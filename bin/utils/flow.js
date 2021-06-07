const { Octokit } = require("octokit");
const supportsHyperlinks = require('supports-hyperlinks');
const isOnline = require('is-online');
const ora = require('ora');
const spinner = ora();
const helper = require('./helper.js');
const chalk = require("chalk");
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
        const { data: release } = await octokit.request('GET /repos/{owner}/{repo}/releases/latest', {
            owner: owner,
            repo: repo
        });
        spinner.succeed(`Latest release is fetched: ${release.tag_name}`);
        return release;
    },

    fetchHeadBranch: async function (owner, repo) {
        spinner.start('Fetching head branch...');
        const { data: branches } = await octokit.request('GET /repos/{owner}/{repo}/branches', {
            owner: owner,
            repo: repo
        });
        const headBranch = helper.retrieveHeadBranch(branches);
        spinner.succeed(`Head branch is fetched: ${headBranch}`);
        return headBranch;
    },

    prepareChangelog: async function (owner, repo, base, head) {
        spinner.start('Preparing the changelog....');
        const { data: changeLog } = await octokit.request('GET /repos/{owner}/{repo}/compare/{base}...{head}', {
            owner: owner,
            repo: repo,
            base: base,
            head: head
        });
        if (changeLog.commits.length != 0) {
            spinner.succeed('Changelog has been prepared...');
        } else {
            spinner.succeed(chalk.yellow.underline('Nothing found to release.'));
        }
        return changeLog;
    },

    createRelease: async function (owner, repo, draft, name, body, tag_name) {
        spinner.start('Preparing the release...');
        try {
            const { data: newRelease } = await octokit.request('POST /repos/{owner}/{repo}/releases', {
                owner: owner,
                repo: repo,
                draft: draft,
                name: helper.releaseName(name),
                body: body,
                tag_name: helper.releaseTagName(tag_name)
            });

            let releaseMessage;
            if (supportsHyperlinks.stdout) {
                releaseMessage = hyperlinker('Release has been prepared on Github.', `${newRelease.html_url}`);
            } else {
                releaseMessage = `Release has been prepared on Github. ${newRelease.html_url}`;
            }
            spinner.succeed(releaseMessage);

        } catch (error) {
            let errorMessage = "\n";
            error.errors.forEach(element => {
                errorMessage += `\t* field: '${element.field}' - code: '${element.code}'`;
            });
            spinner.fail(`Something went wrong while preparing the release! ${errorMessage}`);
        }
    },

    getAuthenticatedUser: async function () {
        const { data: user } = await octokit.request('GET /user');
        return user;
    }
}
