#!/usr/bin/env node

import kleur from "kleur";
import boxen from "boxen";
import * as helper from "./utils/helper.js";
import { checkUpdate } from "./utils/tool.js";
import * as flow from "./utils/flow.js";
import { options, isSupportedReleaseCommand } from "./utils/command.js";
import * as templateUtils from "./utils/template-utils.js";

runYaba();

async function runYaba() {

    try {
        if (!isSupportedReleaseCommand(options)) {
            console.log(kleur.red("Unsupported command. Use 'yaba release create --help' or 'yaba release preview --help' for usage details."));
            process.exit(1);
        }

        // https://www.npmjs.com/package/tiny-updater OR https://www.npmjs.com/package/update-notifier
        // can be used instead below method.
        await checkUpdate(); // check if the yaba cli has newer version
        
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

        // preview release without creating it
        if (isReleasePreviewCommand()) {
            printReleasePreview(changeLog, repoOwner, releaseRepo, lastRelease, headBranch);
            process.exit(0);
        }

        // show only changelog
        if (canShowChangelog(changeLog)) {
            printChangelog(releaseRepo, changeLog);
        }

        // create the release
        if (canCreateRelease(changeLog)) {
            await prepareRelease(changeLog, repoOwner, releaseRepo, lastRelease.tag_name);
        }

        // release completed, to prevent hanging forcing to exit
        process.exit(0);

    } catch (error) {
        console.log(error);
    }
}

async function prepareRelease(changeLog, repoOwner, releaseRepo, lastReleaseTag) {

    const hasReleaseCreatePermission = await helper.releaseCreatePermit(options.interactive);

    if (hasReleaseCreatePermission) {
        let preparedChangeLog = helper.prepareChangeLog(options.body, changeLog);
        let changeLogDetails = templateUtils.generateChangelog(preparedChangeLog, repoOwner, releaseRepo, lastReleaseTag, helper.releaseTagName(options.tag));
        let releaseName = helper.releaseName(options.releaseName)
        const releaseUrl = await flow.createRelease(repoOwner, releaseRepo, options.draft, releaseName,
            changeLogDetails, options.tag);

        // publishes the changelog on slack
        await flow.publishToSlack(options.publish, releaseRepo, preparedChangeLog, releaseUrl, releaseName);

    } else {
        console.log('Release was not prepared!');
    }
}

async function checkHeadBranch(repoOwner, releaseRepo) {
    const headBranch = await flow.fetchHeadBranch(repoOwner, releaseRepo);
    if (headBranch == null) {
        console.log(kleur.red("Head branch can not be found! The release has been interrupted!"));
        process.exit(1);
    }
    return headBranch;
}

function checkDirectory() {
    // check if the current directory is git repo
    if (options.repo == undefined && !helper.isGitRepo()) {
        console.log(`The directory '${helper.retrieveCurrentDirectory()}' is not a Git repo.`);
        process.exit(1);
    }
}

function printChangelog(repoName, changeLog) {
    const changelogBoxOptions = {
        padding: 1,
        title: 'Changelog',
        titleAlignment: 'left',
        align: 'left',
        borderColor: 'green',
        borderStyle: 'round'
    }
    const changelogMsg = `\n${helper.prepareChangeLog(options.body, changeLog)}`;
    console.log('\n\n' + boxen(changelogMsg, changelogBoxOptions)); 
}

function printReleasePreview(changeLog, repoOwner, releaseRepo, lastRelease, headBranch) {
    const preparedChangeLog = helper.prepareChangeLog(options.body, changeLog);
    const lastReleaseTag = resolveLastReleaseTag(lastRelease, headBranch);
    const releaseTag = helper.releaseTagName(options.tag);
    const releaseName = helper.releaseName(options.releaseName);
    const changelogBody = templateUtils.generateChangelog(preparedChangeLog, repoOwner, releaseRepo, lastReleaseTag, releaseTag);
    const releaseTagSource = lastRelease?.tag_name ? "latest release tag" : "head branch (fallback)";

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
        `Owner: ${repoOwner}`,
        `Repository: ${releaseRepo}`,
        `Release name: ${releaseName}`,
        `New tag: ${releaseTag}`,
        `Previous tag: ${lastReleaseTag} (${releaseTagSource})`,
        `Draft: ${options.draft === true ? "true" : "false"}`
    ].join('\n');

    console.log('\n' + boxen(summary, summaryBoxOptions));
    console.log('\n' + boxen(`\n${changelogBody}`, bodyBoxOptions));
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

async function resolveOwner() {
    if (options.owner || process.env.YABA_GITHUB_REPO_OWNER) {
        return helper.retrieveOwner(options.owner, null);
    }
    const username = await flow.retrieveUsername();
    return helper.retrieveOwner(null, username);
}
