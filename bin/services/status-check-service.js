import { spinner } from "../utils/spinner.js";
import { fetchCommitStatus, fetchCommitCheckRuns } from "../utils/github-api.js";
import { createError } from "../utils/errors.js";
import { exitCodes } from "../utils/exit-codes.js";

const PENDING_CHECK_RUN_STATUSES = new Set(['queued', 'in_progress']);
const FAILED_CHECK_RUN_CONCLUSIONS = new Set(['failure', 'timed_out', 'action_required']);

/**
 * Verifies that all GitHub status checks and Actions check runs on the target ref
 * have completed successfully before allowing a release to proceed.
 *
 * Checks two independent GitHub APIs:
 *  - Commit Status API (/commits/{ref}/status): covers legacy status checks from
 *    third-party integrations and older CI systems.
 *  - Check Runs API (/commits/{ref}/check-runs): covers GitHub Actions workflows
 *    and GitHub Apps.
 *
 * Throws a VALIDATION error if any check is still pending (indicating CI is still
 * running) or has failed (indicating something is broken on the target ref).
 *
 * @param owner the repository owner
 * @param repo the repository name
 * @param ref the resolved target commit-ish to verify
 * @param skip when true, bypasses the check entirely (--no-status-checks flag or config)
 * @param fetchStatus injectable function for fetching commit status (defaults to GitHub API)
 * @param fetchCheckRuns injectable function for fetching check runs (defaults to GitHub API)
 * @returns {Promise<void>}
 */
export async function verifyStatusChecks(owner, repo, ref, skip, {
    fetchStatus = fetchCommitStatus,
    fetchCheckRuns = fetchCommitCheckRuns
} = {}) {
    if (skip === true) {
        return;
    }

    spinner.start(`Verifying status checks on '${ref}'...`);

    const [commitStatus, checkRuns] = await Promise.all([
        fetchStatus(owner, repo, ref),
        fetchCheckRuns(owner, repo, ref)
    ]);

    const pendingRun = checkRuns.find(run => PENDING_CHECK_RUN_STATUSES.has(run.status));
    if (pendingRun) {
        spinner.fail(`Status checks are still running on '${ref}'.`);
        throw createError(
            `Cannot release: check run '${pendingRun.name}' is still ${pendingRun.status} on '${ref}'. ` +
            `Wait for all checks to complete before releasing, or use --no-status-checks to bypass this gate.`,
            exitCodes.VALIDATION
        );
    }

    const failedRun = checkRuns.find(run => FAILED_CHECK_RUN_CONCLUSIONS.has(run.conclusion));
    if (failedRun) {
        spinner.fail(`Status checks have failed on '${ref}'.`);
        throw createError(
            `Cannot release: check run '${failedRun.name}' has conclusion '${failedRun.conclusion}' on '${ref}'. ` +
            `Fix the failing checks before releasing, or use --no-status-checks to bypass this gate.`,
            exitCodes.VALIDATION
        );
    }

    if (commitStatus.totalCount > 0) {
        if (commitStatus.state === 'pending') {
            spinner.fail(`Commit status checks are pending on '${ref}'.`);
            throw createError(
                `Cannot release: commit status is '${commitStatus.state}' on '${ref}'. ` +
                `Wait for all checks to complete before releasing, or use --no-status-checks to bypass this gate.`,
                exitCodes.VALIDATION
            );
        }

        if (commitStatus.state === 'failure') {
            spinner.fail(`Commit status checks have failed on '${ref}'.`);
            throw createError(
                `Cannot release: commit status is '${commitStatus.state}' on '${ref}'. ` +
                `Fix the failing checks before releasing, or use --no-status-checks to bypass this gate.`,
                exitCodes.VALIDATION
            );
        }
    }

    spinner.succeed(`All status checks passed on '${ref}'.`);
}
