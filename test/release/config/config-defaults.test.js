/**
 * Config Defaults Test
 * 
 * Verifies that defaults.js exports exactly match legacy hardcoded values.
 * This test ensures Phase C1 configuration centralization introduces zero behavior change.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import defaults from '../../../src/cli/util/config/defaults.js';

describe('Config Defaults - Legacy Equivalence', () => {
  it('should export TIMEOUTS with ci, default, and test modes', () => {
    assert.ok(defaults.TIMEOUTS, 'TIMEOUTS must be defined');
    assert.ok(defaults.TIMEOUTS.ci, 'TIMEOUTS.ci must be defined');
    assert.ok(defaults.TIMEOUTS.default, 'TIMEOUTS.default must be defined');
    assert.ok(defaults.TIMEOUTS.test, 'TIMEOUTS.test must be defined');
  });

  it('should match legacy CI mode timeouts exactly', () => {
    const ci = defaults.TIMEOUTS.ci;
    assert.strictEqual(ci.learnBaseMs, 30000, 'CI learnBaseMs must be 30000');
    assert.strictEqual(ci.learnPerFileMs, 50, 'CI learnPerFileMs must be 50');
    assert.strictEqual(ci.learnMaxMs, 120000, 'CI learnMaxMs must be 120000');
    assert.strictEqual(ci.observeBaseMs, 60000, 'CI observeBaseMs must be 60000');
    assert.strictEqual(ci.observePerExpectationMs, 2000, 'CI observePerExpectationMs must be 2000');
    assert.strictEqual(ci.observeMaxMs, 600000, 'CI observeMaxMs must be 600000');
    assert.strictEqual(ci.detectBaseMs, 15000, 'CI detectBaseMs must be 15000');
    assert.strictEqual(ci.detectPerExpectationMs, 100, 'CI detectPerExpectationMs must be 100');
    assert.strictEqual(ci.detectMaxMs, 120000, 'CI detectMaxMs must be 120000');
    assert.strictEqual(ci.perExpectationBaseMs, 10000, 'CI perExpectationBaseMs must be 10000');
    assert.strictEqual(ci.perExpectationMaxMs, 120000, 'CI perExpectationMaxMs must be 120000');
    assert.strictEqual(ci.totalMinMs, 900000, 'CI totalMinMs must be 900000');
    assert.strictEqual(ci.totalMaxMsCap, 1800000, 'CI totalMaxMsCap must be 1800000');
  });

  it('should match legacy default mode timeouts exactly', () => {
    const def = defaults.TIMEOUTS.default;
    assert.strictEqual(def.learnBaseMs, 60000, 'default learnBaseMs must be 60000');
    assert.strictEqual(def.learnPerFileMs, 50, 'default learnPerFileMs must be 50');
    assert.strictEqual(def.learnMaxMs, 300000, 'default learnMaxMs must be 300000');
    assert.strictEqual(def.observeBaseMs, 120000, 'default observeBaseMs must be 120000');
    assert.strictEqual(def.observePerExpectationMs, 5000, 'default observePerExpectationMs must be 5000');
    assert.strictEqual(def.observeMaxMs, 1800000, 'default observeMaxMs must be 1800000');
    assert.strictEqual(def.detectBaseMs, 30000, 'default detectBaseMs must be 30000');
    assert.strictEqual(def.detectPerExpectationMs, 100, 'default detectPerExpectationMs must be 100');
    assert.strictEqual(def.detectMaxMs, 300000, 'default detectMaxMs must be 300000');
    assert.strictEqual(def.perExpectationBaseMs, 30000, 'default perExpectationBaseMs must be 30000');
    assert.strictEqual(def.perExpectationMaxMs, 120000, 'default perExpectationMaxMs must be 120000');
    assert.strictEqual(def.totalMinMs, 2400000, 'default totalMinMs must be 2400000');
    assert.strictEqual(def.totalMaxMsCap, 3600000, 'default totalMaxMsCap must be 3600000');
  });

  it('should match legacy test mode timeouts exactly', () => {
    const test = defaults.TIMEOUTS.test;
    assert.strictEqual(test.totalMaxMs, 30000, 'test totalMaxMs must be 30000');
    assert.strictEqual(test.learnMaxMs, 5000, 'test learnMaxMs must be 5000');
    assert.strictEqual(test.observeMaxMs, 20000, 'test observeMaxMs must be 20000');
    assert.strictEqual(test.detectMaxMs, 5000, 'test detectMaxMs must be 5000');
    assert.strictEqual(test.perExpectationMaxMs, 5000, 'test perExpectationMaxMs must be 5000');
  });

  it('should match legacy LIMITS exactly', () => {
    assert.strictEqual(defaults.LIMITS.maxNavigationDepth, 2, 'maxNavigationDepth must be 2');
    assert.strictEqual(defaults.LIMITS.maxInteractions, 25, 'maxInteractions must be 25');
    assert.strictEqual(defaults.LIMITS.maxRetries, 1, 'maxRetries must be 1');
    assert.strictEqual(defaults.LIMITS.finalizationBufferMs, 30000, 'finalizationBufferMs must be 30000');
  });

  it('should match legacy minPhaseTimeouts exactly', () => {
    const min = defaults.LIMITS.minPhaseTimeouts;
    assert.strictEqual(min.learnMaxMs, 10000, 'minPhaseTimeouts.learnMaxMs must be 10000');
    assert.strictEqual(min.observeMaxMs, 30000, 'minPhaseTimeouts.observeMaxMs must be 30000');
    assert.strictEqual(min.detectMaxMs, 5000, 'minPhaseTimeouts.detectMaxMs must be 5000');
    assert.strictEqual(min.perExpectationMaxMs, 5000, 'minPhaseTimeouts.perExpectationMaxMs must be 5000');
  });

  it('should match legacy FRAMEWORK_MULTIPLIERS exactly', () => {
    const fm = defaults.FRAMEWORK_MULTIPLIERS;
    assert.strictEqual(fm.nextjs, 1.2, 'nextjs multiplier must be 1.2');
    assert.strictEqual(fm.remix, 1.2, 'remix multiplier must be 1.2');
    assert.strictEqual(fm.react, 1.1, 'react multiplier must be 1.1');
    assert.strictEqual(fm.vue, 1.1, 'vue multiplier must be 1.1');
    assert.strictEqual(fm.unknown, 1.0, 'unknown multiplier must be 1.0');
    assert.strictEqual(fm.default, 1.0, 'default multiplier must be 1.0');
  });

  it('should match legacy SKIP_PATTERNS exactly (order preserved)', () => {
    const expected = [
      'node_modules',
      '.next',
      'dist',
      'build',
      '.git',
      '.venv',
      '__pycache__',
      '.env',
      'public',
      '.cache',
      'coverage',
    ];
    assert.deepStrictEqual(defaults.SKIP_PATTERNS, expected, 'SKIP_PATTERNS must match legacy order');
  });

  it('should match legacy SCAN_EXTENSIONS exactly', () => {
    const expected = ['.js', '.jsx', '.ts', '.tsx', '.html', '.mjs'];
    assert.deepStrictEqual(defaults.SCAN_EXTENSIONS, expected, 'SCAN_EXTENSIONS must match legacy list');
  });
});




