import { test } from 'node:test';
import * as assert from 'node:assert';
import { spawnSync } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '../..');

function runFrozen(command) {
  const result = spawnSync('node', [resolve(rootDir, 'bin/verax.js'), command], {
    cwd: rootDir,
    encoding: 'utf8',
    timeout: 30000,
  });

  return {
    exitCode: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

test('frozen commands exit with 64 and freeze notice', () => {
  // Stage 1 pilot surface: frozen/legacy commands are out of scope and must be hidden
  const { exitCode, stdout, stderr } = runFrozen('diagnose');

  assert.strictEqual(exitCode, 64, 'Frozen command must exit with 64 (USAGE_ERROR)');
  assert.strictEqual(stdout.trim(), '', 'Out-of-scope command must not emit contract output to stdout');
  assert.strictEqual(
    stderr.trim(),
    "Command 'diagnose' is out of scope for VERAX 0.4.9 pilot surface. Supported: run, bundle, readiness, capability-bundle, version, help.",
    'Frozen command must emit pilot-scope out-of-scope message'
  );
});
