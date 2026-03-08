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
