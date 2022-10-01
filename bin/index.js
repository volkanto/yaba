#!/usr/bin/env node

const kleur = require("kleur");
const helper = require('./utils/helper.js');
const tool = require('./utils/tool.js');
const flow = require('./utils/flow.js');
const options = require('./utils/command.js').options;
const templateUtils = require('./utils/template-utils.js');
const boxen = require('boxen');
const { exec } = require('child_process');

runYaba();

async function runYaba() {

    try {

        // https://www.npmjs.com/package/tiny-updater OR https://www.npmjs.com/package/update-notifier
        // can be used instead below method.

        // check if the yaba cli has newer version
        await tool.checkUpdate();
        
        // check required ENV variables
        flow.checkRequiredEnvVariables();

        // check if the current directory is git repo
        checkDirectory();

        // check internet connection
        await flow.checkInternetConnection();

        checkHotfixRelease();

        // prepare username, repoOwner and releaseRepo
        const username = await flow.retrieveUsername();
        const repoOwner = helper.retrieveOwner(options.owner, username);
        const releaseRepo = helper.retrieveReleaseRepo(options.repo);

        // fetch head branch
        const headBranch = await checkHeadBranch(repoOwner, releaseRepo);

        // fetch last release of the repository
        const lastRelease = await flow.fetchLastRelease(repoOwner, releaseRepo);

        // preparing the changeLog from the main/master branch if there is no previous release
        let changeLog = await flow.prepareChangeLog(repoOwner, releaseRepo, headBranch, lastRelease);

        // show only changelog
        if (canShowChangelog(changeLog)) {
            printChangelog(changeLog);
        }

        // create the release
        if (canCreateRelease(changeLog)) {
            await prepareRelease(changeLog, repoOwner, releaseRepo, lastRelease.tag_name);
        }

        // release completed, to prevent hanging forcing to exit
        process.exit(1);

    } catch (error) {
        console.log(error);
    }
}

async function prepareRelease(changeLog, repoOwner, releaseRepo, lastReleaseTag) {

    const hasReleaseCreatePermission = await helper.releaseCreatePermit(options.interactive);

    if (hasReleaseCreatePermission) {
        let preparedChangeLog = helper.prepareChangeLog(options.body, changeLog);
        let changeLogDetails = templateUtils.generateChangelog(preparedChangeLog, repoOwner, releaseRepo, lastReleaseTag, helper.releaseTagName(options.tag));
        let releaseName = helper.releaseName(options.releaseName, options.hotfix);
        const releaseUrl = await flow.createRelease(repoOwner, releaseRepo, options.draft, releaseName,
            changeLogDetails, options.tag, options.hotfix);

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

function checkHotfixRelease() {
    // check if the current branch is not main/master and command has hotfix flag    
    exec('git branch --show-current', (err, stdout, stderr) => {
        if (err) {
            console.log(`An error occurred: ${err.message}`);
            process.exit();
        }
        
        if (stderr) {
            console.error(`An error occurred: ${stderr}`);
            process.exit();
        }

        const currentBranch = stdout;
        if (currentBranch == 'master' || currentBranch == 'main') {
            console.log(kleur.red("you can not create hotfix from main or master branches!"));
            process.exit();
        }
    });
}

function printChangelog(changeLog) {
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

function canCreateRelease(changeLog) {
    return changeLog.length != 0 && !options.changelog;
}

function canShowChangelog(changeLog) {
    return changeLog.length != 0 && options.changelog;
}

