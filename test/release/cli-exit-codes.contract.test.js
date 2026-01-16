/**
 * CLI EXIT CODE CONTRACT TEST
 * 
 * Enforces strict exit code contract for VERAX CLI.
 * 
 * Exit code contract (ENTERPRISE REQUIREMENT):
 * - 0: successful execution (--help, --version, successful runs)
 * - 64: CLI usage error (missing required args, invalid flags)
 * - 65: invalid input data (malformed URL, non-existent path)
 * - 2: internal fatal error (crashes, unexpected exceptions)
 * 
 * This test enforces the contract with strict assertions.
 */

import { test } from 'node:test';
import * as assert from 'node:assert';
import { spawnSync } from 'child_process';
import { dirname, resolve } from 'path';
import { existsSync, rmSync } from 'fs';

const __dirname = dirname(new URL(import.meta.url).pathname).replaceAll('%20', ' ');

/**
 * Helper: Run VERAX CLI synchronously
 */
function runVeraxSync(args, cwd) {
  const result = spawnSync('node', ['bin/verax.js', ...args], {
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 60000,
    encoding: 'utf8'
  });

  return {
    exitCode: result.status !== null ? result.status : 2,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error
  };
}

test('CLI EXIT CODE CONTRACT', async (t) => {
  const _testDir = resolve(process.cwd(), 'artifacts', 'test-exit-codes');
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
    });

    await t.test('Exit code 0: --version flag', () => {
      const result = runVeraxSync(['--version'], process.cwd());
      assert.strictEqual(result.exitCode, 0, `--version must exit with 0, got ${result.exitCode}`);
    });

    await t.test('Exit code 64: run without required --url', () => {
      const result = runVeraxSync(['run'], process.cwd());
      assert.strictEqual(result.exitCode, 64, `run without --url must exit with 64 (UsageError), got ${result.exitCode}`);
    });

    await t.test('Exit code 65: inspect non-existent path', () => {
      const fakeRunPath = resolve(process.cwd(), 'artifacts', 'fake-run-that-does-not-exist-ever');
      const result = runVeraxSync(['inspect', fakeRunPath], process.cwd());
      assert.strictEqual(result.exitCode, 65, `inspect non-existent path must exit with 65 (DataError), got ${result.exitCode}`);
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
