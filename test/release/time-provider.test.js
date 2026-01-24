import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getTimeProvider } from '../../src/cli/util/support/time-provider.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..', '..');

/**
 * Test: Time Provider Infrastructure
 * 
 * Verifies that the time provider infrastructure works correctly in both
 * production (real-time) and test (deterministic) modes.
 */

test('Time Provider | default provider returns real-time values', async () => {
  // Clear VERAX_TEST_TIME to ensure we get real-time values
  const result = execSync('node -e "delete process.env.VERAX_TEST_TIME; import { getTimeProvider } from \'./src/cli/util/support/time-provider.js\'; const p = getTimeProvider(); console.log(JSON.stringify({ now: p.now(), iso: p.iso() }))"', {
    cwd: ROOT,
    encoding: 'utf-8',
    env: { ...process.env, VERAX_TEST_TIME: undefined },
  }).trim();

  const parsed = JSON.parse(result);

  // Verify now() returns a valid timestamp (milliseconds since epoch)
  assert.ok(typeof parsed.now === 'number', 'now() should return a number');
  assert.ok(parsed.now > 0, 'now() should return a positive number');
  // Use a larger window since test execution itself takes time
  assert.ok(parsed.now > getTimeProvider().now() - 10000, 'now() should be recent (within 10 seconds)');

  // Verify iso() returns a valid ISO 8601 string
  assert.ok(typeof parsed.iso === 'string', 'iso() should return a string');
  assert.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(parsed.iso), 'iso() should return ISO 8601 format');

  // Verify consistency: iso() timestamp should match now()
  const isoTime = Date.parse(parsed.iso);
  assert.ok(Math.abs(isoTime - parsed.now) < 100, 'now() and iso() should return consistent times');
});

test('Time Provider | VERAX_TEST_TIME forces deterministic output', async () => {
  const testTime = '2026-01-19T10:00:00.000Z';
  const result = execSync(`node -e "import { getTimeProvider } from './src/cli/util/support/time-provider.js'; const p = getTimeProvider(); console.log(JSON.stringify({ now: p.now(), iso: p.iso() }))"`, {
    cwd: ROOT,
    encoding: 'utf-8',
    env: {
      ...process.env,
      VERAX_TEST_TIME: testTime,
    },
  }).trim();

  const parsed = JSON.parse(result);

  // Verify iso() returns exactly the test time
  assert.equal(parsed.iso, testTime, 'iso() should return VERAX_TEST_TIME value');

  // Verify now() returns the parsed epoch from test time
  const expectedNow = Date.parse(testTime);
  assert.equal(parsed.now, expectedNow, 'now() should return parsed VERAX_TEST_TIME');
});

test('Time Provider | provider has required methods', async () => {
  const result = execSync('node -e "import { getTimeProvider } from \'./src/cli/util/support/time-provider.js\'; const p = getTimeProvider(); console.log(JSON.stringify({ hasNow: typeof p.now === \'function\', hasIso: typeof p.iso === \'function\' }))"', {
    cwd: ROOT,
    encoding: 'utf-8',
  }).trim();

  const parsed = JSON.parse(result);
  assert.ok(parsed.hasNow, 'provider should have now() method');
  assert.ok(parsed.hasIso, 'provider should have iso() method');
});

test('Time Provider | setTimeProvider accepts valid provider', async () => {
  const result = execSync('node -e "import { getTimeProvider, setTimeProvider } from \'./src/cli/util/support/time-provider.js\'; const custom = { now: () => 12345, iso: () => \'2026-01-19T10:00:00.000Z\' }; setTimeProvider(custom); const p = getTimeProvider(); console.log(JSON.stringify({ now: p.now(), iso: p.iso() }))"', {
    cwd: ROOT,
    encoding: 'utf-8',
  }).trim();

  const parsed = JSON.parse(result);
  assert.equal(parsed.now, 12345, 'setTimeProvider should override now()');
  assert.equal(parsed.iso, '2026-01-19T10:00:00.000Z', 'setTimeProvider should override iso()');
});

test('Time Provider | setTimeProvider rejects invalid provider', async () => {
  try {
    execSync('node -e "import { setTimeProvider } from \'./src/cli/util/support/time-provider.js\'; setTimeProvider({})"', {
      cwd: ROOT,
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    assert.fail('Should throw error for invalid provider');
  } catch (error) {
    // Expected to fail
    assert.ok(error.message.includes('Error'), 'Should throw error');
  }
});

test('Time Provider | is singleton across imports', async () => {
  const result = execSync('node -e "import { getTimeProvider, setTimeProvider } from \'./src/cli/util/support/time-provider.js\'; const custom = { now: () => 99999, iso: () => \'test\' }; setTimeProvider(custom); const p1 = getTimeProvider(); import { getTimeProvider as getTimeProvider2 } from \'./src/cli/util/support/time-provider.js\'; const p2 = getTimeProvider2(); console.log(JSON.stringify({ same: p1.now() === p2.now() }))"', {
    cwd: ROOT,
    encoding: 'utf-8',
  }).trim();

  const parsed = JSON.parse(result);
  assert.ok(parsed.same, 'should be singleton (same instance across imports)');
});

test('Time Provider | iso() and now() are consistent (within 100ms)', async () => {
  const result = execSync('node -e "import { getTimeProvider } from \'./src/cli/util/support/time-provider.js\'; const p = getTimeProvider(); const before = p.now(); const iso = p.iso(); const after = p.now(); console.log(JSON.stringify({ before, iso, after, isoNow: Date.parse(iso) }))"', {
    cwd: ROOT,
    encoding: 'utf-8',
  }).trim();

  const parsed = JSON.parse(result);

  // iso() should be called between before and after
  assert.ok(parsed.isoNow >= parsed.before - 100, 'iso() should be from same epoch as now()');
  assert.ok(parsed.isoNow <= parsed.after + 100, 'iso() should be from same epoch as now()');
});




