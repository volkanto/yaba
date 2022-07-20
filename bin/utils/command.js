import yargs from "yargs";
import { hideBin } from 'yargs/helpers'
// import { version as appVersion } from '../../package.json';
// import packageConfig from '../../package.json' assert { type: 'json' }
const appVersion = '1.7.4';


const commands = yargs(hideBin(process.argv))
.command(
    'get',
    'make a get HTTP request',
    function (yargs) {
      return yargs.option('u', {
        alias: 'url',
        describe: 'the URL to make an HTTP request to'
      })
    },
    function (argv) {
      console.log(argv.url)
    }
  )
  .command(
    'volkan',
    'test volkan',
    function (yargs) {
        return yargs.option('n', {
          alias: 'name',
          describe: 'set name'
        })
      },
      function (argv) {
        console.log(argv.name)
      }
  )
  .help()
  .argv;

const commands2 = yargs(hideBin(process.argv))
    .command('curl <url>', 'fetch the contents of the URL', () => { }, (argv) => {
        console.info(argv)
    })
    .usage("Usage: yaba -o <owner> -r <repository> -t <tag> -n <release-name> -b <body> -d <draft> " +
        "-c <changelog> -i <interactive> -s <sound> -p <publish>")
    .option("c", {
        alias: "changelog",
        describe: "Shows only changelog without creating the release.",
        type: "boolean"
    })
    .alias('h', 'help')
    .help('help')
    .alias('v', 'version')
    .version(appVersion)
    .argv;

/*
const commands = y
    .usage("Usage: yaba -o <owner> -r <repository> -t <tag> -n <release-name> -b <body> -d <draft> " +
        "-c <changelog> -i <interactive> -s <sound> -p <publish>")
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
    .option("s", {
        alias: "sound",
        describe: "Play sound when the release created",
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
    .version(appVersion)
    .argv;
    */

export default commands;
