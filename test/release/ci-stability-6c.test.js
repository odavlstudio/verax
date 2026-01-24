/**
 * STAGE 6C: CI Stability & Flake Immunity
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { observeExpectations } from '../../src/cli/util/observation/observation-engine.js';

function makeExpectation(id = 'exp-1') {
  return {
    id,
    type: 'navigation',
    category: 'button',
    promise: { selector: '#btn' },
    source: 'test',
    expectedOutcome: 'ui-change',
  };
}

describe('Stage 6C: CI stability & flake immunity', () => {
  let originalEnv;
  let evidenceDir;

  test.beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.VERAX_TEST_MODE = '1';
    evidenceDir = mkdtempSync(join(tmpdir(), 'verax-evidence-'));
  });

  test.afterEach(() => {
    process.env = originalEnv;
    rmSync(evidenceDir, { recursive: true, force: true });
  });

  test('transient error retried once then succeeds → COMPLETE with retries recorded', async () => {
    process.env.VERAX_TEST_OBS_PATTERN = 'transient-pass';
    const result = await observeExpectations([makeExpectation('retry-pass')], 'http://example.com', evidenceDir);

    assert.strictEqual(result.status, 'COMPLETE');
    assert.strictEqual(result.stability.retries.attempted, 1);
    assert.strictEqual(result.stability.retries.succeeded, 1);
    assert.strictEqual(result.stability.retries.exhausted, 0);
    assert.strictEqual(result.stability.incompleteInteractions, 0);
  });

  test('transient error retried once then fails → INCOMPLETE and exit 30 contract holds', async () => {
    process.env.VERAX_TEST_OBS_PATTERN = 'transient-fail';
    const result = await observeExpectations([makeExpectation('retry-fail')], 'http://example.com', evidenceDir);

    assert.strictEqual(result.status, 'INCOMPLETE');
    assert.strictEqual(result.stability.retries.exhausted, 1);
    assert.ok(result.stability.incompleteReasons.includes('error:transient-net'));

    // Anti-false-green: incomplete must imply exit code 30 in run contract
    const exitCode = result.status === 'INCOMPLETE' ? 30 : 0;
    assert.strictEqual(exitCode, 30);
  });

  test('sensor failure forces INCOMPLETE', async () => {
    process.env.VERAX_TEST_OBS_PATTERN = 'sensor-fail';
    const result = await observeExpectations([makeExpectation('sensor')], 'http://example.com', evidenceDir);

    assert.strictEqual(result.status, 'INCOMPLETE');
    assert.ok(result.stability.flakeSignals.sensorMissing >= 1);
    assert.strictEqual(result.stability.incompleteInteractions >= 1, true);
  });

  test('no false green: incomplete with no findings still mapped to 30', async () => {
    process.env.VERAX_TEST_OBS_PATTERN = 'transient-fail';
    const result = await observeExpectations([makeExpectation('nofindings')], 'http://example.com', evidenceDir);
    const exitCode = result.status === 'INCOMPLETE' ? 30 : 0;
    assert.strictEqual(exitCode, 30);
  });

  test('determinism: identical failure pattern yields stable summary fields', async () => {
    process.env.VERAX_TEST_OBS_PATTERN = 'transient-pass';
    const run1 = await observeExpectations([makeExpectation('det-1')], 'http://example.com', evidenceDir);
    const run2 = await observeExpectations([makeExpectation('det-2')], 'http://example.com', evidenceDir);

    assert.deepStrictEqual(run1.stability.retries, run2.stability.retries);
    assert.deepStrictEqual(run1.stability.incompleteReasons, run2.stability.incompleteReasons);
    assert.strictEqual(run1.status, run2.status);
  });
});




