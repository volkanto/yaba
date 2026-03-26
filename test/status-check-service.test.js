import test from "node:test";
import assert from "node:assert/strict";
import { verifyStatusChecks } from "../bin/services/status-check-service.js";

const noChecks = { state: "success", totalCount: 0 };
const successStatus = { state: "success", totalCount: 1 };
const pendingStatus = { state: "pending", totalCount: 1 };
const failureStatus = { state: "failure", totalCount: 1 };

function makeRun(name, status, conclusion = null) {
    return { name, status, conclusion };
}

test("verifyStatusChecks returns immediately when skip is true", async () => {
    let called = false;
    await verifyStatusChecks("owner", "repo", "abc123", true, {
        fetchStatus: async () => { called = true; return noChecks; },
        fetchCheckRuns: async () => { called = true; return []; }
    });
    assert.equal(called, false);
});

test("verifyStatusChecks passes when all check runs are completed with success", async () => {
    await assert.doesNotReject(() => verifyStatusChecks("owner", "repo", "abc123", false, {
        fetchStatus: async () => successStatus,
        fetchCheckRuns: async () => [
            makeRun("unit-tests", "completed", "success"),
            makeRun("integration-tests", "completed", "success")
        ]
    }));
});

test("verifyStatusChecks passes when check runs are completed with neutral or skipped conclusions", async () => {
    await assert.doesNotReject(() => verifyStatusChecks("owner", "repo", "abc123", false, {
        fetchStatus: async () => noChecks,
        fetchCheckRuns: async () => [
            makeRun("optional-check", "completed", "neutral"),
            makeRun("skipped-check", "completed", "skipped")
        ]
    }));
});

test("verifyStatusChecks passes when there are no check runs and no legacy status checks", async () => {
    await assert.doesNotReject(() => verifyStatusChecks("owner", "repo", "abc123", false, {
        fetchStatus: async () => noChecks,
        fetchCheckRuns: async () => []
    }));
});

test("verifyStatusChecks throws when a check run is queued", async () => {
    await assert.rejects(
        () => verifyStatusChecks("owner", "repo", "abc123", false, {
            fetchStatus: async () => noChecks,
            fetchCheckRuns: async () => [makeRun("unit-tests", "queued")]
        }),
        error => {
            assert.equal(error.exitCode, 1);
            assert.match(error.message, /unit-tests/);
            assert.match(error.message, /queued/);
            assert.match(error.message, /--no-status-checks/);
            return true;
        }
    );
});

test("verifyStatusChecks throws when a check run is in_progress", async () => {
    await assert.rejects(
        () => verifyStatusChecks("owner", "repo", "abc123", false, {
            fetchStatus: async () => noChecks,
            fetchCheckRuns: async () => [makeRun("integration-tests", "in_progress")]
        }),
        error => {
            assert.equal(error.exitCode, 1);
            assert.match(error.message, /integration-tests/);
            assert.match(error.message, /in_progress/);
            return true;
        }
    );
});

test("verifyStatusChecks throws when a check run has conclusion failure", async () => {
    await assert.rejects(
        () => verifyStatusChecks("owner", "repo", "abc123", false, {
            fetchStatus: async () => noChecks,
            fetchCheckRuns: async () => [makeRun("unit-tests", "completed", "failure")]
        }),
        error => {
            assert.equal(error.exitCode, 1);
            assert.match(error.message, /unit-tests/);
            assert.match(error.message, /failure/);
            assert.match(error.message, /--no-status-checks/);
            return true;
        }
    );
});

test("verifyStatusChecks throws when a check run has conclusion timed_out", async () => {
    await assert.rejects(
        () => verifyStatusChecks("owner", "repo", "abc123", false, {
            fetchStatus: async () => noChecks,
            fetchCheckRuns: async () => [makeRun("slow-check", "completed", "timed_out")]
        }),
        error => {
            assert.equal(error.exitCode, 1);
            assert.match(error.message, /slow-check/);
            assert.match(error.message, /timed_out/);
            return true;
        }
    );
});

test("verifyStatusChecks throws when a check run has conclusion action_required", async () => {
    await assert.rejects(
        () => verifyStatusChecks("owner", "repo", "abc123", false, {
            fetchStatus: async () => noChecks,
            fetchCheckRuns: async () => [makeRun("security-scan", "completed", "action_required")]
        }),
        error => {
            assert.equal(error.exitCode, 1);
            assert.match(error.message, /security-scan/);
            assert.match(error.message, /action_required/);
            return true;
        }
    );
});

test("verifyStatusChecks throws on legacy pending status when totalCount is non-zero", async () => {
    await assert.rejects(
        () => verifyStatusChecks("owner", "repo", "abc123", false, {
            fetchStatus: async () => pendingStatus,
            fetchCheckRuns: async () => []
        }),
        error => {
            assert.equal(error.exitCode, 1);
            assert.match(error.message, /pending/);
            assert.match(error.message, /--no-status-checks/);
            return true;
        }
    );
});

test("verifyStatusChecks throws on legacy failure status when totalCount is non-zero", async () => {
    await assert.rejects(
        () => verifyStatusChecks("owner", "repo", "abc123", false, {
            fetchStatus: async () => failureStatus,
            fetchCheckRuns: async () => []
        }),
        error => {
            assert.equal(error.exitCode, 1);
            assert.match(error.message, /failure/);
            assert.match(error.message, /--no-status-checks/);
            return true;
        }
    );
});

test("verifyStatusChecks ignores legacy pending status when totalCount is zero", async () => {
    await assert.doesNotReject(() => verifyStatusChecks("owner", "repo", "abc123", false, {
        fetchStatus: async () => ({ state: "pending", totalCount: 0 }),
        fetchCheckRuns: async () => []
    }));
});

test("verifyStatusChecks prioritises check run failure over legacy status", async () => {
    await assert.rejects(
        () => verifyStatusChecks("owner", "repo", "abc123", false, {
            fetchStatus: async () => successStatus,
            fetchCheckRuns: async () => [makeRun("unit-tests", "completed", "failure")]
        }),
        error => {
            assert.equal(error.exitCode, 1);
            assert.match(error.message, /unit-tests/);
            return true;
        }
    );
});
