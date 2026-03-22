import { runReleaseCommand } from './release-command.js';

const HOTFIX_TAG_PATTERN = 'hotfix_prod_global_{yyyyMMdd}.{HHmm}';

export async function runReleaseHotfixCommand(options, runtimeConfig, isJsonOutput) {
    const hotfixConfig = {
        ...runtimeConfig,
        release: {
            ...runtimeConfig?.release,
            tagPattern: HOTFIX_TAG_PATTERN,
            tagStrategy: 'pattern'
        }
    };
    return runReleaseCommand(options, hotfixConfig, isJsonOutput);
}
