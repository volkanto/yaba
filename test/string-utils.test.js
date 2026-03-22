import test from 'node:test';
import assert from 'node:assert/strict';
import { isBlank } from '../bin/utils/string-utils.js';

test('isBlank returns true for undefined', () => {
    assert.equal(isBlank(undefined), true);
});

test('isBlank returns true for null', () => {
    assert.equal(isBlank(null), true);
});

test('isBlank returns true for empty string', () => {
    assert.equal(isBlank(''), true);
});

test('isBlank returns true for whitespace-only string', () => {
    assert.equal(isBlank('   '), true);
});

test('isBlank returns true for the string "undefined"', () => {
    // Regression: previously used == which is correct here too, but === makes intent explicit
    assert.equal(isBlank('undefined'), true);
});

test('isBlank returns false for a non-blank string', () => {
    assert.equal(isBlank('hello'), false);
});

test('isBlank returns false for a string that is not the word "undefined"', () => {
    assert.equal(isBlank('undefinedx'), false);
});
