function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function detectTokenKind(tokenValue, env = process.env) {
    const token = isNonEmptyString(tokenValue) ? tokenValue.trim() : '';
    if (!token) {
        return 'missing';
    }

    const githubActions = env?.GITHUB_ACTIONS === 'true';
    const githubToken = isNonEmptyString(env?.GITHUB_TOKEN) ? env.GITHUB_TOKEN.trim() : '';

    if ((githubActions && githubToken && token === githubToken) || token.startsWith('ghs_')) {
        return 'github-actions-token';
    }

    if (token.startsWith('github_pat_')) {
        return 'fine-grained-pat';
    }

    if (token.startsWith('ghp_') || token.startsWith('gho_') || token.startsWith('ghu_') || token.startsWith('ghr_')) {
        return 'classic-pat';
    }

    return 'unknown-token';
}

function tokenKindLabel(tokenKind) {
    switch (tokenKind) {
        case 'github-actions-token':
            return 'GitHub Actions token';
        case 'fine-grained-pat':
            return 'Fine-grained personal access token';
        case 'classic-pat':
            return 'Classic personal access token';
        case 'missing':
            return 'Missing token';
        default:
            return 'Unknown token type';
    }
}

function summarizeOAuthScopes(scopesHeader) {
    if (!isNonEmptyString(scopesHeader)) {
        return 'OAuth scopes header not available (common with fine-grained PATs and GitHub Actions tokens).';
    }

    const scopes = scopesHeader
        .split(',')
        .map(scope => scope.trim())
        .filter(Boolean);

    if (scopes.length === 0) {
        return 'OAuth scopes header not available (common with fine-grained PATs and GitHub Actions tokens).';
    }

    return `OAuth scopes: ${scopes.join(', ')}.`;
}

function resolveErrorStatus(error) {
    return error?.status
        || error?.response?.status
        || error?.cause?.status
        || error?.cause?.response?.status
        || null;
}

function buildAuthFailureGuidance({ tokenKind, status }) {
    if (tokenKind === 'github-actions-token') {
        if (status === 403) {
            return 'Token lacks required workflow/repository permissions. Ensure workflow permissions include contents: write.';
        }
        return 'Use `${{ github.token }}` with workflow permissions (`contents: write`) for same-repo releases. Use a PAT for cross-repo access.';
    }

    if (tokenKind === 'fine-grained-pat') {
        return 'Grant this token access to the target repository and ensure permissions include Contents (read/write) and Metadata (read).';
    }

    if (tokenKind === 'classic-pat') {
        return 'Ensure this PAT has `repo` scope (private repos) and belongs to a user with access to the target repository.';
    }

    return 'Check token validity, repository visibility, and permissions. Recreate the token if uncertain.';
}

function buildRepoAccessFailureGuidance({ tokenKind, status, owner, repo, apiMessage }) {
    const target = isNonEmptyString(owner) && isNonEmptyString(repo)
        ? `${owner}/${repo}`
        : 'target repository';

    const statusPart = status ? `status ${status}` : 'unknown status';
    const reasonPart = isNonEmptyString(apiMessage) ? ` GitHub API message: ${apiMessage}.` : '';
    const guidance = buildAuthFailureGuidance({ tokenKind, status });

    return `Repository access check failed (${statusPart}) for ${target}.${reasonPart} ${guidance}`.trim();
}

export {
    buildAuthFailureGuidance,
    buildRepoAccessFailureGuidance,
    detectTokenKind,
    resolveErrorStatus,
    summarizeOAuthScopes,
    tokenKindLabel
};
