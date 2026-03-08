import semver from "semver";
import { createRequire } from "module";
import { createError } from "../utils/errors.js";
import { exitCodes } from "../utils/exit-codes.js";
import { isNonEmptyString } from "../utils/runtime-config.js";
import * as helper from "../utils/helper.js";

const require = createRequire(import.meta.url);
const packageInfo = require("../../package.json");

const TAG_STRATEGIES = Object.freeze(["pattern", "semver", "sha"]);
const TAG_CONFLICT_POLICIES = Object.freeze(["increment", "fail"]);
const DEFAULT_TAG_PATTERN = "prod_global_{yyyyMMdd}.{HHmm}";
const DEFAULT_TAG_MAX_ATTEMPTS = 20;

export async function resolveReleaseTag({
    explicitTag,
    tagStrategy,
    tagPattern,
    tagOnConflict,
    tagMaxAttempts,
    targetCommitish,
    targetReference,
    now = new Date(),
    env = process.env,
    packageVersion = packageInfo.version,
    tagExists = async () => false
}) {
    const resolvedStrategy = normalizeTagStrategy(tagStrategy);
    const resolvedConflictPolicy = normalizeTagConflictPolicy(tagOnConflict);
    const resolvedMaxAttempts = normalizeTagMaxAttempts(tagMaxAttempts);

    let candidate = buildBaseTag({
        explicitTag: explicitTag,
        strategy: resolvedStrategy,
        tagPattern: tagPattern,
        packageVersion: packageVersion,
        targetCommitish: targetCommitish,
        targetReference: targetReference,
        now: now,
        env: env
    });

    if (!helper.isValidGitTagName(candidate)) {
        const sanitizedCandidate = sanitizeTagCandidate(candidate);
        if (!helper.isValidGitTagName(sanitizedCandidate)) {
            throw createError(
                `Resolved tag '${candidate}' is not a valid Git tag name. Provide '--tag' explicitly or adjust 'release.tagPattern'.`,
                exitCodes.VALIDATION
            );
        }
        candidate = sanitizedCandidate;
    }

    if (await tagExists(candidate) === false) {
        return candidate;
    }

    if (resolvedConflictPolicy === "fail") {
        throw createError(
            `Tag '${candidate}' already exists. Set 'release.tagOnConflict' to 'increment' or provide a unique '--tag'.`,
            exitCodes.VALIDATION
        );
    }

    const promotedCandidate = promoteMinuteTagToSeconds(candidate, now);
    if (promotedCandidate && promotedCandidate !== candidate && await tagExists(promotedCandidate) === false) {
        return promotedCandidate;
    }

    const baseTag = promotedCandidate || candidate;
    for (let attempt = 1; attempt <= resolvedMaxAttempts; attempt++) {
        const incrementalTag = `${baseTag}.${attempt}`;
        if (await tagExists(incrementalTag) === false) {
            return incrementalTag;
        }
    }

    throw createError(
        `Could not resolve a unique tag from '${baseTag}' after ${resolvedMaxAttempts} attempt(s).`,
        exitCodes.VALIDATION
    );
}

function buildBaseTag({
    explicitTag,
    strategy,
    tagPattern,
    packageVersion,
    targetCommitish,
    targetReference,
    now,
    env
}) {
    if (isNonEmptyString(explicitTag)) {
        return explicitTag.trim();
    }

    if (strategy === "semver") {
        return resolveSemverTag(packageVersion);
    }

    if (strategy === "sha") {
        return resolveShaTag(targetCommitish);
    }

    return resolvePatternTag(tagPattern, {
        now: now,
        targetCommitish: targetCommitish,
        targetReference: targetReference,
        runNumber: env?.GITHUB_RUN_NUMBER
    });
}

function resolvePatternTag(pattern, context) {
    const rawPattern = isNonEmptyString(pattern) ? pattern.trim() : DEFAULT_TAG_PATTERN;
    const utcParts = extractUtcDateParts(context.now);
    const rendered = rawPattern
        .replaceAll("{yyyyMMdd}", utcParts.yyyyMMdd)
        .replaceAll("{yyyy-MM-dd}", utcParts.yyyyDashMmDashDd)
        .replaceAll("{HHmm}", utcParts.hhmm)
        .replaceAll("{HHmmss}", utcParts.hhmmss)
        .replaceAll("{shortSha}", resolveShortShaToken(context.targetCommitish))
        .replaceAll("{branch}", resolveBranchToken(context.targetReference))
        .replaceAll("{runNumber}", resolveRunNumberToken(context.runNumber));

    return rendered.trim();
}

function resolveSemverTag(version) {
    const normalizedVersion = semver.valid(`${version || ""}`.trim());
    if (!normalizedVersion) {
        throw createError(
            `Could not resolve semver tag from package version '${version}'.`,
            exitCodes.VALIDATION
        );
    }

    return `v${normalizedVersion}`;
}

function resolveShaTag(targetCommitish) {
    const normalized = `${targetCommitish || ""}`.trim();
    if (!/^[0-9a-fA-F]{7,40}$/.test(normalized)) {
        throw createError(
            `Tag strategy 'sha' requires a commit SHA target. Resolved target was '${targetCommitish || ""}'.`,
            exitCodes.VALIDATION
        );
    }

    return `sha-${normalized.substring(0, 12).toLowerCase()}`;
}

function extractUtcDateParts(now) {
    const iso = now.toISOString();
    const datePart = iso.substring(0, 10);
    const timePart = iso.substring(11, 19);

    return {
        yyyyMMdd: datePart.replaceAll("-", ""),
        yyyyDashMmDashDd: datePart,
        hhmm: timePart.substring(0, 5).replace(":", ""),
        hhmmss: timePart.substring(0, 8).replaceAll(":", "")
    };
}

function resolveShortShaToken(targetCommitish) {
    const normalized = `${targetCommitish || ""}`.trim();
    if (/^[0-9a-fA-F]{7,40}$/.test(normalized)) {
        return normalized.substring(0, 12).toLowerCase();
    }
    return "unknownsha";
}

function resolveBranchToken(targetReference) {
    const normalized = `${targetReference || ""}`.trim();
    if (!normalized) {
        return "detached";
    }

    const withoutHeadsPrefix = normalized.replace(/^refs\/heads\//, "");
    return sanitizeToken(withoutHeadsPrefix, "detached").replaceAll("/", "-");
}

function resolveRunNumberToken(runNumber) {
    const normalized = `${runNumber || ""}`.trim();
    return /^\d+$/.test(normalized) ? normalized : "0";
}

function normalizeTagStrategy(strategy) {
    const normalized = `${strategy || "pattern"}`.trim().toLowerCase();
    if (TAG_STRATEGIES.includes(normalized)) {
        return normalized;
    }

    throw createError(
        `Unsupported tag strategy '${strategy}'. Supported values: ${TAG_STRATEGIES.join(", ")}.`,
        exitCodes.VALIDATION
    );
}

function normalizeTagConflictPolicy(policy) {
    const normalized = `${policy || "increment"}`.trim().toLowerCase();
    if (TAG_CONFLICT_POLICIES.includes(normalized)) {
        return normalized;
    }

    throw createError(
        `Unsupported tag conflict policy '${policy}'. Supported values: ${TAG_CONFLICT_POLICIES.join(", ")}.`,
        exitCodes.VALIDATION
    );
}

function normalizeTagMaxAttempts(value) {
    if (value === undefined || value === null || value === "") {
        return DEFAULT_TAG_MAX_ATTEMPTS;
    }

    const normalized = Number(value);
    if (!Number.isInteger(normalized) || normalized <= 0) {
        throw createError("Tag max attempts must be a positive integer.", exitCodes.VALIDATION);
    }

    return normalized;
}

function sanitizeTagCandidate(value) {
    return sanitizeToken(value, "release")
        .replaceAll("/", "-")
        .replaceAll("..", ".")
        .replaceAll("@{", "-")
        .replaceAll("//", "-");
}

function sanitizeToken(value, fallback) {
    const normalized = `${value || ""}`.trim().toLowerCase();
    const sanitized = normalized
        .replace(/[^a-z0-9._/-]+/g, "-")
        .replace(/\/+/g, "/")
        .replace(/-+/g, "-")
        .replace(/^[-./]+/, "")
        .replace(/[-./]+$/, "");

    return sanitized.length > 0 ? sanitized : fallback;
}

function promoteMinuteTagToSeconds(tagName, now) {
    const normalized = `${tagName || ""}`.trim();
    const matched = normalized.match(/^prod_global_(\d{8})\.(\d{4})$/);
    if (!matched) {
        return null;
    }

    return `prod_global_${matched[1]}.${extractUtcDateParts(now).hhmmss}`;
}
