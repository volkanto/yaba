const fs = require("fs");

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
            return `prod_${_year}${_month}${_date}.1`;
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
        changeLog.commits.forEach(change => {
            let message = change.commit.message.split('\n')[0];
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

    retrieveCurrentDirectory: function() {
        const currentFolderPath = process.cwd();
        return currentFolderPath.substring(currentFolderPath.lastIndexOf('/') + 1, currentFolderPath.length);
    },

    retrieveOwner: function (owner, username) {
        return (owner || process.env.GITHUB_REPO_OWNER || username);
    },

    retrieveReleaseRepo: function(repo) {
        return (repo || this.retrieveCurrentRepoName());
    }
}

