import { Octokit } from "octokit";
import supportsHyperlinks from "supports-hyperlinks";
import hyperlinker from "hyperlinker";
import kleur from "kleur";
import { spinner } from "./spinner.js";
import * as helper from "./helper.js";
import { mapGithubError } from "./errors.js";
import { exitCodes } from "./exit-codes.js";

const octokit = new Octokit({
    auth: process.env.YABA_GITHUB_ACCESS_TOKEN
});

/**
 * fetches all releases for a repository
 *
 * @param owner the owner of the repository
 * @param repo the repository to fetch releases for
 * @param limit max number of releases to return; 0 means all
 * @returns {Promise<any[]>}
 */
export async function fetchReleases(owner, repo, limit = 5) {
    const fetchAll = limit === 0;
    spinner.start('Fetching releases...');
    try {
        let releases = [];
        if (!fetchAll && limit <= 100) {
            const { data } = await octokit.request('GET /repos/{owner}/{repo}/releases', {
                owner, repo, per_page: limit
            });
            releases = data;
        } else {
            let page = 1;
            while (true) {
                const { data } = await octokit.request('GET /repos/{owner}/{repo}/releases', {
                    owner, repo, per_page: 100, page
                });
                releases = releases.concat(data);
                if (data.length < 100) break;
                if (!fetchAll && releases.length >= limit) {
                    releases = releases.slice(0, limit);
                    break;
                }
                page++;
            }
        }
        spinner.succeed(`Found ${releases.length} release(s).`);
        return releases;
    } catch (error) {
        spinner.fail('Failed to fetch releases.');
        throw mapGithubError(error, 'Failed to fetch releases.');
    }
}

/**
 * fetches the last release
 *
 * @param owner the owner of the repository
 * @param repo the repository to fetch last release for
 * @returns {Promise<null|any>}
 */
export async function fetchLastRelease(owner, repo) {
    spinner.start('Fetching the last release...');
    try {
        const { data: release } = await octokit.request('GET /repos/{owner}/{repo}/releases/latest', {
            owner: owner,
            repo: repo
        });
        spinner.succeed(`Last release: ${kleur.blue().bold().underline(release.tag_name)}`);
        return release;
    } catch (error) {
        const status = error?.status || error?.response?.status;
        if (status === 404) {
            spinner.warn(`Last release not found.`);
            return null;
        }
        spinner.fail('Could not fetch the latest release.');
        throw mapGithubError(error, 'Could not fetch the latest release.');
    }
}

/**
 * fetches head branch name
 *
 * @param owner the owner of the repository
 * @param repo the repository to fetch the head branch name
 * @returns {Promise<null>}
 */
export async function fetchHeadBranch(owner, repo) {
    spinner.start('Fetching head branch...');
    try {
        const { data: repository } = await octokit.request('GET /repos/{owner}/{repo}', {
            owner: owner,
            repo: repo
        });

        spinner.succeed(`Head branch: ${kleur.blue().bold().underline(repository.default_branch)}`);
        return repository.default_branch;
    } catch (error) {
        spinner.fail('Could not fetch repository default branch.');
        throw mapGithubError(error, 'Could not fetch repository default branch.');
    }
}

/**
 * if no release found, this will list all the commits in the head branch, otherwise will prepare the changelog
 * between the latest release and the given head branch.
 *
 * @param owner the owner of the repository
 * @param repo the repository to prepare changelog for
 * @param head the head branch
 * @param lastRelease the last release of the repo
 * @returns {Promise<*|*>}
 */
export async function prepareChangeLog(owner, repo, head, lastRelease) {
    return lastRelease == null
        ? await listCommits(owner, repo, head)
        : await prepareChangelog(owner, repo, lastRelease.tag_name, head);
}

/**
 * prepares changelog with the given parameters
 *
 * @param owner the owner of the repository
 * @param repo the repository to prepare changelog for
 * @param base the branch to compare with the {@code head}
 * @param head the head branch of the {@code repo}
 * @returns {Promise<string[]>}
 */
export async function prepareChangelog(owner, repo, base, head) {
    spinner.start('Preparing the changelog....');

    try {
        const { data: changeLog } = await octokit.request('GET /repos/{owner}/{repo}/compare/{base}...{head}', {
            owner: owner,
            repo: repo,
            base: base,
            head: head
        });

        if (changeLog.commits.length !== 0) {
            spinner.succeed('Changelog has been prepared...');
        } else {
            spinner.succeed(kleur.yellow().underline('Nothing found to release.'));
        }

        return changeLog.commits.map(item => item.commit.message);

    } catch (error) {
        const errorMessage = error?.response?.data?.message;
        spinner.fail(`Something went wrong while preparing the changelog! ${errorMessage || ''}`.trim());
        throw mapGithubError(error, 'Could not prepare changelog.');
    }
}

/**
 * fetches the commits from the {@code head} branch
 * @param owner the owner of the repository
 * @param repo the repository to fetch commits from
 * @param head the head branch of the {@code repo}
 * @returns {Promise<*>}
 */
export async function listCommits(owner, repo, head) {
    spinner.start(`Fetching commits from ${head} reference...`);
    try {
        const { data: commits } = await octokit.request('GET /repos/{owner}/{repo}/commits', {
            owner: owner,
            repo: repo,
            sha: head
        });
        spinner.succeed('Commits have been fetched...');

        return commits.map(item => item.commit.message);
    } catch (error) {
        spinner.fail(`Could not fetch commits from ${head} reference.`);
        throw mapGithubError(error, `Could not fetch commits from ${head} reference.`);
    }
}

/**
 * creates the release with the given parameters
 *
 * @param owner the owner of the repository
 * @param repo the repository to create release for
 * @param draft defines if release is a draft or not
 * @param name the name/title of the release
 * @param body the changelog to be defined in the release
 * @param tag_name the tag name
 * @param targetCommitish the target commitish
 * @returns {Promise<string>}
 */
export async function createRelease(owner, repo, draft, name, body, tag_name, targetCommitish) {

    try {
        spinner.start('Preparing the release...');
        const createReleasePayload = {
            owner: owner,
            repo: repo,
            draft: draft,
            name: helper.releaseName(name),
            body: body,
            tag_name: tag_name
        };

        if (typeof targetCommitish === 'string' && targetCommitish.trim().length > 0) {
            createReleasePayload.target_commitish = targetCommitish.trim();
        }

        const { data: newRelease } = await octokit.request('POST /repos/{owner}/{repo}/releases', createReleasePayload);

        const releaseUrl = prepareReleaseUrl(newRelease.html_url);
        spinner.succeed(`Release has been prepared on Github. ${releaseUrl}`);

        return newRelease.html_url;

    } catch (error) {
        const fallbackTagName = helper.promoteTagPrecisionToSeconds(createReleasePayload.tag_name);
        if (isTagNameConflictError(error) && fallbackTagName && fallbackTagName !== createReleasePayload.tag_name) {
            try {
                spinner.warn(`Tag '${createReleasePayload.tag_name}' already exists. Retrying with '${fallbackTagName}'.`);
                spinner.start('Retrying release preparation with second-precision tag...');

                const retryPayload = {
                    owner: owner,
                    repo: repo,
                    draft: draft,
                    name: helper.releaseName(name),
                    body: body,
                    tag_name: fallbackTagName
                };

                if (typeof targetCommitish === 'string' && targetCommitish.trim().length > 0) {
                    retryPayload.target_commitish = targetCommitish.trim();
                }

                const { data: newRelease } = await octokit.request('POST /repos/{owner}/{repo}/releases', retryPayload);
                const releaseUrl = prepareReleaseUrl(newRelease.html_url);
                spinner.succeed(`Release has been prepared on Github. ${releaseUrl}`);
                return newRelease.html_url;
            } catch (retryError) {
                throw buildCreateReleaseError(retryError);
            }
        }

        throw buildCreateReleaseError(error);
    }
}

/**
 * checks whether the given tag already exists in the repository.
 *
 * @param owner the repository owner
 * @param repo the repository name
 * @param tagName the tag name to check
 * @returns {Promise<boolean>}
 */
export async function tagExists(owner, repo, tagName) {
    try {
        const { data: refs } = await octokit.request('GET /repos/{owner}/{repo}/git/matching-refs/{ref}', {
            owner: owner,
            repo: repo,
            ref: `tags/${tagName}`
        });

        return Array.isArray(refs) && refs.some(item => item?.ref === `refs/tags/${tagName}`);
    } catch (error) {
        const status = error?.status || error?.response?.status;
        if (status === 404) {
            return false;
        }

        throw mapGithubError(error, `Could not verify whether tag '${tagName}' exists.`);
    }
}

/**
 * fetches pull request metadata by number.
 *
 * @param owner the repository owner
 * @param repo the repository name
 * @param pullNumber the pull request number
 * @returns {Promise<{number: number, title: string, labels: string[]}>}
 */
export async function fetchPullRequestByNumber(owner, repo, pullNumber) {
    try {
        const { data: pullRequest } = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
            owner: owner,
            repo: repo,
            pull_number: pullNumber
        });

        return {
            number: pullRequest.number,
            title: pullRequest.title,
            labels: Array.isArray(pullRequest.labels)
                ? pullRequest.labels.map(item => item?.name).filter(Boolean)
                : []
        };
    } catch (error) {
        throw mapGithubError(error, `Could not fetch pull request #${pullNumber}.`);
    }
}

/**
 * validates and resolves a target commit-ish (branch, tag, or SHA) to a commit SHA.
 *
 * @param owner repository owner
 * @param repo repository name
 * @param ref target commit-ish
 * @returns {Promise<string>}
 */
export async function resolveTargetCommitish(owner, repo, ref) {
    spinner.start(`Validating target reference '${ref}'...`);
    try {
        const { data: commit } = await octokit.request('GET /repos/{owner}/{repo}/commits/{ref}', {
            owner: owner,
            repo: repo,
            ref: ref
        });
        spinner.succeed(`Target reference resolved to commit ${kleur.blue().bold().underline(commit.sha.substring(0, 12))}`);
        return commit.sha;
    } catch (error) {
        spinner.fail(`Could not resolve target reference '${ref}'.`);
        throw mapGithubError(error, `Could not resolve target reference '${ref}'.`);
    }
}

/**
 * retrieves the username with the help of the authentication token
 * @returns {Promise<*>}
 */
export async function retrieveUsername() {
    try {
        const { data: user } = await octokit.request('GET /user');
        return user.login;
    } catch (error) {
        throw mapGithubError(error, 'Could not retrieve authenticated user.');
    }
}

/**
 * inspects auth context and optionally checks repository access when owner/repo are provided.
 *
 * @param owner optional repository owner for access check
 * @param repo optional repository name for access check
 * @returns {Promise<{login: string, oauthScopes: string, repoAccess: {checked: boolean, ok: boolean, owner?: string, repo?: string, status?: number|null, message?: string|null}}>}
 */
export async function inspectGithubAuth(owner, repo) {
    try {
        const userResponse = await octokit.request('GET /user');
        const resolvedOwner = (typeof owner === 'string' && owner.trim())
            ? owner.trim()
            : userResponse.data.login;
        const diagnostics = {
            login: userResponse.data.login,
            oauthScopes: userResponse.headers?.['x-oauth-scopes'] || '',
            repoAccess: {
                checked: false,
                ok: false
            }
        };

        if (typeof repo === 'string' && repo.trim()) {
            try {
                await octokit.request('GET /repos/{owner}/{repo}', {
                    owner: resolvedOwner,
                    repo: repo
                });

                diagnostics.repoAccess = {
                    checked: true,
                    ok: true,
                    owner: resolvedOwner,
                    repo: repo.trim()
                };
            } catch (error) {
                diagnostics.repoAccess = {
                    checked: true,
                    ok: false,
                    owner: resolvedOwner,
                    repo: repo.trim(),
                    status: error?.status || error?.response?.status || null,
                    message: error?.response?.data?.message || error?.message || null
                };
            }
        }

        return diagnostics;
    } catch (error) {
        throw mapGithubError(error, 'Could not retrieve authenticated user.');
    }
}

function isTagNameConflictError(error) {
    const errors = error?.response?.data?.errors || [];
    return errors.some(item => item?.field === 'tag_name' && item?.code === 'already_exists');
}

function buildCreateReleaseError(error) {
    let errorMessage = "\n";
    const errors = error?.response?.data?.errors || [];
    const message = error?.response?.data?.message || 'Could not create release';
    errors.forEach(element => {
        errorMessage += `\t* field: '${element.field}' - code: '${element.code}'`;
    });
    spinner.fail(`${message} while preparing the release! ${errorMessage}`);
    return mapGithubError(error, `${message} while preparing the release.`);
}

function prepareReleaseUrl(releaseUrl) {
    if (supportsHyperlinks.stdout) {
        return hyperlinker(`${kleur.blue().bold().underline(releaseUrl)}`);
    }
    return `${releaseUrl}`;
}
