import test from "node:test";
import assert from "node:assert/strict";
import {
    enforceReleaseSafety,
    shouldCreateRelease,
    shouldShowChangelog
} from "../bin/services/release-safety-service.js";

test("shouldCreateRelease allows empty changelog when allowEmpty is enabled", () => {
    assert.equal(shouldCreateRelease(0, false, true), true);
    assert.equal(shouldCreateRelease(0, false, false), false);
});

test("shouldShowChangelog allows empty changelog only with allowEmpty", () => {
    assert.equal(shouldShowChangelog(0, true, true), true);
    assert.equal(shouldShowChangelog(0, true, false), false);
});

test("enforceReleaseSafety rejects conflicting allowEmpty/failOnEmpty flags", () => {
    assert.throws(
        () => enforceReleaseSafety(0, {
            allowEmpty: true,
            failOnEmpty: true,
            maxCommits: undefined
        }),
        error => {
            assert.equal(error.exitCode, 1);
            assert.match(error.message, /cannot be enabled together/);
            return true;
        }
    );
});

test("enforceReleaseSafety rejects invalid maxCommits", () => {
    assert.throws(
        () => enforceReleaseSafety(1, {
            allowEmpty: false,
            failOnEmpty: false,
            maxCommits: Number.NaN
        }),
        error => {
            assert.equal(error.exitCode, 1);
            assert.match(error.message, /max-commits/);
            return true;
        }
    );
});

test("enforceReleaseSafety rejects empty changelog when failOnEmpty is enabled", () => {
    assert.throws(
        () => enforceReleaseSafety(0, {
            allowEmpty: false,
            failOnEmpty: true,
            maxCommits: undefined
        }),
        error => {
            assert.equal(error.exitCode, 1);
            assert.match(error.message, /No changes found to release/);
            return true;
        }
    );
});

test("enforceReleaseSafety rejects commit counts above maxCommits", () => {
    assert.throws(
        () => enforceReleaseSafety(51, {
            allowEmpty: false,
            failOnEmpty: false,
            maxCommits: 50
        }),
        error => {
            assert.equal(error.exitCode, 1);
            assert.match(error.message, /exceeds the configured maximum/);
            return true;
        }
    );
});

test("enforceReleaseSafety passes for valid safety context", () => {
    assert.doesNotThrow(() => enforceReleaseSafety(10, {
        allowEmpty: false,
        failOnEmpty: false,
        maxCommits: 50
    }));
});
