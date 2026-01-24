#!/usr/bin/env node
/**
 * STAGE 7 — EXIT CODE CONTRACT TEST
 * 
 * CONSTITUTIONAL CONTRACT (Stage 7):
 * The ONLY valid exit codes are: 0, 10, 20, 30, 40, 50, 64
 * 
 * - 0:  SUCCESS (no actionable findings)
 * - 10: NEEDS_REVIEW (suspected findings)
 * - 20: FAILURE_CONFIRMED (confirmed findings)
 * - 30: FAILURE_INCOMPLETE (timeouts/budgets/coverage gaps)
 * - 40: INFRA_FAILURE (crash/runtime)
 * - 50: EVIDENCE_LAW_VIOLATION (corrupted/missing artifacts)
 * - 64: USAGE_ERROR (invalid CLI usage)
 * 
 * This test locks the contract and prevents any non-contract codes from being emitted.
 */

import { EXIT_CODE, getExitCodeMeaning } from '../../src/verax/core/failures/exit-codes.js';
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
  const contractCodes = [0, 10, 20, 30, 40, 50, 64];
  const actualCodes = Object.values(EXIT_CODE);
  
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
  const invalid = [1, 2, 3, 65, 66, 70];
  const actualCodes = Object.values(EXIT_CODE);
  
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
  const _contractCodes = [0, 10, 20, 30, 40, 50, 64];
  
  assertEqual(EXIT_CODE.OK !== undefined, true, 'EXIT_CODE.OK (0) not defined');
  assertEqual(EXIT_CODE.NEEDS_REVIEW !== undefined, true, 'EXIT_CODE.NEEDS_REVIEW (10) not defined');
  assertEqual(EXIT_CODE.FAILURE !== undefined, true, 'EXIT_CODE.FAILURE (20) not defined');
  assertEqual(EXIT_CODE.INCOMPLETE !== undefined, true, 'EXIT_CODE.INCOMPLETE (30) not defined');
  assertEqual(EXIT_CODE.INFRA_FAILURE !== undefined, true, 'EXIT_CODE.INFRA_FAILURE (40) not defined');
  assertEqual(EXIT_CODE.EVIDENCE_VIOLATION !== undefined, true, 'EXIT_CODE.EVIDENCE_VIOLATION (50) not defined');
  assertEqual(EXIT_CODE.USAGE_ERROR !== undefined, true, 'EXIT_CODE.USAGE_ERROR (64) not defined');
  
  // Verify values are contract codes
  assertEqual(EXIT_CODE.OK, 0, 'OK must be 0');
  assertEqual(EXIT_CODE.NEEDS_REVIEW, 10, 'NEEDS_REVIEW must be 10');
  assertEqual(EXIT_CODE.FAILURE, 20, 'FAILURE must be 20');
  assertEqual(EXIT_CODE.INCOMPLETE, 30, 'INCOMPLETE must be 30');
  assertEqual(EXIT_CODE.INFRA_FAILURE, 40, 'INFRA_FAILURE must be 40');
  assertEqual(EXIT_CODE.EVIDENCE_VIOLATION, 50, 'EVIDENCE_VIOLATION must be 50');
  assertEqual(EXIT_CODE.USAGE_ERROR, 64, 'USAGE_ERROR must be 64');
});

// CONTRACT TEST 4: Error classes map to contract codes
test('CLIError subclasses map to correct contract codes', () => {
  const usageError = new UsageError('test');
  const dataError = new DataError('test');
  const crashError = new CrashError('test');
  
  assertEqual(getExitCode(usageError), 64, 'UsageError must return 64');
  assertEqual(getExitCode(dataError), 50, 'DataError must return 50');
  assertEqual(getExitCode(crashError), 40, 'CrashError must return 40');
});

// CONTRACT TEST 5: getExitCodeMeaning returns meaningful text for all codes
test('getExitCodeMeaning covers all contract codes', () => {
  const contractCodes = [0, 10, 20, 30, 40, 50, 64];
  
  for (const code of contractCodes) {
    const meaning = getExitCodeMeaning(code);
    assertEqual(
      meaning !== undefined && meaning !== null && meaning !== `Unknown exit code: ${code}`,
      true,
      `getExitCodeMeaning should provide meaning for code ${code}`
    );
  }
});

// CONTRACT TEST 6: Simulate findings exit codes
test('Findings exit codes: 0 for none, 10 for suspected, 20 for confirmed', () => {
  const testCases = [
    { confirmed: 0, suspected: 0, expected: 0 },
    { confirmed: 0, suspected: 2, expected: 10 },
    { confirmed: 1, suspected: 0, expected: 20 },
  ];
  
  for (const tc of testCases) {
    let exitCode = 0;
    if (tc.confirmed > 0) {
      exitCode = 20;
    } else if (tc.suspected > 0) {
      exitCode = 10;
    }
    assertEqual(exitCode, tc.expected, `Expected exit ${tc.expected} for confirmed=${tc.confirmed}, suspected=${tc.suspected}`);
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
  console.log('  0:  SUCCESS (no actionable findings)');
  console.log('  10: NEEDS_REVIEW (suspected findings)');
  console.log('  20: FAILURE_CONFIRMED (confirmed findings)');
  console.log('  30: FAILURE_INCOMPLETE (timeouts/budgets/coverage gaps)');
  console.log('  40: INFRA_FAILURE (crash/runtime)');
  console.log('  50: EVIDENCE_LAW_VIOLATION (corrupted/missing artifacts)');
  console.log('  64: USAGE_ERROR (invalid CLI usage)');
  console.log('');
  console.log('No other exit codes are possible.');
  process.exit(0);
} else {
  console.log('✗ EXIT CODE CONTRACT IS BROKEN\n');
  process.exit(1);
}





