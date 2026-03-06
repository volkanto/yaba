import test from 'node:test';
import assert from 'node:assert/strict';
import {
    deepMerge,
    firstDefined,
    renderConfigPattern,
    resolveBoolean,
    resolveOutputFormatFromSources
} from '../bin/utils/runtime-config.js';

test('firstDefined returns first non-nullish value', () => {
    assert.equal(firstDefined(undefined, null, 'x', 'y'), 'x');
    assert.equal(firstDefined(undefined, null), undefined);
});

test('resolveBoolean respects primary > secondary > default precedence', () => {
    assert.equal(resolveBoolean(true, false, false), true);
    assert.equal(resolveBoolean(undefined, false, true), false);
    assert.equal(resolveBoolean(undefined, undefined, true), true);
});

test('resolveOutputFormatFromSources applies flags > env > config > default', () => {
    assert.equal(resolveOutputFormatFromSources('json', 'human', 'human'), 'json');
    assert.equal(resolveOutputFormatFromSources(undefined, 'json', 'human'), 'json');
    assert.equal(resolveOutputFormatFromSources(undefined, undefined, 'json'), 'json');
    assert.equal(resolveOutputFormatFromSources(undefined, undefined, undefined), 'human');
});

test('deepMerge merges nested object keys without losing siblings', () => {
    const target = {
        release: {
            draft: false,
            interactive: true
        }
    };

    deepMerge(target, {
        release: {
            draft: true
        },
        output: {
            format: 'json'
        }
    });

    assert.deepEqual(target, {
        release: {
            draft: true,
            interactive: true
        },
        output: {
            format: 'json'
        }
    });
});

test('renderConfigPattern replaces date placeholders', () => {
    const now = new Date('2026-03-06T08:00:00.000Z');
    const rendered = renderConfigPattern('tag-{yyyyMMdd}-name-{yyyy-MM-dd}', now);
    assert.equal(rendered, 'tag-20260306-name-2026-03-06');
});
