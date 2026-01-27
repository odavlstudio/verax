/**
 * SCOPE BOUNDARY ENFORCEMENT TESTS
 * 
 * Vision.md explicitly states authenticated/post-login flows are OUT OF SCOPE.
 * These tests verify that:
 * 1. Auth flags require explicit --force-post-auth acknowledgement
 * 2. Post-auth mode ALWAYS results in INCOMPLETE (exit 30)
 * 3. Proper warnings and reasons are emitted
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { runVeraxSync } from './support/run-verax-sync.js';

const ROOT = resolve(import.meta.dirname, '..');
const FIXTURE_PATH = resolve(ROOT, 'test/fixtures/static-buttons');

test('SCOPE ENFORCEMENT | auth flags without --force-post-auth throw USAGE_ERROR', () => {
  const result = runVeraxSync([
    'run',
    '--url', 'http://localhost:9999',
    '--src', FIXTURE_PATH,
    '--auth-storage', '/fake/path/state.json',
  ], ROOT);

  assert.strictEqual(result.exitCode, 64, 'Should exit with USAGE_ERROR (64)');
  assert.match(result.stderr, /OUT OF SCOPE per Vision\.md/, 'Should mention Vision.md scope');
  assert.match(result.stderr, /add --force-post-auth to proceed/, 'Should suggest --force-post-auth');
  assert.match(result.stderr, /EXPERIMENTAL/, 'Should warn about experimental nature');
});

test('SCOPE ENFORCEMENT | --auth-cookie without --force-post-auth throws USAGE_ERROR', () => {
  const result = runVeraxSync([
    'run',
    '--url', 'http://localhost:9999',
    '--src', FIXTURE_PATH,
    '--auth-cookie', 'session=abc123',
  ], ROOT);

  assert.strictEqual(result.exitCode, 64, 'Should exit with USAGE_ERROR (64)');
  assert.match(result.stderr, /OUT OF SCOPE/, 'Should reject auth flags');
});

test('SCOPE ENFORCEMENT | --auth-header without --force-post-auth throws USAGE_ERROR', () => {
  const result = runVeraxSync([
    'run',
    '--url', 'http://localhost:9999',
    '--src', FIXTURE_PATH,
    '--auth-header', 'Authorization: Bearer token',
  ], ROOT);

  assert.strictEqual(result.exitCode, 64, 'Should exit with USAGE_ERROR (64)');
  assert.match(result.stderr, /OUT OF SCOPE/, 'Should reject auth flags');
});

test('SCOPE ENFORCEMENT | --auth-mode strict without --force-post-auth throws USAGE_ERROR', () => {
  const result = runVeraxSync([
    'run',
    '--url', 'http://localhost:9999',
    '--src', FIXTURE_PATH,
    '--auth-mode', 'strict',
  ], ROOT);

  assert.strictEqual(result.exitCode, 64, 'Should exit with USAGE_ERROR (64)');
  assert.match(result.stderr, /OUT OF SCOPE/, 'Should reject non-auto auth mode');
});

test('SCOPE ENFORCEMENT | --force-post-auth prints loud warnings', (t) => {
  // Note: This test will fail in actual runtime because server isn't running
  // We're verifying the warning is printed before server connection
  const result = runVeraxSync([
    'run',
    '--url', 'http://localhost:9999',
    '--src', FIXTURE_PATH,
    '--auth-storage', '/fake/path/state.json',
    '--force-post-auth',
  ], ROOT);

  // Should print warning before attempting connection
  assert.match(result.stdout + result.stderr, /WARNING: Running in EXPERIMENTAL post-auth mode/, 
    'Should print experimental warning');
  assert.match(result.stdout + result.stderr, /Authenticated flows are OUT OF SCOPE per Vision\.md/, 
    'Should reference Vision.md');
  assert.match(result.stdout + result.stderr, /Result will be marked INCOMPLETE/, 
    'Should warn about INCOMPLETE result');
  assert.match(result.stdout + result.stderr, /Trust guarantees do NOT apply/, 
    'Should disclaim trust guarantees');
});

test('SCOPE ENFORCEMENT | post-auth mode forces INCOMPLETE result', async (t) => {
  // Static enforcement check to avoid needing a live server; this asserts the
  // contract in the code path that writes final artifacts.
  
  // Verify the enforcement code exists
  const runJsPath = resolve(ROOT, 'src/cli/commands/run.js');
  const { readFileSync } = await import('fs');
  const content = readFileSync(runJsPath, 'utf-8');
  
  assert.ok(content.includes('post_auth_experimental'), 
    'run.js should add post_auth_experimental reason');
  assert.ok(content.includes('out_of_scope_per_vision'), 
    'run.js should add out_of_scope_per_vision reason');
  assert.ok(content.includes('if (hasAuthFlags)'), 
    'run.js should check hasAuthFlags');
  
  // Verify truthState is forced to INCOMPLETE
  const postAuthBlock = content.match(/if \(hasAuthFlags\) \{[\s\S]*?finalTruthResult\.truthState = 'INCOMPLETE'/);
  assert.ok(postAuthBlock, 'Should force INCOMPLETE when hasAuthFlags=true');
  assert.match(postAuthBlock[0], /recommendedAction/, 'Should include remediation guidance');
});

test('SCOPE ENFORCEMENT | Vision.md documents pre-auth scope', async (t) => {
  const visionPath = resolve(ROOT, 'docs/VISION.md');
  const { readFileSync } = await import('fs');
  const vision = readFileSync(visionPath, 'utf-8');
  
  assert.match(vision, /pre-authentication/, 'Vision.md should mention pre-authentication scope');
  assert.match(vision, /Authenticated.*post-login flows.*OUT OF SCOPE/i, 
    'Vision.md should explicitly state authenticated flows are out of scope');
});

test('SCOPE ENFORCEMENT | --auth-mode auto (default) does not trigger enforcement', () => {
  // Default auth-mode is 'auto' which shouldn't trigger enforcement by itself
  const result = runVeraxSync([
    'run',
    '--url', 'http://localhost:9999',
    '--src', FIXTURE_PATH,
    // No auth flags, just testing default doesn't break
  ], ROOT);

  // Should fail due to connection (no server), not due to scope enforcement
  assert.notStrictEqual(result.exitCode, 64, 'Should not be USAGE_ERROR for missing auth flags');
});

test('SCOPE ENFORCEMENT | --force-post-auth without auth flags is harmless', () => {
  // --force-post-auth alone shouldn't do anything (no auth flags provided)
  const result = runVeraxSync([
    'run',
    '--url', 'http://localhost:9999',
    '--src', FIXTURE_PATH,
    '--force-post-auth',
  ], ROOT);

  // Should fail due to connection, not scope enforcement
  assert.notStrictEqual(result.exitCode, 64, 'Should not be USAGE_ERROR when no auth flags');
  assert.doesNotMatch(result.stdout + result.stderr, /EXPERIMENTAL post-auth mode/, 
    'Should not print post-auth warnings without auth flags');
});
