import { Octokit } from "octokit";
import supportsHyperlinks from "supports-hyperlinks";
import hyperlinker from "hyperlinker";
import isOnline from "is-online";
import ora from "ora";
import * as helper from './helper.js';
import kleur from "kleur";
import axios from "axios";
const octokit = new Octokit({
    auth: process.env.YABA_GITHUB_ACCESS_TOKEN
});
const spinner = ora();

/**
 * checks if the all required environment variables in place.
 */
export function checkRequiredEnvVariables() {

    spinner.start('Checking required ENV variables...');
    if (helper.requiredEnvVariablesExist() == false) {
        spinner.fail('The required env variables are not set in order to run the command.');
        process.exit();
    }
    spinner.succeed('Required ENV variables in place.');
}

/**
 * checks if internet connection is available.
 *
 * @returns {Promise<void>}
 */
export async function checkInternetConnection() {

    spinner.start('Checking internet connection...');
    const isInternetUp = await isOnline();
    if (!isInternetUp) {
        spinner.fail('There is no internet connection!');
        process.exit();
    }
    spinner.succeed('Internet connection established.');
}

/**
 * fetches the last release
 *
 * @param owner the owner of the repository
 * @param repo the repository to fetch last release for
 * @returns {Promise<null|any>}
 */
export async function fetchLastRelease(owner, repo) {
    spinner.start('Fetching the last release...');
    try {
        const { data: release } = await octokit.request('GET /repos/{owner}/{repo}/releases/latest', {
            owner: owner,
            repo: repo
        });
        spinner.succeed(`Last release: ${kleur.blue().bold().underline(release.tag_name)}`);
        return release;
    } catch (error) {
        spinner.warn(`Last release not found.`);
        return null;
    }
}

/**
 * fetches head branch name
 *
 * @param owner the owner of the repository
 * @param repo the repository to fetch the head branch name
 * @returns {Promise<null>}
 */
export async function fetchHeadBranch(owner, repo) {
    spinner.start('Fetching head branch...');
    const { data: headBranch } = await octokit.request('GET /repos/{owner}/{repo}/branches/{branch}', {
        owner: owner,
        repo: repo,
        branch: 'master'
    });

    spinner.succeed(`Head branch: ${kleur.blue().bold().underline(headBranch.name)}`);
    return headBranch.name;
}

/**
 * if no release found, this will list all the commits in the head branch, otherwise will prepare the changelog
 * between the latest release and the given head branch.
 *
 * @param owner the owner of the repository
 * @param repo the repository to prepare changelog for
 * @param head the head branch
 * @param lastRelease the last release of the repo
 * @returns {Promise<*|*>}
 */
export async function prepareChangeLog(owner, repo, head, lastRelease) {

    let changeLog = lastRelease == null
        ? await this.listCommits(owner, repo, head)
        : await this.prepareChangelog(owner, repo, lastRelease.tag_name, head);

    return changeLog;
}

/**
 * prepares changelog with the given parameters
 *
 * @param owner the owner of the repository
 * @param repo the repository to prepare changelog for
 * @param base the branch to compare with the {@code head}
 * @param head the head branch of the {@code repo}
 * @returns {Promise<string[]>}
 */
export async function prepareChangelog(owner, repo, base, head) {
    spinner.start('Preparing the changelog....');

    try {
        const { data: changeLog } = await octokit.request('GET /repos/{owner}/{repo}/compare/{base}...{head}', {
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

    } catch (error) {
        const errorResponseData = error.response.data;
        spinner.fail(`Something went wrong while preparing the changelog! ${errorResponseData.message} -> ${errorResponseData.documentation_url}`);
        process.exit();
    }
}

/**
 * fetches the commits from the {@code head} branch
 * @param owner the owner of the repository
 * @param repo the repository to fetch commits from
 * @param head the head branch of the {@code repo}
 * @returns {Promise<*>}
 */
export async function listCommits(owner, repo, head) {
    spinner.start(`Fetching commits from ${head} branch...`);
    const { data: commits } = await octokit.request('GET /repos/{owner}/{repo}/commits', {
        owner: owner,
        repo: repo
    });
    spinner.succeed('Commits have been fetched...');

    // return commits;
    return commits.map(item => {
        return item.commit.message;
    });
}

/**
 * creates the release with the given parameters
 *
 * @param owner the owner of the repository
 * @param repo the repository to create release for
 * @param draft defines if release is a draft or not
 * @param name the name/title of the release
 * @param body the changelog to be defined in the release
 * @param tag_name the tag name
 * @returns {Promise<void>}
 */
export async function createRelease(owner, repo, draft, name, body, tag_name) {

    try {
        spinner.start('Preparing the release...');

        const { data: newRelease } = await octokit.request('POST /repos/{owner}/{repo}/releases', {
            owner: owner,
            repo: repo,
            draft: draft,
            name: helper.releaseName(name),
            body: body,
            tag_name: helper.releaseTagName(tag_name)
        });

        // if the user terminal supports hyperlink, this will be a clickable link, otherwise prints plain text.
        const releaseUrl = prepareReleaseUrl(newRelease.html_url);
        spinner.succeed(`Release has been prepared on Github. ${releaseUrl}`);

        return newRelease.html_url;

    } catch (error) {
        let errorMessage = "\n";
        let errors = error.response.data.errors;
        let message = error.response.data.message;
        errors.forEach(element => {
            errorMessage += `\t* field: '${element.field}' - code: '${element.code}'`;
        });
        spinner.fail(`${message} while preparing the release! ${errorMessage}`);
        process.exit();
    }
}

/**
 * retrieves the username with the help of the authentication token
 * @returns {Promise<*>}
 */
export async function retrieveUsername() {
    const { data: user } = await octokit.request('GET /user');
    return user.login;
}

/**
 * publishes the given message to the slack channels which are defined in the environment variables
 * @param publish decides if the given message to be published to the slack channels
 * @param repo the repository to prepare the slack message header
 * @param changelog the changelog/message to send to the slack channels
 * @param releaseUrl the release tag url on Github
 * @param releaseName the title of the release
 */
export async function publishToSlack(publish, repo, changelog, releaseUrl, releaseName) {

    if (publish == true) {

        spinner.start('Sending release information to Slack channel...');

        const slackHookUrls = process.env.YABA_SLACK_HOOK_URL;
        if (!slackHookUrls) {
            spinner.fail("Release not announced on Slack: configuration not found!");
            return;
        }

        const slackHookUrlList = slackHookUrls.split(",");
        const message = helper.prepareSlackMessage(repo, changelog, releaseUrl, releaseName);
        for (const channelUrl of slackHookUrlList) {
            await postToSlack(channelUrl, message);
        }
    }
}


/**
 * Sends the given message to the given Slack channel
 *
 * @param channelUrl the Slack channel webhook url to post {@code message} to
 * @param repo the name of the release repository
 * @param message the message to send to the given Slack {@code channelUrl}
 */
async function postToSlack(channelUrl, message) {
    await axios
        .post(channelUrl, message)
        .then(function (response) {
            spinner.succeed('Changelog published to Slack.');
        })
        .catch(error => {
            spinner.fail(`Something went wrong while sending to Slack channel: ${error}`);
            process.exit();
        });
}

/**
 *
 * @param releaseUrl
 * @returns {string|*}
 */
function prepareReleaseUrl(releaseUrl) {

    if (supportsHyperlinks.stdout) {
        return hyperlinker(`${kleur.blue().bold().underline(releaseUrl)}`);
    }
    return `${releaseUrl}`;
}
