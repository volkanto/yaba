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

test("prepareSlackMessage keeps a 3000-character newsletter in one section", () => {
    const payload = prepareSlackMessage(
        "yaba",
        "x".repeat(3000),
        "https://example.com/release",
        "Release v2.1.0",
        "https://example.com/compare"
    );

    const sections = payload.blocks.filter(item => item.type === "section");
    assert.equal(sections.length, 1);
    assert.equal(Array.from(sections[0].text.text).length, 3000);
});

test("prepareSlackMessage splits newsletters over 3000 characters on line boundaries", () => {
    const firstLine = "x".repeat(2995);
    const payload = prepareSlackMessage(
        "yaba",
        `${firstLine}\nsecond line`,
        "https://example.com/release",
        "Release v2.1.0",
        "https://example.com/compare"
    );

    const sections = payload.blocks.filter(item => item.type === "section");
    assert.equal(sections.length, 2);
    assert.equal(sections[0].text.text, firstLine);
    assert.equal(sections[1].text.text, "second line");
    assert.ok(sections.every(item => Array.from(item.text.text).length <= 3000));
});

test("prepareSlackMessage splits an individual line over 3000 characters", () => {
    const payload = prepareSlackMessage(
        "yaba",
        "🚀".repeat(3001),
        "https://example.com/release",
        "Release v2.1.0",
        "https://example.com/compare"
    );

    const sections = payload.blocks.filter(item => item.type === "section");
    assert.deepEqual(
        sections.map(item => Array.from(item.text.text).length),
        [3000, 1]
    );
});

test("prepareSlackMessage truncates headers to Slack's 150-character limit", () => {
    const payload = prepareSlackMessage(
        "repository",
        "Release notes",
        "https://example.com/release",
        "🚀".repeat(160),
        "https://example.com/compare"
    );

    const header = payload.blocks.find(item => item.type === "header");
    assert.equal(Array.from(header.text.text).length, 150);
    assert.match(header.text.text, /…$/);
});

test("prepareSlackMessage does not add an ellipsis to headers within Slack's limit", () => {
    const payload = prepareSlackMessage(
        "yaba",
        "Release notes",
        "https://example.com/release",
        "Release v2.1.0",
        "https://example.com/compare"
    );

    const header = payload.blocks.find(item => item.type === "header");
    assert.doesNotMatch(header.text.text, /…$/);
});
