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
  // Test with an actually frozen command (diagnose is frozen, doctor is public)
  const { exitCode, stdout, stderr } = runFrozen('diagnose');
  const output = `${stdout}\n${stderr}`;

  assert.strictEqual(exitCode, 64, 'Frozen command must exit with 64 (USAGE_ERROR)');
  assert.ok(
    output.includes('This command is frozen and not part of VERAX Vision 1.0 guarantees.'),
    'Frozen command must emit the freeze notice'
  );
});
