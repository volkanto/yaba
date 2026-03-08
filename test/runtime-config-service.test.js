import test from "node:test";
import assert from "node:assert/strict";
import {
    buildDefaultConfigTemplate,
    resolveReleaseContext
} from "../bin/services/runtime-config-service.js";

test("buildDefaultConfigTemplate includes nullable release target", () => {
    const template = buildDefaultConfigTemplate();
    assert.equal(template.release.target, null);
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
