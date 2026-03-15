import * as templateUtils from "../utils/template-utils.js";

const DEFAULT_LABEL_BUCKETS = [
    {
        key: "breakingChanges",
        title: "Breaking Changes",
        labels: ["breaking", "type:breaking", "semver:major"]
    },
    {
        key: "features",
        title: "Features",
        labels: ["feature", "enhancement", "type:feature", "feat"]
    },
    {
        key: "fixes",
        title: "Fixes",
        labels: ["fix", "bug", "bugfix", "type:fix"]
    },
    {
        key: "dependencies",
        title: "Dependencies",
        labels: ["dependencies", "dependency", "deps", "type:dependencies", "type:deps", "renovate"]
    },
    {
        key: "documentation",
        title: "Documentation",
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
    fetchPullRequest,
    labelBuckets
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
        const activeBuckets = Array.isArray(labelBuckets) && labelBuckets.length > 0
            ? labelBuckets
            : DEFAULT_LABEL_BUCKETS;

        grouped = groupPullRequestsByLabels(pullRequests, activeBuckets);

        const sectionsStr = [
            ...activeBuckets.map(bucket => renderSection(resolveSectionTitle(bucket), grouped[bucket.key])),
            renderSection("Internal", grouped.internal)
        ].filter(Boolean).join("\n");

        githubReleaseBody = templateUtils.generateGroupedGithubReleaseNotes(
            owner,
            repo,
            previousTag,
            currentTag,
            {
                highlights: renderHighlights(grouped, activeBuckets),
                sections: sectionsStr
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
            commitEntries: commitEntries,
            activeBuckets: Array.isArray(labelBuckets) && labelBuckets.length > 0 ? labelBuckets : DEFAULT_LABEL_BUCKETS
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

function groupPullRequestsByLabels(pullRequests, activeBuckets) {
    const grouped = { internal: [] };
    for (const bucket of activeBuckets) {
        grouped[bucket.key] = [];
    }

    for (const pullRequest of pullRequests) {
        const bucket = resolveBucket(pullRequest.labels, activeBuckets);
        grouped[bucket].push(pullRequest);
    }

    return grouped;
}

function resolveBucket(labels, activeBuckets) {
    for (const bucket of activeBuckets) {
        if (labels.some(label => bucket.labels.includes(label))) {
            return bucket.key;
        }
    }

    return "internal";
}

function resolveSectionTitle(bucket) {
    return bucket.title
        ?? bucket.key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase());
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

function renderHighlights(grouped, activeBuckets) {
    const highlights = [];
    const find = key => activeBuckets.find(b => b.key === key);

    const breaking = find("breakingChanges");
    const features = find("features");
    const fixes = find("fixes");
    const deps = find("dependencies");

    if (breaking && grouped[breaking.key]?.length > 0) {
        highlights.push(`- ${grouped[breaking.key].length} breaking change update(s) in this release.`);
    }
    if (features && grouped[features.key]?.length > 0) {
        highlights.push(`- ${grouped[features.key].length} feature enhancement(s) added.`);
    }
    if (fixes && grouped[fixes.key]?.length > 0) {
        highlights.push(`- ${grouped[fixes.key].length} fix(es) included for stability.`);
    }
    if (deps && grouped[deps.key]?.length > 0) {
        highlights.push(`- ${grouped[deps.key].length} dependency update(s) included.`);
    }
    if (highlights.length === 0) {
        highlights.push("- Maintenance and internal improvements included.");
    }

    return highlights.join("\n");
}

function buildSlackNewsletter({ releaseName, compareUrl, grouped, commitEntries, activeBuckets }) {
    const shipped = grouped
        ? buildShippedFromPullRequests(grouped, activeBuckets)
        : buildShippedFromCommits(commitEntries);

    const findFeatures = activeBuckets.find(b => b.key === "features");
    const findBreaking = activeBuckets.find(b => b.key === "breakingChanges");

    const whyMatters = grouped && findFeatures && grouped[findFeatures.key]?.length > 0
        ? "- Developer workflows gain new capabilities.\n- Release safety and validation behavior are stronger."
        : "- Release stability and maintainability improvements are included.";

    const actionRequired = grouped && findBreaking && grouped[findBreaking.key]?.length > 0
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

function buildShippedFromPullRequests(grouped, activeBuckets) {
    const ordered = activeBuckets
        .flatMap(bucket => grouped[bucket.key] ?? [])
        .concat(grouped.internal ?? [])
        .slice(0, 5);

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
