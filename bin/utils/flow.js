import isOnline from "is-online";
import { spinner } from "./spinner.js";
import * as helper from './helper.js';
import { createError, mapNetworkError } from './errors.js';
import { exitCodes } from './exit-codes.js';

export { setOutputFormat } from './spinner.js';

export {
    fetchReleases,
    fetchLastRelease,
    fetchHeadBranch,
    prepareChangeLog,
    prepareChangelog,
    listCommits,
    createRelease,
    tagExists,
    fetchPullRequestByNumber,
    resolveTargetCommitish,
    retrieveUsername,
    inspectGithubAuth
} from './github-api.js';

export {
    publish,
    publishWithRetry
} from './slack.js';

/**
 * checks if the all required environment variables in place.
 */
export function checkRequiredEnvVariables() {

    spinner.start('Checking required ENV variables...');
    if (helper.requiredEnvVariablesExist() === false) {
        spinner.fail('The required env variables are not set in order to run the command.');
        throw createError('The required env variables are not set in order to run the command.', exitCodes.VALIDATION);
    }
    spinner.succeed('Required ENV variables in place.');
}

/**
 * checks if internet connection is available.
 *
 * @returns {Promise<void>}
 */
export async function checkInternetConnection() {

    spinner.start('Checking internet connection...');
    try {
        const isInternetUp = await isOnline();
        if (!isInternetUp) {
            spinner.fail('There is no internet connection!');
            throw createError('There is no internet connection.', exitCodes.NETWORK);
        }
        spinner.succeed('Internet connection established.');
    } catch (error) {
        if (error?.exitCode) {
            throw error;
        }
        spinner.fail('Unable to verify internet connection.');
        throw mapNetworkError(error, 'Unable to verify internet connection.');
    }
}
