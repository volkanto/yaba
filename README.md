# Yaba Github Release CLI

[![NPM](https://nodei.co/npm/yaba-release-cli.png?downloads=true&stars=true)](https://www.npmjs.com/package/yaba-release-cli)

**Yaba** is a simple CLI tool that helps you manage releases of your Github projects.

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

### Create a Personal Access Token

Go to [Personal Access Tokens](https://github.com/settings/tokens) page on Github and generate new token to enable `yaba` CLI to access your repos.

* Give your desired name to your perosonal access token with `Note` section.
* Choosing `repo` scope is enough to use `yaba` CLI tool.

Now, your personal access token is generated. Copy that token and define that one as an environment variable:

```shell
export GITHUB_ACCESS_TOKEN=generated_personal_access_token
```

You can define that env variable into `~/.bashrc`, `~/.bash_profile` or `~/.zshrc` file, choose which one is suitable for you. After defining the env variable, open new terminal or simply run `source ~/.zshrc`(here again choose where you defined your env variable).

If the repository owner is another Github account or organisation, you can define that like below instead of passing the owner to the command in every run.

```shell
export GITHUB_REPO_OWNER=repository_owner
```

Always `-o` or `--owner` has precedence over authenticated user. Presendence is like `-o > GITHUB_REPO_OWNER > authenticated-user`.

## Command Line Usage

Run `yaba` with `--help` options:

```shell
➜  ~ yaba --help
Usage: yaba -o <owner> -r <repository> -t <tag> -n <release-name> -b <body> -d
<draft> -c

Options:
      --help          Show help                                        [boolean]
      --version       Show version number                              [boolean]
  -o, --owner         The repository owner.                             [string]
  -r, --repo          The repository name.                              [string]
  -t, --tag           The name of the tag.                              [string]
  -n, --release-name  The name of the release.                          [string]
  -b, --body          Text describing the contents of the tag. If not provided,
                      the default changelog will be generated with the usage of
                      the difference of master and latest release.      [string]
  -d, --draft         `true` or only using `-d` makes the release a draft.
                                                                       [boolean]
  -c, --changelog     Shows only changelog without creating the release.
                                                                       [boolean]
```

You can run `yaba` from a git directory or any other directories which is not a git repo.

If you are in a git repo and if you want to prepare release for that repo, you don't need to specify the repo name with the command, it will automatically detects the current directory and if it is a git repository `yaba` will use it as `repo` for the command.

By default, if you don't specify `-o`, `-t`, `-n` and `-b` the command will prepare default values for them with the below pattern:

```text
-o: authenticated_user
-t: prod_global_YYYYMMDD.1
-n: Global release YYYY-MM-DD
-b: Commits between last release and master/main branch
```

> **IMPORTANT NOTE:** If you don't explicitly define the release as draft with `-d`, `yaba` will directly create the release with given or pre-defined values.

## Local Setup

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

You can create an issue if you find any problem or feel free to create a PR with a possible fix or any other feature. Also, you can create an issue if you have any idea that you think it will be nice if we have it.

## Authors

* Volkan Tokmak - [volkanto](github.com/volkanto)

## LICENCE

ISC
