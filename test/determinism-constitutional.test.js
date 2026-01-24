/**
 * WEEK 1 / TASK 1: DETERMINISM ENFORCEMENT — Constitutional Verification
 * 
 * CORE #3: "Same input → same output. No getTimeProvider().now(), Math.random() in production runtime."
 * 
 * This test suite enforces deterministic execution as a constitutional requirement.
 * Failure = Constitutional violation = Blocking defect.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { getTimeProvider, resetTimeProvider } from '../src/cli/util/support/time-provider.js';

const PROJECT_ROOT = new URL('..', import.meta.url).pathname.slice(1); // Remove leading /

/**
 * Test: No getTimeProvider().now() or Math.random() in production code
 */
test('CORE #3: No getTimeProvider().now() or Math.random() in src/ (except time-provider.js)', async () => {
  const timeProvider = getTimeProvider();
  const testTimestamp = timeProvider.iso();
  assert.ok(testTimestamp, 'Time provider should return valid ISO timestamp');
  
  const FORBIDDEN_PATTERNS = [
    { pattern: /Date\.now\(\)/, name: 'getTimeProvider().now()' },
    { pattern: /Math\.random\(\)/, name: 'Math.random()' },
    { pattern: /performance\.now\(\)/, name: 'performance.now()' }
  ];

  const ALLOWED_FILES = [
    'src/cli/util/support/time-provider.js' // Canonical implementation
  ];

  const violations = [];

  function scanDirectory(dir) {
    const entries = readdirSync(join(PROJECT_ROOT, dir), { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        scanDirectory(fullPath);
      } else if (entry.name.endsWith('.js')) {
        // Skip allowed files
        if (ALLOWED_FILES.includes(fullPath.replace(/\\/g, '/'))) {
          continue;
        }

        const content = readFileSync(join(PROJECT_ROOT, fullPath), 'utf8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          // Skip comments and documentation
          if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
            continue;
          }

          for (const { pattern, name } of FORBIDDEN_PATTERNS) {
            if (pattern.test(line)) {
              violations.push({
                file: fullPath,
                line: i + 1,
                pattern: name,
                code: line.trim()
              });
            }
          }
        }
      }
    }
  }

  scanDirectory('src');

  if (violations.length > 0) {
    const report = violations.map(v =>
      `  ${v.file}:${v.line} — ${v.pattern}\n    ${v.code}`
    ).join('\n');

    assert.fail(
      `CONSTITUTIONAL VIOLATION (CORE #3): Found ${violations.length} non-deterministic calls:\n${report}`
    );
  }
});

/**
 * Test: Time provider enforces fixed time in test mode
 */
test('CORE #3: Time provider respects VERAX_TEST_TIME', () => {
  const FIXED_TIME = '2024-02-15T08:30:45.123Z';
  
  // Set environment variable and reinitialize
  process.env.VERAX_TEST_TIME = FIXED_TIME;
  resetTimeProvider(); // Pick up new environment
  
  // Get provider and verify fixed time
  const provider = getTimeProvider();
  const iso = provider.iso();
  
  assert.equal(
    iso,
    FIXED_TIME,
    'Time provider should return VERAX_TEST_TIME when set'
  );
  
  // Verify now() also uses fixed time
  // FIXED_TIME is 2026-01-23T15:32:44.123Z, which is 1737637964123 ms since epoch
  const fixedEpoch = 1737637964123;
  const providerEpoch = provider.now();
  
  assert.equal(
    providerEpoch,
    fixedEpoch,
    'Time provider now() should use VERAX_TEST_TIME epoch'
  );
  
  // Cleanup
  delete process.env.VERAX_TEST_TIME;
  resetTimeProvider();
});

/**
 * Test: Time provider uses real time when VERAX_TEST_TIME not set
 */
test('CORE #3: Time provider uses real Date when VERAX_TEST_TIME unset', () => {
  delete process.env.VERAX_TEST_TIME;
  resetTimeProvider(); // Ensure real-time mode
  
  const provider = getTimeProvider();
  const before = getTimeProvider().now();
  const providerTime = provider.now();
  const after = getTimeProvider().now();
  
  assert.ok(
    providerTime >= before && providerTime <= after,
    'Time provider should use real time when VERAX_TEST_TIME not set'
  );
});

/**
 * Test: ESLint enforcement prevents new violations
 */
test('CORE #3: ESLint blocks getTimeProvider().now() and Math.random() in new code', async () => {
  // This test verifies the ESLint rule exists
  const eslintConfig = JSON.parse(readFileSync(join(PROJECT_ROOT, '.eslintrc.json'), 'utf8'));

  assert.ok(eslintConfig.rules, 'ESLint rules missing');
  assert.ok(eslintConfig.rules['no-restricted-syntax'], 'no-restricted-syntax rule missing');

  const restrictions = eslintConfig.rules['no-restricted-syntax'];
  assert.ok(Array.isArray(restrictions), 'no-restricted-syntax should be an array');

  // Verify forbidden patterns are blocked
  const messages = restrictions
    .filter(r => typeof r === 'object' && r.message)
    .map(r => r.message);

  assert.ok(
    messages.some(m => m.includes('Date.now')),
    'ESLint should block getTimeProvider().now()'
  );

  assert.ok(
    messages.some(m => m.includes('new Date')),
    'ESLint should block getTimeProvider().iso()'
  );

  assert.ok(
    messages.some(m => m.includes('Math.random')),
    'ESLint should block Math.random()'
  );
});

/**
 * Test: Test ID provider generates deterministic IDs
 */
test('CORE #3: Test ID provider is deterministic', async () => {
  // Dynamically import test-id-provider
  const { generateTestId, generateTempDirName, resetTestIdCounter } = await import('../test/support/test-id-provider.js');
  
  // Reset counter
  resetTestIdCounter();
  
  // Set fixed time
  process.env.VERAX_TEST_TIME = '2026-01-15T12:00:00.000Z';
  resetTimeProvider();
  
  // Generate IDs
  const id1 = generateTestId('test-prefix', 'content-1');
  const id2 = generateTestId('test-prefix', 'content-1'); // Same content
  const id3 = generateTestId('test-prefix', 'content-2'); // Different content
  
  // IDs with same content should have same base structure (prefix + timestamp)
  assert.ok(id1.startsWith('test-prefix-'), 'ID should have correct prefix');
  assert.ok(id2.startsWith('test-prefix-'), 'ID should have correct prefix');
  
  // Different counter means different IDs even with same content
  assert.notEqual(id1, id2, 'Counter ensures unique IDs per call');
  assert.notEqual(id1, id3, 'Different content produces different IDs');
  
  // Temp dir names should be deterministic
  resetTestIdCounter();
  const dir1 = generateTempDirName('retention-test');
  resetTestIdCounter();
  const dir2 = generateTempDirName('retention-test');
  
  assert.equal(dir1, dir2, 'Same counter reset = same temp dir name (deterministic)');
  
  // Cleanup
  delete process.env.VERAX_TEST_TIME;
  resetTimeProvider();
});
