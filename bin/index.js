#!/usr/bin/env node

import kleur from "kleur";
import boxen from "boxen";
import * as helper from "./utils/helper.js";
import { checkUpdate } from "./utils/tool.js";
import * as flow from "./utils/flow.js";
import { options, isSupportedReleaseCommand } from "./utils/command.js";
import * as templateUtils from "./utils/template-utils.js";
import { exitCodes } from "./utils/exit-codes.js";
import { createError, normalizeError } from "./utils/errors.js";

runYaba().then(exitCode => process.exit(exitCode));

async function runYaba() {

    try {
        flow.setOutputFormat(options.outputFormat);

        if (!isSupportedReleaseCommand(options)) {
            throw createError("Unsupported command. Use 'yaba release create --help' or 'yaba release preview --help' for usage details.", exitCodes.VALIDATION);
        }

        // https://www.npmjs.com/package/tiny-updater OR https://www.npmjs.com/package/update-notifier
        // can be used instead below method.
        if (!isJsonOutput()) {
            await checkUpdate(); // check if the yaba cli has newer version
        }
        
        // check required ENV variables
        flow.checkRequiredEnvVariables();

        // check if the current directory is git repo
        checkDirectory();

        // check internet connection
        await flow.checkInternetConnection();

        // prepare repoOwner and releaseRepo
        const repoOwner = await resolveOwner();
        const releaseRepo = helper.retrieveReleaseRepo(options.repo);

        // fetch head branch
        const headBranch = await checkHeadBranch(repoOwner, releaseRepo);

        // fetch last release of the repository
        const lastRelease = await flow.fetchLastRelease(repoOwner, releaseRepo);

        // preparing the changeLog from the main/master branch if there is no previous release
        let changeLog = await flow.prepareChangeLog(repoOwner, releaseRepo, headBranch, lastRelease);

        const preparedChangeLog = helper.prepareChangeLog(options.body, changeLog);
        const releasePreview = buildReleasePreview(preparedChangeLog, repoOwner, releaseRepo, lastRelease, headBranch);

        // preview release without creating it
        if (isReleasePreviewCommand()) {
            if (isJsonOutput()) {
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
                    changelog: releasePreview.changelogBody
                });
            } else {
                printReleasePreview(releasePreview);
            }
            return exitCodes.SUCCESS;
        }

        // show only changelog
        if (canShowChangelog(changeLog)) {
            if (isJsonOutput()) {
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
        } else if (isJsonOutput() && options.changelog) {
            printJson({
                command: "release.changelog",
                status: "noop",
                owner: repoOwner,
                repo: releaseRepo,
                reason: "No changes found to release."
            });
        }

        // create the release
        if (canCreateRelease(changeLog)) {
            const lastReleaseTag = resolveLastReleaseTag(lastRelease, headBranch);
            const releaseResult = await prepareRelease(preparedChangeLog, repoOwner, releaseRepo, lastReleaseTag);

            if (isJsonOutput()) {
                printJson({
                    command: "release.create",
                    status: "success",
                    owner: repoOwner,
                    repo: releaseRepo,
                    releaseName: releaseResult.releaseName,
                    newTag: releaseResult.releaseTag,
                    previousTag: releaseResult.previousTag,
                    draft: releaseResult.draft,
                    releaseUrl: releaseResult.releaseUrl,
                    notified: releaseResult.publishRequested
                });
            }
        } else if (isJsonOutput() && !options.changelog) {
            printJson({
                command: "release.create",
                status: "noop",
                owner: repoOwner,
                repo: releaseRepo,
                reason: "No changes found to release."
            });
        }

        // release completed, to prevent hanging forcing to exit
        return exitCodes.SUCCESS;

    } catch (error) {
        const normalizedError = normalizeError(error);
        if (isJsonOutput()) {
            console.error(JSON.stringify({
                status: "error",
                exitCode: normalizedError.exitCode,
                message: normalizedError.message
            }));
        } else {
            console.error(kleur.red(normalizedError.message));
        }
        return normalizedError.exitCode;
    }
}

async function prepareRelease(preparedChangeLog, repoOwner, releaseRepo, lastReleaseTag) {

    const hasReleaseCreatePermission = await helper.releaseCreatePermit(options.interactive);

    if (hasReleaseCreatePermission) {
        const releaseTag = helper.releaseTagName(options.tag);
        let changeLogDetails = templateUtils.generateChangelog(preparedChangeLog, repoOwner, releaseRepo, lastReleaseTag, releaseTag);
        let releaseName = helper.releaseName(options.releaseName);
        const releaseUrl = await flow.createRelease(repoOwner, releaseRepo, options.draft, releaseName,
            changeLogDetails, options.tag);

        // publishes the changelog on slack
        await flow.publishToSlack(options.publish, releaseRepo, preparedChangeLog, releaseUrl, releaseName);

        return {
            releaseName: releaseName,
            releaseTag: releaseTag,
            previousTag: lastReleaseTag,
            releaseUrl: releaseUrl,
            draft: options.draft === true,
            publishRequested: options.publish === true
        };
    } else {
        throw createError('Release was not prepared. Confirmation prompt was declined.', exitCodes.VALIDATION);
    }
}

async function checkHeadBranch(repoOwner, releaseRepo) {
    const headBranch = await flow.fetchHeadBranch(repoOwner, releaseRepo);
    if (headBranch == null) {
        throw createError("Head branch can not be found! The release has been interrupted!", exitCodes.UPSTREAM);
    }
    return headBranch;
}

function checkDirectory() {
    // check if the current directory is git repo
    if (options.repo == undefined && !helper.isGitRepo()) {
        throw createError(`The directory '${helper.retrieveCurrentDirectory()}' is not a Git repo.`, exitCodes.VALIDATION);
    }
}

function printChangelog(preparedChangeLog) {
    const changelogBoxOptions = {
        padding: 1,
        title: 'Changelog',
        titleAlignment: 'left',
        align: 'left',
        borderColor: 'green',
        borderStyle: 'round'
    };
    const changelogMsg = `\n${preparedChangeLog}`;
    console.log('\n\n' + boxen(changelogMsg, changelogBoxOptions)); 
}

function printReleasePreview(releasePreview) {
    const summaryBoxOptions = {
        padding: 1,
        title: 'Release Preview Summary',
        titleAlignment: 'left',
        align: 'left',
        borderColor: 'cyan',
        borderStyle: 'round'
    };

    const bodyBoxOptions = {
        padding: 1,
        title: 'Release Preview Body',
        titleAlignment: 'left',
        align: 'left',
        borderColor: 'green',
        borderStyle: 'round'
    };

    const summary = [
        `Owner: ${releasePreview.owner}`,
        `Repository: ${releasePreview.repo}`,
        `Release name: ${releasePreview.releaseName}`,
        `New tag: ${releasePreview.releaseTag}`,
        `Previous tag: ${releasePreview.lastReleaseTag} (${releasePreview.releaseTagSource})`,
        `Draft: ${releasePreview.draft ? "true" : "false"}`
    ].join('\n');

    console.log('\n' + boxen(summary, summaryBoxOptions));
    console.log('\n' + boxen(`\n${releasePreview.changelogBody}`, bodyBoxOptions));
}

function canCreateRelease(changeLog) {
    return changeLog.length != 0 && !options.changelog;
}

function canShowChangelog(changeLog) {
    return changeLog.length != 0 && options.changelog;
}

function isReleasePreviewCommand() {
    return options.releaseCommand === "preview";
}

function resolveLastReleaseTag(lastRelease, headBranch) {
    return lastRelease?.tag_name || headBranch;
}

function buildReleasePreview(preparedChangeLog, repoOwner, releaseRepo, lastRelease, headBranch) {
    const lastReleaseTag = resolveLastReleaseTag(lastRelease, headBranch);
    const releaseTag = helper.releaseTagName(options.tag);
    const releaseName = helper.releaseName(options.releaseName);
    const changelogBody = templateUtils.generateChangelog(preparedChangeLog, repoOwner, releaseRepo, lastReleaseTag, releaseTag);
    const releaseTagSource = lastRelease?.tag_name ? "latest release tag" : "head branch (fallback)";

    return {
        owner: repoOwner,
        repo: releaseRepo,
        releaseName: releaseName,
        releaseTag: releaseTag,
        lastReleaseTag: lastReleaseTag,
        releaseTagSource: releaseTagSource,
        draft: options.draft === true,
        changelogBody: changelogBody
    };
}

function printJson(payload) {
    console.log(JSON.stringify(payload, null, 2));
}

function isJsonOutput() {
    return options.outputFormat === "json";
}

async function resolveOwner() {
    if (options.owner || process.env.YABA_GITHUB_REPO_OWNER) {
        return helper.retrieveOwner(options.owner, null);
    }
    const username = await flow.retrieveUsername();
    return helper.retrieveOwner(null, username);
}
