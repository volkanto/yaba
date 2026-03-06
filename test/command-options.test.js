import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

function parseOptions(args) {
    const script = `
process.argv = ['node', 'yaba', ...JSON.parse(process.argv[1])];
const { options, isSupportedReleaseCommand } = await import('./bin/utils/command.js');
console.log(JSON.stringify({ options, supported: isSupportedReleaseCommand(options) }));
`;

    const output = execFileSync(
        process.execPath,
        ['--input-type=module', '-e', script, JSON.stringify(args)],
        { cwd: repoRoot, encoding: 'utf8' }
    );
    return JSON.parse(output);
}

test('defaults to release.create and marks implicit invocation as deprecated', () => {
    const { options, supported } = parseOptions([]);
    assert.equal(supported, true);
    assert.equal(options.commandName, 'release.create');
    assert.equal(options.releaseCommand, 'create');
    assert.equal(options.deprecationWarnings.length, 1);
    assert.match(options.deprecationWarnings[0], /Implicit command invocation/);
});

test('parses release preview command with json output option', () => {
    const { options, supported } = parseOptions(['release', 'preview', '--format', 'json']);
    assert.equal(supported, true);
    assert.equal(options.commandName, 'release.preview');
    assert.equal(options.releaseCommand, 'preview');
    assert.equal(options.outputFormat, 'json');
});

test('maps --yes to non-interactive mode and emits deprecation warning', () => {
    const { options, supported } = parseOptions(['release', 'create', '--yes']);
    assert.equal(supported, true);
    assert.equal(options.interactive, false);
    assert.ok(options.deprecationWarnings.some(item => item.includes("--yes")));
});

test('supports config init command', () => {
    const { options, supported } = parseOptions(['config', 'init']);
    assert.equal(supported, true);
    assert.equal(options.commandName, 'config.init');
});

test('rejects unsupported command input', () => {
    const { options, supported } = parseOptions(['foo']);
    assert.equal(supported, false);
    assert.equal(options.commandName, null);
});
