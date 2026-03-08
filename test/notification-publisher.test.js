import test from "node:test";
import assert from "node:assert/strict";
import { publishReleaseNotifications, resolveProviderNames } from "../bin/notifications/publisher.js";

test("resolveProviderNames falls back to slack when unset", () => {
    assert.deepEqual(resolveProviderNames(undefined), ["slack"]);
});

test("resolveProviderNames normalizes and de-duplicates provider names", () => {
    assert.deepEqual(resolveProviderNames(["Slack", "slack", "  "]), ["slack"]);
});

test("publishReleaseNotifications skips provider calls when publish is false", async () => {
    let called = false;

    const result = await publishReleaseNotifications(
        {
            publish: false,
            providerNames: ["slack"],
            context: {}
        },
        {
            slack: {
                name: "slack",
                async publish() {
                    called = true;
                }
            }
        }
    );

    assert.equal(called, false);
    assert.equal(result.published, false);
    assert.deepEqual(result.providers, []);
});

test("publishReleaseNotifications throws validation error for unsupported provider", async () => {
    await assert.rejects(
        publishReleaseNotifications(
            {
                publish: true,
                providerNames: ["unknown-provider"],
                context: {}
            },
            {}
        ),
        error => {
            assert.equal(error.exitCode, 1);
            assert.match(error.message, /Unsupported notification provider/);
            return true;
        }
    );
});

test("publishReleaseNotifications executes all configured providers", async () => {
    const calls = [];

    const result = await publishReleaseNotifications(
        {
            publish: true,
            providerNames: ["slack", "audit"],
            context: {
                repo: "yaba",
                releaseName: "v2.1.0",
                changelog: "- added",
                releaseUrl: "https://example.test/release"
            }
        },
        {
            slack: {
                name: "slack",
                async publish(context) {
                    calls.push(`slack:${context.repo}`);
                }
            },
            audit: {
                name: "audit",
                async publish(context) {
                    calls.push(`audit:${context.releaseName}`);
                }
            }
        }
    );

    assert.equal(result.published, true);
    assert.deepEqual(result.providers, ["slack", "audit"]);
    assert.deepEqual(calls, ["slack:yaba", "audit:v2.1.0"]);
});
