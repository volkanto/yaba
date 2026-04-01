import test from "node:test";
import assert from "node:assert/strict";
import { buildReleaseNotesBundle } from "../bin/services/release-notes-service.js";

test("buildReleaseNotesBundle groups GitHub notes by PR labels when labels exist", async () => {
    const pullRequestMap = {
        101: { number: 101, title: "add config validate command", labels: ["type:feature"] },
        102: { number: 102, title: "fix release preview fallback", labels: ["type:fix"] },
        103: { number: 103, title: "docs architecture refresh", labels: ["type:docs"] },
        104: { number: 104, title: "bump octokit to latest minor", labels: ["dependencies"] }
    };

    const bundle = await buildReleaseNotesBundle({
        owner: "volkanto",
        repo: "yaba",
        previousTag: "v2.0.2",
        currentTag: "v2.1.0",
        releaseName: "Release v2.1.0",
        preparedChangeLog: "- fallback entry",
        changeLog: [
            "feat(config): add config validate command (#101)",
            "fix(release): fix release preview fallback (#102)",
            "docs: architecture refresh (#103)",
            "chore(deps): bump octokit (#104)"
        ],
        fetchPullRequest: async pullNumber => pullRequestMap[pullNumber]
    });

    assert.equal(bundle.mode, "labels");
    assert.match(bundle.githubReleaseBody, /## Features/);
    assert.match(bundle.githubReleaseBody, /#101 add config validate command/);
    assert.match(bundle.githubReleaseBody, /## Fixes/);
    assert.match(bundle.githubReleaseBody, /#102 fix release preview fallback/);
    assert.match(bundle.githubReleaseBody, /## Dependencies/);
    assert.match(bundle.githubReleaseBody, /#104 bump octokit to latest minor/);
    assert.match(bundle.githubReleaseBody, /## Documentation/);
    assert.match(bundle.githubReleaseBody, /#103 docs architecture refresh/);
    assert.doesNotMatch(bundle.githubReleaseBody, /## Breaking Changes/);
    assert.doesNotMatch(bundle.githubReleaseBody, /## Internal/);
    assert.match(bundle.compareUrl, /v2\.0\.2\.\.\.v2\.1\.0/);
});

test("buildReleaseNotesBundle omits empty grouped sections", async () => {
    const bundle = await buildReleaseNotesBundle({
        owner: "volkanto",
        repo: "yaba",
        previousTag: "v2.0.2",
        currentTag: "v2.1.0",
        releaseName: "Release v2.1.0",
        preparedChangeLog: "- fallback entry",
        changeLog: [
            "feat(config): add runtime profile command (#301)"
        ],
        fetchPullRequest: async pullNumber => {
            return {
                number: pullNumber,
                title: "add runtime profile command",
                labels: ["type:feature"]
            };
        }
    });

    assert.equal(bundle.mode, "labels");
    assert.match(bundle.githubReleaseBody, /## Features/);
    assert.match(bundle.githubReleaseBody, /#301 add runtime profile command/);
    assert.doesNotMatch(bundle.githubReleaseBody, /## Fixes/);
    assert.doesNotMatch(bundle.githubReleaseBody, /## Dependencies/);
    assert.doesNotMatch(bundle.githubReleaseBody, /## Documentation/);
});

test("buildReleaseNotesBundle falls back to legacy changelog when labels are missing", async () => {
    const bundle = await buildReleaseNotesBundle({
        owner: "volkanto",
        repo: "yaba",
        previousTag: "v2.0.2",
        currentTag: "v2.1.0",
        releaseName: "Release v2.1.0",
        preparedChangeLog: "- feat: modularize runtime\n- fix: improve safety checks",
        changeLog: [
            "feat(cli): modularize runtime (#201)",
            "fix(release): improve safety checks (#202)"
        ],
        fetchPullRequest: async pullNumber => {
            return {
                number: pullNumber,
                title: `Pull Request ${pullNumber}`,
                labels: []
            };
        }
    });

    assert.equal(bundle.mode, "fallback");
    assert.match(bundle.githubReleaseBody, /## What's Changed/);
    assert.match(bundle.githubReleaseBody, /- feat: modularize runtime/);
    assert.match(bundle.slackNewsletterBody, /\*What shipped\*/);
    assert.match(bundle.slackNewsletterBody, /Compare changes:/);
});

test("buildReleaseNotesBundle routes PRs with no labels to Unlabelled section", async () => {
    const bundle = await buildReleaseNotesBundle({
        owner: "volkanto",
        repo: "yaba",
        previousTag: "v2.0.2",
        currentTag: "v2.1.0",
        releaseName: "Release v2.1.0",
        preparedChangeLog: "",
        changeLog: [
            "feat: add feature (#101)",
            "chore: internal cleanup (#102)"
        ],
        fetchPullRequest: async pullNumber => ({
            101: { number: 101, title: "add feature", labels: ["type:feature"] },
            102: { number: 102, title: "internal cleanup", labels: [] }
        }[pullNumber])
    });

    assert.equal(bundle.mode, "labels");
    assert.match(bundle.githubReleaseBody, /## Unlabelled/);
    assert.match(bundle.githubReleaseBody, /#102 internal cleanup/);
    assert.doesNotMatch(bundle.githubReleaseBody, /## Internal/);
    assert.match(bundle.slackNewsletterBody, /\*Unlabelled\*/);
    assert.match(bundle.slackNewsletterBody, /#102 internal cleanup/);
});

test("buildReleaseNotesBundle routes non-matching labelled PRs to Unlabelled when custom labelBuckets are configured", async () => {
    const bundle = await buildReleaseNotesBundle({
        owner: "volkanto",
        repo: "yaba",
        previousTag: "v2.0.2",
        currentTag: "v2.1.0",
        releaseName: "Release v2.1.0",
        preparedChangeLog: "",
        changeLog: [
            "feat: new thing (#101)",
            "chore: some work (#102)"
        ],
        fetchPullRequest: async pullNumber => ({
            101: { number: 101, title: "new thing", labels: ["custom-feature"] },
            102: { number: 102, title: "some work", labels: ["unrecognised-label"] }
        }[pullNumber]),
        labelBuckets: [
            { key: "customFeatures", title: "Custom Features", labels: ["custom-feature"] }
        ]
    });

    assert.equal(bundle.mode, "labels");
    assert.match(bundle.githubReleaseBody, /## Custom Features/);
    assert.match(bundle.githubReleaseBody, /#101 new thing/);
    assert.match(bundle.githubReleaseBody, /## Unlabelled/);
    assert.match(bundle.githubReleaseBody, /#102 some work/);
    assert.doesNotMatch(bundle.githubReleaseBody, /## Internal/);
});

test("buildReleaseNotesBundle routes non-matching labelled PRs to Internal when using default config", async () => {
    const bundle = await buildReleaseNotesBundle({
        owner: "volkanto",
        repo: "yaba",
        previousTag: "v2.0.2",
        currentTag: "v2.1.0",
        releaseName: "Release v2.1.0",
        preparedChangeLog: "",
        changeLog: [
            "feat: new thing (#101)",
            "chore: some work (#102)"
        ],
        fetchPullRequest: async pullNumber => ({
            101: { number: 101, title: "new thing", labels: ["feature"] },
            102: { number: 102, title: "some work", labels: ["unrecognised-label"] }
        }[pullNumber])
    });

    assert.equal(bundle.mode, "labels");
    assert.match(bundle.githubReleaseBody, /## Features/);
    assert.match(bundle.githubReleaseBody, /#101 new thing/);
    assert.match(bundle.githubReleaseBody, /## Internal/);
    assert.match(bundle.githubReleaseBody, /#102 some work/);
    assert.doesNotMatch(bundle.githubReleaseBody, /## Unlabelled/);
});

test("buildReleaseNotesBundle slack newsletter groups PRs into bold sections ordered by priority", async () => {
    const bundle = await buildReleaseNotesBundle({
        owner: "volkanto",
        repo: "yaba",
        previousTag: "v2.0.2",
        currentTag: "v2.1.0",
        releaseName: "Release v2.1.0",
        preparedChangeLog: "",
        changeLog: [
            "chore: bump deps (#101)",
            "feat: new endpoint (#102)",
            "fix: crash on startup (#103)"
        ],
        fetchPullRequest: async pullNumber => ({
            101: { number: 101, title: "bump deps", labels: ["dependencies"] },
            102: { number: 102, title: "new endpoint", labels: ["feature"] },
            103: { number: 103, title: "crash on startup", labels: ["fix"] }
        }[pullNumber])
    });

    assert.match(bundle.slackNewsletterBody, /\*Features\*/);
    assert.match(bundle.slackNewsletterBody, /\*Fixes\*/);
    assert.match(bundle.slackNewsletterBody, /\*Dependencies\*/);

    const featuresPos = bundle.slackNewsletterBody.indexOf("*Features*");
    const fixesPos = bundle.slackNewsletterBody.indexOf("*Fixes*");
    const depsPos = bundle.slackNewsletterBody.indexOf("*Dependencies*");
    assert.ok(featuresPos < fixesPos, "Features should appear before Fixes");
    assert.ok(fixesPos < depsPos, "Fixes should appear before Dependencies");
});

test("buildReleaseNotesBundle slack newsletter Why it matters detects features by bucket label not key name", async () => {
    const bundle = await buildReleaseNotesBundle({
        owner: "volkanto",
        repo: "yaba",
        previousTag: "v2.0.2",
        currentTag: "v2.1.0",
        releaseName: "Release v2.1.0",
        preparedChangeLog: "",
        changeLog: ["feat: new capability (#101)"],
        fetchPullRequest: async () => ({ number: 101, title: "new capability", labels: ["feat"] }),
        labelBuckets: [
            { key: "enhancements", title: "Enhancements", labels: ["feat", "feature"] }
        ]
    });

    assert.match(bundle.slackNewsletterBody, /Developer workflows gain new capabilities/);
    assert.doesNotMatch(bundle.slackNewsletterBody, /Release stability and maintainability/);
});

test("buildReleaseNotesBundle slack newsletter Action required detects breaking changes by bucket label not key name", async () => {
    const bundle = await buildReleaseNotesBundle({
        owner: "volkanto",
        repo: "yaba",
        previousTag: "v2.0.2",
        currentTag: "v2.1.0",
        releaseName: "Release v2.1.0",
        preparedChangeLog: "",
        changeLog: ["feat!: rename API (#101)"],
        fetchPullRequest: async () => ({ number: 101, title: "rename API", labels: ["semver:major"] }),
        labelBuckets: [
            { key: "majors", title: "Major Changes", labels: ["semver:major"] }
        ]
    });

    assert.match(bundle.slackNewsletterBody, /Review the breaking changes/);
    assert.doesNotMatch(bundle.slackNewsletterBody, /No mandatory migration/);
});

test("buildReleaseNotesBundle slack newsletter shows no-action message when no breaking changes exist", async () => {
    const bundle = await buildReleaseNotesBundle({
        owner: "volkanto",
        repo: "yaba",
        previousTag: "v2.0.2",
        currentTag: "v2.1.0",
        releaseName: "Release v2.1.0",
        preparedChangeLog: "",
        changeLog: ["feat: safe change (#101)"],
        fetchPullRequest: async () => ({ number: 101, title: "safe change", labels: ["feature"] })
    });

    assert.match(bundle.slackNewsletterBody, /No mandatory migration action required/);
    assert.doesNotMatch(bundle.slackNewsletterBody, /Review the breaking changes/);
});
