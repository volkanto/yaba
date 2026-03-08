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
