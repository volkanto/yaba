import test from "node:test";
import assert from "node:assert/strict";
import { validateRuntimeConfigSchema } from "../bin/services/config-validation-service.js";
import { buildDefaultConfigTemplate } from "../bin/services/runtime-config-service.js";

test("validateRuntimeConfigSchema returns no issues for default template", () => {
    const config = buildDefaultConfigTemplate();
    const issues = validateRuntimeConfigSchema(config, ["slack"]);
    assert.deepEqual(issues, []);
});

test("validateRuntimeConfigSchema reports invalid boolean and integer fields", () => {
    const config = buildDefaultConfigTemplate();
    config.release.draft = "true";
    config.release.firstReleaseMaxCommits = 0;

    const issues = validateRuntimeConfigSchema(config, ["slack"]);
    assert.ok(issues.some(item => item.includes("release.draft")));
    assert.ok(issues.some(item => item.includes("release.firstReleaseMaxCommits")));
});

test("validateRuntimeConfigSchema reports unsupported notification provider", () => {
    const config = buildDefaultConfigTemplate();
    config.notifications.providers = ["slack", "discord"];

    const issues = validateRuntimeConfigSchema(config, ["slack"]);
    assert.ok(issues.some(item => item.includes("unsupported provider")));
});
