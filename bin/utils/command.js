const yargs = require("yargs");
const package = require('../../package.json');

const commands = yargs
    .usage("Usage: yaba -o <owner> -r <repository> -t <tag> -n <release-name> -b <body> -d <draft> " +
        "-c <changelog> -i <interactive> -s <sound>")
    .option("o", { alias: "owner", describe: "The repository owner.", type: "string" })
    .option("r", { alias: "repo", describe: "The repository name.", type: "string" })
    .option("t", { alias: "tag", describe: "The name of the tag.", type: "string" })
    .option("n", { alias: "release-name", describe: "The name of the release.", type: "string" })
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
    .option("s", {
        alias: "sound",
        describe: "Play sound when the release created",
        type: "boolean"
    })
    .epilog(`Copyleft ${new Date().getFullYear()} ${package.author} - ${package.githubProfile}`)
    .alias('h', 'help')
    .help('help')
    .alias('v', 'version')
    .version(package.version)
    .argv;

// yaba commands
module.exports = {
    options: commands
}
