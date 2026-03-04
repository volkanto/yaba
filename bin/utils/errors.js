import { exitCodes } from './exit-codes.js';

const NETWORK_ERROR_CODES = ['ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN'];

class YabaError extends Error {
    constructor(message, exitCode = exitCodes.INTERNAL, cause = null) {
        super(message);
        this.name = 'YabaError';
        this.exitCode = exitCode;
        if (cause) {
            this.cause = cause;
        }
    }
}

function createError(message, exitCode, cause = null) {
    return new YabaError(message, exitCode, cause);
}

function mapGithubError(error, defaultMessage) {
    const status = error?.status || error?.response?.status;
    if (NETWORK_ERROR_CODES.includes(error?.code)) {
        return createError(defaultMessage, exitCodes.NETWORK, error);
    }

    if (status === 401 || status === 403) {
        return createError(`${defaultMessage} Authentication/authorization failed.`, exitCodes.AUTH, error);
    }

    return createError(defaultMessage, exitCodes.UPSTREAM, error);
}

function mapNetworkError(error, defaultMessage) {
    if (NETWORK_ERROR_CODES.includes(error?.code)) {
        return createError(defaultMessage, exitCodes.NETWORK, error);
    }

    return createError(defaultMessage, exitCodes.UPSTREAM, error);
}

function normalizeError(error) {
    if (error instanceof YabaError) {
        return error;
    }

    return createError(error?.message || 'Unexpected error.', exitCodes.INTERNAL, error);
}

export { YabaError, createError, mapGithubError, mapNetworkError, normalizeError };
