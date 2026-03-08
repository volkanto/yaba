import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

function runCli(args, env = {}) {
    return spawnSync(
        process.execPath,
        ['./bin/index.js', ...args],
        {
            cwd: repoRoot,
            env: { ...process.env, ...env },
            encoding: 'utf8'
        }
    );
}

test('unsupported command returns JSON error payload with validation exit code', () => {
    const result = runCli(['foo', '--format', 'json']);

    assert.equal(result.status, 1);
    const payload = JSON.parse(result.stderr.trim());
    assert.equal(payload.status, 'error');
    assert.equal(payload.exitCode, 1);
    assert.match(payload.message, /Unsupported command/);
});

test('unsupported command in human mode writes plain text error', () => {
    const result = runCli(['foo']);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Unsupported command/);
    assert.throws(() => JSON.parse(result.stderr));
});

test('config init supports JSON output and --force overwrite semantics', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yaba-config-test-'));
    const configPath = path.join(tmpDir, 'yaba.config.json');

    const initial = runCli(['config', 'init', '--format', 'json', '--config', configPath]);
    assert.equal(initial.status, 0);
    const initialPayload = JSON.parse(initial.stdout.trim());
    assert.equal(initialPayload.command, 'config.init');
    assert.equal(initialPayload.status, 'success');
    assert.equal(initialPayload.overwritten, false);
    assert.equal(fs.existsSync(configPath), true);
    const configContent = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.deepEqual(configContent.notifications.providers, ['slack']);

    const second = runCli(['config', 'init', '--format', 'json', '--config', configPath]);
    assert.equal(second.status, 1);
    const secondPayload = JSON.parse(second.stderr.trim());
    assert.equal(secondPayload.status, 'error');
    assert.equal(secondPayload.exitCode, 1);
    assert.match(secondPayload.message, /already exists/);

    const forced = runCli(['config', 'init', '--format', 'json', '--config', configPath, '--force']);
    assert.equal(forced.status, 0);
    const forcedPayload = JSON.parse(forced.stdout.trim());
    assert.equal(forcedPayload.command, 'config.init');
    assert.equal(forcedPayload.status, 'success');
    assert.equal(forcedPayload.overwritten, true);

    fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('config validate returns success payload for valid config', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yaba-config-validate-success-'));
    const configPath = path.join(tmpDir, 'yaba.config.json');
    const template = runCli(['config', 'init', '--format', 'json', '--config', configPath]);
    assert.equal(template.status, 0);

    const result = runCli(['config', 'validate', '--format', 'json', '--config', configPath]);
    assert.equal(result.status, 0);
    const payload = JSON.parse(result.stdout.trim());
    assert.equal(payload.command, 'config.validate');
    assert.equal(payload.status, 'success');
    assert.equal(payload.valid, true);
    assert.deepEqual(payload.issues, []);
    assert.ok(payload.sources.some(item => item.endsWith('yaba.config.json')));

    fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('config validate returns failure payload for invalid config fields', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yaba-config-validate-failure-'));
    const configPath = path.join(tmpDir, 'yaba.config.json');
    fs.writeFileSync(configPath, JSON.stringify({
        release: {
            draft: 'yes'
        }
    }, null, 2));

    const result = runCli(['config', 'validate', '--format', 'json', '--config', configPath]);
    assert.equal(result.status, 1);
    const payload = JSON.parse(result.stdout.trim());
    assert.equal(payload.command, 'config.validate');
    assert.equal(payload.status, 'failure');
    assert.equal(payload.valid, false);
    assert.equal(payload.exitCode, 1);
    assert.ok(payload.issues.some(item => item.includes('release.draft')));

    fs.rmSync(tmpDir, { recursive: true, force: true });
});
