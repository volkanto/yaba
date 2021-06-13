const fs = require("fs");
const prompts = require('prompts');
const player = require('play-sound')(opts = {})
const path = require("path");

module.exports = {
    releaseDate: function () {
        let today = new Date();
        let _date = today.getDate();

        let _month = today.getMonth() + 1;
        const _year = today.getFullYear();
        if (_date < 10) {
            _date = `0${_date}`;
        }

        if (_month < 10) {
            _month = `0${_month}`;
        }
        return `${_year}-${_month}-${_date}`;
    },

    releaseTagName: function (tagName) {

        if (this.isBlank(tagName)) {
            let today = new Date();
            let _date = today.getDate();

            let _month = today.getMonth() + 1;
            const _year = today.getFullYear();
            if (_date < 10) {
                _date = `0${_date}`;
            }

            if (_month < 10) {
                _month = `0${_month}`;
            }
            return `prod_global_${_year}${_month}${_date}.1`;
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

    getNpmRegistryUrl: function (packageName) {
        const buildRegistryUrl = (package) => `https://www.npmjs.com/search/suggestions?q=${package}`;
        return buildRegistryUrl(packageName);
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

