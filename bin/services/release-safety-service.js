import { createError } from "../utils/errors.js";
import { exitCodes } from "../utils/exit-codes.js";

export function enforceReleaseSafety(changeLogCount, releaseContext) {
    validateReleaseSafetyOptions(releaseContext);

    if (releaseContext.maxCommits !== undefined && changeLogCount > releaseContext.maxCommits) {
        throw createError(
            `Commit count (${changeLogCount}) exceeds the configured maximum (${releaseContext.maxCommits}).`,
            exitCodes.VALIDATION
        );
    }

    if (changeLogCount === 0 && releaseContext.failOnEmpty === true && releaseContext.allowEmpty !== true) {
        throw createError(
            "No changes found to release and '--fail-on-empty' is enabled.",
            exitCodes.VALIDATION
        );
    }
}

export function shouldCreateRelease(changeLogCount, changelogOnly, allowEmpty) {
    if (changelogOnly) {
        return false;
    }

    return changeLogCount !== 0 || allowEmpty === true;
}

export function shouldShowChangelog(changeLogCount, changelogRequested, allowEmpty) {
    if (!changelogRequested) {
        return false;
    }

    return changeLogCount !== 0 || allowEmpty === true;
}

function validateReleaseSafetyOptions(releaseContext) {
    if (releaseContext.allowEmpty === true && releaseContext.failOnEmpty === true) {
        throw createError(
            "Flags '--allow-empty' and '--fail-on-empty' cannot be enabled together.",
            exitCodes.VALIDATION
        );
    }

    if (Number.isNaN(releaseContext.maxCommits)) {
        throw createError(
            "Flag '--max-commits' must be a positive integer.",
            exitCodes.VALIDATION
        );
    }
}
