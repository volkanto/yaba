#!/usr/bin/env node

// third party lib definitions
const yargs = require("yargs");
const ora = require('ora');
const { Octokit } = require("octokit");
const helper = require('./utils/helper.js');
const pkg = require('../package.json');
const chalk = require("chalk");
const isOnline = require('is-online');
const supportsHyperlinks = require('supports-hyperlinks');
const hyperlinker = require('hyperlinker');

// local variables
const spinner = ora();
const octokit = new Octokit({
    auth: process.env.GITHUB_ACCESS_TOKEN
});

async function run() {

    try {

        const options = yargs
            .version(pkg.version)
            .usage("Usage: yaba -o <owner> -r <repository> -t <tag> -n <release-name> -b <body> -d <draft> -c")
            .option("o", { alias: "owner", describe: "The repository owner.", type: "string" })
            .option("r", { alias: "repo", describe: "The repository name.", type: "string" })
            .option("t", { alias: "tag", describe: "The name of the tag.", type: "string" })
            .option("n", { alias: "release-name", describe: "The name of the release.", type: "string" })
            .option("b", { alias: "body", describe: "Text describing the contents of the tag. If not provided, the default changelog will be generated with the usage of the difference of master and latest release.", type: "string" })
            .option("d", { alias: "draft", describe: "`true` or only using `-d` makes the release a draft.", type: "boolean" })
            .option("c", { alias: "changelog", describe: "Shows only changelog without creating the release.", type: "boolean" })
            .argv;


        spinner.start('Checking required ENV variables...');
        if (helper.requiredEnvVariablesExist() == false) {
            spinner.fail('The required env variables are not set in order to run the command.');
            return;
        }
        spinner.succeed('Required ENV variables in place.');

        if (options.repo == undefined && !helper.isGitRepo()) {
            error(`The directory '${helper.retrieveCurrentDirectory()}' is not a Git repo.`);
            return;
        }

        spinner.start('Checking internet connection...');
        const isInternetUp = await isOnline();
        if (!isInternetUp) {
            spinner.fail('There is no internet connection!');
            return;
        }
        spinner.succeed('Internet connection established.');

        const { data: user } = await octokit.request('GET /user');
        const username = user.login;
        const repoOwner = helper.retrieveOwner(options.owner, username);
        const releaseRepo = helper.retrieveReleaseRepo(options.repo);

        spinner.start('Fetching latest release...');
        const { data: release } = await octokit.request('GET /repos/{owner}/{repo}/releases/latest', {
            owner: repoOwner,
            repo: releaseRepo
        });
        spinner.succeed(`Latest release is fetched: ${release.tag_name}`);

        spinner.start('Fetching head branch...');
        const { data: branches } = await octokit.request('GET /repos/{owner}/{repo}/branches', {
            owner: repoOwner,
            repo: releaseRepo
        });
        const headBranch = helper.retrieveHeadBranch(branches);
        spinner.succeed(`Head branch is fetched: ${headBranch}`);

        spinner.start('Preparing the changelog....');
        const latestTagName = release.tag_name;
        const { data: changeLog } = await octokit.request('GET /repos/{owner}/{repo}/compare/{base}...{head}', {
            owner: repoOwner,
            repo: releaseRepo,
            base: latestTagName,
            head: headBranch
        });
        if (changeLog.commits.length != 0) {
            spinner.succeed('Changelog has been prepared...');
        } else {
            spinner.succeed(chalk.yellow.underline('Nothing found to release.'));
        }

        if (changeLog.commits.length != 0 && options.changelog) {
            console.log('\n\n' + chalk.green.underline(`${releaseRepo} changelog for upcoming release:`) + `\n\n${helper.prepareChangeLog(options.body, changeLog)}\n`);
        }

        if (!options.changelog) {
            spinner.start('Preparing the release...');
            try {
                const { data: newRelease } = await octokit.request('POST /repos/{owner}/{repo}/releases', {
                    owner: repoOwner,
                    repo: releaseRepo,
                    draft: options.draft,
                    name: helper.releaseName(options.releaseName),
                    body: helper.prepareChangeLog(options.body, changeLog),
                    tag_name: helper.releaseTagName(options.tag)
                });

                let releaseMessage;
                if (supportsHyperlinks.stdout) {
                    releaseMessage = hyperlinker('Release has been prepared on Github.', `${newRelease.html_url}`);
                } else {
                    releaseMessage = `Release has been prepared on Github. ${newRelease.html_url}`;
                }
                spinner.succeed(releaseMessage);

            } catch (error) {
                spinner.fail(`Something went wrong while preparing the release! => ${error.errors}`);
            }
        }

    } catch (error) {
        console.log(error);
    }
}

run();
