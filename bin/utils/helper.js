const fs = require("fs");
const prompts = require('prompts');
const player = require('play-sound')(opts = {})
const path = require("path");
const { format } = require('date-fns')

module.exports = {
    releaseDate: function () {
        return format(new Date(), 'yyyy-MM-dd');
    },

    releaseTagName: function (tagName) {

        if (this.isBlank(tagName)) {
            const currentDate= format(new Date(), 'yyyyMMdd');
            return `prod_global_${currentDate}.1`;
        }

        return tagName;
    },

    isBlank: function (str) {
        return (str == "undefined" || !str || /^\s*$/.test(str));
    },

    releaseName: function (name) {
        return this.isBlank(name) ? `Global release ${this.releaseDate()}` : name;
    },

    prepareChangeLog: function (givenBody, changeLog) {

        if (!this.isBlank(givenBody)) {
            return givenBody;
        }

        let releaseMessage = "";
        // FIXME: there should be a better way
        changeLog.forEach(commit => {
            let message = commit.split('\n')[0];
            releaseMessage += `* ${message}\n`;
        });

        return this.isBlank(releaseMessage) ? "* No changes" : releaseMessage;
    },

    isGitRepo: function () {
        return fs.existsSync(".git/");
    },

    retrieveCurrentRepoName: function () {
        if (!this.isGitRepo()) {
            return "not a git repo";
        }
        return this.retrieveCurrentDirectory();
    },

    retrieveCurrentDirectory: function () {
        const currentFolderPath = process.cwd();
        return currentFolderPath.substring(currentFolderPath.lastIndexOf('/') + 1, currentFolderPath.length);
    },

    retrieveOwner: function (owner, username) {
        return (owner || process.env.GITHUB_REPO_OWNER || username);
    },

    retrieveReleaseRepo: function (repo) {
        return (repo || this.retrieveCurrentRepoName());
    },

    retrieveHeadBranch: function (branches) {
        let headBranch = branches.find(branch => branch.name === 'master' || branch.name === 'main');
        return headBranch == undefined ? null : headBranch.name;
    },

    requiredEnvVariablesExist: function () {
        if (process.env.GITHUB_ACCESS_TOKEN) {
            return true;
        }
        return false;
    },

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

    playSound: function (sound) {
        if (sound == true) {
            const filePath = path.join(__dirname, "../assets/yaba.mp3");
            player.play(filePath);
        }
    }
}
