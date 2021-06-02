#!/usr/bin/env node

const yargs = require("yargs");
const ora = require('ora');
const { Octokit } = require("octokit");
const helper = require('./utils/helper.js');
const pkg = require('../package.json');
const chalk = require("chalk");
const log = console.log;
const error = chalk.bold.red;
const spinner = ora();
const isOnline = require('is-online');

const octokit = new Octokit({
    auth: process.env.GITHUB_ACCESS_TOKEN
});

async function run() {

    try {

        spinner.start('Checking internet connection.');
        const isInternetUp = await isOnline();
        if (!isInternetUp) {
            spinner.fail('There is no internet connection!');
            return;
        }
        spinner.succeed('Internet connection established');

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

        if (options.repo == undefined && !helper.isGitRepo()) {
            error(`The directory '${helper.retrieveCurrentDirectory()}' is not a Git repo.`);
            return;
        }

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
        spinner.succeed('Changelog has been prepared...');

        if (options.changelog) {
            log('\n\n' + chalk.green.underline(`${releaseRepo} changelog for upcoming release:`) + `\n\n${helper.prepareChangeLog(options.body, changeLog)}\n`);
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

                spinner.succeed(`Release has been prepared on Github. ${newRelease.html_url}`);
                // log(`${newRelease.tag_name} has been created from ${newRelease.target_commitish}. Click the link to check the release ${newRelease.html_url}`);

            } catch (error) {
                spinner.fail(`Something went wrong while preparing the release! => ${error.errors}`);
            }
        }

    } catch (error) {
        log(error);
    }
}

run();
