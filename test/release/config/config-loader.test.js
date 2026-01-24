/**
 * Config Loader Test
 * 
 * Verifies that load-config.js correctly:
 * - Loads defaults
 * - Applies environment variable overrides
 * - Returns frozen config object
 * - Maintains singleton behavior
 * 
 * Tests only existing env var behavior (no new features).
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { loadConfig, getConfig, resetConfig } from '../../../src/cli/util/config/load-config.js';

describe('Config Loader - Environment Overrides', () => {
  beforeEach(() => {
    // Reset singleton between tests
    resetConfig();
    // Clear env vars
    delete process.env.VERAX_TEST_MODE;
    delete process.env.VERAX_MAX_RETRIES;
    delete process.env.VERAX_MAX_NAVIGATION_DEPTH;
    delete process.env.VERAX_MAX_INTERACTIONS;
  });

  it('should load default configuration when no env vars set', () => {
    const config = loadConfig();
    assert.ok(config, 'config must be returned');
    assert.strictEqual(config.limits.maxRetries, 1, 'default maxRetries is 1');
    assert.strictEqual(config.limits.maxNavigationDepth, 2, 'default maxNavigationDepth is 2');
    assert.strictEqual(config.limits.maxInteractions, 25, 'default maxInteractions is 25');
    assert.strictEqual(config.testMode, false, 'default testMode is false');
  });

  it('should apply VERAX_TEST_MODE=1 override', () => {
    process.env.VERAX_TEST_MODE = '1';
    const config = loadConfig();
    assert.strictEqual(config.testMode, true, 'testMode must be true when VERAX_TEST_MODE=1');
  });

  it('should not enable testMode for non-"1" values', () => {
    process.env.VERAX_TEST_MODE = 'true';
    const config1 = loadConfig();
    assert.strictEqual(config1.testMode, false, 'testMode must be false for VERAX_TEST_MODE=true');

    resetConfig();
    process.env.VERAX_TEST_MODE = '0';
    const config2 = loadConfig();
    assert.strictEqual(config2.testMode, false, 'testMode must be false for VERAX_TEST_MODE=0');
  });

  it('should apply VERAX_MAX_RETRIES override', () => {
    process.env.VERAX_MAX_RETRIES = '5';
    const config = loadConfig();
    assert.strictEqual(config.limits.maxRetries, 5, 'maxRetries must be 5');
  });

  it('should apply VERAX_MAX_NAVIGATION_DEPTH override', () => {
    process.env.VERAX_MAX_NAVIGATION_DEPTH = '10';
    const config = loadConfig();
    assert.strictEqual(config.limits.maxNavigationDepth, 10, 'maxNavigationDepth must be 10');
  });

  it('should apply VERAX_MAX_INTERACTIONS override', () => {
    process.env.VERAX_MAX_INTERACTIONS = '50';
    const config = loadConfig();
    assert.strictEqual(config.limits.maxInteractions, 50, 'maxInteractions must be 50');
  });

  it('should enforce minimum value of 0 for maxRetries', () => {
    process.env.VERAX_MAX_RETRIES = '-5';
    const config = loadConfig();
    assert.strictEqual(config.limits.maxRetries, 0, 'maxRetries must be clamped to 0');
  });

  it('should enforce minimum value of 1 for maxNavigationDepth', () => {
    process.env.VERAX_MAX_NAVIGATION_DEPTH = '0';
    const config = loadConfig();
    assert.strictEqual(config.limits.maxNavigationDepth, 1, 'maxNavigationDepth must be clamped to 1');
  });

  it('should enforce minimum value of 1 for maxInteractions', () => {
    process.env.VERAX_MAX_INTERACTIONS = '-10';
    const config = loadConfig();
    assert.strictEqual(config.limits.maxInteractions, 1, 'maxInteractions must be clamped to 1');
  });

  it('should return frozen config object', () => {
    const config = loadConfig();
    assert.throws(() => {
      config.testMode = true;
    }, 'config root must be frozen');
    assert.throws(() => {
      config.limits.maxRetries = 999;
    }, 'config.limits must be frozen');
    assert.throws(() => {
      config.timeouts.ci.learnBaseMs = 999;
    }, 'config.timeouts.ci must be frozen');
  });

  it('should return frozen arrays', () => {
    const config = loadConfig();
    assert.throws(() => {
      config.skipPatterns.push('newPattern');
    }, 'skipPatterns must be frozen');
    assert.throws(() => {
      config.scanExtensions.push('.py');
    }, 'scanExtensions must be frozen');
  });

  it('should maintain singleton behavior via getConfig()', () => {
    const config1 = getConfig();
    const config2 = getConfig();
    assert.strictEqual(config1, config2, 'getConfig() must return same instance');
  });

  it('should reset singleton via resetConfig()', () => {
    const config1 = getConfig();
    resetConfig();
    const config2 = getConfig();
    assert.notStrictEqual(config1, config2, 'resetConfig() must create new instance');
  });

  it('should preserve skipPatterns order from defaults', () => {
    const config = loadConfig();
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
    assert.deepStrictEqual(config.skipPatterns, expected, 'skipPatterns order must be preserved');
  });

  it('should include all timeout modes', () => {
    const config = loadConfig();
    assert.ok(config.timeouts.ci, 'timeouts.ci must exist');
    assert.ok(config.timeouts.default, 'timeouts.default must exist');
    assert.ok(config.timeouts.test, 'timeouts.test must exist');
  });
});




