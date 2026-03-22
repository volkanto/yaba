import test from "node:test";
import assert from "node:assert/strict";
import { runCli } from "../../test-utils/cli-helpers.js";

test("release preview returns JSON validation error when token is missing", () => {
    const result = runCli(
        ["release", "preview", "--repo", "yaba", "--owner", "volkanto", "--format", "json"],
        { YABA_GITHUB_ACCESS_TOKEN: "" }
    );

    assert.equal(result.status, 1);
    const payload = JSON.parse(result.stderr.trim());
    assert.equal(payload.status, "error");
    assert.equal(payload.exitCode, 1);
    assert.match(payload.message, /required env variables/i);
});

test("release create returns JSON validation error when token is missing", () => {
    const result = runCli(
        ["release", "create", "--repo", "yaba", "--owner", "volkanto", "--format", "json", "--no-prompt"],
        { YABA_GITHUB_ACCESS_TOKEN: "" }
    );

    assert.equal(result.status, 1);
    const payload = JSON.parse(result.stderr.trim());
    assert.equal(payload.status, "error");
    assert.equal(payload.exitCode, 1);
    assert.match(payload.message, /required env variables/i);
});

test("release hotfix returns JSON validation error when token is missing", () => {
    const result = runCli(
        ["release", "hotfix", "--repo", "yaba", "--owner", "volkanto", "--format", "json"],
        { YABA_GITHUB_ACCESS_TOKEN: "" }
    );

    assert.equal(result.status, 1);
    const payload = JSON.parse(result.stderr.trim());
    assert.equal(payload.status, "error");
    assert.equal(payload.exitCode, 1);
    assert.match(payload.message, /required env variables/i);
});

test("release list returns JSON validation error when token is missing", () => {
    const result = runCli(
        ["release", "list", "--repo", "yaba", "--owner", "volkanto", "--format", "json"],
        { YABA_GITHUB_ACCESS_TOKEN: "" }
    );

    assert.equal(result.status, 1);
    const payload = JSON.parse(result.stderr.trim());
    assert.equal(payload.status, "error");
    assert.equal(payload.exitCode, 1);
    assert.match(payload.message, /required env variables/i);
});
