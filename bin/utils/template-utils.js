const fs = require("fs");
const stringUtils = require('./string-utils.js');
const path = require("path");
const constants = require('./constants');

module.exports = {
    
    /**
     * prepares the changelog with the given parameters.
     *
     * @param {*} body the full changelog of the release 
     * @param {*} owner the owner of the repository
     * @param {*} repo the repo name that is going to be released
     * @param {*} previousTag the tag name of the previous release
     * @param {*} currentTag the tag name of the current release
     */
    generateChangelog: function(body, owner, repo, previousTag, currentTag) {
        const templatePath = path.join(__dirname, constants.CHANGELOG_TEMPLATE);
        const templateFile = fs.readFileSync(templatePath, 'utf8');

        return stringUtils.format(templateFile, {
            changelogBody: body,
            owner: owner,
            repo: repo,
            lastTag: previousTag,
            newTag: currentTag
        });
    }

}
