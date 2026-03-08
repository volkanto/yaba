import * as helper from "../utils/helper.js";
import * as flow from "../utils/flow.js";
import * as templateUtils from "../utils/template-utils.js";
import { exitCodes } from "../utils/exit-codes.js";
import { createError } from "../utils/errors.js";
import { isNonEmptyString } from "../utils/runtime-config.js";
import { printChangelog, printJson, printReleasePreview } from "../services/command-output.js";
import {
    resolveOwner,
    resolveReleaseContext,
    resolveReleaseRepo
} from "../services/runtime-config-service.js";

export async function runReleaseCommand(options, runtimeConfig, isJsonOutput) {
    const releaseRepo = resolveReleaseRepo(options, runtimeConfig);

    checkDirectory(options, releaseRepo, runtimeConfig);

    await flow.checkInternetConnection();

    const repoOwner = await resolveOwner(options, runtimeConfig);
    const releaseContext = resolveReleaseContext(options, runtimeConfig);

    const headBranch = releaseContext.target ? null : await checkHeadBranch(repoOwner, releaseRepo);
    const releaseTarget = await resolveReleaseTarget(repoOwner, releaseRepo, releaseContext, headBranch);
    const lastRelease = await flow.fetchLastRelease(repoOwner, releaseRepo);
    const changeLog = await flow.prepareChangeLog(repoOwner, releaseRepo, releaseTarget, lastRelease);

    const preparedChangeLog = helper.prepareChangeLog(releaseContext.body, changeLog);
    const releasePreview = buildReleasePreview(preparedChangeLog, repoOwner, releaseRepo, lastRelease, headBranch, releaseTarget, releaseContext);

    if (options.releaseCommand === "preview") {
        if (isJsonOutput) {
            printJson({
                command: "release.preview",
                status: "success",
                owner: releasePreview.owner,
                repo: releasePreview.repo,
                releaseName: releasePreview.releaseName,
                newTag: releasePreview.releaseTag,
                previousTag: releasePreview.lastReleaseTag,
                previousTagSource: releasePreview.releaseTagSource,
                draft: releasePreview.draft,
                targetCommitish: releasePreview.targetCommitish,
                changelog: releasePreview.changelogBody
            });
        } else {
            printReleasePreview(releasePreview);
        }
        return exitCodes.SUCCESS;
    }

    if (canShowChangelog(changeLog, options)) {
        if (isJsonOutput) {
            printJson({
                command: "release.changelog",
                status: "success",
                owner: repoOwner,
                repo: releaseRepo,
                changelog: preparedChangeLog,
                commitCount: changeLog.length
            });
        } else {
            printChangelog(preparedChangeLog);
        }
    } else if (isJsonOutput && options.changelog) {
        printJson({
            command: "release.changelog",
            status: "noop",
            owner: repoOwner,
            repo: releaseRepo,
            reason: "No changes found to release."
        });
    }

    if (canCreateRelease(changeLog, options)) {
        const lastReleaseTag = resolveLastReleaseTag(lastRelease, releaseTarget);
        const releaseResult = await prepareRelease(preparedChangeLog, repoOwner, releaseRepo, lastReleaseTag, releaseContext, releaseTarget);

        if (isJsonOutput) {
            printJson({
                command: "release.create",
                status: "success",
                owner: repoOwner,
                repo: releaseRepo,
                releaseName: releaseResult.releaseName,
                newTag: releaseResult.releaseTag,
                previousTag: releaseResult.previousTag,
                draft: releaseResult.draft,
                targetCommitish: releaseResult.targetCommitish,
                releaseUrl: releaseResult.releaseUrl,
                notified: releaseResult.publishRequested
            });
        }
    } else if (isJsonOutput && !options.changelog) {
        printJson({
            command: "release.create",
            status: "noop",
            owner: repoOwner,
            repo: releaseRepo,
            reason: "No changes found to release."
        });
    }

    return exitCodes.SUCCESS;
}

async function prepareRelease(preparedChangeLog, repoOwner, releaseRepo, lastReleaseTag, releaseContext, targetCommitish) {
    const hasReleaseCreatePermission = await helper.releaseCreatePermit(releaseContext.interactive);

    if (!hasReleaseCreatePermission) {
        throw createError("Release was not prepared. Confirmation prompt was declined.", exitCodes.VALIDATION);
    }

    const releaseTag = helper.releaseTagName(releaseContext.tag);
    const changeLogDetails = templateUtils.generateChangelog(preparedChangeLog, repoOwner, releaseRepo, lastReleaseTag, releaseTag);
    const releaseName = helper.releaseName(releaseContext.releaseName);
    const releaseUrl = await flow.createRelease(
        repoOwner,
        releaseRepo,
        releaseContext.draft,
        releaseName,
        changeLogDetails,
        releaseContext.tag,
        targetCommitish
    );

    await flow.publishToSlack(releaseContext.publish, releaseRepo, preparedChangeLog, releaseUrl, releaseName);

    return {
        releaseName: releaseName,
        releaseTag: releaseTag,
        previousTag: lastReleaseTag,
        targetCommitish: targetCommitish,
        releaseUrl: releaseUrl,
        draft: releaseContext.draft === true,
        publishRequested: releaseContext.publish === true
    };
}

async function resolveReleaseTarget(repoOwner, releaseRepo, releaseContext, fallbackHeadBranch) {
    if (isNonEmptyString(releaseContext.target)) {
        return await flow.resolveTargetCommitish(repoOwner, releaseRepo, releaseContext.target.trim());
    }

    return fallbackHeadBranch;
}

async function checkHeadBranch(repoOwner, releaseRepo) {
    const headBranch = await flow.fetchHeadBranch(repoOwner, releaseRepo);
    if (headBranch == null) {
        throw createError("Head branch can not be found! The release has been interrupted!", exitCodes.UPSTREAM);
    }
    return headBranch;
}

function checkDirectory(options, releaseRepo, runtimeConfig) {
    const hasRepoFromConfig = isNonEmptyString(runtimeConfig?.release?.repo);
    if (options.repo == undefined && !hasRepoFromConfig && !helper.isGitRepo()) {
        throw createError(`The directory '${helper.retrieveCurrentDirectory()}' is not a Git repo.`, exitCodes.VALIDATION);
    }

    if (!isNonEmptyString(releaseRepo) || releaseRepo === "not a git repo") {
        throw createError("Repository name could not be resolved. Use --repo or set release.repo in config.", exitCodes.VALIDATION);
    }
}

function canCreateRelease(changeLog, options) {
    return changeLog.length !== 0 && !options.changelog;
}

function canShowChangelog(changeLog, options) {
    return changeLog.length !== 0 && options.changelog;
}

function resolveLastReleaseTag(lastRelease, fallbackRef) {
    return lastRelease?.tag_name || fallbackRef;
}

function buildReleasePreview(preparedChangeLog, repoOwner, releaseRepo, lastRelease, headBranch, releaseTarget, releaseContext) {
    const lastReleaseTag = resolveLastReleaseTag(lastRelease, releaseTarget);
    const releaseTag = helper.releaseTagName(releaseContext.tag);
    const releaseName = helper.releaseName(releaseContext.releaseName);
    const changelogBody = templateUtils.generateChangelog(preparedChangeLog, repoOwner, releaseRepo, lastReleaseTag, releaseTag);
    const releaseTagSource = lastRelease?.tag_name
        ? "latest release tag"
        : isNonEmptyString(releaseContext.target)
            ? "target reference (--target fallback)"
            : "head branch (fallback)";

    return {
        owner: repoOwner,
        repo: releaseRepo,
        releaseName: releaseName,
        releaseTag: releaseTag,
        lastReleaseTag: lastReleaseTag,
        releaseTagSource: releaseTagSource,
        targetCommitish: releaseTarget,
        draft: releaseContext.draft === true,
        changelogBody: changelogBody
    };
}
