import prompts from 'prompts';
import * as flow from '../utils/flow.js';
import { exitCodes } from '../utils/exit-codes.js';
import { resolveOwner, resolveReleaseRepo } from '../services/runtime-config-service.js';
import { printReleaseDetails, printJson } from '../services/command-output.js';

export async function runReleaseListCommand(options, runtimeConfig, isJsonOutput) {
    const releaseRepo = resolveReleaseRepo(options, runtimeConfig);
    const repoOwner = await resolveOwner(options, runtimeConfig);
    const limit = options.releaseListLimit ?? 5;
    const releases = await flow.fetchReleases(repoOwner, releaseRepo, limit);

    if (releases.length === 0) {
        console.log('No releases found.');
        return exitCodes.SUCCESS;
    }

    if (isJsonOutput) {
        printJson({ command: 'release.list', status: 'success', releases: releases.map(r => ({
            tag: r.tag_name, name: r.name, draft: r.draft,
            prerelease: r.prerelease, publishedAt: r.published_at, url: r.html_url
        }))});
        return exitCodes.SUCCESS;
    }

    const { release } = await prompts({
        type: 'select',
        name: 'release',
        message: 'Select a release to view details:',
        choices: releases.map(r => ({
            title: r.name || r.tag_name,
            value: r
        })),
        warn: 'This option is disabled'
    });

    if (!release) return exitCodes.SUCCESS;

    printReleaseDetails(release);
    return exitCodes.SUCCESS;
}
