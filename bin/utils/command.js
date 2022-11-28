import yargs from "yargs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const packageInfo = require("../../package.json");

import { hideBin } from 'yargs/helpers';

const commands = yargs(hideBin(process.argv))
    .usage("Usage: yaba -o <owner> -r <repository> -t <tag> -n <release-name> -b <body> -d <draft> " +
        "-c <changelog> -i <interactive> -p <publish>")
    .option("o", {alias: "owner", describe: "The repository owner.", type: "string"})
    .option("r", {alias: "repo", describe: "The repository name.", type: "string"})
    .option("t", {alias: "tag", describe: "The name of the tag.", type: "string"})
    .option("n", {alias: "release-name", describe: "The name of the release.", type: "string"})
    .option("b", {
        alias: "body",
        describe: "Text describing the contents of the tag. If not provided, the default changelog " +
            "will be generated with the usage of the difference of master and latest release.",
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
    .option("p", {
        alias: "publish",
        describe: "Publishes the release announcement to the defined Slack channel",
        type: "boolean"
    })
    .alias('h', 'help')
    .help('help')
    .alias('v', 'version')
    .version(packageInfo.version)
    .argv;

export { commands as options };
