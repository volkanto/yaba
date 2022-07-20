import kleur from 'kleur';
import SemVer from 'semver';
import boxen from 'boxen';
import { format } from './string-utils.js';
import latestVersion from 'latest-version';
import _packageJson from "../../package.json" assert { type: "json" };
import { retrieveFile } from './template-utils.js';
import { appConstants, defaultBoxOptions } from './constants.js';

/**
 * checks if yaba has newer version.
 * @returns {Promise<void>}
 */
export async function checkUpdate() {
    const appVersion = _packageJson.version;
    const lastVersion = await latestVersion('yaba-release-cli');
    if (SemVer.gt(lastVersion, appVersion)) {
        const message = prepareUpdateMessage(lastVersion, appVersion);
        console.log(boxen(message, defaultBoxOptions));
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

    const updateMessageTemplate = retrieveFile(appConstants.UPDATE_MESSAGE_TEMPLATE);

    return format(updateMessageTemplate, {
        localVersion: kleur.red().bold(localVersion),
        lastVersion: kleur.green().bold(lastVersion),
        updateCommand: kleur.green(appConstants.UPDATE_COMMAND)
    });
}

