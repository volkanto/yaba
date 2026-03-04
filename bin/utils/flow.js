import { Octokit } from "octokit";
import supportsHyperlinks from "supports-hyperlinks";
import hyperlinker from "hyperlinker";
import isOnline from "is-online";
import ora from "ora";
import * as helper from './helper.js';
import kleur from "kleur";
import axios from "axios";
import { createError, mapGithubError, mapNetworkError } from './errors.js';
import { exitCodes } from './exit-codes.js';
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
        throw createError('The required env variables are not set in order to run the command.', exitCodes.VALIDATION);
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
    try {
        const isInternetUp = await isOnline();
        if (!isInternetUp) {
            spinner.fail('There is no internet connection!');
            throw createError('There is no internet connection.', exitCodes.NETWORK);
        }
        spinner.succeed('Internet connection established.');
    } catch (error) {
        if (error?.exitCode) {
            throw error;
        }
        spinner.fail('Unable to verify internet connection.');
        throw mapNetworkError(error, 'Unable to verify internet connection.');
    }
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
        const status = error?.status || error?.response?.status;
        if (status === 404) {
            spinner.warn(`Last release not found.`);
            return null;
        }
        spinner.fail('Could not fetch the latest release.');
        throw mapGithubError(error, 'Could not fetch the latest release.');
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
    try {
        const { data: repository } = await octokit.request('GET /repos/{owner}/{repo}', {
            owner: owner,
            repo: repo
        });

        spinner.succeed(`Head branch: ${kleur.blue().bold().underline(repository.default_branch)}`);
        return repository.default_branch;
    } catch (error) {
        spinner.fail('Could not fetch repository default branch.');
        throw mapGithubError(error, 'Could not fetch repository default branch.');
    }
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
        const errorMessage = error?.response?.data?.message;
        spinner.fail(`Something went wrong while preparing the changelog! ${errorMessage || ''}`.trim());
        throw mapGithubError(error, 'Could not prepare changelog.');
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
    try {
        const { data: commits } = await octokit.request('GET /repos/{owner}/{repo}/commits', {
            owner: owner,
            repo: repo
        });
        spinner.succeed('Commits have been fetched...');

        // return commits;
        return commits.map(item => {
            return item.commit.message;
        });
    } catch (error) {
        spinner.fail(`Could not fetch commits from ${head} branch.`);
        throw mapGithubError(error, `Could not fetch commits from ${head} branch.`);
    }
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
        const errors = error?.response?.data?.errors || [];
        const message = error?.response?.data?.message || 'Could not create release';
        errors.forEach(element => {
            errorMessage += `\t* field: '${element.field}' - code: '${element.code}'`;
        });
        spinner.fail(`${message} while preparing the release! ${errorMessage}`);
        throw mapGithubError(error, `${message} while preparing the release.`);
    }
}

/**
 * retrieves the username with the help of the authentication token
 * @returns {Promise<*>}
 */
export async function retrieveUsername() {
    try {
        const { data: user } = await octokit.request('GET /user');
        return user.login;
    } catch (error) {
        throw mapGithubError(error, 'Could not retrieve authenticated user.');
    }
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
            spinner.fail('Slack publish requested but YABA_SLACK_HOOK_URL is not configured.');
            throw createError('Slack publish requested but YABA_SLACK_HOOK_URL is not configured.', exitCodes.VALIDATION);
        }

        const slackHookUrlList = slackHookUrls.split(",").map(item => item.trim()).filter(Boolean);
        if (slackHookUrlList.length === 0) {
            spinner.fail('Slack publish requested but no valid webhook URL exists.');
            throw createError('Slack publish requested but no valid webhook URL exists.', exitCodes.VALIDATION);
        }

        const message = helper.prepareSlackMessage(repo, changelog, releaseUrl, releaseName);
        try {
            for (const channelUrl of slackHookUrlList) {
                await postToSlack(channelUrl, message);
            }
            spinner.succeed('Changelog published to Slack.');
        } catch (error) {
            spinner.fail('Release was created but Slack announcement failed.');
            throw createError('Release was created but Slack announcement failed.', exitCodes.PARTIAL_SUCCESS, error);
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
    await axios.post(channelUrl, message);
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
