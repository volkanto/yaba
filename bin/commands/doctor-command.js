import * as helper from "../utils/helper.js";
import * as flow from "../utils/flow.js";
import { exitCodes } from "../utils/exit-codes.js";
import { normalizeError } from "../utils/errors.js";
import { firstDefined } from "../utils/runtime-config.js";
import {
    buildAuthFailureGuidance,
    buildRepoAccessFailureGuidance,
    detectTokenKind,
    resolveErrorStatus,
    summarizeOAuthScopes,
    tokenKindLabel
} from "../utils/auth-diagnostics.js";
import { printDoctorSummary, printJson } from "../services/command-output.js";

export async function runDoctorCommand(options, runtimeConfig, isJsonOutput) {
    const checks = [];
    const tokenConfigured = helper.requiredEnvVariablesExist();
    const tokenKind = detectTokenKind(process.env.YABA_GITHUB_ACCESS_TOKEN);
    const gitRepo = helper.isGitRepo();
    const detectedRepo = gitRepo ? helper.retrieveCurrentRepoName() : null;
    const configuredOwner = firstDefined(
        options.owner,
        process.env.YABA_GITHUB_REPO_OWNER,
        runtimeConfig?.github?.owner
    );
    const configuredRepo = firstDefined(
        options.repo,
        runtimeConfig?.release?.repo,
        detectedRepo
    );
    const configSources = runtimeConfig?._meta?.sources || [];
    const slackEndpoints = (process.env.YABA_SLACK_HOOK_URL || "")
        .split(",")
        .map(item => item.trim())
        .filter(Boolean);

    checks.push(createDoctorCheck(
        "config.sources",
        true,
        configSources.length > 0
            ? `Loaded config from: ${configSources.join(", ")}.`
            : "No config file loaded. Using defaults.",
        false,
        exitCodes.VALIDATION
    ));

    checks.push(createDoctorCheck(
        "env.githubToken",
        tokenConfigured,
        tokenConfigured
            ? `YABA_GITHUB_ACCESS_TOKEN is configured (${tokenKindLabel(tokenKind)}).`
            : "YABA_GITHUB_ACCESS_TOKEN is missing.",
        true,
        exitCodes.VALIDATION
    ));

    checks.push(createDoctorCheck(
        "git.repository",
        gitRepo,
        gitRepo
            ? `Git repository detected (${detectedRepo}).`
            : "Current directory is not a Git repository.",
        true,
        exitCodes.VALIDATION
    ));

    checks.push(createDoctorCheck(
        "env.slackHook",
        slackEndpoints.length > 0,
        slackEndpoints.length > 0
            ? `YABA_SLACK_HOOK_URL configured with ${slackEndpoints.length} endpoint(s).`
            : "YABA_SLACK_HOOK_URL is not configured.",
        false,
        exitCodes.VALIDATION
    ));

    try {
        await flow.checkInternetConnection();
        checks.push(createDoctorCheck(
            "network.connectivity",
            true,
            "Internet connectivity check passed.",
            true,
            exitCodes.NETWORK
        ));
    } catch (error) {
        const normalizedError = normalizeError(error);
        checks.push(createDoctorCheck(
            "network.connectivity",
            false,
            normalizedError.message,
            true,
            normalizedError.exitCode
        ));
    }

    if (tokenConfigured) {
        try {
            const authDiagnostics = await flow.inspectGithubAuth(configuredOwner, configuredRepo);
            const scopesSummary = summarizeOAuthScopes(authDiagnostics.oauthScopes);
            checks.push(createDoctorCheck(
                "github.auth",
                true,
                `Authenticated as ${authDiagnostics.login}. Token type: ${tokenKindLabel(tokenKind)}. ${scopesSummary}`,
                true,
                exitCodes.AUTH
            ));

            if (authDiagnostics.repoAccess.checked) {
                if (authDiagnostics.repoAccess.ok) {
                    checks.push(createDoctorCheck(
                        "github.repoAccess",
                        true,
                        `Token can access ${authDiagnostics.repoAccess.owner}/${authDiagnostics.repoAccess.repo}.`,
                        true,
                        exitCodes.AUTH
                    ));
                } else {
                    checks.push(createDoctorCheck(
                        "github.repoAccess",
                        false,
                        buildRepoAccessFailureGuidance({
                            tokenKind: tokenKind,
                            status: authDiagnostics.repoAccess.status,
                            owner: authDiagnostics.repoAccess.owner,
                            repo: authDiagnostics.repoAccess.repo,
                            apiMessage: authDiagnostics.repoAccess.message
                        }),
                        true,
                        exitCodes.AUTH
                    ));
                }
            } else {
                checks.push(createDoctorCheck(
                    "github.repoAccess",
                    false,
                    "Skipped repository access check. Provide --repo (or set release.repo in config) to validate repo-level permissions.",
                    false,
                    exitCodes.VALIDATION,
                    true
                ));
            }
        } catch (error) {
            const normalizedError = normalizeError(error);
            const status = resolveErrorStatus(error);
            const guidance = buildAuthFailureGuidance({
                tokenKind: tokenKind,
                status: status
            });
            checks.push(createDoctorCheck(
                "github.auth",
                false,
                `${normalizedError.message} ${guidance}`.trim(),
                true,
                normalizedError.exitCode
            ));

            checks.push(createDoctorCheck(
                "github.repoAccess",
                false,
                "Skipped because GitHub authentication failed.",
                false,
                exitCodes.AUTH,
                true
            ));
        }
    } else {
        checks.push(createDoctorCheck(
            "github.auth",
            false,
            "Skipped because GitHub token is missing.",
            false,
            exitCodes.VALIDATION,
            true
        ));

        checks.push(createDoctorCheck(
            "github.repoAccess",
            false,
            "Skipped because GitHub token is missing.",
            false,
            exitCodes.VALIDATION,
            true
        ));
    }

    const exitCode = resolveDoctorExitCode(checks);
    if (isJsonOutput) {
        printJson({
            command: "doctor",
            status: exitCode === exitCodes.SUCCESS ? "success" : "failure",
            exitCode: exitCode,
            checks: checks.map(check => ({
                name: check.name,
                status: check.skipped ? "skipped" : check.ok ? "pass" : "fail",
                required: check.required,
                message: check.message
            }))
        });
    } else {
        printDoctorSummary(checks, exitCode);
    }

    return exitCode;
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
