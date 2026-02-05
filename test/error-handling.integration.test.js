/**
 * Integration tests for error handling contract
 * Verifies that errors propagate correctly from operations through CLI to exit codes
 */

import test from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

/**
 * Helper to run verax CLI and capture output/exit code
 */
function runVerax(args = []) {
  const result = spawnSync('node', [join(projectRoot, 'bin', 'verax.js'), ...args], {
    encoding: 'utf-8',
    cwd: projectRoot,
    timeout: 10000
  });
  
  return {
    exitCode: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    signal: result.signal
  };
}

test('CLI Error Handling Contract - Exit Codes', async (t) => {
  await t.test('--help exits with 0', () => {
    const result = runVerax(['--help']);
    assert.strictEqual(result.exitCode, 0, 'help should exit 0');
    assert.match(result.stdout, /VERAX/i, 'help should contain VERAX');
  });

  await t.test('--version exits with 0', () => {
    const result = runVerax(['--version']);
    assert.strictEqual(result.exitCode, 0, 'version should exit 0');
    assert.match(result.stdout, /verax/i, 'version should contain version string');
  });

  await t.test('run without --url exits with 64 (usage error)', () => {
    const result = runVerax(['run']);
    assert.strictEqual(result.exitCode, 64, 'missing --url should exit 64');
    assert.match(result.stderr, /url|require|argument/i, 'error should mention missing url');
  });

  await t.test('inspect non-existent path exits with 50 (invariant violation)', () => {
    const result = runVerax(['inspect', '/nonexistent/path']);
    assert.strictEqual(result.exitCode, 50, 'nonexistent path should exit 50');
    assert.match(result.stderr, /not found|does not exist|error/i, 'error should indicate missing path');
  });

  await t.test('unknown command exits with 64 (usage error)', () => {
    const result = runVerax(['unknown-command']);
    assert.strictEqual(result.exitCode, 64, 'unknown command should exit 64');
  });

  await t.test('no arguments exits with 64 (usage error)', () => {
    const result = runVerax([]);
    assert.strictEqual(result.exitCode, 64, 'no args should exit 64');
    assert.match(result.stdout, /USAGE|usage/i, 'should show usage help');
  });
});

test('CLI Error Handling Contract - Error Messages', async (t) => {
  await t.test('error messages are printed to stderr', () => {
    const result = runVerax(['run']);
    assert(result.stderr.length > 0, 'errors should print to stderr');
    assert(result.stderr.includes('Error') || result.stderr.includes('error'), 'error output should mention error');
  });

  await t.test('error messages are human-readable', () => {
    const result = runVerax(['run']);
    assert.match(result.stderr, /--url|missing|required|argument/i, 'error should be descriptive');
  });
});

test('CLI Error Handling Contract - Consistency', async (t) => {
  await t.test('same command twice produces same exit code', () => {
    const result1 = runVerax(['run']);
    const result2 = runVerax(['run']);
    assert.strictEqual(result1.exitCode, result2.exitCode, 'same error should exit same code');
  });

  await t.test('error exit codes are consistent', () => {
    // Usage errors should all exit 64
    assert.strictEqual(runVerax(['run']).exitCode, 64);
    assert.strictEqual(runVerax(['unknown']).exitCode, 64);
    
    // Data/invariant violations should exit 50
    assert.strictEqual(runVerax(['inspect', '/nonexistent']).exitCode, 50);
  });
});
