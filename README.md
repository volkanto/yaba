# Yaba GitHub Release CLI 

**Yaba** is a simple CLI tool that helps you manage releases of your GitHub projects.

![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/volkanto/yaba/codeql-analysis.yml)
[![version](https://img.shields.io/npm/v/yaba-release-cli.svg?style=flat-square)](https://npmjs.org/yaba-release-cli)
[![dependancies](https://img.shields.io/librariesio/release/npm/yaba-release-cli?color=%23007a1f&style=flat-square)](https://libraries.io/npm/yaba-release-cli)
[![downloads](https://img.shields.io/npm/dm/yaba-release-cli?style=flat-square&color=%23007a1f)](https://npmcharts.com/compare/yaba-release-cli)
[![license](https://img.shields.io/npm/l/yaba-release-cli?color=%23007a1f&style=flat-square)](https://github.com//volkanto/blob/master/LICENSE)

## Prerequisites

You need `npm` in order to run the project on your local environment.

## Installing / Updating / Uninstalling

To install CLI package globally:

```shell
npm i -g yaba-release-cli
```

To Update:

```shell
npm update -g yaba-release-cli
```

To uninstall:

```shell
npm uninstall -g yaba-release-cli
```

## Setup

### Create Personal Access Token

Go to [Personal Access Tokens](https://github.com/settings/tokens) page on GitHub and generate new token to
enable `yaba` CLI to access your repos.

* Give your desired name to your personal access token with `Note` section.
* Choosing `repo` scope is enough to use `yaba` CLI tool.

Now, your personal access token is generated. Copy that token and define that one as an environment variable:

```shell
export YABA_GITHUB_ACCESS_TOKEN=generated_personal_access_token
```

You can define that env variable into `~/.bashrc`, `~/.bash_profile` or `~/.zshrc` file, choose which one is suitable
for you. After defining the env variable, open new terminal or simply run `source ~/.zshrc`(here again choose where you
defined your env variable).

If the repository owner is another GitHub account or organisation, you can define that like below instead of passing the
owner to the command in every run.

```shell
export YABA_GITHUB_REPO_OWNER=repository_owner
```

Always `-o` or `--owner` has precedence over authenticated user. Presendence is
like `-o > GITHUB_REPO_OWNER > authenticated-user`.

### Slack Integration

If you want to announce your release/changelog to the specific Slack channel, you have to define below environment
variable with the appropriate value.

```shell
export YABA_SLACK_HOOK_URL=your_slack_hook_url
```

Also, multiple hook URLs allowed to be defined like below:

```shell
export YABA_SLACK_HOOK_URL=your_slack_hook_url_1,your_slack_hook_url_2,...
```

If the above variable is set and the `-p` command given while running the command, an announcement will be post to the
given Slack channel. You can find detailed information in the [Command Line Usage](#command-line-usage) section.

```shell
yaba -p
```

## Command Line Usage

Run `yaba` with `--help` options:

```shell
➜  ~ yaba --help
Usage: yaba -o <owner> -r <repository> -t <tag> -n <release-name> -b <body> -d
<draft> -c <changelog> -i <interactive> -p <publish>

Options:
  -o, --owner         The repository owner.                             [string]
  -r, --repo          The repository name.                              [string]
  -t, --tag           The name of the tag.                              [string]
  -n, --release-name  The name of the release.                          [string]
  -b, --body          Text describing the contents of the tag. If not provided,
                      the default changelog will be generated with the usage of
                      the difference of master and latest release.      [string]
  -d, --draft         Creates the release as draft.                    [boolean]
  -c, --changelog     Shows only changelog without creating the release.
                                                                       [boolean]
  -i, --interactive   Prompt before (draft) release is created (default true)
                                                                       [boolean]
  -p, --publish       Publishes the release announcement to the defined Slack
                      channel                                          [boolean]
  -h, --help          Show help                                        [boolean]
  -v, --version       Show version number                              [boolean]
```

You can run `yaba` from a git directory or any other directories which is not a git repo.

If you are in a git repo and if you want to prepare the release for that repo, you don't need to specify the repo name
with the command. The command will automatically detect the current directory and if it is a git repository `yaba` will
use it as `repo` for the command.

By default, if you don't specify `-o`, `-t`, `-n` and `-b` the command will prepare default values for them with the
below pattern:

```text
-o: authenticated_user
-t: prod_global_YYYYMMDD.1
-n: Global release YYYY-MM-DD
-b: Commits between last release and master/main branch
```

> **:bulb:** If you want to bypass the prompt that is before creating the actual release,
> you can use `-i false` flag. This could be useful if you use `yaba` in your automation tools.

## Run Locally

You have to clone the repository to your local machine

```shell
git clone git@github.com:volkanto/yaba.git
```

Go to project folder

```shell
cd yaba
```

Build dependencies

```shell
npm install
```

You have to install globally in order to run your `yaba` command

```shell
npm install -g .
```

## Issues

You can create an issue if you find any problem or feel free to create a PR with a possible fix or any other feature.
Also, you can create an issue if you have any idea that you think it will be nice if we have it.

## Authors

* Volkan Tokmak - [volkanto](https://github.com/volkanto)
