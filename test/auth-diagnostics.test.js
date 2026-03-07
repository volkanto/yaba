import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildAuthFailureGuidance,
    buildRepoAccessFailureGuidance,
    detectTokenKind,
    resolveErrorStatus,
    summarizeOAuthScopes,
    tokenKindLabel
} from '../bin/utils/auth-diagnostics.js';

test('detectTokenKind classifies known GitHub token types', () => {
    assert.equal(detectTokenKind('ghp_abc123'), 'classic-pat');
    assert.equal(detectTokenKind('github_pat_abc123'), 'fine-grained-pat');
    assert.equal(detectTokenKind('ghs_abc123'), 'github-actions-token');
    assert.equal(detectTokenKind(''), 'missing');
});

test('detectTokenKind treats github.token in actions env as actions token', () => {
    const env = {
        GITHUB_ACTIONS: 'true',
        GITHUB_TOKEN: 'token-value'
    };

    assert.equal(detectTokenKind('token-value', env), 'github-actions-token');
});

test('tokenKindLabel returns user-facing labels', () => {
    assert.equal(tokenKindLabel('classic-pat'), 'Classic personal access token');
    assert.equal(tokenKindLabel('fine-grained-pat'), 'Fine-grained personal access token');
    assert.equal(tokenKindLabel('github-actions-token'), 'GitHub Actions token');
});

test('summarizeOAuthScopes handles empty and non-empty scope headers', () => {
    assert.match(
        summarizeOAuthScopes(''),
        /not available/i
    );

    assert.equal(
        summarizeOAuthScopes('repo, workflow'),
        'OAuth scopes: repo, workflow.'
    );
});

test('resolveErrorStatus extracts status code from nested error shapes', () => {
    assert.equal(resolveErrorStatus({ status: 401 }), 401);
    assert.equal(resolveErrorStatus({ response: { status: 403 } }), 403);
    assert.equal(resolveErrorStatus({ cause: { response: { status: 404 } } }), 404);
    assert.equal(resolveErrorStatus({}), null);
});

test('buildAuthFailureGuidance returns token-specific remediation', () => {
    const classic = buildAuthFailureGuidance({ tokenKind: 'classic-pat', status: 403 });
    assert.match(classic, /repo/i);

    const fineGrained = buildAuthFailureGuidance({ tokenKind: 'fine-grained-pat', status: 403 });
    assert.match(fineGrained, /Contents/i);

    const actions = buildAuthFailureGuidance({ tokenKind: 'github-actions-token', status: 403 });
    assert.match(actions, /contents: write/i);
});

test('buildRepoAccessFailureGuidance includes status, target and guidance', () => {
    const message = buildRepoAccessFailureGuidance({
        tokenKind: 'fine-grained-pat',
        status: 403,
        owner: 'volkanto',
        repo: 'yaba',
        apiMessage: 'Resource not accessible by personal access token'
    });

    assert.match(message, /status 403/);
    assert.match(message, /volkanto\/yaba/);
    assert.match(message, /Resource not accessible by personal access token/);
    assert.match(message, /Contents/);
});
