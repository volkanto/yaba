import test from "node:test";
import assert from "node:assert/strict";
import {
    buildDefaultConfigTemplate,
    resolveReleaseContext
} from "../bin/services/runtime-config-service.js";

test("buildDefaultConfigTemplate includes nullable release target", () => {
    const template = buildDefaultConfigTemplate();
    assert.equal(template.release.target, null);
    assert.equal(template.release.allowEmpty, false);
    assert.equal(template.release.failOnEmpty, false);
    assert.equal(template.release.maxCommits, null);
    assert.deepEqual(template.notifications.providers, ["slack"]);
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
