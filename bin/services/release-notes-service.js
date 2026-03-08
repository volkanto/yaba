import * as templateUtils from "../utils/template-utils.js";

const labelBuckets = [
    {
        key: "breakingChanges",
        labels: ["breaking", "type:breaking", "semver:major"]
    },
    {
        key: "features",
        labels: ["feature", "enhancement", "type:feature", "feat"]
    },
    {
        key: "fixes",
        labels: ["fix", "bug", "bugfix", "type:fix"]
    },
    {
        key: "dependencies",
        labels: ["dependencies", "dependency", "deps", "type:dependencies", "type:deps", "renovate"]
    },
    {
        key: "documentation",
        labels: ["docs", "documentation", "type:docs"]
    }
];

export async function buildReleaseNotesBundle({
    owner,
    repo,
    previousTag,
    currentTag,
    releaseName,
    preparedChangeLog,
    changeLog,
    fetchPullRequest
}) {
    const compareUrl = buildCompareUrl(owner, repo, previousTag, currentTag);
    const commitEntries = normalizeCommitEntries(changeLog);
    const pullRequestNumbers = extractPullRequestNumbers(commitEntries);
    const pullRequests = await resolvePullRequests(pullRequestNumbers, fetchPullRequest);
    const hasLabels = pullRequests.some(item => item.labels.length > 0);

    let githubReleaseBody;
    let mode;
    let grouped = null;

    if (hasLabels) {
        grouped = groupPullRequestsByLabels(pullRequests);
        githubReleaseBody = templateUtils.generateGroupedGithubReleaseNotes(
            owner,
            repo,
            previousTag,
            currentTag,
            {
                highlights: renderHighlights(grouped),
                breakingChangesSection: renderSection("Breaking Changes", grouped.breakingChanges),
                featuresSection: renderSection("Features", grouped.features),
                fixesSection: renderSection("Fixes", grouped.fixes),
                dependenciesSection: renderSection("Dependencies", grouped.dependencies),
                documentationSection: renderSection("Documentation", grouped.documentation),
                internalSection: renderSection("Internal", grouped.internal)
            }
        );
        mode = "labels";
    } else {
        githubReleaseBody = templateUtils.generateChangelog(
            preparedChangeLog,
            owner,
            repo,
            previousTag,
            currentTag
        );
        mode = "fallback";
    }

    return {
        mode: mode,
        compareUrl: compareUrl,
        githubReleaseBody: githubReleaseBody,
        slackNewsletterBody: buildSlackNewsletter({
            releaseName: releaseName,
            compareUrl: compareUrl,
            grouped: grouped,
            commitEntries: commitEntries
        })
    };
}

function buildCompareUrl(owner, repo, previousTag, currentTag) {
    return `https://github.com/${owner}/${repo}/compare/${previousTag}...${currentTag}`;
}

function normalizeCommitEntries(changeLog) {
    if (!Array.isArray(changeLog)) {
        return [];
    }

    return changeLog
        .map(item => `${item || ""}`.split("\n")[0].trim())
        .filter(item => item.length > 0);
}

function extractPullRequestNumbers(commitEntries) {
    const ids = new Set();
    for (const commitEntry of commitEntries) {
        const matches = commitEntry.match(/\(#(\d+)\)/g) || [];
        for (const match of matches) {
            const parsed = Number(match.replace(/\D/g, ""));
            if (Number.isInteger(parsed) && parsed > 0) {
                ids.add(parsed);
            }
        }
    }
    return [...ids];
}

async function resolvePullRequests(pullRequestNumbers, fetchPullRequest) {
    if (pullRequestNumbers.length === 0 || typeof fetchPullRequest !== "function") {
        return [];
    }

    const results = await Promise.all(pullRequestNumbers.map(async number => {
        try {
            const item = await fetchPullRequest(number);
            if (!item || typeof item.number !== "number") {
                return null;
            }

            return {
                number: item.number,
                title: `${item.title || `Pull Request #${item.number}`}`.trim(),
                labels: Array.isArray(item.labels)
                    ? item.labels
                        .map(label => `${label || ""}`.trim().toLowerCase())
                        .filter(Boolean)
                    : []
            };
        } catch (error) {
            return null;
        }
    }));

    return results.filter(Boolean);
}

function groupPullRequestsByLabels(pullRequests) {
    const grouped = {
        breakingChanges: [],
        features: [],
        fixes: [],
        dependencies: [],
        documentation: [],
        internal: []
    };

    for (const pullRequest of pullRequests) {
        const bucket = resolveBucket(pullRequest.labels);
        grouped[bucket].push(pullRequest);
    }

    return grouped;
}

function resolveBucket(labels) {
    for (const bucket of labelBuckets) {
        if (labels.some(label => bucket.labels.includes(label))) {
            return bucket.key;
        }
    }

    return "internal";
}

function renderPullRequestList(items) {
    return items
        .map(item => `- #${item.number} ${item.title}`)
        .join("\n");
}

function renderSection(title, items) {
    if (!Array.isArray(items) || items.length === 0) {
        return "";
    }

    return `## ${title}\n\n${renderPullRequestList(items)}\n`;
}

function renderHighlights(grouped) {
    const highlights = [];

    if (grouped.breakingChanges.length > 0) {
        highlights.push(`- ${grouped.breakingChanges.length} breaking change update(s) in this release.`);
    }
    if (grouped.features.length > 0) {
        highlights.push(`- ${grouped.features.length} feature enhancement(s) added.`);
    }
    if (grouped.fixes.length > 0) {
        highlights.push(`- ${grouped.fixes.length} fix(es) included for stability.`);
    }
    if (grouped.dependencies.length > 0) {
        highlights.push(`- ${grouped.dependencies.length} dependency update(s) included.`);
    }
    if (highlights.length === 0) {
        highlights.push("- Maintenance and internal improvements included.");
    }

    return highlights.join("\n");
}

function buildSlackNewsletter({ releaseName, compareUrl, grouped, commitEntries }) {
    const shipped = grouped
        ? buildShippedFromPullRequests(grouped)
        : buildShippedFromCommits(commitEntries);

    const whyMatters = grouped && grouped.features.length > 0
        ? "- Developer workflows gain new capabilities.\n- Release safety and validation behavior are stronger."
        : "- Release stability and maintainability improvements are included.";

    const actionRequired = grouped && grouped.breakingChanges.length > 0
        ? "- Review the breaking changes section in GitHub release notes."
        : "- No mandatory migration action required.";

    return [
        `*${releaseName} newsletter*`,
        "",
        "*What shipped*",
        shipped,
        "",
        "*Why it matters*",
        whyMatters,
        "",
        "*Action required*",
        actionRequired,
        "",
        "*Links*",
        `- Compare changes: ${compareUrl}`
    ].join("\n");
}

function buildShippedFromPullRequests(grouped) {
    const ordered = [
        ...grouped.features,
        ...grouped.fixes,
        ...grouped.dependencies,
        ...grouped.documentation,
        ...grouped.internal
    ].slice(0, 5);

    if (ordered.length === 0) {
        return "- Maintenance updates in this release.";
    }

    return ordered.map(item => `- #${item.number} ${item.title}`).join("\n");
}

function buildShippedFromCommits(commitEntries) {
    const items = commitEntries.slice(0, 5);
    if (items.length === 0) {
        return "- No commit details available.";
    }

    return items.map(item => `- ${item}`).join("\n");
}
