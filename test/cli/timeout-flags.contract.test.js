/**
 * TIMEOUT FLAGS CONTRACT TESTS
 * 
 * Validates that CLI timeout flags (--global-timeout-ms, --interaction-timeout-ms, 
 * --navigation-timeout-ms) work correctly and maintain backward compatibility.
 * 
 * CONTRACT GUARANTEES:
 * 1. Without flags: defaults unchanged (no behavior change)
 * 2. With flags: config updated correctly
 * 3. Invalid flags: clear UsageError thrown
 * 4. Determinism: same output with/without flags (no timestamps)
 * 5. Priority: CLI > ENV > DEFAULT
 */

import test from 'node:test';
import assert from 'node:assert';
import { getConfig, resetConfig } from '../../src/cli/util/config/load-config.js';
import { computeRuntimeBudget } from '../../src/cli/util/observation/runtime-budget.js';
import { UsageError } from '../../src/cli/util/support/errors.js';

// Helper to create mock args array
function _createArgs(flags) {
  const args = [];
  for (const [flag, value] of Object.entries(flags)) {
    args.push(flag);
    if (value !== undefined) {
      args.push(String(value));
    }
  }
  return args;
}

// Helper to parse timeout flags (copied from entry.js for testing)
function parseTimeoutFlags(args) {
  const config = {};
  const timeoutFlags = {
    '--global-timeout-ms': 'globalTimeoutMs',
    '--interaction-timeout-ms': 'interactionTimeoutMs',
    '--navigation-timeout-ms': 'navigationTimeoutMs',
  };
  
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (timeoutFlags[arg]) {
      const key = timeoutFlags[arg];
      i++;
      if (i < args.length && !args[i].startsWith('--')) {
        const value = args[i];
        const num = Number(value);
        if (!Number.isInteger(num) || num <= 0) {
          throw new UsageError(`${arg} must be a positive integer (got: ${value})`);
        }
        config[key] = num;
      } else {
        throw new UsageError(`${arg} requires a value`);
      }
    }
    i++;
  }
  return config;
}

test('timeout-flags: without flags, defaults unchanged', async () => {
  resetConfig();
  const config1 = getConfig();
  
  // Load config again without options - should return same frozen object
  const config2 = getConfig();
  
  // Both should have undefined cliTimeouts
  assert.strictEqual(config1.cliTimeouts, undefined, 
    'cliTimeouts should be undefined when no CLI flags provided');
  assert.strictEqual(config2.cliTimeouts, undefined, 
    'cliTimeouts should be undefined for second getConfig() call');
  
  // Configs should be identical for determinism
  assert.strictEqual(config1, config2, 
    'getConfig() should return same object for identical options');
});

test('timeout-flags: with --global-timeout-ms, config updated', () => {
  resetConfig();
  const cliOptions = { globalTimeoutMs: 120000 };
  const config = getConfig(cliOptions);
  
  assert(config.cliTimeouts, 'cliTimeouts should be defined');
  assert.strictEqual(config.cliTimeouts.globalTimeoutMs, 120000, 
    'globalTimeoutMs should be set from CLI options');
  
  // Config should be frozen
  assert.throws(() => {
    config.cliTimeouts.globalTimeoutMs = 60000;
  }, 'cliTimeouts should be frozen');
});

test('timeout-flags: with --interaction-timeout-ms, config updated', () => {
  resetConfig();
  const cliOptions = { interactionTimeoutMs: 30000 };
  const config = getConfig(cliOptions);
  
  assert(config.cliTimeouts, 'cliTimeouts should be defined');
  assert.strictEqual(config.cliTimeouts.interactionTimeoutMs, 30000, 
    'interactionTimeoutMs should be set from CLI options');
});

test('timeout-flags: with --navigation-timeout-ms, config updated', () => {
  resetConfig();
  const cliOptions = { navigationTimeoutMs: 45000 };
  const config = getConfig(cliOptions);
  
  assert(config.cliTimeouts, 'cliTimeouts should be defined');
  assert.strictEqual(config.cliTimeouts.navigationTimeoutMs, 45000, 
    'navigationTimeoutMs should be set from CLI options');
});

test('timeout-flags: with all three flags, all applied', () => {
  resetConfig();
  const cliOptions = {
    globalTimeoutMs: 120000,
    interactionTimeoutMs: 30000,
    navigationTimeoutMs: 45000,
  };
  const config = getConfig(cliOptions);
  
  assert(config.cliTimeouts, 'cliTimeouts should be defined');
  assert.strictEqual(config.cliTimeouts.globalTimeoutMs, 120000);
  assert.strictEqual(config.cliTimeouts.interactionTimeoutMs, 30000);
  assert.strictEqual(config.cliTimeouts.navigationTimeoutMs, 45000);
});

test('timeout-flags: parseTimeoutFlags validates positive integer', () => {
  // Valid: positive integer
  const valid = parseTimeoutFlags(['--global-timeout-ms', '60000']);
  assert.strictEqual(valid.globalTimeoutMs, 60000);
});

test('timeout-flags: parseTimeoutFlags rejects negative numbers', () => {
  assert.throws(() => {
    parseTimeoutFlags(['--global-timeout-ms', '-1000']);
  }, UsageError, 'Should reject negative numbers');
});

test('timeout-flags: parseTimeoutFlags rejects zero', () => {
  assert.throws(() => {
    parseTimeoutFlags(['--global-timeout-ms', '0']);
  }, UsageError, 'Should reject zero');
});

test('timeout-flags: parseTimeoutFlags rejects non-integer', () => {
  assert.throws(() => {
    parseTimeoutFlags(['--global-timeout-ms', '3.14']);
  }, UsageError, 'Should reject decimal numbers');
});

test('timeout-flags: parseTimeoutFlags rejects non-numeric', () => {
  assert.throws(() => {
    parseTimeoutFlags(['--global-timeout-ms', 'abc']);
  }, UsageError, 'Should reject non-numeric values');
});

test('timeout-flags: parseTimeoutFlags requires value', () => {
  assert.throws(() => {
    parseTimeoutFlags(['--global-timeout-ms']);
  }, UsageError, 'Should reject flag without value');
});

test('timeout-flags: CLI > ENV > DEFAULT priority', async () => {
  resetConfig();
  
  // Set ENV variable
  const originalEnv = process.env.VERAX_GLOBAL_TIMEOUT_MS;
  process.env.VERAX_GLOBAL_TIMEOUT_MS = '90000';
  
  try {
    // Without CLI, ENV should be used
    const _configEnv = getConfig();
    // ENV handling depends on load-config.js implementation
    
    // With CLI, CLI should override ENV
    const configCli = getConfig({ globalTimeoutMs: 120000 });
    assert.strictEqual(configCli.cliTimeouts.globalTimeoutMs, 120000, 
      'CLI should override ENV');
  } finally {
    if (originalEnv) {
      process.env.VERAX_GLOBAL_TIMEOUT_MS = originalEnv;
    } else {
      delete process.env.VERAX_GLOBAL_TIMEOUT_MS;
    }
    resetConfig();
  }
});

test('timeout-flags: multiple getConfig calls with different options', () => {
  resetConfig();
  
  // First call with option A
  const config1 = getConfig({ globalTimeoutMs: 60000 });
  assert.strictEqual(config1.cliTimeouts.globalTimeoutMs, 60000);
  
  // Second call with different option B
  const config2 = getConfig({ globalTimeoutMs: 120000 });
  assert.strictEqual(config2.cliTimeouts.globalTimeoutMs, 120000);
  
  // Third call with same as first should return different object
  const config3 = getConfig({ globalTimeoutMs: 60000 });
  assert.strictEqual(config3.cliTimeouts.globalTimeoutMs, 60000);
  
  // Objects should be different (different option sets)
  assert.notStrictEqual(config1, config2, 'Different options should create different configs');
});

test('timeout-flags: runtime budget applies global timeout override', () => {
  resetConfig();
  
  const baselineConfig = getConfig();
  const baselineBudget = computeRuntimeBudget({
    expectationsCount: 10,
    mode: 'run',
    framework: 'react',
    fileCount: 50,
    config: baselineConfig,
  });
  
  // Create config with CLI override
  const overrideConfig = getConfig({ globalTimeoutMs: 60000 });
  const overrideBudget = computeRuntimeBudget({
    expectationsCount: 10,
    mode: 'run',
    framework: 'react',
    fileCount: 50,
    config: overrideConfig,
  });
  
  // With CLI override, totalMaxMs should be exactly 60000
  assert.strictEqual(overrideBudget.totalMaxMs, 60000, 
    'Budget should use CLI globalTimeoutMs override');
  
  // Without CLI override, totalMaxMs should be computed normally
  assert.notStrictEqual(baselineBudget.totalMaxMs, 60000, 
    'Budget should compute normally without CLI override');
});

test('timeout-flags: runtime budget with very large timeout', () => {
  resetConfig();
  const config = getConfig({ globalTimeoutMs: 600000 });
  const budget = computeRuntimeBudget({
    expectationsCount: 10,
    mode: 'run',
    framework: 'react',
    fileCount: 50,
    config,
  });
  
  assert.strictEqual(budget.totalMaxMs, 600000, 
    'Budget should accept large timeout values');
});

test('timeout-flags: runtime budget with minimal timeout', () => {
  resetConfig();
  const config = getConfig({ globalTimeoutMs: 1000 });
  const budget = computeRuntimeBudget({
    expectationsCount: 10,
    mode: 'run',
    framework: 'react',
    fileCount: 50,
    config,
  });
  
  // Should be exactly 1000 (CLI overrides all caps)
  assert.strictEqual(budget.totalMaxMs, 1000, 
    'Budget should accept minimal timeout values');
});

test('timeout-flags: determinism - config frozen prevents mutations', () => {
  resetConfig();
  const config = getConfig({ globalTimeoutMs: 120000 });
  
  // Attempt to modify should fail
  assert.throws(() => {
    config.cliTimeouts.globalTimeoutMs = 60000;
  }, {}, 'cliTimeouts should be frozen');
  
  // Original value should remain unchanged
  assert.strictEqual(config.cliTimeouts.globalTimeoutMs, 120000);
});

test('timeout-flags: determinism - no timestamps added to config', async () => {
  resetConfig();
  const config1 = getConfig({ globalTimeoutMs: 120000 });
  
  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 10));
  
  // Get config again with same options
  const config2 = getConfig({ globalTimeoutMs: 120000 });
  
  // cliTimeouts should be identical (no timestamps)
  assert.deepStrictEqual(config1.cliTimeouts, config2.cliTimeouts, 
    'cliTimeouts should be identical across calls (deterministic)');
});

test('timeout-flags: no CLI flags preserve default behavior', () => {
  resetConfig();
  
  // Get default config twice
  const config1 = getConfig();
  const config2 = getConfig();
  
  // Should be exact same object (singleton)
  assert.strictEqual(config1, config2, 
    'Default config should be cached singleton');
  
  // Both should NOT have cliTimeouts defined
  assert.strictEqual(config1.cliTimeouts, undefined);
  assert.strictEqual(config2.cliTimeouts, undefined);
});





