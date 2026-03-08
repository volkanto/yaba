import test from "node:test";
import assert from "node:assert/strict";
import { runCli } from "../../test-utils/cli-helpers.js";

test("doctor command returns machine-readable payload in JSON mode", () => {
    const result = runCli(["doctor", "--format", "json"], {
        YABA_GITHUB_ACCESS_TOKEN: ""
    });

    assert.equal(result.stdout.trim().length > 0, true);
    const payload = JSON.parse(result.stdout.trim());
    assert.equal(payload.command, "doctor");
    assert.ok(payload.status === "success" || payload.status === "failure");
    assert.equal(Array.isArray(payload.checks), true);
    assert.equal(typeof payload.exitCode, "number");
});
