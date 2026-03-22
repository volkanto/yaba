import test from 'node:test';
import assert from 'node:assert/strict';
import { releaseName, prepareChangeLog } from '../bin/utils/helper.js';

test('releaseName returns provided name when non-blank', () => {
    assert.equal(releaseName('My Release'), 'My Release');
});

test('releaseName generates a default name without calling this.releaseDate', () => {
    // Regression: previously called this.releaseDate() which throws in ESM strict mode
    const result = releaseName('');
    assert.match(result, /^Global release \d{4}-\d{2}-\d{2}$/);
});

test('releaseName generates default name when given undefined', () => {
    const result = releaseName(undefined);
    assert.match(result, /^Global release \d{4}-\d{2}-\d{2}$/);
});

test('prepareChangeLog returns givenBody when non-blank', () => {
    assert.equal(prepareChangeLog('custom body', ['commit1']), 'custom body');
});

test('prepareChangeLog formats changelog from commits when body is blank', () => {
    const result = prepareChangeLog('', ['feat: add login', 'fix: typo']);
    assert.match(result, /- feat: add login/);
    assert.match(result, /- fix: typo/);
});

test('prepareChangeLog returns no-changes placeholder for empty changelog', () => {
    const result = prepareChangeLog('', []);
    assert.equal(result, '* No changes');
});
