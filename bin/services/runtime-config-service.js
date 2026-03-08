import fs from "fs";
import path from "path";
import * as helper from "../utils/helper.js";
import * as flow from "../utils/flow.js";
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
            tagPattern: "prod_global_{yyyyMMdd}.1",
            namePattern: "Global release {yyyy-MM-dd}",
            target: null,
            draft: false,
            interactive: true,
            firstReleaseMaxCommits: 50
        },
        notifications: {
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
        tag: firstDefined(
            options.tag,
            renderConfigPattern(runtimeConfig?.release?.tagPattern)
        ),
        target: firstDefined(
            options.target,
            runtimeConfig?.release?.target
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
        interactive: resolveBoolean(
            options.interactive,
            runtimeConfig?.release?.interactive,
            true
        ),
        body: options.body
    };
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
    const username = await flow.retrieveUsername();
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
        throw createError(`Config file '${filePath}' is not valid JSON.`, exitCodes.VALIDATION);
    }

    if (!isPlainObject(parsedContent)) {
        throw createError(`Config file '${filePath}' must contain a JSON object.`, exitCodes.VALIDATION);
    }

    deepMerge(target, parsedContent);
    loadedSet.add(filePath);
    loadedSources.push(filePath);
}
