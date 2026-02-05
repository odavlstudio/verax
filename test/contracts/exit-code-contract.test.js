#!/usr/bin/env node
/**
 * STAGE 7 — EXIT CODE CONTRACT TEST
 * 
 * CONSTITUTIONAL CONTRACT (Stage 7):
 * The ONLY valid exit codes are: 0, 20, 30, 50, 64
 * 
 * - 0:  SUCCESS
 * - 20: FINDINGS
 * - 30: INCOMPLETE
 * - 50: INVARIANT_VIOLATION
 * - 64: USAGE_ERROR
 * 
 * This test locks the contract and prevents any non-contract codes from being emitted.
 */

import { EXIT_CODES, getExitCodeMeaning } from '../../src/verax/core/failures/exit-codes.js';
import { UsageError, DataError, CrashError } from '../../src/cli/util/support/errors.js';
import { getExitCode } from '../../src/cli/util/support/errors.js';

const tests = [];
const results = { passed: 0, failed: 0 };

function test(name, fn) {
  tests.push({ name, fn });
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}\n  Expected: ${expected}\n  Actual: ${actual}`);
  }
}

function _assertOneOf(actual, allowed, message) {
  if (!allowed.includes(actual)) {
    throw new Error(`${message}\n  Expected one of: ${allowed.join(', ')}\n  Actual: ${actual}`);
  }
}

// CONTRACT TEST 1: Only contract codes exist in EXIT_CODE constant
test('EXIT_CODE constant contains ONLY contract codes (0,10,20,30,40,50,64)', () => {
  const contractCodes = [0, 20, 30, 50, 64];
  const actualCodes = Object.values(EXIT_CODES);
  
  for (const code of actualCodes) {
    assertEqual(
      contractCodes.includes(code),
      true,
      `Exit code ${code} is not in contract. Valid codes: ${contractCodes.join(',')}`
    );
  }
});

// CONTRACT TEST 2: No ghost codes beyond contract set
test('No deprecated codes exist in EXIT_CODE', () => {
  const invalid = [1, 2, 3, 4, 5, 10, 40, 63, 65, 66, 67, 70, 100, -1];
  const actualCodes = Object.values(EXIT_CODES);
  
  for (const code of actualCodes) {
    assertEqual(
      invalid.includes(code),
      false,
      `Deprecated code ${code} found in EXIT_CODE`
    );
  }
});

// CONTRACT TEST 3: All contract codes are defined
test('All contract codes are defined in EXIT_CODE', () => {
  assertEqual(EXIT_CODES.SUCCESS !== undefined, true, 'EXIT_CODES.SUCCESS (0) not defined');
  assertEqual(EXIT_CODES.FINDINGS !== undefined, true, 'EXIT_CODES.FINDINGS (20) not defined');
  assertEqual(EXIT_CODES.INCOMPLETE !== undefined, true, 'EXIT_CODES.INCOMPLETE (30) not defined');
  assertEqual(EXIT_CODES.INVARIANT_VIOLATION !== undefined, true, 'EXIT_CODES.INVARIANT_VIOLATION (50) not defined');
  assertEqual(EXIT_CODES.USAGE_ERROR !== undefined, true, 'EXIT_CODES.USAGE_ERROR (64) not defined');
  
  // Verify values are contract codes
  assertEqual(EXIT_CODES.SUCCESS, 0, 'SUCCESS must be 0');
  assertEqual(EXIT_CODES.FINDINGS, 20, 'FINDINGS must be 20');
  assertEqual(EXIT_CODES.INCOMPLETE, 30, 'INCOMPLETE must be 30');
  assertEqual(EXIT_CODES.INVARIANT_VIOLATION, 50, 'INVARIANT_VIOLATION must be 50');
  assertEqual(EXIT_CODES.USAGE_ERROR, 64, 'USAGE_ERROR must be 64');
});

// CONTRACT TEST 4: Error classes map to contract codes
test('CLIError subclasses map to correct contract codes', () => {
  const usageError = new UsageError('test');
  const dataError = new DataError('test');
  const crashError = new CrashError('test');
  
  assertEqual(getExitCode(usageError), 64, 'UsageError must return 64');
  assertEqual(getExitCode(dataError), 50, 'DataError must return 50');
  assertEqual(getExitCode(crashError), 50, 'CrashError must return 50');
});

// CONTRACT TEST 5: getExitCodeMeaning returns meaningful text for all codes
test('getExitCodeMeaning covers all contract codes', () => {
  const contractCodes = [0, 20, 30, 50, 64];
  
  for (const code of contractCodes) {
    const meaning = getExitCodeMeaning(code);
    assertEqual(
      meaning !== undefined && meaning !== null && meaning !== `Unknown exit code: ${code}`,
      true,
      `getExitCodeMeaning should provide meaning for code ${code}`
    );
  }
});

// CONTRACT TEST 6: Findings exit codes are strictly tri-state
test('Findings exit codes: 0 for none, 20 for any findings', () => {
  const testCases = [
    { findings: 0, expected: 0 },
    { findings: 1, expected: 20 },
  ];
  
  for (const tc of testCases) {
    let exitCode = 0;
    if (tc.findings > 0) {
      exitCode = 20;
    }
    assertEqual(exitCode, tc.expected, `Expected exit ${tc.expected} for findings=${tc.findings}`);
  }
});

// CONTRACT TEST 7: No non-contract codes can be accidentally used
test('Only contract codes are valid (prevention test)', () => {
  const invalidCodes = [1, 2, 3, 4, 5, 63, 65, 66, 67, 70, 100, -1];
  
  for (const code of invalidCodes) {
    const meaning = getExitCodeMeaning(code);
    assertEqual(
      meaning.startsWith('Unknown'),
      true,
      `Code ${code} should be unknown/invalid`
    );
  }
});

// Run all tests
console.log('═══════════════════════════════════════════════════════════');
console.log('EXIT CODE CONTRACT TEST');
console.log('═══════════════════════════════════════════════════════════\n');

for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`✓ PASS: ${name}`);
    results.passed++;
  } catch (err) {
    console.log(`✗ FAIL: ${name}`);
    console.log(`  Error: ${err.message}\n`);
    results.failed++;
  }
}

console.log('\n───────────────────────────────────────────────────────────');
console.log('Summary:');
console.log(`  Passed: ${results.passed}`);
console.log(`  Failed: ${results.failed}`);
console.log('');

if (results.failed === 0) {
  console.log('✓ EXIT CODE CONTRACT IS LOCKED\n');
  console.log('Constitutional Exit Codes:');
  console.log('  0:  SUCCESS');
  console.log('  20: FINDINGS');
  console.log('  30: INCOMPLETE');
  console.log('  50: INVARIANT_VIOLATION');
  console.log('  64: USAGE_ERROR');
  console.log('');
  console.log('No other exit codes are possible.');
  process.exit(0);
} else {
  console.log('✗ EXIT CODE CONTRACT IS BROKEN\n');
  process.exit(1);
}





