#!/usr/bin/env node

import kleur from "kleur";
import boxen from "boxen";
import fs from "fs";
import path from "path";
import * as helper from "./utils/helper.js";
import { checkUpdate } from "./utils/tool.js";
import * as flow from "./utils/flow.js";
import { options, isSupportedReleaseCommand } from "./utils/command.js";
import * as templateUtils from "./utils/template-utils.js";
import { exitCodes } from "./utils/exit-codes.js";
import { createError, normalizeError } from "./utils/errors.js";
import {
    deepMerge,
    firstDefined,
    isNonEmptyString,
    isPlainObject,
    renderConfigPattern,
    resolveBoolean,
    resolveOutputFormatCandidate,
    resolveOutputFormatFromSources
} from "./utils/runtime-config.js";

let runtimeOutputFormat = "human";

runYaba().then(exitCode => process.exit(exitCode));

async function runYaba() {

    try {
        setRuntimeOutputFormat(resolveOutputFormatCandidate(options.outputFormat));
        flow.setOutputFormat(runtimeOutputFormat);

        if (!isSupportedReleaseCommand(options)) {
            throw createError("Unsupported command. Use 'yaba release create --help', 'yaba release preview --help', 'yaba doctor --help', or 'yaba config init --help' for usage details.", exitCodes.VALIDATION);
        }

        if (isConfigInitCommand()) {
            return runConfigInit();
        }

        const runtimeConfig = loadRuntimeConfig();
        setRuntimeOutputFormat(resolveOutputFormat(runtimeConfig));
        flow.setOutputFormat(runtimeOutputFormat);
        if (!isJsonOutput()) {
            printDeprecationWarnings(options.deprecationWarnings);
        }

        if (isDoctorCommand()) {
            return await runDoctor(runtimeConfig);
        }

        // https://www.npmjs.com/package/tiny-updater OR https://www.npmjs.com/package/update-notifier
        // can be used instead below method.
        if (!isJsonOutput()) {
            await checkUpdate(); // check if the yaba cli has newer version
        }
        
        // check required ENV variables
        flow.checkRequiredEnvVariables();

        const releaseRepo = resolveReleaseRepo(runtimeConfig);

        // check if the current directory is git repo
        checkDirectory(releaseRepo, runtimeConfig);

        // check internet connection
        await flow.checkInternetConnection();

        // prepare repoOwner and releaseRepo
        const repoOwner = await resolveOwner(runtimeConfig);
        const releaseContext = resolveReleaseContext(runtimeConfig);

        // fetch head branch
        const headBranch = await checkHeadBranch(repoOwner, releaseRepo);

        // fetch last release of the repository
        const lastRelease = await flow.fetchLastRelease(repoOwner, releaseRepo);

        // preparing the changeLog from the main/master branch if there is no previous release
        let changeLog = await flow.prepareChangeLog(repoOwner, releaseRepo, headBranch, lastRelease);

        const preparedChangeLog = helper.prepareChangeLog(releaseContext.body, changeLog);
        const releasePreview = buildReleasePreview(preparedChangeLog, repoOwner, releaseRepo, lastRelease, headBranch, releaseContext);

        // preview release without creating it
        if (isReleasePreviewCommand()) {
            if (isJsonOutput()) {
                printJson({
                    command: "release.preview",
                    status: "success",
                    owner: releasePreview.owner,
                    repo: releasePreview.repo,
                    releaseName: releasePreview.releaseName,
                    newTag: releasePreview.releaseTag,
                    previousTag: releasePreview.lastReleaseTag,
                    previousTagSource: releasePreview.releaseTagSource,
                    draft: releasePreview.draft,
                    changelog: releasePreview.changelogBody
                });
            } else {
                printReleasePreview(releasePreview);
            }
            return exitCodes.SUCCESS;
        }

        // show only changelog
        if (canShowChangelog(changeLog)) {
            if (isJsonOutput()) {
                printJson({
                    command: "release.changelog",
                    status: "success",
                    owner: repoOwner,
                    repo: releaseRepo,
                    changelog: preparedChangeLog,
                    commitCount: changeLog.length
                });
            } else {
                printChangelog(preparedChangeLog);
            }
        } else if (isJsonOutput() && options.changelog) {
            printJson({
                command: "release.changelog",
                status: "noop",
                owner: repoOwner,
                repo: releaseRepo,
                reason: "No changes found to release."
            });
        }

        // create the release
        if (canCreateRelease(changeLog)) {
            const lastReleaseTag = resolveLastReleaseTag(lastRelease, headBranch);
            const releaseResult = await prepareRelease(preparedChangeLog, repoOwner, releaseRepo, lastReleaseTag, releaseContext);

            if (isJsonOutput()) {
                printJson({
                    command: "release.create",
                    status: "success",
                    owner: repoOwner,
                    repo: releaseRepo,
                    releaseName: releaseResult.releaseName,
                    newTag: releaseResult.releaseTag,
                    previousTag: releaseResult.previousTag,
                    draft: releaseResult.draft,
                    releaseUrl: releaseResult.releaseUrl,
                    notified: releaseResult.publishRequested
                });
            }
        } else if (isJsonOutput() && !options.changelog) {
            printJson({
                command: "release.create",
                status: "noop",
                owner: repoOwner,
                repo: releaseRepo,
                reason: "No changes found to release."
            });
        }

        // release completed, to prevent hanging forcing to exit
        return exitCodes.SUCCESS;

    } catch (error) {
        const normalizedError = normalizeError(error);
        if (isJsonOutput()) {
            console.error(JSON.stringify({
                status: "error",
                exitCode: normalizedError.exitCode,
                message: normalizedError.message
            }));
        } else {
            console.error(kleur.red(normalizedError.message));
        }
        return normalizedError.exitCode;
    }
}

async function prepareRelease(preparedChangeLog, repoOwner, releaseRepo, lastReleaseTag, releaseContext) {

    const hasReleaseCreatePermission = await helper.releaseCreatePermit(releaseContext.interactive);

    if (hasReleaseCreatePermission) {
        const releaseTag = helper.releaseTagName(releaseContext.tag);
        let changeLogDetails = templateUtils.generateChangelog(preparedChangeLog, repoOwner, releaseRepo, lastReleaseTag, releaseTag);
        let releaseName = helper.releaseName(releaseContext.releaseName);
        const releaseUrl = await flow.createRelease(repoOwner, releaseRepo, releaseContext.draft, releaseName,
            changeLogDetails, releaseContext.tag);

        // publishes the changelog on slack
        await flow.publishToSlack(releaseContext.publish, releaseRepo, preparedChangeLog, releaseUrl, releaseName);

        return {
            releaseName: releaseName,
            releaseTag: releaseTag,
            previousTag: lastReleaseTag,
            releaseUrl: releaseUrl,
            draft: releaseContext.draft === true,
            publishRequested: releaseContext.publish === true
        };
    } else {
        throw createError('Release was not prepared. Confirmation prompt was declined.', exitCodes.VALIDATION);
    }
}

async function runDoctor(runtimeConfig) {
    const checks = [];
    const tokenConfigured = helper.requiredEnvVariablesExist();
    const gitRepo = helper.isGitRepo();
    const detectedRepo = gitRepo ? helper.retrieveCurrentRepoName() : null;
    const configSources = runtimeConfig?._meta?.sources || [];
    const slackEndpoints = (process.env.YABA_SLACK_HOOK_URL || '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);

    checks.push(createDoctorCheck(
        'config.sources',
        true,
        configSources.length > 0
            ? `Loaded config from: ${configSources.join(', ')}.`
            : 'No config file loaded. Using defaults.',
        false,
        exitCodes.VALIDATION
    ));

    checks.push(createDoctorCheck(
        'env.githubToken',
        tokenConfigured,
        tokenConfigured
            ? 'YABA_GITHUB_ACCESS_TOKEN is configured.'
            : 'YABA_GITHUB_ACCESS_TOKEN is missing.',
        true,
        exitCodes.VALIDATION
    ));

    checks.push(createDoctorCheck(
        'git.repository',
        gitRepo,
        gitRepo
            ? `Git repository detected (${detectedRepo}).`
            : 'Current directory is not a Git repository.',
        true,
        exitCodes.VALIDATION
    ));

    checks.push(createDoctorCheck(
        'env.slackHook',
        slackEndpoints.length > 0,
        slackEndpoints.length > 0
            ? `YABA_SLACK_HOOK_URL configured with ${slackEndpoints.length} endpoint(s).`
            : 'YABA_SLACK_HOOK_URL is not configured.',
        false,
        exitCodes.VALIDATION
    ));

    try {
        await flow.checkInternetConnection();
        checks.push(createDoctorCheck(
            'network.connectivity',
            true,
            'Internet connectivity check passed.',
            true,
            exitCodes.NETWORK
        ));
    } catch (error) {
        const normalizedError = normalizeError(error);
        checks.push(createDoctorCheck(
            'network.connectivity',
            false,
            normalizedError.message,
            true,
            normalizedError.exitCode
        ));
    }

    if (tokenConfigured) {
        try {
            const username = await flow.retrieveUsername();
            checks.push(createDoctorCheck(
                'github.auth',
                true,
                `Authenticated as ${username}.`,
                true,
                exitCodes.AUTH
            ));
        } catch (error) {
            const normalizedError = normalizeError(error);
            checks.push(createDoctorCheck(
                'github.auth',
                false,
                normalizedError.message,
                true,
                normalizedError.exitCode
            ));
        }
    } else {
        checks.push(createDoctorCheck(
            'github.auth',
            false,
            'Skipped because GitHub token is missing.',
            false,
            exitCodes.VALIDATION,
            true
        ));
    }

    const exitCode = resolveDoctorExitCode(checks);
    if (isJsonOutput()) {
        printJson({
            command: 'doctor',
            status: exitCode === exitCodes.SUCCESS ? 'success' : 'failure',
            exitCode: exitCode,
            checks: checks.map(check => ({
                name: check.name,
                status: check.skipped ? 'skipped' : check.ok ? 'pass' : 'fail',
                required: check.required,
                message: check.message
            }))
        });
    } else {
        printDoctorSummary(checks, exitCode);
    }

    return exitCode;
}

function runConfigInit() {
    const configPath = resolveConfigFilePath(options.configPath);
    const configDir = path.dirname(configPath);
    const alreadyExists = fs.existsSync(configPath);

    if (alreadyExists && options.force !== true) {
        throw createError(`Config file already exists at '${configPath}'. Use '--force' to overwrite it.`, exitCodes.VALIDATION);
    }

    const configTemplate = buildDefaultConfigTemplate();
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(configPath, `${JSON.stringify(configTemplate, null, 2)}\n`, 'utf8');

    const overwritten = alreadyExists && options.force === true;
    if (isJsonOutput()) {
        printJson({
            command: 'config.init',
            status: 'success',
            path: configPath,
            overwritten: overwritten
        });
    } else {
        printConfigInitSummary(configPath, overwritten);
    }

    return exitCodes.SUCCESS;
}

async function checkHeadBranch(repoOwner, releaseRepo) {
    const headBranch = await flow.fetchHeadBranch(repoOwner, releaseRepo);
    if (headBranch == null) {
        throw createError("Head branch can not be found! The release has been interrupted!", exitCodes.UPSTREAM);
    }
    return headBranch;
}

function checkDirectory(releaseRepo, runtimeConfig) {
    // check if the current directory is git repo
    const hasRepoFromConfig = isNonEmptyString(runtimeConfig?.release?.repo);
    if (options.repo == undefined && !hasRepoFromConfig && !helper.isGitRepo()) {
        throw createError(`The directory '${helper.retrieveCurrentDirectory()}' is not a Git repo.`, exitCodes.VALIDATION);
    }

    if (!isNonEmptyString(releaseRepo) || releaseRepo === 'not a git repo') {
        throw createError('Repository name could not be resolved. Use --repo or set release.repo in config.', exitCodes.VALIDATION);
    }
}

function printChangelog(preparedChangeLog) {
    const changelogBoxOptions = {
        padding: 1,
        title: 'Changelog',
        titleAlignment: 'left',
        align: 'left',
        borderColor: 'green',
        borderStyle: 'round'
    };
    const changelogMsg = `\n${preparedChangeLog}`;
    console.log('\n\n' + boxen(changelogMsg, changelogBoxOptions)); 
}

function printReleasePreview(releasePreview) {
    const summaryBoxOptions = {
        padding: 1,
        title: 'Release Preview Summary',
        titleAlignment: 'left',
        align: 'left',
        borderColor: 'cyan',
        borderStyle: 'round'
    };

    const bodyBoxOptions = {
        padding: 1,
        title: 'Release Preview Body',
        titleAlignment: 'left',
        align: 'left',
        borderColor: 'green',
        borderStyle: 'round'
    };

    const summary = [
        `Owner: ${releasePreview.owner}`,
        `Repository: ${releasePreview.repo}`,
        `Release name: ${releasePreview.releaseName}`,
        `New tag: ${releasePreview.releaseTag}`,
        `Previous tag: ${releasePreview.lastReleaseTag} (${releasePreview.releaseTagSource})`,
        `Draft: ${releasePreview.draft ? "true" : "false"}`
    ].join('\n');

    console.log('\n' + boxen(summary, summaryBoxOptions));
    console.log('\n' + boxen(`\n${releasePreview.changelogBody}`, bodyBoxOptions));
}

function canCreateRelease(changeLog) {
    return changeLog.length != 0 && !options.changelog;
}

function canShowChangelog(changeLog) {
    return changeLog.length != 0 && options.changelog;
}

function isReleasePreviewCommand() {
    return options.releaseCommand === "preview";
}

function isDoctorCommand() {
    return options.commandName === "doctor";
}

function isConfigInitCommand() {
    return options.commandName === "config.init";
}

function resolveLastReleaseTag(lastRelease, headBranch) {
    return lastRelease?.tag_name || headBranch;
}

function buildReleasePreview(preparedChangeLog, repoOwner, releaseRepo, lastRelease, headBranch, releaseContext) {
    const lastReleaseTag = resolveLastReleaseTag(lastRelease, headBranch);
    const releaseTag = helper.releaseTagName(releaseContext.tag);
    const releaseName = helper.releaseName(releaseContext.releaseName);
    const changelogBody = templateUtils.generateChangelog(preparedChangeLog, repoOwner, releaseRepo, lastReleaseTag, releaseTag);
    const releaseTagSource = lastRelease?.tag_name ? "latest release tag" : "head branch (fallback)";

    return {
        owner: repoOwner,
        repo: releaseRepo,
        releaseName: releaseName,
        releaseTag: releaseTag,
        lastReleaseTag: lastReleaseTag,
        releaseTagSource: releaseTagSource,
        draft: releaseContext.draft === true,
        changelogBody: changelogBody
    };
}

function printJson(payload) {
    console.log(JSON.stringify(payload, null, 2));
}

function printDeprecationWarnings(warnings) {
    if (!Array.isArray(warnings) || warnings.length === 0) {
        return;
    }

    const body = warnings.map(item => `${kleur.yellow('DEPRECATION')} ${item}`).join('\n');
    console.warn(`\n${body}\n`);
}

function isJsonOutput() {
    return runtimeOutputFormat === "json";
}

function setRuntimeOutputFormat(format) {
    runtimeOutputFormat = resolveOutputFormatCandidate(format);
}

function resolveOutputFormat(runtimeConfig) {
    return resolveOutputFormatFromSources(
        options.outputFormat,
        process.env.YABA_OUTPUT_FORMAT,
        runtimeConfig?.output?.format
    );
}

function createDoctorCheck(name, ok, message, required, exitCode, skipped = false) {
    return {
        name: name,
        ok: ok,
        message: message,
        required: required,
        exitCode: exitCode,
        skipped: skipped
    };
}

function resolveDoctorExitCode(checks) {
    const failedRequiredChecks = checks.filter(check => check.required && !check.ok && !check.skipped);
    if (failedRequiredChecks.length === 0) {
        return exitCodes.SUCCESS;
    }

    const precedence = [
        exitCodes.AUTH,
        exitCodes.NETWORK,
        exitCodes.UPSTREAM,
        exitCodes.VALIDATION,
        exitCodes.INTERNAL
    ];

    for (const code of precedence) {
        if (failedRequiredChecks.some(check => check.exitCode === code)) {
            return code;
        }
    }

    return exitCodes.INTERNAL;
}

function printDoctorSummary(checks, exitCode) {
    const body = checks.map(check => {
        const status = check.skipped
            ? kleur.gray('SKIP')
            : check.ok
                ? kleur.green('PASS')
                : check.required
                    ? kleur.red('FAIL')
                    : kleur.yellow('WARN');
        return `${status} ${check.name}: ${check.message}`;
    }).join('\n');

    const doctorBoxOptions = {
        padding: 1,
        title: 'Doctor',
        titleAlignment: 'left',
        align: 'left',
        borderColor: exitCode === exitCodes.SUCCESS ? 'green' : 'yellow',
        borderStyle: 'round'
    };

    console.log('\n' + boxen(body, doctorBoxOptions));
    if (exitCode === exitCodes.SUCCESS) {
        console.log(kleur.green('\nDoctor checks passed.'));
    } else {
        const failureCount = checks.filter(check => check.required && !check.ok && !check.skipped).length;
        console.log(kleur.red(`\nDoctor detected ${failureCount} required issue(s).`));
    }
}

function printConfigInitSummary(configPath, overwritten) {
    const lines = [
        `Config file ${overwritten ? 'overwritten' : 'created'} at:`,
        `${configPath}`,
        '',
        'Next steps:',
        '1) Update values in yaba.config.json for your repository defaults.',
        '2) Keep secrets in environment variables (YABA_GITHUB_ACCESS_TOKEN, YABA_SLACK_HOOK_URL).'
    ].join('\n');

    const configBoxOptions = {
        padding: 1,
        title: 'Config Init',
        titleAlignment: 'left',
        align: 'left',
        borderColor: 'blue',
        borderStyle: 'round'
    };

    console.log('\n' + boxen(lines, configBoxOptions));
}

function buildDefaultConfigTemplate() {
    return {
        github: {
            owner: null
        },
        release: {
            repo: null,
            tagPattern: "prod_global_{yyyyMMdd}.1",
            namePattern: "Global release {yyyy-MM-dd}",
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

function loadRuntimeConfig() {
    const config = buildDefaultConfigTemplate();
    const loadedSources = [];
    const loadedSet = new Set();

    const userConfigPath = resolveUserConfigPath();
    mergeConfigFile(config, userConfigPath, false, loadedSources, loadedSet);

    const projectConfigPath = path.join(process.cwd(), 'yaba.config.json');
    mergeConfigFile(config, projectConfigPath, false, loadedSources, loadedSet);

    if (isNonEmptyString(options.configPath)) {
        const explicitConfigPath = resolveConfigFilePath(options.configPath);
        mergeConfigFile(config, explicitConfigPath, true, loadedSources, loadedSet);
    }

    config._meta = { sources: loadedSources };
    return config;
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
        parsedContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
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

function resolveReleaseContext(runtimeConfig) {
    return {
        releaseName: firstDefined(
            options.releaseName,
            renderConfigPattern(runtimeConfig?.release?.namePattern)
        ),
        tag: firstDefined(
            options.tag,
            renderConfigPattern(runtimeConfig?.release?.tagPattern)
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

function resolveReleaseRepo(runtimeConfig) {
    const configuredRepo = runtimeConfig?.release?.repo;
    return helper.retrieveReleaseRepo(firstDefined(options.repo, configuredRepo));
}

function resolveConfigFilePath(configPath) {
    if (!isNonEmptyString(configPath)) {
        return path.join(process.cwd(), 'yaba.config.json');
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

    return path.join(homeDir, '.config', 'yaba', 'config.json');
}

async function resolveOwner(runtimeConfig) {
    if (isNonEmptyString(options.owner) || isNonEmptyString(process.env.YABA_GITHUB_REPO_OWNER)) {
        return helper.retrieveOwner(options.owner, null);
    }
    if (isNonEmptyString(runtimeConfig?.github?.owner)) {
        return runtimeConfig.github.owner.trim();
    }
    const username = await flow.retrieveUsername();
    return helper.retrieveOwner(null, username);
}
