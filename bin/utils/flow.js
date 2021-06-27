const {Octokit} = require("octokit");
const supportsHyperlinks = require('supports-hyperlinks');
const isOnline = require('is-online');
const ora = require('ora');
const spinner = ora();
const helper = require('./helper.js');
const kleur = require('kleur');
const axios = require('axios');
const octokit = new Octokit({
    auth: process.env.GITHUB_ACCESS_TOKEN
});

module.exports = {
    checkRequiredEnvVariables: function () {

        spinner.start('Checking required ENV variables...');
        if (helper.requiredEnvVariablesExist() == false) {
            spinner.fail('The required env variables are not set in order to run the command.');
            return;
        }
        spinner.succeed('Required ENV variables in place.');
    },

    checkInternetConnection: async function () {

        spinner.start('Checking internet connection...');
        const isInternetUp = await isOnline();
        if (!isInternetUp) {
            spinner.fail('There is no internet connection!');
            return;
        }
        spinner.succeed('Internet connection established.');
    },

    fetchLatestRelease: async function (owner, repo) {
        spinner.start('Fetching latest release...');
        try {
            const {data: release} = await octokit.request('GET /repos/{owner}/{repo}/releases/latest', {
                owner: owner,
                repo: repo
            });
            spinner.succeed(`Latest release is fetched: ${kleur.blue().bold().underline(release.tag_name)}`);
            return release;
        } catch (error) {
            spinner.warn(`Latest release not found.`);
            return null;
        }
    },

    fetchHeadBranch: async function (owner, repo) {
        spinner.start('Fetching head branch...');
        const {data: branches} = await octokit.request('GET /repos/{owner}/{repo}/branches', {
            owner: owner,
            repo: repo
        });
        const headBranch = helper.retrieveHeadBranch(branches);
        spinner.succeed(`Head branch is fetched: ${kleur.blue().bold().underline(headBranch)}`);
        return headBranch;
    },

    prepareChangelog: async function (owner, repo, base, head) {
        spinner.start('Preparing the changelog....');
        const {data: changeLog} = await octokit.request('GET /repos/{owner}/{repo}/compare/{base}...{head}', {
            owner: owner,
            repo: repo,
            base: base,
            head: head
        });
        if (changeLog.commits.length != 0) {
            spinner.succeed('Changelog has been prepared...');
        } else {
            spinner.succeed(kleur.yellow().underline('Nothing found to release.'));
        }

        return changeLog.commits.map(item => {
            return item.commit.message;
        });
    },

    listCommits: async function (owner, repo, head) {
        spinner.start(`Fetching commits from ${head} branch...`);
        const {data: commits} = await octokit.request('GET /repos/{owner}/{repo}/commits', {
            owner: owner,
            repo: repo
        });
        spinner.succeed('Commits have been fetched...');

        // return commits;
        return commits.map(item => {
            return item.commit.message;
        });
    },

    createRelease: async function (owner, repo, draft, name, body, tag_name) {

        try {
            spinner.start('Preparing the release...');

            const {data: newRelease} = await octokit.request('POST /repos/{owner}/{repo}/releases', {
                owner: owner,
                repo: repo,
                draft: draft,
                name: helper.releaseName(name),
                body: body,
                tag_name: helper.releaseTagName(tag_name)
            });

            const releaseUrl = prepareReleaseUrl(newRelease.html_url);
            spinner.succeed(`Release has been prepared on Github. ${releaseUrl}`);

        } catch (error) {
            let errorMessage = "\n";
            error.errors.forEach(element => {
                errorMessage += `\t* field: '${element.field}' - code: '${element.code}'`;
            });
            spinner.fail(`Something went wrong while preparing the release! ${errorMessage}`);
        }
    },

    retrieveUsername: async function () {
        const {data: user} = await octokit.request('GET /user');
        return user.login;
    },

    publishToSlack: function (publish, repo, message) {

        if (publish == true) {

            spinner.start('Sending release information to Slack channel...');

            let slackHookUrl = process.env.SLACK_HOOK_URL;
            if (!slackHookUrl) {
                spinner.fail("Release not announced on Slack: configuration not found!");
                return;
            }

            axios
                .post(process.env.SLACK_HOOK_URL, {
                    text: repo + " changelog for upcoming release:\n\n```\n" + message + "```"
                })
                .catch(error => {
                    spinner.fail(`Something went wrong while sending to Slack channel: ${error}`)
                });

            spinner.succeed('Changelog published to Slack.');
        }
    }
}

function prepareReleaseUrl(releaseUrl) {

    if (supportsHyperlinks.stdout) {
        return hyperlinker(`${kleur.blue().bold().underline(releaseUrl)}`);
    }
    return `${releaseUrl}`;
}
