#!/usr/bin/env node

const yargs = require("yargs");
const { Octokit } = require("octokit");
const helper = require('./utils/helper.js');
const pkg = require('../package.json');
const chalk = require("chalk");
const log = console.log;
const error = chalk.bold.red;

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

        if (options.repo == undefined && !helper.isGitRepo()) {
            error(`The directory '${helper.retrieveCurrentDirectory()}' is not a Git repo.`);
            return;
        }

        const { data: user } = await octokit.request('GET /user');
        const username = user.login;
        const repoOwner = helper.retrieveOwner(options.owner, username);
        const releaseRepo = helper.retrieveReleaseRepo(options.repo);

        const { data: release } = await octokit.request('GET /repos/{owner}/{repo}/releases/latest', {
            owner: repoOwner,
            repo: releaseRepo
        })
        const latestTagName = release.tag_name;
        const { data: changeLog } = await octokit.request('GET /repos/{owner}/{repo}/compare/{base}...{head}', {
            owner: repoOwner,
            repo: releaseRepo,
            base: latestTagName,
            head: 'master'
        });

        log(chalk.green.underline(`${releaseRepo} changelog for upcoming release:`) + `\n\n${helper.prepareChangeLog(options.body, changeLog)}`);

        if (!options.changelog) {
            try {
                const { data: newRelease } = await octokit.request('POST /repos/{owner}/{repo}/releases', {
                    owner: repoOwner,
                    repo: releaseRepo,
                    draft: options.draft,
                    name: helper.releaseName(options.releaseName),
                    body: helper.prepareChangeLog(options.body, changeLog),
                    tag_name: helper.releaseTagName(options.tag)
                });

                log(`${newRelease.tag_name} has been created from ${newRelease.target_commitish}. Click the link to check the release ${newRelease.html_url}`);

            } catch (error) {
                log(error.errors);
                // console.log(error.errors[0].code);
            }
        }

    } catch (error) {

        log(error);
        // console.log(error.errors);
    }
}

run();
