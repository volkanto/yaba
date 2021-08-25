const kleur = require('kleur');
const semver = require('semver');
const boxen = require('boxen');
const stringUtils = require('./string-utils.js');
const latestVersion = require('latest-version');
const package = require('../../package.json');
const path = require("path");
const fs = require("fs");
const constants = require('./constants');

module.exports = {

    /**
     * checks if yaba has newer version.
     * @returns {Promise<void>}
     */
    checkUpdate: async function () {

        const localVersion = package.version;
        const lastVersion = await latestVersion('yaba-release-cli');

        if (semver.gt(lastVersion, localVersion)) {
            const message = prepareUpdateMessage(lastVersion, localVersion);
            console.log(boxen(message, defaultBoxOptions));
        }
    }
}

/**
 * prepares version update message to show to the user
 *
 * @param lastVersion the latest version which is available
 * @param localVersion the version which is installed on user's local machine
 * @returns {string} the version update message
 */
function prepareUpdateMessage(lastVersion, localVersion) {

    const templatePath = path.join(__dirname, constants.UPDATE_MESSAGE_TEMPLATE);
    const templateFile = fs.readFileSync(templatePath, 'utf8');

    const message = stringUtils.format(templateFile, {
        localVersion: kleur.red().bold(localVersion),
        lastVersion: kleur.green().bold(lastVersion),
        updateCommand: kleur.green(constants.UPDATE_COMMAND)
    });

    return message;
}

const defaultBoxOptions = {
    padding: 1,
    align: 'center',
    borderColor: 'yellow',
    borderStyle: 'round'
}
