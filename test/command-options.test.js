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
    const { options, supported } = parseOptions(['release', 'preview', '--format', 'json', '--target', 'abc123']);
    assert.equal(supported, true);
    assert.equal(options.commandName, 'release.preview');
    assert.equal(options.releaseCommand, 'preview');
    assert.equal(options.outputFormat, 'json');
    assert.equal(options.target, 'abc123');
});

test('parses release preview command with notifications option', () => {
    const { options: slackOptions, supported: slackSupported } = parseOptions(['release', 'preview', '--notifications', 'slack']);
    assert.equal(slackSupported, true);
    assert.equal(slackOptions.notifications, 'slack');

    const { options: githubOptions, supported: githubSupported } = parseOptions(['release', 'preview', '--notifications', 'github']);
    assert.equal(githubSupported, true);
    assert.equal(githubOptions.notifications, 'github');
});

test('maps --yes to non-interactive mode and emits deprecation warning', () => {
    const { options, supported } = parseOptions(['release', 'create', '--yes']);
    assert.equal(supported, true);
    assert.equal(options.interactive, false);
    assert.ok(options.deprecationWarnings.some(item => item.includes("--yes")));
});

test('parses release safety flags', () => {
    const { options, supported } = parseOptions([
        'release',
        'create',
        '--allow-empty',
        '--fail-on-empty',
        '--max-commits',
        '25'
    ]);

    assert.equal(supported, true);
    assert.equal(options.allowEmpty, true);
    assert.equal(options.failOnEmpty, true);
    assert.equal(options.maxCommits, 25);
});

test("parses tag strategy and conflict policy flags", () => {
    const { options, supported } = parseOptions([
        "release",
        "create",
        "--tag-strategy",
        "sha",
        "--tag-on-conflict",
        "fail",
        "--tag-max-attempts",
        "7"
    ]);

    assert.equal(supported, true);
    assert.equal(options.tagStrategy, "sha");
    assert.equal(options.tagOnConflict, "fail");
    assert.equal(options.tagMaxAttempts, 7);
});

test('supports config init command', () => {
    const { options, supported } = parseOptions(['config', 'init']);
    assert.equal(supported, true);
    assert.equal(options.commandName, 'config.init');
});

test('supports config validate command', () => {
    const { options, supported } = parseOptions(['config', 'validate']);
    assert.equal(supported, true);
    assert.equal(options.commandName, 'config.validate');
});

test('rejects unsupported command input', () => {
    const { options, supported } = parseOptions(['foo']);
    assert.equal(supported, false);
    assert.equal(options.commandName, null);
});

test('parses release list command', () => {
    const { options, supported } = parseOptions(['release', 'list']);
    assert.equal(supported, true);
    assert.equal(options.commandName, 'release.list');
    assert.equal(options.releaseCommand, 'list');
});

test('release list without --limit has undefined releaseListLimit', () => {
    const { options } = parseOptions(['release', 'list']);
    assert.equal(options.releaseListLimit, undefined);
});

test('parses release list --limit as releaseListLimit', () => {
    const { options, supported } = parseOptions(['release', 'list', '--limit', '10']);
    assert.equal(supported, true);
    assert.equal(options.releaseListLimit, 10);
});

test('parses release list --limit 0 for all releases', () => {
    const { options } = parseOptions(['release', 'list', '--limit', '0']);
    assert.equal(options.releaseListLimit, 0);
});

test('parses release hotfix command', () => {
    const { options, supported } = parseOptions(['release', 'hotfix']);
    assert.equal(supported, true);
    assert.equal(options.commandName, 'release.hotfix');
    assert.equal(options.releaseCommand, 'hotfix');
});

test('--no-status-checks sets noStatusChecks to true', () => {
    const { options } = parseOptions(['release', 'create', '--no-status-checks']);
    assert.equal(options.noStatusChecks, true);
});

test('noStatusChecks is undefined when --no-status-checks is not provided', () => {
    const { options } = parseOptions(['release', 'create']);
    assert.equal(options.noStatusChecks, undefined);
});

test('--no-status-checks is accepted on release hotfix', () => {
    const { options, supported } = parseOptions(['release', 'hotfix', '--no-status-checks']);
    assert.equal(supported, true);
    assert.equal(options.noStatusChecks, true);
});
