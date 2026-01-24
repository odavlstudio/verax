/**
 * CONTRACT TEST: Scan Roots Error Handling
 * 
 * VERAX must NEVER silently skip learning when no scan roots are found.
 * This test verifies the error contract is enforced.
 */

import { strict as assert } from 'assert';
import { resolveScanConfig } from '../src/verax/learn/scan-roots.js';
import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { generateTempDirName } from './support/test-id-provider.js';

const TEST_ROOT = join(tmpdir(), generateTempDirName('scan-roots-error-test'));

function setup() {
  mkdirSync(TEST_ROOT, { recursive: true });
}

function teardown() {
  try {
    rmSync(TEST_ROOT, { recursive: true, force: true });
  } catch (e) {
    // Ignore
  }
}

console.log('[CONTRACT] Scan Roots Error Handling');

// Test 1: Error is thrown when no roots found (default)
setup();
let error1 = null;
try {
  resolveScanConfig(TEST_ROOT, 'unknown', {});
} catch (e) {
  error1 = e;
}
assert.ok(error1, 'MUST throw error when no roots found');
assert.ok(error1.message.includes('could not determine any source directories'), 'Error message must be clear');
assert.ok(error1.message.includes('--learn-paths'), 'Error must guide user to solution');
console.log('✓ Contract 1: Error thrown when no roots found');
teardown();

// Test 2: allowEmptyLearn=true bypasses error
setup();
let error2 = null;
let result = null;
try {
  result = resolveScanConfig(TEST_ROOT, 'unknown', { allowEmptyLearn: true });
} catch (e) {
  error2 = e;
}
assert.ok(!error2, 'MUST NOT throw error when allowEmptyLearn=true');
assert.deepEqual(result.roots, [], 'Result must have empty roots');
console.log('✓ Contract 2: allowEmptyLearn bypasses error');
teardown();

// Test 3: User-provided paths bypass error
setup();
let error3 = null;
let result3 = null;
try {
  result3 = resolveScanConfig(TEST_ROOT, 'unknown', { learnPaths: ['custom'] });
} catch (e) {
  error3 = e;
}
assert.ok(!error3, 'MUST NOT throw error when user provides paths');
assert.deepEqual(result3.roots, ['custom'], 'Result must use user-provided paths');
console.log('✓ Contract 3: User paths bypass error');
teardown();

// Test 4: Static site with no public/ throws error
setup();
let error4 = null;
try {
  resolveScanConfig(TEST_ROOT, 'static', {});
} catch (e) {
  error4 = e;
}
assert.ok(error4, 'Static site with no public/ MUST throw error');
assert.ok(error4.message.includes('could not determine any source directories'), 'Error must be consistent');
console.log('✓ Contract 4: Static site error enforced');
teardown();

console.log('\n✅ All error contracts verified');
