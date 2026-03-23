import * as helper from "../utils/helper.js";
import * as flow from "../utils/flow.js";
import * as git from "../utils/git.js";
import * as templateUtils from "../utils/template-utils.js";
import { exitCodes } from "../utils/exit-codes.js";
import { createError } from "../utils/errors.js";
import { isNonEmptyString } from "../utils/runtime-config.js";
import { publishReleaseNotifications } from "../notifications/publisher.js";
import { printChangelog, printJson, printReleasePreview, printNotificationPreview } from "../services/command-output.js";
import { buildReleaseNotesBundle } from "../services/release-notes-service.js";
import { resolveReleaseTag } from "../services/tag-resolution-service.js";
import {
    enforceReleaseSafety,
    shouldCreateRelease,
    shouldShowChangelog
} from "../services/release-safety-service.js";
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
    const targetReference = isNonEmptyString(releaseContext.target) ? releaseContext.target : headBranch;
    const lastRelease = await flow.fetchLastRelease(repoOwner, releaseRepo);
    const releaseTag = await resolveTagName(repoOwner, releaseRepo, releaseContext, releaseTarget, targetReference);
    const changeLog = await flow.prepareChangeLog(repoOwner, releaseRepo, releaseTarget, lastRelease);
    enforceReleaseSafety(changeLog.length, releaseContext);

    const preparedChangeLog = helper.prepareChangeLog(releaseContext.body, changeLog);
    const releasePreview = buildReleasePreview(
        preparedChangeLog,
        repoOwner,
        releaseRepo,
        lastRelease,
        releaseTarget,
        releaseContext,
        releaseTag
    );

    if (options.releaseCommand === "preview") {
        const lastReleaseTag = resolveLastReleaseTag(lastRelease, releaseTarget);
        const releaseName = helper.releaseName(releaseContext.releaseName);
        const releaseNotes = await buildReleaseNotesBundle({
            owner: repoOwner,
            repo: releaseRepo,
            previousTag: lastReleaseTag,
            currentTag: releaseTag,
            releaseName: releaseName,
            preparedChangeLog: preparedChangeLog,
            changeLog: changeLog,
            fetchPullRequest: async pullNumber =>
                await flow.fetchPullRequestByNumber(repoOwner, releaseRepo, pullNumber),
            labelBuckets: releaseContext.labelBuckets
        });

        let notificationPreview = null;
        if (options.notifications) {
            notificationPreview = {
                provider: options.notifications,
                body: options.notifications === "slack"
                    ? releaseNotes.slackNewsletterBody
                    : releaseNotes.githubReleaseBody
            };
        }

        if (isJsonOutput) {
            printJson({
                ...buildReleaseJsonBase("release.preview", releasePreview.owner, releasePreview.repo, {
                    releaseName: releasePreview.releaseName,
                    newTag: releasePreview.releaseTag,
                    previousTag: releasePreview.lastReleaseTag,
                    draft: releasePreview.draft,
                    targetCommitish: releasePreview.targetCommitish
                }),
                previousTagSource: releasePreview.releaseTagSource,
                changelog: releaseNotes.githubReleaseBody,
                notificationPreview: notificationPreview
            });
        } else {
            printReleasePreview({ ...releasePreview, changelogBody: releaseNotes.githubReleaseBody });
            if (notificationPreview) {
                printNotificationPreview(notificationPreview);
            }
        }
        return exitCodes.SUCCESS;
    }

    if (shouldShowChangelog(changeLog.length, options.changelog === true, releaseContext.allowEmpty === true)) {
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

    if (shouldCreateRelease(changeLog.length, options.changelog === true, releaseContext.allowEmpty === true)) {
        const lastReleaseTag = resolveLastReleaseTag(lastRelease, releaseTarget);
        const releaseResult = await prepareRelease(
            changeLog,
            preparedChangeLog,
            repoOwner,
            releaseRepo,
            lastReleaseTag,
            releaseContext,
            releaseTarget,
            releaseTag,
            releaseContext.labelBuckets
        );

        if (isJsonOutput) {
            printJson({
                ...buildReleaseJsonBase("release.create", repoOwner, releaseRepo, {
                    releaseName: releaseResult.releaseName,
                    newTag: releaseResult.releaseTag,
                    previousTag: releaseResult.previousTag,
                    draft: releaseResult.draft,
                    targetCommitish: releaseResult.targetCommitish
                }),
                releaseUrl: releaseResult.releaseUrl,
                notificationProviders: releaseResult.notificationProviders,
                releaseNotesMode: releaseResult.releaseNotesMode,
                allowEmpty: releaseContext.allowEmpty === true,
                failOnEmpty: releaseContext.failOnEmpty === true,
                maxCommits: releaseContext.maxCommits ?? null,
                notified: releaseResult.publishRequested
            });
        }
    } else if (isJsonOutput && !options.changelog) {
        printJson({
            command: "release.create",
            status: "noop",
            owner: repoOwner,
            repo: releaseRepo,
            reason: "No changes found to release. Use '--allow-empty' to proceed or '--fail-on-empty' to fail explicitly."
        });
    }

    return exitCodes.SUCCESS;
}

async function prepareRelease(changeLog, preparedChangeLog, repoOwner, releaseRepo, lastReleaseTag, releaseContext, targetCommitish, releaseTag, labelBuckets) {
    const hasReleaseCreatePermission = await helper.releaseCreatePermit(releaseContext.interactive);

    if (!hasReleaseCreatePermission) {
        throw createError("Release was not prepared. Confirmation prompt was declined.", exitCodes.VALIDATION);
    }

    const releaseName = helper.releaseName(releaseContext.releaseName);
    const releaseNotes = await buildReleaseNotesBundle({
        owner: repoOwner,
        repo: releaseRepo,
        previousTag: lastReleaseTag,
        currentTag: releaseTag,
        releaseName: releaseName,
        preparedChangeLog: preparedChangeLog,
        changeLog: changeLog,
        fetchPullRequest: async pullNumber => {
            return await flow.fetchPullRequestByNumber(repoOwner, releaseRepo, pullNumber);
        },
        labelBuckets: labelBuckets
    });

    const releaseUrl = await flow.createRelease(
        repoOwner,
        releaseRepo,
        releaseContext.draft,
        releaseName,
        releaseNotes.githubReleaseBody,
        releaseTag,
        targetCommitish
    );

    const notificationResult = await publishReleaseNotifications({
        publish: releaseContext.publish,
        providerNames: releaseContext.notificationProviders,
        context: {
            repo: releaseRepo,
            changelog: releaseNotes.slackNewsletterBody,
            releaseUrl: releaseUrl,
            releaseName: releaseName,
            compareUrl: releaseNotes.compareUrl
        }
    });

    return {
        releaseName: releaseName,
        releaseTag: releaseTag,
        previousTag: lastReleaseTag,
        targetCommitish: targetCommitish,
        releaseUrl: releaseUrl,
        notificationProviders: notificationResult.providers,
        releaseNotesMode: releaseNotes.mode,
        draft: releaseContext.draft === true,
        publishRequested: releaseContext.publish === true
    };
}

async function resolveReleaseTarget(repoOwner, releaseRepo, releaseContext, fallbackHeadBranch) {
    if (isNonEmptyString(releaseContext.target)) {
        return await flow.resolveTargetCommitish(repoOwner, releaseRepo, releaseContext.target.trim());
    }

    const requiresCommitSha = releaseContext.tagStrategy === "sha"
        || (isNonEmptyString(releaseContext.tagPattern) && releaseContext.tagPattern.includes("{shortSha}"));
    if (requiresCommitSha) {
        return await flow.resolveTargetCommitish(repoOwner, releaseRepo, fallbackHeadBranch);
    }

    return fallbackHeadBranch;
}

async function checkHeadBranch(repoOwner, releaseRepo) {
    const headBranch = await flow.fetchHeadBranch(repoOwner, releaseRepo);
    if (headBranch === null) {
        throw createError("Head branch can not be found! The release has been interrupted!", exitCodes.UPSTREAM);
    }
    return headBranch;
}

function checkDirectory(options, releaseRepo, runtimeConfig) {
    const hasRepoFromConfig = isNonEmptyString(runtimeConfig?.release?.repo);
    if (options.repo == undefined && !hasRepoFromConfig && !git.isGitRepo()) {
        throw createError(`The directory '${git.retrieveCurrentDirectory()}' is not a Git repo.`, exitCodes.VALIDATION);
    }

    if (!isNonEmptyString(releaseRepo) || releaseRepo === "not a git repo") {
        throw createError("Repository name could not be resolved. Use --repo or set release.repo in config.", exitCodes.VALIDATION);
    }
}

function resolveLastReleaseTag(lastRelease, fallbackRef) {
    return lastRelease?.tag_name || fallbackRef;
}

async function resolveTagName(repoOwner, releaseRepo, releaseContext, releaseTarget, targetReference) {
    return await resolveReleaseTag({
        explicitTag: releaseContext.tag,
        tagStrategy: releaseContext.tagStrategy,
        tagPattern: releaseContext.tagPattern,
        tagOnConflict: releaseContext.tagOnConflict,
        tagMaxAttempts: releaseContext.tagMaxAttempts,
        targetCommitish: releaseTarget,
        targetReference: targetReference,
        tagExists: async tagName => {
            return await flow.tagExists(repoOwner, releaseRepo, tagName);
        }
    });
}

function buildReleaseJsonBase(command, owner, repo, { releaseName, newTag, previousTag, draft, targetCommitish }) {
    return { command, status: "success", owner, repo, releaseName, newTag, previousTag, draft, targetCommitish };
}

function buildReleasePreview(preparedChangeLog, repoOwner, releaseRepo, lastRelease, releaseTarget, releaseContext, releaseTag) {
    const lastReleaseTag = resolveLastReleaseTag(lastRelease, releaseTarget);
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
