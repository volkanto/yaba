#!/usr/bin/env node

// const chalk = require("chalk");
// const boxen = require("boxen");

// const greeting = chalk.white.bold("Hello!");

// const boxenOptions = {
//  padding: 1,
//  margin: 1,
//  borderStyle: "round",
//  borderColor: "green",
//  backgroundColor: "#555555"
// };
// const msgBox = boxen( greeting, boxenOptions );

// console.log(msgBox);

const yargs = require("yargs");
const axios = require("axios");
const { Octokit } = require("octokit");
const helper = require('./utils/helper.js');
const pkg = require('../package.json');

const octokit = new Octokit({
    auth: process.env.GITHUB_ACCESS_TOKEN_2
});

async function run() {

    try {

        const options = yargs
            .version(pkg.version)
            .usage("Usage: yaba -o <owner> -r <repository> -t <tag> -n <release-name> -b <body> -d <draft>")
            .option("o", { alias: "owner", describe: "The repository owner.", type: "string" })
            .option("r", { alias: "repo", describe: "The repository name.", type: "string" })
            .option("t", { alias: "tag", describe: "The name of the tag.", type: "string" })
            .option("n", { alias: "release-name", describe: "The name of the release.", type: "string", demandOption: true })
            .option("b", { alias: "body", describe: "Text describing the contents of the tag.", type: "string" })
            .option("d", { alias: "draft", describe: "`true` makes the release a draft, and `false` publishes the release.", type: "boolean" })
            .argv;

        if (options.repo == undefined && !helper.isGitRepo()) {
            console.log("The directory is not a Git repo.");
            return;
        }

        const { data: user } = await octokit.request('GET /user');
        const username = user.login;
        console.log(`logged in as ${user.name} - ${user.login}`);
        console.log(`owner is ${helper.retrieveOwner(options.owner, username)}`);

        const { data: release } = await octokit.request('GET /repos/{owner}/{repo}/releases/latest', {
            owner: username,
            repo: options.repo
        })
        const latestTagName = release.tag_name;
        console.log(`latest version is ${latestTagName} on ${options.repo}`);

        // const compare = `${latestTagName}...master`;
        const { data: changeLog } = await octokit.request('GET /repos/{owner}/{repo}/compare/{base}...{head}', {
            owner: username,
            repo: options.repo,
            base: latestTagName,
            head: 'master'
        });
        // console.log(process.cwd())
        console.log(`current directory is a git repo: ${helper.isGitRepo()}`);
        console.log(`current directory path is: ${helper.retrieveCurrentRepoName()}`);

        console.log(`Changelog: ${helper.prepareChangeLog(changeLog)}`)

        try {
            const { data: newRelease } = await octokit.request('POST /repos/{owner}/{repo}/releases', {
                owner: username,
                repo: options.repo,
                name: helper.releaseName(`${options.releaseName}`),
                body: helper.prepareChangeLog(changeLog),
                tag_name: helper.releaseTagName(`${options.tag}`)
            });

            console.log(newRelease.html_url);

        } catch (error) {
            console.log(error);
            // console.log(error.errors[0].code);
        }

    } catch (error) {

        console.log(error);
        // console.log(error.errors);
    }
}

run();
