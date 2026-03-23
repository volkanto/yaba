import axios from "axios";
import { spinner } from "./spinner.js";
import * as helper from "./helper.js";
import { createError } from "./errors.js";
import { exitCodes } from "./exit-codes.js";

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 500;
const RETRYABLE_NETWORK_CODES = ['ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN'];

/**
 * publishes the given message to the slack channels which are defined in the environment variables
 *
 * @param publish decides if the given message to be published to the slack channels
 * @param repo the repository to prepare the slack message header
 * @param changelog the changelog/message to send to the slack channels
 * @param releaseUrl the release tag url on Github
 * @param releaseName the title of the release
 * @param compareUrl the compare URL between previous and current release refs
 */
export async function publish(publish, repo, changelog, releaseUrl, releaseName, compareUrl) {

    if (publish) {

        spinner.start('Sending release information to Slack channel...');

        const slackHookUrls = process.env.YABA_SLACK_HOOK_URL;
        if (!slackHookUrls) {
            spinner.fail('Slack publish requested but YABA_SLACK_HOOK_URL is not configured.');
            throw createError('Slack publish requested but YABA_SLACK_HOOK_URL is not configured.', exitCodes.VALIDATION);
        }

        const slackHookUrlList = slackHookUrls.split(",").map(item => item.trim()).filter(Boolean);
        if (slackHookUrlList.length === 0) {
            spinner.fail('Slack publish requested but no valid webhook URL exists.');
            throw createError('Slack publish requested but no valid webhook URL exists.', exitCodes.VALIDATION);
        }

        const message = helper.prepareSlackMessage(repo, changelog, releaseUrl, releaseName, compareUrl);
        try {
            for (const channelUrl of slackHookUrlList) {
                await publishWithRetry(channelUrl, message);
            }
            spinner.succeed('Changelog published to Slack.');
        } catch (error) {
            spinner.fail('Release was created but Slack announcement failed.');
            throw createError('Release was created but Slack announcement failed.', exitCodes.PARTIAL_SUCCESS, error);
        }
    }
}

/**
 * sends a Slack message with bounded retries and exponential backoff.
 *
 * @param channelUrl Slack webhook URL
 * @param message Slack payload
 * @param options retry settings
 * @returns {Promise<void>}
 */
export async function publishWithRetry(channelUrl, message, options = {}) {
    const maxAttempts = resolveMaxAttempts(options.maxAttempts);
    const baseDelayMs = resolveBaseDelay(options.baseDelayMs);
    const postFn = typeof options.postFn === 'function' ? options.postFn : post;
    const sleepFn = typeof options.sleepFn === 'function' ? options.sleepFn : wait;

    let lastError = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            await postFn(channelUrl, message);
            return;
        } catch (error) {
            lastError = error;
            const canRetry = attempt < maxAttempts && isRetriable(error);
            if (!canRetry) {
                throw error;
            }

            const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
            await sleepFn(delayMs);
        }
    }

    throw lastError;
}

async function post(channelUrl, message) {
    await axios.post(channelUrl, message);
}

function isRetriable(error) {
    const status = error?.status || error?.response?.status;
    if (RETRYABLE_NETWORK_CODES.includes(error?.code)) {
        return true;
    }

    return status === 429 || status === 408 || (typeof status === 'number' && status >= 500);
}

function resolveMaxAttempts(value) {
    if (!Number.isInteger(value) || value <= 0) {
        return DEFAULT_MAX_ATTEMPTS;
    }

    return value;
}

function resolveBaseDelay(value) {
    if (!Number.isInteger(value) || value <= 0) {
        return DEFAULT_BASE_DELAY_MS;
    }

    return value;
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
