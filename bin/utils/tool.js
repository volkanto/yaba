const kleur = require('kleur');
const semver = require('semver');
const boxen = require('boxen');
const latestVersion = require('latest-version');
const package = require('../../package.json');

module.exports = {
    checkUpdate: async function () {

        const localVersion = package.version;
        const lastVersion = await latestVersion('yaba-release-cli');

        if (semver.gt(lastVersion, localVersion)) {
            const message = prepareUpdateMessage(lastVersion, localVersion);
            console.log(boxen(message, defaultBoxOptions));
        }
    }
}

function prepareUpdateMessage(lastVersion, localVersion) {

    const localVersionMessage = kleur.red().bold(localVersion);
    const lastVersionMessage = kleur.green().bold(lastVersion)
    const updateCommand = kleur.green('npm update -g yaba-release-cli');
    const message = `New version of Yaba available! ${localVersionMessage} -> ${lastVersionMessage}` +
        `\nPlease run ${updateCommand} to update!`;

    return message;
}

const defaultBoxOptions = {
    padding: 1,
    align: 'center',
    borderColor: 'yellow',
    borderStyle: 'round'
}
