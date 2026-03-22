import test from "node:test";
import assert from "node:assert/strict";
import { resolveReleaseTag } from "../bin/services/tag-resolution-service.js";

test("resolveReleaseTag renders pattern strategy in UTC", async () => {
    const resolved = await resolveReleaseTag({
        explicitTag: undefined,
        tagStrategy: "pattern",
        tagPattern: "prod_global_{yyyyMMdd}.{HHmm}",
        now: new Date("2026-03-08T14:23:45.000Z"),
        tagExists: async () => false
    });

    assert.equal(resolved, "prod_global_20260308.1423");
});

test("resolveReleaseTag supports semver strategy", async () => {
    const resolved = await resolveReleaseTag({
        tagStrategy: "semver",
        packageVersion: "2.1.0",
        tagExists: async () => false
    });

    assert.equal(resolved, "v2.1.0");
});

test("resolveReleaseTag supports sha strategy", async () => {
    const resolved = await resolveReleaseTag({
        tagStrategy: "sha",
        targetCommitish: "a1b2c3d4e5f67890123456789abcdef01234567",
        tagExists: async () => false
    });

    assert.equal(resolved, "sha-a1b2c3d4e5f6");
});

test("resolveReleaseTag applies conflict fail policy", async () => {
    await assert.rejects(
        async () => {
            await resolveReleaseTag({
                tagStrategy: "pattern",
                tagPattern: "prod_global_{yyyyMMdd}.{HHmm}",
                now: new Date("2026-03-08T14:23:45.000Z"),
                tagOnConflict: "fail",
                tagExists: async () => true
            });
        },
        /already exists/i
    );
});

test("resolveReleaseTag promotes minute precision to second precision on conflict", async () => {
    const resolved = await resolveReleaseTag({
        tagStrategy: "pattern",
        tagPattern: "prod_global_{yyyyMMdd}.{HHmm}",
        now: new Date("2026-03-08T14:23:45.000Z"),
        tagExists: async tagName => {
            return tagName === "prod_global_20260308.1423";
        }
    });

    assert.equal(resolved, "prod_global_20260308.142345");
});

test("resolveReleaseTag increments suffix when promoted tag still exists", async () => {
    const resolved = await resolveReleaseTag({
        tagStrategy: "pattern",
        tagPattern: "prod_global_{yyyyMMdd}.{HHmm}",
        now: new Date("2026-03-08T14:23:45.000Z"),
        tagExists: async tagName => {
            return [
                "prod_global_20260308.1423",
                "prod_global_20260308.142345"
            ].includes(tagName);
        }
    });

    assert.equal(resolved, "prod_global_20260308.142345.1");
});

test("resolveReleaseTag promotes minute-precision hotfix_prod_global tag to second precision on conflict", async () => {
    const resolved = await resolveReleaseTag({
        tagStrategy: "pattern",
        tagPattern: "hotfix_prod_global_{yyyyMMdd}.{HHmm}",
        now: new Date("2026-03-22T09:15:47.000Z"),
        tagExists: async tagName => tagName === "hotfix_prod_global_20260322.0915"
    });

    assert.equal(resolved, "hotfix_prod_global_20260322.091547");
});

test("resolveReleaseTag throws when tagExists is not provided", async () => {
    await assert.rejects(
        async () => {
            await resolveReleaseTag({
                tagStrategy: "pattern",
                tagPattern: "prod_global_{yyyyMMdd}.{HHmm}",
                now: new Date("2026-03-08T14:23:45.000Z")
            });
        },
        /tagExists callback is required/i
    );
});

test("resolveReleaseTag fills shortSha, branch and runNumber pattern tokens", async () => {
    const resolved = await resolveReleaseTag({
        tagStrategy: "pattern",
        tagPattern: "build-{shortSha}-{branch}-{runNumber}",
        targetCommitish: "abcdef1234567890abcdef1234567890abcdef12",
        targetReference: "release/2.1.0",
        env: { GITHUB_RUN_NUMBER: "57" },
        tagExists: async () => false
    });

    assert.equal(resolved, "build-abcdef123456-release-2.1.0-57");
});
