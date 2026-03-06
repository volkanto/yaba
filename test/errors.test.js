import test from 'node:test';
import assert from 'node:assert/strict';
import { createError, mapGithubError, mapNetworkError, normalizeError, YabaError } from '../bin/utils/errors.js';
import { exitCodes } from '../bin/utils/exit-codes.js';

test('mapGithubError returns NETWORK for low-level network failures', () => {
    const error = mapGithubError({ code: 'ENOTFOUND' }, 'Request failed.');
    assert.equal(error.exitCode, exitCodes.NETWORK);
});

test('mapGithubError returns AUTH for unauthorized responses', () => {
    const error = mapGithubError({ status: 401 }, 'Could not fetch repository.');
    assert.equal(error.exitCode, exitCodes.AUTH);
    assert.match(error.message, /Authentication\/authorization failed/);
});

test('mapGithubError returns UPSTREAM for non-auth API failures', () => {
    const error = mapGithubError({ status: 500 }, 'Could not fetch repository.');
    assert.equal(error.exitCode, exitCodes.UPSTREAM);
});

test('mapNetworkError returns NETWORK when socket-level code is present', () => {
    const error = mapNetworkError({ code: 'ETIMEDOUT' }, 'Network check failed.');
    assert.equal(error.exitCode, exitCodes.NETWORK);
});

test('normalizeError preserves YabaError and wraps unknown errors as INTERNAL', () => {
    const existing = createError('Known', exitCodes.VALIDATION);
    assert.ok(existing instanceof YabaError);
    assert.equal(normalizeError(existing), existing);

    const normalized = normalizeError(new Error('Boom'));
    assert.equal(normalized.exitCode, exitCodes.INTERNAL);
    assert.equal(normalized.message, 'Boom');
});
