import { isNonEmptyString, isPlainObject } from "../utils/runtime-config.js";

export function validateRuntimeConfigSchema(runtimeConfig, supportedNotificationProviders = ["slack"]) {
    const issues = [];

    if (!isPlainObject(runtimeConfig)) {
        return ["Configuration root must be a JSON object."];
    }

    validateOptionalString(runtimeConfig?.github?.owner, "github.owner", issues);
    validateOptionalString(runtimeConfig?.release?.repo, "release.repo", issues);
    validateOptionalString(runtimeConfig?.release?.tagPattern, "release.tagPattern", issues);
    validateOptionalString(runtimeConfig?.release?.namePattern, "release.namePattern", issues);
    validateOptionalString(runtimeConfig?.release?.target, "release.target", issues);

    validateBoolean(runtimeConfig?.release?.draft, "release.draft", issues);
    validateBoolean(runtimeConfig?.release?.interactive, "release.interactive", issues);
    validatePositiveInteger(
        runtimeConfig?.release?.firstReleaseMaxCommits,
        "release.firstReleaseMaxCommits",
        issues
    );

    validateProviderList(
        runtimeConfig?.notifications?.providers,
        supportedNotificationProviders,
        "notifications.providers",
        issues
    );
    validateBoolean(runtimeConfig?.notifications?.slack?.enabled, "notifications.slack.enabled", issues);

    validateOutputFormat(runtimeConfig?.output?.format, "output.format", issues);
    validateBoolean(runtimeConfig?.output?.color, "output.color", issues);
    validateBoolean(runtimeConfig?.output?.verbose, "output.verbose", issues);

    return issues;
}

function validateOptionalString(value, path, issues) {
    if (value == null) {
        return;
    }

    if (!isNonEmptyString(value)) {
        issues.push(`${path} must be a non-empty string when provided.`);
    }
}

function validateBoolean(value, path, issues) {
    if (typeof value !== "boolean") {
        issues.push(`${path} must be a boolean.`);
    }
}

function validatePositiveInteger(value, path, issues) {
    if (!Number.isInteger(value) || value <= 0) {
        issues.push(`${path} must be a positive integer.`);
    }
}

function validateProviderList(value, supportedProviders, path, issues) {
    if (!Array.isArray(value) || value.length === 0) {
        issues.push(`${path} must be a non-empty string array.`);
        return;
    }

    for (const providerName of value) {
        if (!isNonEmptyString(providerName)) {
            issues.push(`${path} must contain non-empty strings only.`);
            continue;
        }

        const normalized = providerName.trim().toLowerCase();
        if (!supportedProviders.includes(normalized)) {
            issues.push(`${path} contains unsupported provider '${providerName}'.`);
        }
    }
}

function validateOutputFormat(value, path, issues) {
    if (!isNonEmptyString(value)) {
        issues.push(`${path} must be either 'human' or 'json'.`);
        return;
    }

    const normalized = value.trim().toLowerCase();
    if (normalized !== "human" && normalized !== "json") {
        issues.push(`${path} must be either 'human' or 'json'.`);
    }
}
