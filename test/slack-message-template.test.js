import test from "node:test";
import assert from "node:assert/strict";
import { prepareSlackMessage } from "../bin/utils/helper.js";

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("prepareSlackMessage injects newsletter content and compare link", () => {
    const payload = prepareSlackMessage(
        "yaba",
        "*What shipped*\n- Added config validation",
        "https://github.com/volkanto/yaba/releases/tag/v2.1.0",
        "Release v2.1.0",
        "https://github.com/volkanto/yaba/compare/v2.0.2...v2.1.0"
    );

    assert.match(payload.text, /Release v2\.1\.0/);
    const newsletterSection = payload.blocks.find(item => item.type === "section");
    assert.ok(newsletterSection);
    assert.match(newsletterSection.text.text, /\*What shipped\*/);

    const linkContext = payload.blocks.find(item => item.type === "context");
    assert.ok(linkContext);
    assert.match(linkContext.elements[0].text, /compare\/v2\.0\.2\.\.\.v2\.1\.0/);
});

test("prepareSlackMessage falls back compare link to release URL when compare URL is missing", () => {
    const releaseUrl = "https://github.com/volkanto/yaba/releases/tag/v2.1.0";
    const payload = prepareSlackMessage(
        "yaba",
        "*What shipped*\n- Internal improvements",
        releaseUrl,
        "Release v2.1.0"
    );

    const linkContext = payload.blocks.find(item => item.type === "context");
    assert.ok(linkContext);
    assert.match(linkContext.elements[0].text, /Release Notes/);
    assert.match(linkContext.elements[0].text, new RegExp(escapeRegExp(releaseUrl)));
});
