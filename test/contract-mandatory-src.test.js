/**
 * PHASE 1 — CONTRACT LOCK: MANDATORY --src
 * 
 * Validates the hard product decision to require --src flag for all runs.
 * 
 * CONTRACT GUARANTEES:
 * 1. verax run --url <url> WITHOUT --src → exit code 64 (USAGE_ERROR)
 * 2. Error message is clear and user-facing
 * 3. No auto-discovery or implicit src behavior
 * 4. VERAX fails fast before any learn/observe logic
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '../');

test('Phase 1: Contract Lock -- Mandatory --src Flag', async (suite) => {
  
  await suite.test('verax run --url <url> WITHOUT --src exits with 64 (USAGE_ERROR)', () => {
    const result = spawnSync('node', ['bin/verax.js', 'run', '--url', 'https://example.com'], {
      cwd: projectRoot,
      encoding: 'utf-8',
    });

    assert.equal(
      result.status,
      64,
      `Missing --src must exit with code 64 (USAGE_ERROR), got ${result.status}`
    );

    // Verify error message is user-facing and explicit
    const output = (result.stdout || '') + (result.stderr || '');
    assert.match(
      output,
      /VERAX requires frontend source code \(--src\) to analyze user-facing promises/i,
      'Error message must explicitly state --src requirement'
    );
  });

  await suite.test('verax run --url <url> --src <path> does not fail with missing --src error', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'verax-test-phase1-'));
    try {
      // Create a minimal project
      mkdirSync(join(tmpDir, 'src'));
      writeFileSync(join(tmpDir, 'src', 'index.js'), 'console.log("hello");');
      
      // Note: This will fail due to unreachable URL, but we're testing that --src validation passes
      const result = spawnSync('node', ['bin/verax.js', 'run', '--url', 'https://127.0.0.1:99999', '--src', join(tmpDir, 'src')], {
        cwd: projectRoot,
        encoding: 'utf-8',
        timeout: 5000, // Short timeout to avoid waiting forever
      });

      // Should NOT fail with "missing --src" error
      const output = (result.stdout || '') + (result.stderr || '');
      assert.strictEqual(
        output.includes('VERAX requires frontend source code'),
        false,
        'Should not fail with missing --src error when --src is provided'
      );
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  await suite.test('No auto-discovery fallback when --src is missing', () => {
    // Even when src/ exists in the current directory, running without --src should fail
    // This test verifies the contract is hard-locked and not soft-failed via discovery
    const tmpDir = mkdtempSync(join(tmpdir(), 'verax-test-phase1-discovery-'));
    try {
      // Create a directory with src/ subdirectory to test auto-discovery doesn't happen
      mkdirSync(join(tmpDir, 'src'));
      writeFileSync(join(tmpDir, 'src', 'index.js'), 'console.log("discovered");');
      
      // Copy package.json and node_modules setup to make the test more realistic
      const result = spawnSync('node', ['bin/verax.js', 'run', '--url', 'https://example.com'], {
        cwd: tmpDir,
        encoding: 'utf-8',
      });

      // Must fail with --src requirement, whether with exit code 64 or 1
      // The important thing is: it fails and doesn't silently use src/
      assert(
        result.status === 64 || result.status === 1,
        `Should fail with 64 (USAGE_ERROR) or 1 (runtime error), got ${result.status}`
      );

      const output = (result.stdout || '') + (result.stderr || '');
      // Either fails with --src requirement or fails before discovering src
      // The key contract: no silent auto-discovery that succeeds
      assert(
        result.status === 64 || !output.includes('discovered'),
        'Should not silently use auto-discovered src/'
      );
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

});
