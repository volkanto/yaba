#!/usr/bin/env node

const kleur = require("kleur");
const helper = require('./utils/helper.js');
const tool = require('./utils/tool.js');
const flow = require('./utils/flow.js');
const options = require('./utils/command.js').options;

runYaba();

async function runYaba() {

    try {

        // https://www.npmjs.com/package/tiny-updater OR https://www.npmjs.com/package/update-notifier
        // can be used instead below method.

        await tool.checkUpdate(); // check if the yaba cli has newer version
        // check required ENV variables

        flow.checkRequiredEnvVariables();
        // check if the current directory is git repo

        checkDirectory()
        // check internet connection

        await flow.checkInternetConnection();
        // prepare username, repoOwner and releaseRepo

        const username = await flow.retrieveUsername();
        const repoOwner = helper.retrieveOwner(options.owner, username);
        const releaseRepo = helper.retrieveReleaseRepo(options.repo);

        // fetch head branch
        const headBranch = await checkHeadBranch(repoOwner, releaseRepo);

        // preparing the changeLog from the main/master branch if there is no previous release
        let changeLog = await flow.prepareChangeLog(repoOwner, releaseRepo, headBranch);

        // show only changelog
        if (canShowChangelog(changeLog)) {
            printChangelog(releaseRepo, changeLog);
        }

        // create the release
        if (canCreateRelease(changeLog)) {
            await prepareRelease(changeLog, repoOwner, releaseRepo);
        }

        // release completed, to prevent hanging forcing to exit
        process.exit(1);

    } catch (error) {
        console.log(error);
    }
}

async function prepareRelease(changeLog, repoOwner, releaseRepo) {

    const hasReleaseCreatePermission = await helper.releaseCreatePermit(options.interactive);
    if (hasReleaseCreatePermission) {
        let preparedChangeLog = helper.prepareChangeLog(options.body, changeLog);
        let releaseName = helper.releaseName(options.releaseName)
        const releaseUrl = await flow.createRelease(repoOwner, releaseRepo, options.draft, releaseName,
            preparedChangeLog, options.tag);

        // play yaba sound if the release successfully created
        helper.playSound(options.sound);

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
        process.exit();
    }
    return headBranch;
}

function checkDirectory() {
    // check if the current directory is git repo
    if (options.repo == undefined && !helper.isGitRepo()) {
        console.log(`The directory '${helper.retrieveCurrentDirectory()}' is not a Git repo.`);
        process.exit();
    }
}

function printChangelog(repoName, changeLog) {
    console.log('\n\n' + kleur.green().underline(`${repoName} changelog for upcoming release:`) + `\n\n${helper.prepareChangeLog(options.body, changeLog)}\n`);
}

function canCreateRelease(changeLog) {
    return changeLog.length != 0 && !options.changelog;
}

function canShowChangelog(changeLog) {
    return changeLog.length != 0 && options.changelog;
}

