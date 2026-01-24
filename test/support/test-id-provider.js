/**
 * WEEK 1 / TASK 2 — Test ID Provider (Deterministic)
 * 
 * CORE #3: Determinism Principle
 * NO Math.random() in tests — all test IDs must be reproducible.
 * 
 * This provider generates deterministic, collision-resistant test identifiers
 * suitable for temporary directories, fixtures, and test artifacts.
 */

import { createHash } from 'crypto';
import { getTimeProvider } from '../../src/cli/util/support/time-provider.js';

/**
 * Counter-based test ID generator
 * Resets at module load for deterministic test runs
 */
let testIdCounter = 0;

/**
 * Reset test ID counter (for test isolation)
 */
export function resetTestIdCounter() {
  testIdCounter = 0;
}

/**
 * Generate deterministic test ID
 * 
 * Format: <prefix>-<time>-<counter>-<hash>
 * - time: Fixed if VERAX_TEST_TIME set, otherwise real epoch
 * - counter: Sequential per test run
 * - hash: Content hash for collision resistance
 * 
 * @param {string} prefix - ID prefix (e.g., 'retention-test', 'detect-test')
 * @param {string} [content] - Optional content to hash (e.g., test name, params)
 * @returns {string} Deterministic test ID
 * 
 * @example
 * // With VERAX_TEST_TIME set:
 * generateTestId('retention-test', 'test-cleanup')
 * // => 'retention-test-1706054400000-1-a3f8b2c1'
 * 
 * @example
 * // Without VERAX_TEST_TIME (uses real time, still reproducible with same timestamp):
 * generateTestId('detect-test')
 * // => 'detect-test-1737676800000-2-4b9c3d2e'
 */
export function generateTestId(prefix, content = '') {
  const provider = getTimeProvider();
  const timestamp = provider.now();
  
  testIdCounter += 1;
  
  // Generate content hash for collision resistance
  const hashInput = `${prefix}-${timestamp}-${testIdCounter}-${content}`;
  const hash = createHash('sha256')
    .update(hashInput)
    .digest('hex')
    .slice(0, 8);
  
  return `${prefix}-${timestamp}-${testIdCounter}-${hash}`;
}

/**
 * Generate short deterministic ID (for simple cases)
 * 
 * @param {string} prefix - ID prefix
 * @returns {string} Short deterministic ID
 * 
 * @example
 * generateShortTestId('temp')
 * // => 'temp-1-a3f8b2c1'
 */
export function generateShortTestId(prefix) {
  testIdCounter += 1;
  
  const provider = getTimeProvider();
  const timestamp = provider.now();
  
  const hash = createHash('sha256')
    .update(`${prefix}-${timestamp}-${testIdCounter}`)
    .digest('hex')
    .slice(0, 8);
  
  return `${prefix}-${testIdCounter}-${hash}`;
}

/**
 * Generate deterministic temp directory name
 * 
 * REPLACES: `verax-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
 * 
 * @param {string} testName - Test name/identifier
 * @returns {string} Deterministic directory name
 * 
 * @example
 * generateTempDirName('retention-test')
 * // => 'verax-retention-test-1706054400000-1-a3f8b2c1'
 */
export function generateTempDirName(testName) {
  return generateTestId(`verax-${testName}`);
}
