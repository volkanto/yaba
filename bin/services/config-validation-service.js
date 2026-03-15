import { isNonEmptyString, isPlainObject } from "../utils/runtime-config.js";

export function validateRuntimeConfigSchema(runtimeConfig, supportedNotificationProviders = ["slack"]) {
    const issues = [];

    if (!isPlainObject(runtimeConfig)) {
        return ["Configuration root must be a JSON object."];
    }

    validateOptionalString(runtimeConfig?.github?.owner, "github.owner", issues);
    validateOptionalString(runtimeConfig?.release?.repo, "release.repo", issues);
    validateOptionalString(runtimeConfig?.release?.tagPattern, "release.tagPattern", issues);
    validateOptionalEnum(
        runtimeConfig?.release?.tagStrategy,
        "release.tagStrategy",
        ["pattern", "semver", "sha"],
        issues
    );
    validateOptionalEnum(
        runtimeConfig?.release?.tagOnConflict,
        "release.tagOnConflict",
        ["increment", "fail"],
        issues
    );
    validateOptionalPositiveInteger(runtimeConfig?.release?.tagMaxAttempts, "release.tagMaxAttempts", issues);
    validateOptionalString(runtimeConfig?.release?.namePattern, "release.namePattern", issues);
    validateOptionalString(runtimeConfig?.release?.target, "release.target", issues);

    validateBoolean(runtimeConfig?.release?.draft, "release.draft", issues);
    validateBoolean(runtimeConfig?.release?.interactive, "release.interactive", issues);
    validateBoolean(runtimeConfig?.release?.allowEmpty, "release.allowEmpty", issues);
    validateBoolean(runtimeConfig?.release?.failOnEmpty, "release.failOnEmpty", issues);
    validateOptionalPositiveInteger(runtimeConfig?.release?.maxCommits, "release.maxCommits", issues);
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

    validateLabelBuckets(runtimeConfig?.release?.labelBuckets, issues);

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

function validateOptionalEnum(value, path, supportedValues, issues) {
    if (value == null) {
        return;
    }

    if (!isNonEmptyString(value)) {
        issues.push(`${path} must be one of: ${supportedValues.join(", ")}.`);
        return;
    }

    const normalized = value.trim().toLowerCase();
    if (!supportedValues.includes(normalized)) {
        issues.push(`${path} must be one of: ${supportedValues.join(", ")}.`);
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

function validateOptionalPositiveInteger(value, path, issues) {
    if (value === undefined || value === null || value === "") {
        return;
    }

    if (!Number.isInteger(value) || value <= 0) {
        issues.push(`${path} must be a positive integer when provided.`);
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

function validateLabelBuckets(value, issues) {
    if (value === null || value === undefined) return;

    if (!Array.isArray(value)) {
        issues.push("release.labelBuckets must be an array or null.");
        return;
    }

    const keys = new Set();
    value.forEach((bucket, i) => {
        if (!bucket || typeof bucket !== "object") {
            issues.push(`release.labelBuckets[${i}] must be an object.`);
            return;
        }
        if (typeof bucket.key !== "string" || bucket.key.trim() === "") {
            issues.push(`release.labelBuckets[${i}].key must be a non-empty string.`);
        } else if (keys.has(bucket.key)) {
            issues.push(`release.labelBuckets[${i}].key "${bucket.key}" is duplicated.`);
        } else {
            keys.add(bucket.key);
        }
        if (bucket.title !== undefined && (typeof bucket.title !== "string" || bucket.title.trim() === "")) {
            issues.push(`release.labelBuckets[${i}].title must be a non-empty string when provided.`);
        }
        if (!Array.isArray(bucket.labels) || bucket.labels.length === 0
                || bucket.labels.some(l => typeof l !== "string" || l.trim() === "")) {
            issues.push(`release.labelBuckets[${i}].labels must be a non-empty array of non-empty strings.`);
        }
    });
}
