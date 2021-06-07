const chalk = require("chalk");
const axios = require('axios')
const semver = require('semver');
const boxen = require('boxen');
const { Octokit } = require("octokit");

const helper = require('./helper.js');
// get local package name and version from package.json (or wherever)
const package = require('../../package.json');
const packageName = package.name;
const localVersion = package.version;

const octokit = new Octokit({
    auth: process.env.GITHUB_ACCESS_TOKEN
});

module.exports = {
    checkUpdate: async function () {

        const { data: cliLatestRelease } = await octokit.request('GET /repos/{owner}/{repo}/releases/latest', {
            owner: package.repository.user,
            repo: package.repository.name
        });

        const cliLatestVersion = chalk.green.underline(cliLatestRelease.html_url);

        const { data: result } = await axios.get(helper.getNpmRegistryUrl(packageName));
        const remoteVersion = result[0].version;
        if (semver.gt(remoteVersion, localVersion)) {
            const updateCommand = chalk.green('npm update -g yaba-release-cli');
            const updateMessage = `New version of Yaba available! ${localVersion} -> ${remoteVersion}` +
                `\nChangelog: ${cliLatestVersion}` +
                `\nPlease run ${updateCommand} to update!`;
            console.log(boxen(updateMessage, { padding: 1, align: 'center', borderColor: 'yellow', borderStyle: 'round' }));
        }
    }
}
