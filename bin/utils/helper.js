import fs from 'fs';
import prompts from 'prompts';
import { isBlank, format as _format } from './string-utils.js';
import path from 'path';
import { format } from 'date-fns';
import { appConstants } from './constants.js';
import {fileURLToPath} from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


/**
 * returns the current date in 'yyyy-MM-dd' format
 *
 * @returns {string} the current formatted date
 */
export function releaseDate() {
    return format(new Date(), appConstants.RELEASE_DATE_FORMAT);
}

/**
 * prepares the tag name of the release. if the given {@code tagName} is blank,
 * this prepares the tag name in 'prod_global_yyyy-MM-dd.1' format.
 *
 * @param tagName the given tag name
 * @returns {string|*} the prepared tag name
 */
export function releaseTagName(tagName) {

    if (isBlank(tagName)) {
        const currentDate = format(new Date(), appConstants.TAG_DATE_FORMAT);
        return `prod_global_${currentDate}.1`;
    }

    return tagName;
}

/**
 * prepares the title of the release. if the given {@code name} is blank, this prepares
 * the title in 'Global release yyyy-MM-dd' format.
 * @param name the given release name
 * @returns {string|*}
 */
export function releaseName(name) {
    return isBlank(name) ? `Global release ${this.releaseDate()}` : name;
}

/**
 * prepares the release changelog. if {@code givenBody} is blank, this prepares the all the commits inside
 * the given {@code changelog} in a list as release changelog.
 *
 * @param givenBody the changelog which is defined by the user
 * @param changeLog the changelog which is generated automatically by checking head branch against the latest release
 * @returns {string|*} the release changelog
 */
export function prepareChangeLog(givenBody, changeLog) {

    if (!isBlank(givenBody)) {
        return givenBody;
    }

    let releaseMessage = "";
    // FIXME: there should be a better way
    changeLog.forEach(commit => {
        let message = commit.split('\n')[0];
        releaseMessage += `- ${message}\n`;
    });

    return isBlank(releaseMessage) ? "* No changes" : releaseMessage;
}

/**
 * checks if the current directory is a git repo or not.
 *
 * @returns {boolean} {@code true} if the current directory is a git repo, otherwise returns {@code false}
 */
export function isGitRepo() {
    return fs.existsSync(".git/");
}

/**
 * check if the current directory is a git repo, if yes this will return the name of the directory
 *
 * @returns {string}
 */
export function retrieveCurrentRepoName() {
    if (!this.isGitRepo()) {
        return "not a git repo";
    }
    return this.retrieveCurrentDirectory();
}

/**
 * retrieves the current directory name
 *
 * @returns {string}
 */
export function retrieveCurrentDirectory() {
    const currentFolderPath = process.cwd();
    return currentFolderPath.substring(currentFolderPath.lastIndexOf('/') + 1, currentFolderPath.length);
}

/**
 * retrieves the owner of the repository.
 *
 * @param owner the owner of the repository
 * @param username the username of the authenticated user
 * @returns {string}
 */
export function retrieveOwner(owner, username) {
    return (owner || process.env.YABA_GITHUB_REPO_OWNER || username);
}

/**
 *
 * prepares the release repository name. if the given {@code repo} is not defined, this will try to return
 * the current directory as release repo if it is a git repo.
 *
 * @param repo the repository to retrieve the repository name for the release
 * @returns {string}
 */
export function retrieveReleaseRepo(repo) {
    return (repo || this.retrieveCurrentRepoName());
}

/**
 * checks if all the required environment variables are set.
 *
 * @returns {boolean}
 */
export function requiredEnvVariablesExist() {
    if (process.env.YABA_GITHUB_ACCESS_TOKEN) {
        return true;
    }
    return false;
}

/**
 * shows prompt regarding the given parameter
 *
 * @param interactive the parameter to decide if yaba need to show prompt for the release creation
 * @returns {@code true} if the given {@code interactive} parameter is set to {@code true},
 * otherwise it returns the result depending on the prompt question.
 */
export async function releaseCreatePermit(interactive) {

    if (interactive == false) {
        return true;
    }

    const response = await prompts({
        type: 'confirm',
        name: 'create',
        message: 'Are you sure to create the release?',
        initial: false
    });

    return response.create;
}

/**
 * @param repo the repository to prepare Slack message for
 * @param message the changelog to send to Slack channel(s)
 * @param releaseUrl the release tag url on Github
 * @param releaseName the title of the release
 * @returns {string} the formatted JSON to send to Slack
 */
export function prepareSlackMessage(repo, message, releaseUrl, releaseName) {

    const slackMessageTemplatePath = path.join(__dirname, appConstants.SLACK_POST_TEMPLATE);
    let templateFile = fs.readFileSync(slackMessageTemplatePath);
    let templateJson = JSON.parse(templateFile);
    let slackMessageTemplate = JSON.stringify(templateJson);

    return _format(slackMessageTemplate, {
        repo: repo,
        changelog: message.trim(),
        releaseUrl: releaseUrl,
        releaseName: releaseName
    });
}

