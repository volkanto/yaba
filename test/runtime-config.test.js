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

test('deepMerge ignores prototype-polluting keys', () => {
    const target = {};
    const source = JSON.parse('{"__proto__":{"polluted":"yes"},"constructor":{"prototype":{"pollutedCtor":"yes"}},"prototype":{"pollutedProto":"yes"},"safe":{"enabled":true}}');

    try {
        deepMerge(target, source);

        assert.deepEqual(target, {
            safe: {
                enabled: true
            }
        });

        assert.equal(Object.prototype.polluted, undefined);
        assert.equal(Object.prototype.pollutedCtor, undefined);
        assert.equal(Object.prototype.pollutedProto, undefined);
    } finally {
        delete Object.prototype.polluted;
        delete Object.prototype.pollutedCtor;
        delete Object.prototype.pollutedProto;
    }
});

test('renderConfigPattern replaces date placeholders', () => {
    const now = new Date('2026-03-06T08:00:00.000Z');
    const rendered = renderConfigPattern('tag-{yyyyMMdd}-name-{yyyy-MM-dd}', now);
    assert.equal(rendered, 'tag-20260306-name-2026-03-06');
});
