import kleur from "kleur";
import boxen from "boxen";
import { exitCodes } from "../utils/exit-codes.js";
import { resolveOutputFormatCandidate } from "../utils/runtime-config.js";

export function createOutputController(initialFormat = "human") {
    let runtimeOutputFormat = resolveOutputFormatCandidate(initialFormat);

    return {
        getFormat() {
            return runtimeOutputFormat;
        },
        isJson() {
            return runtimeOutputFormat === "json";
        },
        setFormat(format) {
            runtimeOutputFormat = resolveOutputFormatCandidate(format);
        }
    };
}

export function printJson(payload) {
    console.log(JSON.stringify(payload, null, 2));
}

export function printDeprecationWarnings(warnings) {
    if (!Array.isArray(warnings) || warnings.length === 0) {
        return;
    }

    const body = warnings.map(item => `${kleur.yellow("DEPRECATION")} ${item}`).join("\n");
    console.warn(`\n${body}\n`);
}

export function printChangelog(preparedChangeLog) {
    const changelogBoxOptions = {
        padding: 1,
        title: "Changelog",
        titleAlignment: "left",
        align: "left",
        borderColor: "green",
        borderStyle: "round"
    };
    const changelogMsg = `\n${preparedChangeLog}`;
    console.log("\n\n" + boxen(changelogMsg, changelogBoxOptions));
}

export function printReleasePreview(releasePreview) {
    const summaryBoxOptions = {
        padding: 1,
        title: "Release Preview Summary",
        titleAlignment: "left",
        align: "left",
        borderColor: "cyan",
        borderStyle: "round"
    };

    const bodyBoxOptions = {
        padding: 1,
        title: "Release Preview Body",
        titleAlignment: "left",
        align: "left",
        borderColor: "green",
        borderStyle: "round"
    };

    const summary = [
        `Owner: ${releasePreview.owner}`,
        `Repository: ${releasePreview.repo}`,
        `Release name: ${releasePreview.releaseName}`,
        `New tag: ${releasePreview.releaseTag}`,
        `Previous tag: ${releasePreview.lastReleaseTag} (${releasePreview.releaseTagSource})`,
        `Target commit-ish: ${releasePreview.targetCommitish}`,
        `Draft: ${releasePreview.draft ? "true" : "false"}`
    ].join("\n");

    console.log("\n" + boxen(summary, summaryBoxOptions));
    console.log("\n" + boxen(`\n${releasePreview.changelogBody}`, bodyBoxOptions));
}

export function printDoctorSummary(checks, exitCode) {
    const body = checks.map(check => {
        const status = check.skipped
            ? kleur.gray("SKIP")
            : check.ok
                ? kleur.green("PASS")
                : check.required
                    ? kleur.red("FAIL")
                    : kleur.yellow("WARN");
        return `${status} ${check.name}: ${check.message}`;
    }).join("\n");

    const doctorBoxOptions = {
        padding: 1,
        title: "Doctor",
        titleAlignment: "left",
        align: "left",
        borderColor: exitCode === exitCodes.SUCCESS ? "green" : "yellow",
        borderStyle: "round"
    };

    console.log("\n" + boxen(body, doctorBoxOptions));
    if (exitCode === exitCodes.SUCCESS) {
        console.log(kleur.green("\nDoctor checks passed."));
    } else {
        const failureCount = checks.filter(check => check.required && !check.ok && !check.skipped).length;
        console.log(kleur.red(`\nDoctor detected ${failureCount} required issue(s).`));
    }
}

export function printConfigInitSummary(configPath, overwritten) {
    const lines = [
        `Config file ${overwritten ? "overwritten" : "created"} at:`,
        `${configPath}`,
        "",
        "Next steps:",
        "1) Update values in yaba.config.json for your repository defaults.",
        "2) Keep secrets in environment variables (YABA_GITHUB_ACCESS_TOKEN, YABA_SLACK_HOOK_URL)."
    ].join("\n");

    const configBoxOptions = {
        padding: 1,
        title: "Config Init",
        titleAlignment: "left",
        align: "left",
        borderColor: "blue",
        borderStyle: "round"
    };

    console.log("\n" + boxen(lines, configBoxOptions));
}
