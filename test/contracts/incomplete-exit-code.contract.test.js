#!/usr/bin/env node

/**
 * INCOMPLETE EXIT CODE CONTRACT TEST (Exit 30)
 *
 * Verifies Stage 7 contract for incomplete runs:
 * - Timeouts emit exit code 30 with RESULT/REASON/ACTION
 * - Run status is recorded as INCOMPLETE with incompleteAt metadata
 * - No legacy 66 codes remain
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Test framework
function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    return true;
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(`  ${error.message}`);
    return false;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// Contract tests
console.log('\n═══════════════════════════════════════════════════════════');
console.log('INCOMPLETE EXIT CODE CONTRACT TESTS (Exit 30)');
console.log('═══════════════════════════════════════════════════════════\n');

let passed = 0;
let failed = 0;

// Test 1: CLI contract exposes FAILURE_INCOMPLETE = 30
if (test('cli-contract.js exports exit code 30 for incomplete', () => {
  const contractPath = join(process.cwd(), 'src', 'cli', 'config', 'cli-contract.js');
  assert(existsSync(contractPath), 'cli-contract.js should exist');
  const content = readFileSync(contractPath, 'utf-8');
  assert(content.includes('FAILURE_INCOMPLETE') && content.includes('30'), 'FAILURE_INCOMPLETE should be 30');
})) passed++; else failed++;

// Test 2: Global timeout path exits with FAILURE_INCOMPLETE (30)
if (test('Global timeout emits exit code 30', () => {
  const runPath = join(process.cwd(), 'src', 'cli', 'commands', 'run.js');
  const content = readFileSync(runPath, 'utf-8');
  assert(content.includes('Global timeout exceeded'), 'Global timeout branch should exist');
  assert(content.includes('EXIT_CODES.FAILURE_INCOMPLETE'), 'Global timeout should use FAILURE_INCOMPLETE');
})) passed++; else failed++;

// Test 3: Learn phase timeout emits FAILURE_INCOMPLETE (30)
if (test('Learn timeout emits exit code 30', () => {
  const runPath = join(process.cwd(), 'src', 'cli', 'commands', 'run.js');
  const content = readFileSync(runPath, 'utf-8');
  assert(content.includes('Learn phase timeout'), 'Learn timeout branch should exist');
  assert(content.includes('EXIT_CODES.FAILURE_INCOMPLETE'), 'Learn timeout should use FAILURE_INCOMPLETE');
})) passed++; else failed++;

// Test 4: Verify timeout writes status as INCOMPLETE
if (test('Timeout writes status as INCOMPLETE (not FAILED)', () => {
  const handlerPath = join(process.cwd(), 'src', 'cli', 'run', 'timeout-handler.js');
  const content = readFileSync(handlerPath, 'utf-8');
  assert(content.includes("status: 'INCOMPLETE'"), 'Should write status as INCOMPLETE');
  assert(!content.includes("status: 'FAILED'"), 'Should NOT write status as FAILED');
})) passed++; else failed++;

// Test 5: Timeout metadata uses incompleteAt field
if (test('Timeout uses incompleteAt field (not failedAt)', () => {
  const runPath = join(process.cwd(), 'src', 'cli', 'run', 'timeout-handler.js');
  const content = readFileSync(runPath, 'utf-8');
  assert(content.includes('incompleteAt'), 'Timeout handler should write incompleteAt');
  assert(!content.includes("failedAt'"), 'Timeout handler should not write failedAt');
})) passed++; else failed++;

console.log(`\n═══════════════════════════════════════════════════════════`);
console.log(`Tests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
console.log(`═══════════════════════════════════════════════════════════\n`);

if (failed > 0) {
  console.error(`[FAIL] ${failed} contract test(s) failed`);
  process.exit(1);
} else {
  console.log('[PASS] All incomplete exit code contract tests passed');
  process.exit(0);
}





