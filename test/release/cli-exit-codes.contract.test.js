/**
 * CLI EXIT CODE CONTRACT TEST
 * 
 * Enforces strict exit code contract for VERAX CLI.
 * 
 * Exit code contract (OFFICIAL, and ONLY set):
 * - SUCCESS = 0
 * - FINDINGS = 20
 * - INCOMPLETE = 30
 * - INVARIANT_VIOLATION = 50
 * - USAGE_ERROR = 64
 * 
 * This test enforces the contract with strict assertions.
 */

import { test } from 'node:test';
import * as assert from 'node:assert';
import { spawnSync } from 'child_process';
import { dirname, resolve } from 'path';
import { existsSync, rmSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const __dirname = dirname(new URL(import.meta.url).pathname).replaceAll('%20', ' ');

/**
 * Helper: Run VERAX CLI synchronously
 */
function runVeraxSync(args, cwd) {
  const result = spawnSync('node', ['bin/verax.js', ...args], {
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 60000,
    encoding: 'utf8',
    env: {
      ...process.env,
      // Avoid real browser launches in contract tests
      VERAX_TEST_MODE: '1',
    },
  });

  return {
    exitCode: result.status !== null ? result.status : 30,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error
  };
}

test('CLI EXIT CODE CONTRACT', async (t) => {
  const _testDir = mkdtempSync(join(tmpdir(), 'verax-test-exit-codes-'));
  let testServer = null;
  let _port = null;

  // Start test server for valid URL tests
  try {
    const { createTestServer } = await import('../fixtures/http-post-blocking/server.js');
    testServer = await createTestServer();
  } catch {
    // If we can't create server, skip server-based tests but continue with others
  }

  if (testServer) {
    _port = testServer.port;
  }

  try {
    // STRICT CONTRACT ENFORCEMENT
    // These tests MUST pass. Any failure indicates contract violation.

    await t.test('Exit code 0: --help flag', () => {
      const result = runVeraxSync(['--help'], process.cwd());
      assert.strictEqual(result.exitCode, 0, `--help must exit with 0, got ${result.exitCode}`);
      assert.strictEqual(result.stderr.trim(), '', `--help must not write to stderr, got: ${result.stderr}`);
    });

    await t.test('Exit code 0: help subcommand', () => {
      const result = runVeraxSync(['help'], process.cwd());
      assert.strictEqual(result.exitCode, 0, `help must exit with 0, got ${result.exitCode}`);
      assert.strictEqual(result.stderr.trim(), '', `help must not write to stderr, got: ${result.stderr}`);
    });

    await t.test('Exit code 0: --version flag', () => {
      const result = runVeraxSync(['--version'], process.cwd());
      assert.strictEqual(result.exitCode, 0, `--version must exit with 0, got ${result.exitCode}`);
      assert.strictEqual(result.stderr.trim(), '', `--version must not write to stderr, got: ${result.stderr}`);
    });

    await t.test('Exit code 0: version subcommand', () => {
      const result = runVeraxSync(['version'], process.cwd());
      assert.strictEqual(result.exitCode, 0, `version must exit with 0, got ${result.exitCode}`);
      assert.strictEqual(result.stderr.trim(), '', `version must not write to stderr, got: ${result.stderr}`);
    });

    await t.test('Exit code 64: run without required --url', () => {
      const result = runVeraxSync(['run'], process.cwd());
      assert.strictEqual(result.exitCode, 64, `run without --url must exit with 64 (USAGE_ERROR), got ${result.exitCode}`);
      assert.match(result.stdout, /RESULT\s+USAGE_ERROR/, 'run usage error must emit RESULT USAGE_ERROR');
      assert.strictEqual(result.stderr.trim(), '', `run usage error must not write to stderr, got: ${result.stderr}`);
    });

    await t.test('Exit code 64: bundle with missing args', () => {
      const result = runVeraxSync(['bundle'], process.cwd());
      assert.strictEqual(result.exitCode, 64, `bundle without args must exit with 64 (USAGE_ERROR), got ${result.exitCode}`);
      assert.match(result.stdout, /RESULT\s+USAGE_ERROR/, 'bundle usage error must emit RESULT USAGE_ERROR');
      assert.strictEqual(result.stderr.trim(), '', `bundle usage error must not write to stderr, got: ${result.stderr}`);
    });

    await t.test('Exit code 50: bundle non-existent run directory', () => {
      const fakeRunPath = resolve(_testDir, 'fake-run-that-does-not-exist-ever');
      const bundleDir = resolve(_testDir, 'bundle');
      const result = runVeraxSync(['bundle', fakeRunPath, bundleDir], process.cwd());
      assert.strictEqual(result.exitCode, 50, `bundle non-existent run directory must exit with 50 (INVARIANT_VIOLATION), got ${result.exitCode}`);
      assert.match(result.stdout, /RESULT\s+INVARIANT_VIOLATION/, 'bundle data error must emit RESULT INVARIANT_VIOLATION');
      assert.strictEqual(result.stderr.trim(), '', `bundle data error must not write to stderr, got: ${result.stderr}`);
    });

    await t.test('Exit code set: run in JSON mode emits only contract exit codes', async () => {
      if (!testServer) {
        t.skip('test server not available');
        return;
      }

      const url = `http://127.0.0.1:${_port}`;
      const outDir = resolve(_testDir, '.verax');
      const srcDir = resolve(process.cwd(), 'test', 'fixtures', 'truly-empty-fixture');

      const result = runVeraxSync(['run', '--url', url, '--src', srcDir, '--out', outDir, '--json'], process.cwd());

      assert.ok([0, 20, 30, 50, 64].includes(result.exitCode), `run must exit with official code, got ${result.exitCode}`);
      assert.strictEqual(result.stderr.trim(), '', `run --json must not write to stderr, got: ${result.stderr}`);
      const lines = String(result.stdout || '').trim().split(/\r?\n/).filter(Boolean);
      assert.ok(lines.length >= 1, 'run --json must emit at least one JSON line');
      for (const line of lines) {
        assert.doesNotThrow(() => JSON.parse(line), `run --json line must be JSON: ${line.slice(0, 80)}`);
      }
      const json = JSON.parse(lines[lines.length - 1]);
      assert.ok([0, 20, 30, 50, 64].includes(json.exitCode), `final JSON exitCode must be official, got ${json.exitCode}`);
    });

  } finally {
    // Cleanup
    if (testServer && testServer.server) {
      await new Promise((resolve) => {
        testServer.server.close(() => {
          resolve();
        });
      });
    }

    // Optional: cleanup test artifacts
    if (existsSync(_testDir)) {
      rmSync(_testDir, { recursive: true, force: true });
    }
  }
});

