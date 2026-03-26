import test from "node:test";
import assert from "node:assert/strict";
import {
    buildDefaultConfigTemplate,
    resolveReleaseContext
} from "../bin/services/runtime-config-service.js";

test("buildDefaultConfigTemplate includes nullable release target", () => {
    const template = buildDefaultConfigTemplate();
    assert.equal(template.release.target, null);
    assert.equal(template.release.tagPattern, "prod_global_{yyyyMMdd}.{HHmm}");
    assert.equal(template.release.tagStrategy, "pattern");
    assert.equal(template.release.tagOnConflict, "increment");
    assert.equal(template.release.tagMaxAttempts, 20);
    assert.equal(template.release.allowEmpty, false);
    assert.equal(template.release.failOnEmpty, false);
    assert.equal(template.release.maxCommits, null);
    assert.deepEqual(template.notifications.providers, ["slack"]);
});

test("buildDefaultConfigTemplate sets noStatusChecks to false", () => {
    const template = buildDefaultConfigTemplate();
    assert.equal(template.release.noStatusChecks, false);
});

test("resolveReleaseContext applies target precedence from options over config", () => {
    const runtimeConfig = buildDefaultConfigTemplate();
    runtimeConfig.release.target = "main";

    const resolved = resolveReleaseContext(
        {
            target: "abc123",
            releaseName: undefined,
            tag: undefined,
            draft: undefined,
            publish: undefined,
            interactive: undefined,
            body: undefined
        },
        runtimeConfig
    );

    assert.equal(resolved.target, "abc123");
});

test("resolveReleaseContext normalizes notification providers from config", () => {
    const runtimeConfig = buildDefaultConfigTemplate();
    runtimeConfig.notifications.providers = ["Slack", "slack", "  "];

    const resolved = resolveReleaseContext(
        {
            target: undefined,
            releaseName: undefined,
            tag: undefined,
            draft: undefined,
            publish: undefined,
            interactive: undefined,
            body: undefined
        },
        runtimeConfig
    );

    assert.deepEqual(resolved.notificationProviders, ["slack"]);
});

test("resolveReleaseContext applies release safety options from flags", () => {
    const runtimeConfig = buildDefaultConfigTemplate();
    runtimeConfig.release.allowEmpty = false;
    runtimeConfig.release.failOnEmpty = false;
    runtimeConfig.release.maxCommits = 40;

    const resolved = resolveReleaseContext(
        {
            target: undefined,
            releaseName: undefined,
            tag: undefined,
            draft: undefined,
            publish: undefined,
            interactive: undefined,
            body: undefined,
            allowEmpty: true,
            failOnEmpty: false,
            maxCommits: 25
        },
        runtimeConfig
    );

    assert.equal(resolved.allowEmpty, true);
    assert.equal(resolved.failOnEmpty, false);
    assert.equal(resolved.maxCommits, 25);
});

test("resolveReleaseContext marks invalid maxCommits as NaN", () => {
    const runtimeConfig = buildDefaultConfigTemplate();
    runtimeConfig.release.maxCommits = "bad";

    const resolved = resolveReleaseContext(
        {
            target: undefined,
            releaseName: undefined,
            tag: undefined,
            draft: undefined,
            publish: undefined,
            interactive: undefined,
            body: undefined,
            allowEmpty: undefined,
            failOnEmpty: undefined,
            maxCommits: undefined
        },
        runtimeConfig
    );

    assert.equal(Number.isNaN(resolved.maxCommits), true);
});

test("resolveReleaseContext defaults noStatusChecks to false", () => {
    const runtimeConfig = buildDefaultConfigTemplate();

    const resolved = resolveReleaseContext(
        {
            target: undefined,
            releaseName: undefined,
            tag: undefined,
            draft: undefined,
            publish: undefined,
            interactive: undefined,
            body: undefined,
            noStatusChecks: undefined
        },
        runtimeConfig
    );

    assert.equal(resolved.noStatusChecks, false);
});

test("resolveReleaseContext reads noStatusChecks from config", () => {
    const runtimeConfig = buildDefaultConfigTemplate();
    runtimeConfig.release.noStatusChecks = true;

    const resolved = resolveReleaseContext(
        {
            target: undefined,
            releaseName: undefined,
            tag: undefined,
            draft: undefined,
            publish: undefined,
            interactive: undefined,
            body: undefined,
            noStatusChecks: undefined
        },
        runtimeConfig
    );

    assert.equal(resolved.noStatusChecks, true);
});

test("resolveReleaseContext flag takes precedence over config for noStatusChecks", () => {
    const runtimeConfig = buildDefaultConfigTemplate();
    runtimeConfig.release.noStatusChecks = false;

    const resolved = resolveReleaseContext(
        {
            target: undefined,
            releaseName: undefined,
            tag: undefined,
            draft: undefined,
            publish: undefined,
            interactive: undefined,
            body: undefined,
            noStatusChecks: true
        },
        runtimeConfig
    );

    assert.equal(resolved.noStatusChecks, true);
});

test("resolveReleaseContext applies tag strategy policy values", () => {
    const runtimeConfig = buildDefaultConfigTemplate();
    runtimeConfig.release.tagStrategy = "pattern";
    runtimeConfig.release.tagOnConflict = "increment";
    runtimeConfig.release.tagMaxAttempts = 15;

    const resolved = resolveReleaseContext(
        {
            tagStrategy: "semver",
            tagOnConflict: "fail",
            tagMaxAttempts: 5,
            target: undefined,
            releaseName: undefined,
            tag: undefined,
            draft: undefined,
            publish: undefined,
            interactive: undefined,
            body: undefined
        },
        runtimeConfig
    );

    assert.equal(resolved.tagStrategy, "semver");
    assert.equal(resolved.tagOnConflict, "fail");
    assert.equal(resolved.tagMaxAttempts, 5);
});
