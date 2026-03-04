import yargs from "yargs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const packageInfo = require("../../package.json");

import { hideBin } from 'yargs/helpers';
const rawArguments = hideBin(process.argv);

const commands = yargs(rawArguments)
    .scriptName("yaba")
    .usage("Usage: yaba <release|doctor|config> [options]")
    .command("release create", "Create a GitHub release for a repository")
    .command("release preview", "Preview release details without creating a GitHub release")
    .command("doctor", "Run environment and connectivity diagnostics")
    .command("config init", "Create yaba.config.json in the current directory")
    .option("o", {alias: "owner", describe: "The repository owner.", type: "string"})
    .option("r", {alias: "repo", describe: "The repository name.", type: "string"})
    .option("t", {alias: "tag", describe: "The name of the tag.", type: "string"})
    .option("n", {
        alias: ["name", "release-name"],
        describe: "The name of the release.",
        type: "string"
    })
    .option("b", {
        alias: "body",
        describe: "Text describing the contents of the tag. If not provided, the default changelog " +
            "will be generated with the usage of the difference of default branch and latest release.",
        type: "string"
    })
    .option("d", {
        alias: "draft",
        describe: "Creates the release as draft.",
        type: "boolean"
    })
    .option("c", {
        alias: "changelog",
        describe: "Shows only changelog without creating the release.",
        type: "boolean"
    })
    .option("i", {
        alias: "interactive",
        describe: "Prompt before (draft) release is created (default true)",
        type: "boolean"
    })
    .option("yes", {
        describe: "Skip confirmation prompt and create release directly.",
        type: "boolean",
        default: false
    })
    .option("no-prompt", {
        describe: "Skip release confirmation prompt (same behavior as --yes).",
        type: "boolean",
        default: false
    })
    .option("notify", {
        describe: "Send notifications after release is created.",
        choices: ["slack"],
        type: "string"
    })
    .option("p", {
        alias: "publish",
        describe: "Publishes the release announcement to the defined Slack channel",
        type: "boolean"
    })
    .option("format", {
        describe: "Output format.",
        choices: ["human", "json"],
        type: "string"
    })
    .option("config", {
        describe: "Path to config file.",
        type: "string"
    })
    .option("force", {
        describe: "Overwrite generated files when they already exist.",
        type: "boolean",
        default: false
    })
    .alias('h', 'help')
    .help('help')
    .alias('v', 'version')
    .version(packageInfo.version)
    .parseSync();

const normalizedOptions = normalizeOptions(commands);

function normalizeOptions(parsed) {
    const normalized = { ...parsed };
    const noPrompt = wasFlagProvided("--no-prompt") || wasFlagProvided("--yes");
    const interactiveProvided = wasFlagProvided("--interactive") || wasFlagProvided("-i");
    const publishProvided = wasFlagProvided("--publish") || wasFlagProvided("-p");
    const draftProvided = wasFlagProvided("--draft") || wasFlagProvided("-d");
    const formatProvided = wasFlagProvided("--format");
    const commandName = resolveCommand(parsed);

    normalized.releaseName = parsed.name ?? parsed["release-name"];
    normalized.publish = parsed.notify === "slack"
        ? true
        : publishProvided
            ? parsed.publish === true
            : undefined;
    normalized.interactive = noPrompt
        ? false
        : interactiveProvided
            ? parsed.interactive
            : undefined;
    normalized.draft = draftProvided ? parsed.draft === true : undefined;
    normalized.commandName = commandName;
    normalized.releaseCommand = commandName?.startsWith("release.")
        ? commandName.split(".")[1]
        : null;
    normalized.outputFormat = formatProvided ? parsed.format : undefined;
    normalized.configPath = parsed.config;

    return normalized;
}

function resolveCommand(parsed) {
    const positional = (parsed._ || []).map(item => `${item}`);
    if (positional.length === 0) {
        return "release.create";
    }

    if (positional.length === 1 && positional[0] === "doctor") {
        return "doctor";
    }

    if (positional.length === 2 && positional[0] === "config" && positional[1] === "init") {
        return "config.init";
    }

    if (positional.length === 2 && positional[0] === "release") {
        if (positional[1] === "create" || positional[1] === "preview") {
            return `release.${positional[1]}`;
        }
    }

    return null;
}

function isSupportedReleaseCommand(parsed) {
    return resolveCommand(parsed) !== null;
}

function wasFlagProvided(flag) {
    return rawArguments.some(argument => argument === flag || argument.startsWith(`${flag}=`));
}

export { normalizedOptions as options, isSupportedReleaseCommand };
