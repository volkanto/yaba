import fs from "fs";
import path from "path";
import * as helper from "../utils/helper.js";
import * as githubApi from "../utils/github-api.js";
import { createError } from "../utils/errors.js";
import { exitCodes } from "../utils/exit-codes.js";
import {
    deepMerge,
    firstDefined,
    isNonEmptyString,
    isPlainObject,
    renderConfigPattern,
    resolveBoolean
} from "../utils/runtime-config.js";

export function buildDefaultConfigTemplate() {
    return {
        github: {
            owner: null
        },
        release: {
            repo: null,
            tagPattern: "prod_global_{yyyyMMdd}.{HHmm}",
            tagStrategy: "pattern",
            tagOnConflict: "increment",
            tagMaxAttempts: 20,
            namePattern: "Global release {yyyy-MM-dd}",
            target: null,
            allowEmpty: false,
            failOnEmpty: false,
            maxCommits: null,
            draft: false,
            interactive: true,
            firstReleaseMaxCommits: 50,
            labelBuckets: null,
            noStatusChecks: false
        },
        notifications: {
            providers: ["slack"],
            slack: {
                enabled: false
            }
        },
        output: {
            format: "human",
            color: true,
            verbose: false
        }
    };
}

export function loadRuntimeConfig(options) {
    const config = buildDefaultConfigTemplate();
    const loadedSources = [];
    const loadedSet = new Set();

    const userConfigPath = resolveUserConfigPath();
    mergeConfigFile(config, userConfigPath, false, loadedSources, loadedSet);

    const projectConfigPath = path.join(process.cwd(), "yaba.config.json");
    mergeConfigFile(config, projectConfigPath, false, loadedSources, loadedSet);

    if (isNonEmptyString(options.configPath)) {
        const explicitConfigPath = resolveConfigFilePath(options.configPath);
        mergeConfigFile(config, explicitConfigPath, true, loadedSources, loadedSet);
    }

    config._meta = { sources: loadedSources };
    return config;
}

export function resolveReleaseContext(options, runtimeConfig) {
    return {
        releaseName: firstDefined(
            options.releaseName,
            renderConfigPattern(runtimeConfig?.release?.namePattern)
        ),
        tag: options.tag,
        tagPattern: runtimeConfig?.release?.tagPattern,
        tagStrategy: firstDefined(
            options.tagStrategy,
            runtimeConfig?.release?.tagStrategy,
            "pattern"
        ),
        tagOnConflict: firstDefined(
            options.tagOnConflict,
            runtimeConfig?.release?.tagOnConflict,
            "increment"
        ),
        tagMaxAttempts: resolveTagMaxAttempts(
            options.tagMaxAttempts,
            runtimeConfig?.release?.tagMaxAttempts
        ),
        target: firstDefined(
            options.target,
            runtimeConfig?.release?.target
        ),
        allowEmpty: resolveBoolean(
            options.allowEmpty,
            runtimeConfig?.release?.allowEmpty,
            false
        ),
        failOnEmpty: resolveBoolean(
            options.failOnEmpty,
            runtimeConfig?.release?.failOnEmpty,
            false
        ),
        maxCommits: resolveMaxCommits(
            options.maxCommits,
            runtimeConfig?.release?.maxCommits
        ),
        draft: resolveBoolean(
            options.draft,
            runtimeConfig?.release?.draft,
            false
        ),
        publish: resolveBoolean(
            options.publish,
            runtimeConfig?.notifications?.slack?.enabled,
            false
        ),
        notificationProviders: resolveNotificationProviders(runtimeConfig),
        interactive: resolveBoolean(
            options.interactive,
            runtimeConfig?.release?.interactive,
            true
        ),
        body: options.body,
        labelBuckets: runtimeConfig?.release?.labelBuckets ?? null,
        noStatusChecks: resolveBoolean(
            options.noStatusChecks,
            runtimeConfig?.release?.noStatusChecks,
            false
        )
    };
}

function resolveNotificationProviders(runtimeConfig) {
    const configuredProviders = runtimeConfig?.notifications?.providers;
    if (!Array.isArray(configuredProviders)) {
        return ["slack"];
    }

    const normalized = configuredProviders
        .map(item => (typeof item === "string" ? item.trim().toLowerCase() : ""))
        .filter(Boolean);

    return normalized.length > 0
        ? [...new Set(normalized)]
        : ["slack"];
}

function resolveMaxCommits(optionValue, configValue) {
    const candidate = firstDefined(optionValue, configValue);
    if (candidate === undefined || candidate === null || candidate === "") {
        return undefined;
    }

    const normalized = Number(candidate);
    if (!Number.isFinite(normalized) || !Number.isInteger(normalized) || normalized <= 0) {
        return Number.NaN;
    }

    return normalized;
}

function resolveTagMaxAttempts(optionValue, configValue) {
    const candidate = firstDefined(optionValue, configValue);
    if (candidate === undefined || candidate === null || candidate === "") {
        return undefined;
    }

    const normalized = Number(candidate);
    if (!Number.isFinite(normalized) || !Number.isInteger(normalized) || normalized <= 0) {
        return Number.NaN;
    }

    return normalized;
}

export function resolveReleaseRepo(options, runtimeConfig) {
    const configuredRepo = runtimeConfig?.release?.repo;
    return helper.retrieveReleaseRepo(firstDefined(options.repo, configuredRepo));
}

export async function resolveOwner(options, runtimeConfig) {
    if (isNonEmptyString(options.owner) || isNonEmptyString(process.env.YABA_GITHUB_REPO_OWNER)) {
        return helper.retrieveOwner(options.owner, null);
    }
    if (isNonEmptyString(runtimeConfig?.github?.owner)) {
        return runtimeConfig.github.owner.trim();
    }
    const username = await githubApi.retrieveUsername();
    return helper.retrieveOwner(null, username);
}

export function resolveConfigFilePath(configPath) {
    if (!isNonEmptyString(configPath)) {
        return path.join(process.cwd(), "yaba.config.json");
    }

    return path.isAbsolute(configPath)
        ? configPath
        : path.resolve(process.cwd(), configPath);
}

function resolveUserConfigPath() {
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (!isNonEmptyString(homeDir)) {
        return null;
    }

    return path.join(homeDir, ".config", "yaba", "config.json");
}

function mergeConfigFile(target, filePath, required, loadedSources, loadedSet) {
    if (!isNonEmptyString(filePath) || loadedSet.has(filePath)) {
        return;
    }

    if (!fs.existsSync(filePath)) {
        if (required) {
            throw createError(`Config file '${filePath}' was not found.`, exitCodes.VALIDATION);
        }
        return;
    }

    let parsedContent;
    try {
        parsedContent = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (error) {
        throw createError(`Config file '${filePath}' is not valid JSON: ${error.message}`, exitCodes.VALIDATION);
    }

    if (!isPlainObject(parsedContent)) {
        throw createError(`Config file '${filePath}' must contain a JSON object.`, exitCodes.VALIDATION);
    }

    deepMerge(target, parsedContent);
    loadedSet.add(filePath);
    loadedSources.push(filePath);
}
