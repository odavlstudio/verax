import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '../../');
const wrapperPath = resolve(projectRoot, 'test/infrastructure/test-runner-wrapper.js');

function runWrapper(env) {
  const result = spawnSync('node', [wrapperPath], {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      ...env,
    },
    timeout: 60000,
  });
  return {
    exitCode: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

test('test-runner-wrapper propagates failing test exit code', () => {
  const r = runWrapper({
    VERAX_TEST_PATTERN: 'test\\release\\fixtures\\wrapper-force-fail.test.js',
    VERAX_WRAPPER_FORCE_FAIL: '1',
    VERAX_TEST_TIMEOUT_MS: '5000',
  });
  assert.notEqual(
    r.exitCode,
    0,
    `wrapper must exit non-zero on test failure (got ${r.exitCode})\nSTDOUT:\n${r.stdout}\nSTDERR:\n${r.stderr}`
  );
});

test('test-runner-wrapper exits non-zero on timeout', () => {
  const r = runWrapper({
    VERAX_TEST_PATTERN: 'test\\release\\fixtures\\wrapper-force-timeout.test.js',
    VERAX_WRAPPER_FORCE_TIMEOUT: '1',
    VERAX_TEST_TIMEOUT_MS: '100',
  });
  assert.notEqual(r.exitCode, 0, `wrapper must exit non-zero on timeout (got ${r.exitCode})`);
  assert.match(r.stderr, /FATAL: Test runner exceeded/i);
});
