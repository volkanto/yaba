const fs = require("fs");
const prompts = require("prompts");
const player = require("play-sound")(opts = {});
const stringUtils = require('./string-utils.js');
const path = require("path");
const {format} = require('date-fns');
const constants = require('./constants');

module.exports = {

    /**
     * returns the current date in 'yyyy-MM-dd' format
     *
     * @returns {string} the current formatted date
     */
    releaseDate: function () {
        return format(new Date(), constants.RELEASE_DATE_FORMAT);
    },

    /**
     * prepares the tag name of the release. if the given {@code tagName} is blank,
     * this prepares the tag name in 'prod_global_yyyy-MM-dd.1' format.
     *
     * @param tagName the given tag name
     * @returns {string|*} the prepared tag name
     */
    releaseTagName: function (tagName) {

        if (stringUtils.isBlank(tagName)) {
            const currentDate = format(new Date(), constants.TAG_DATE_FORMAT);
            return `prod_global_${currentDate}.1`;
        }

        return tagName;
    },

    /**
     * prepares the title of the release. if the given {@code name} is blank, this prepares
     * the title in 'Global release yyyy-MM-dd' format.
     * @param name the given release name
     * @returns {string|*}
     */
    releaseName: function (name) {
        return stringUtils.isBlank(name) ? `Global release ${this.releaseDate()}` : name;
    },

    /**
     * prepares the release changelog. if {@code givenBody} is blank, this prepares the all the commits inside
     * the given {@code changelog} in a list as release changelog.
     *
     * @param givenBody the changelog which is defined by the user
     * @param changeLog the changelog which is generated automatically by checking head branch against the latest release
     * @returns {string|*} the release changelog
     */
    prepareChangeLog: function (givenBody, changeLog) {

        if (!stringUtils.isBlank(givenBody)) {
            return givenBody;
        }

        let releaseMessage = "";
        // FIXME: there should be a better way
        changeLog.forEach(commit => {
            let message = commit.split('\n')[0];
            releaseMessage += `* ${message}\n`;
        });

        return stringUtils.isBlank(releaseMessage) ? "* No changes" : releaseMessage;
    },

    /**
     * checks if the current directory is a git repo or not.
     *
     * @returns {boolean} {@code true} if the current directory is a git repo, otherwise returns {@code false}
     */
    isGitRepo: function () {
        return fs.existsSync(".git/");
    },

    /**
     * check if the current directory is a git repo, if yes this will return the name of the directory
     *
     * @returns {string}
     */
    retrieveCurrentRepoName: function () {
        if (!this.isGitRepo()) {
            return "not a git repo";
        }
        return this.retrieveCurrentDirectory();
    },

    /**
     * retrieves the current directory name
     *
     * @returns {string}
     */
    retrieveCurrentDirectory: function () {
        const currentFolderPath = process.cwd();
        return currentFolderPath.substring(currentFolderPath.lastIndexOf('/') + 1, currentFolderPath.length);
    },

    /**
     * retrieves the owner of the repository.
     *
     * @param owner the owner of the repository
     * @param username the username of the authenticated user
     * @returns {string}
     */
    retrieveOwner: function (owner, username) {
        return (owner || (process.env.GITHUB_REPO_OWNER || process.env.YABA_GITHUB_REPO_OWNER) || username);
    },

    /**
     *
     * prepares the release repository name. if the given {@code repo} is not defined, this will try to return
     * the current directory as release repo if it is a git repo.
     *
     * @param repo the repository to retrieve the repository name for the release
     * @returns {string}
     */
    retrieveReleaseRepo: function (repo) {
        return (repo || this.retrieveCurrentRepoName());
    },

    /**
     *
     * retrieves the head branch from the given {@code branch} list.
     *
     * @param branches the all the branches which are belongs to the related repository.
     * @returns {null|*}
     */
    retrieveHeadBranch: function (branches) {
        let headBranch = branches.find(branch => branch.name === 'master' || branch.name === 'main');
        return headBranch == undefined ? null : headBranch.name;
    },

    /**
     * checks if all the required environment variables are set.
     *
     * @returns {boolean}
     */
    requiredEnvVariablesExist: function () {
        if (process.env.GITHUB_ACCESS_TOKEN || process.env.YABA_GITHUB_ACCESS_TOKEN) {
            return true;
        }
        return false;
    },

    /**
     * shows prompt regarding the given parameter
     *
     * @param interactive the parameter to decide if yaba need to show prompt for the release creation
     * @returns {@code true} if the given {@code interactive} parameter is set to {@code true},
     * otherwise it returns the result depending on the prompt question.
     */
    releaseCreatePermit: async function (interactive) {

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
    },

    /**
     * plays if the given {@code sound} parameter is {@code true}
     *
     * @param sound the parameter to decide to play sound
     */
    playSound: function (sound) {
        if (sound == true) {
            const filePath = path.join(__dirname, constants.SOUND_PATH);
            player.play(filePath);
        }
    },

    /**
     * @param repo the repository to prepare Slack message for
     * @param message the changelog to send to Slack channel(s)
     * @param releaseUrl the release tag url on Github
     * @param releaseName the title of the release
     * @returns {string} the formatted JSON to send to Slack
     */
    prepareSlackMessage: function (repo, message, releaseUrl, releaseName) {

        const slackMessageTemplatePath = path.join(__dirname, constants.SLACK_POST_TEMPLATE);
        let templateFile = fs.readFileSync(slackMessageTemplatePath);
        let templateJson = JSON.parse(templateFile);
        let slackMessageTemplate = JSON.stringify(templateJson);

        return stringUtils.format(slackMessageTemplate, {repo: repo, changelog: message, releaseUrl: releaseUrl, releaseName: releaseName});
    }
}
