import * as fs from 'fs';
import path from "path";
import { fileURLToPath } from 'url';
import { format } from "./string-utils.js";
import { appConstants } from "./constants.js";


/**
 * prepares the changelog with the given parameters.
 *
 * @param {*} body the full changelog of the release 
 * @param {*} owner the owner of the repository
 * @param {*} repo the repo name that is going to be released
 * @param {*} previousTag the tag name of the previous release
 * @param {*} currentTag the tag name of the current release
 */
export function generateChangelog(body, owner, repo, previousTag, currentTag) {

    const changeLogTemplate = this.retrieveFile(appConstants.CHANGELOG_TEMPLATE);

    return format(changeLogTemplate, {
        changelogBody: body,
        owner: owner,
        repo: repo,
        lastTag: previousTag,
        newTag: currentTag
    });
}

/**
 * prepares grouped GitHub release notes body from mapped sections.
 *
 * @param {*} owner the owner of the repository
 * @param {*} repo the repository name
 * @param {*} previousTag the previous release tag/reference
 * @param {*} currentTag the new release tag
 * @param {*} data sections data with highlights and pre-rendered sections
 * @returns {string}
 */
export function generateGroupedGithubReleaseNotes(owner, repo, previousTag, currentTag, data) {
    const template = this.retrieveFile(appConstants.GITHUB_RELEASE_TEMPLATE);
    return format(template, {
        owner: owner,
        repo: repo,
        lastTag: previousTag,
        newTag: currentTag,
        highlights: data.highlights,
        sections: data.sections
    });
}

/**
 * returns the file with the given path.
 * @param {*} _path the path of the file
 * @returns  the file.
 */
export function retrieveFile(_path) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    return fs.readFileSync(path.join(__dirname, _path), 'utf8');
}
