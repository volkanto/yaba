import test from "node:test";
import assert from "node:assert/strict";
import { promoteTagPrecisionToSeconds, releaseTagName } from "../bin/utils/helper.js";

test("releaseTagName defaults to minute-precision prod_global format", () => {
    const tag = releaseTagName(undefined);
    assert.match(tag, /^prod_global_\d{8}\.\d{4}$/);
});

test("promoteTagPrecisionToSeconds upgrades minute-precision prod_global tags", () => {
    const fallbackTag = promoteTagPrecisionToSeconds(
        "prod_global_20260308.1423",
        new Date("2026-03-08T14:23:59")
    );

    assert.equal(fallbackTag, "prod_global_20260308.142359");
});

test("promoteTagPrecisionToSeconds returns null for non-matching tags", () => {
    assert.equal(promoteTagPrecisionToSeconds("v2.1.0"), null);
    assert.equal(promoteTagPrecisionToSeconds("prod_global_20260308.142359"), null);
});

test("promoteTagPrecisionToSeconds upgrades minute-precision hotfix_prod_global tags", () => {
    const fallbackTag = promoteTagPrecisionToSeconds(
        "hotfix_prod_global_20260322.0915",
        new Date("2026-03-22T09:15:47")
    );
    assert.equal(fallbackTag, "hotfix_prod_global_20260322.091547");
});

test("promoteTagPrecisionToSeconds returns null for already-second-precision hotfix tags", () => {
    assert.equal(promoteTagPrecisionToSeconds("hotfix_prod_global_20260322.091547"), null);
});
