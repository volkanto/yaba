#!/usr/bin/env node

// third party lib definitions
const yargs = require("yargs");
const chalk = require("chalk");

// local variables
const helper = require('./utils/helper.js');
const tool = require('./utils/tool.js');
const flow = require('./utils/flow.js');
const options = require('./utils/command.js');

async function run() {

    try {

        // https://www.npmjs.com/package/tiny-updater OR https://www.npmjs.com/package/update-notifier
        // can be used instead below method.
        await tool.checkUpdate(); // check if the yaba cli has newer version

        // check required ENV variables
        flow.checkRequiredEnvVariables();

        // check if the current directory is git repo
        if (options.repo == undefined && !helper.isGitRepo()) {
            console.log(`The directory '${helper.retrieveCurrentDirectory()}' is not a Git repo.`);
            return;
        }

        // check internet connection
        await flow.checkInternetConnection();

        const user = await flow.getAuthenticatedUser();
        const repoOwner = helper.retrieveOwner(options.owner, user.login);
        const releaseRepo = helper.retrieveReleaseRepo(options.repo);

        // fetch latest release
        const latestRelease = await flow.fetchLatestRelease(repoOwner, releaseRepo);

        // fetch head branch
        const headBranch = await flow.fetchHeadBranch(repoOwner, releaseRepo);

        if (headBranch == null) {
            console.log(chalk.red("Head branch can not be found! The release has been interrupted!"));
            return;
        }

        // preparing the changeLog from the main/master branch if there is no previous release
        let changeLog = latestRelease == null
            ? await flow.listCommits(repoOwner, releaseRepo, headBranch)
            : await flow.prepareChangelog(repoOwner, releaseRepo, latestRelease.tag_name, headBranch);

        // show only changelog
        if (changeLog.length != 0 && options.changelog) {
            console.log('\n\n' + chalk.green.underline(`${releaseRepo} changelog for upcoming release:`) + `\n\n${helper.prepareChangeLog(options.body, changeLog)}\n`);
        }

        // create the release
        if (changeLog.length != 0 && !options.changelog) {
            const isPermitted = await helper.releaseCreatePermit(options.interactive);
            if (isPermitted) {
                await flow.createRelease(repoOwner, releaseRepo, options.draft, options.releaseName, helper.prepareChangeLog(options.body, changeLog), options.tag);
                helper.playSound(options.sound);
            } else {
                console.log('Release was not prepared!');
            }
        }

    } catch (error) {
        console.log(error);
    }
}

run();
