import { spawnSync } from 'child_process';
import { isBlank } from './string-utils.js';

/**
 * checks if the current directory is a git repo or not.
 *
 * @returns {boolean} {@code true} if the current directory is a git repo, otherwise returns {@code false}
 */
export function isGitRepo() {
    const commandResult = runGitCommand(['rev-parse', '--is-inside-work-tree']);
    return commandResult === 'true';
}

/**
 * check if the current directory is a git repo, if yes this will return the repository name.
 *
 * @returns {string}
 */
export function retrieveCurrentRepoName() {
    if (!isGitRepo()) {
        return "not a git repo";
    }
    const remoteUrl = runGitCommand(['config', '--get', 'remote.origin.url']);
    const remoteRepoName = retrieveRepoNameFromRemote(remoteUrl);
    return remoteRepoName || retrieveCurrentDirectory();
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
 * validates the given tag name against git ref format rules.
 *
 * @param tagName the tag candidate to validate
 * @returns {boolean}
 */
export function isValidGitTagName(tagName) {
    if (isBlank(tagName)) {
        return false;
    }

    const command = spawnSync('git', ['check-ref-format', '--allow-onelevel', `refs/tags/${tagName}`], {
        encoding: 'utf8'
    });

    return command.status === 0;
}

function runGitCommand(args) {
    const command = spawnSync('git', args, {
        encoding: 'utf8'
    });
    if (command.status !== 0) {
        return null;
    }
    return command.stdout.trim();
}

function retrieveRepoNameFromRemote(remoteUrl) {
    if (isBlank(remoteUrl)) {
        return null;
    }

    const normalizedRemote = remoteUrl.trim().replace(/\/+$/, '');
    let pathPart = normalizedRemote;

    if (normalizedRemote.includes('://')) {
        try {
            const parsedUrl = new URL(normalizedRemote);
            pathPart = parsedUrl.pathname;
        } catch (error) {
            pathPart = normalizedRemote;
        }
    } else if (normalizedRemote.includes(':')) {
        pathPart = normalizedRemote.substring(normalizedRemote.lastIndexOf(':') + 1);
    }

    const segments = pathPart.split('/').filter(Boolean);
    if (segments.length === 0) {
        return null;
    }

    const repository = segments[segments.length - 1].replace(/\.git$/, '');
    return isBlank(repository) ? null : repository;
}
