#!/usr/bin/env node

// third party lib definitions
const yargs = require("yargs");
const pkg = require('../package.json');
const chalk = require("chalk");

// local variables
const package = require('../package.json');
const helper = require('./utils/helper.js');
const tool = require('./utils/tool.js');
const flow = require('./utils/flow.js');

async function run() {

    try {

        // https://www.npmjs.com/package/tiny-updater OR https://www.npmjs.com/package/update-notifier
        // can be used instead below method.
        await tool.checkUpdate(); // check if the yaba cli has newer version

        // yaba commands
        const options = yargs
            .usage("Usage: yaba -o <owner> -r <repository> -t <tag> -n <release-name> -b <body> -d <draft> -c")
            .option("o", {alias: "owner", describe: "The repository owner.", type: "string"})
            .option("r", {alias: "repo", describe: "The repository name.", type: "string"})
            .option("t", {alias: "tag", describe: "The name of the tag.", type: "string"})
            .option("n", {alias: "release-name", describe: "The name of the release.", type: "string"})
            .option("b", {
                alias: "body",
                describe: "Text describing the contents of the tag. If not provided, the default changelog will be generated with the usage of the difference of master and latest release.",
                type: "string"
            })
            .option("d", {
                alias: "draft",
                describe: "Creates the release as draft.",
                type: "boolean"
            })
            .option("c", {
                alias: "changelog",
                describe: "Shows only changelog without creating the release.",
                type: "boolean"
            })
            .option("i", {
                alias: "interactive",
                describe: "Prompt before (draft) release is created (default true)",
                type: "boolean"
            })
            .epilog(`Copyleft ${new Date().getFullYear()} ${package.author} - ${package.githubProfile}`)
            .alias('h', 'help')
            .help('help')
            .alias('v', 'version')
            .version(pkg.version)
            .argv;


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
            } else {
                console.log('Release was not prepared!');
            }
        }

    } catch (error) {
        console.log(error);
    }
}

run();
