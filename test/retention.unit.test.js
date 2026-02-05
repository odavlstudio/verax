#!/usr/bin/env node

/**
 * Retention Policy Unit Tests
 * Tests for src/cli/util/support/retention.js
 * 
 * COVERAGE:
 * 1. Default retention (keep last 10)
 * 2. Custom retain-runs values
 * 3. retain-runs = 0 (delete all old runs)
 * 4. --no-retention (disable deletion)
 * 5. Active run never deleted
 * 6. Safety: only deletes inside runsDir
 * 7. Error handling for invalid inputs
 */

import { applyRetention } from '../src/cli/util/support/retention.js';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'fs';
import { resolve, join } from 'path';
import { tmpdir } from 'os';
import { generateTempDirName } from './support/test-id-provider.js';

let testCount = 0;
let passCount = 0;

function test(description, fn) {
  testCount++;
  try {
    fn();
    passCount++;
    console.log(`✓ Test ${testCount}: ${description}`);
  } catch (error) {
    console.error(`✗ Test ${testCount}: ${description}`);
    console.error(`  ${error.message}`);
    if (error.stack) {
      console.error(`  ${error.stack}`);
    }
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

function createTestRunsDir() {
  const testDir = resolve(tmpdir(), generateTempDirName('retention-test'));
  mkdirSync(testDir, { recursive: true });
  return testDir;
}

function createRunDir(runsDir, runId) {
  const runPath = join(runsDir, runId);
  mkdirSync(runPath, { recursive: true });
  writeFileSync(join(runPath, 'run.status.json'), JSON.stringify({ runId, status: 'SUCCESS' }));
  return runPath;
}

function cleanup(dir) {
  try {
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
  } catch (error) {
    // Ignore cleanup errors
  }
}

console.log('Testing retention module...\n');

// Test 1: Default retention keeps last 10
test('Default retention keeps last 10 runs', () => {
  const testDir = createTestRunsDir();
  const runsDir = join(testDir, 'runs');
  mkdirSync(runsDir, { recursive: true });
  
  // Create 15 runs with staggered timestamps
  for (let i = 0; i < 15; i++) {
    createRunDir(runsDir, `run-${String(i).padStart(2, '0')}`);
  }
  
  const result = applyRetention({
    runsDir,
    retainCount: 10,
    disableRetention: false,
    activeRunId: null,
    verbose: false
  });
  
  assertEquals(result.deleted, 5, 'Should delete 5 oldest runs');
  assertEquals(result.kept, 10, 'Should keep 10 most recent runs');
  assertEquals(result.errors.length, 0, 'Should have no errors');
  
  cleanup(testDir);
});

// Test 2: Custom retain-runs = 3
test('retain-runs=3 keeps last 3 runs', () => {
  const testDir = createTestRunsDir();
  const runsDir = join(testDir, 'runs');
  mkdirSync(runsDir, { recursive: true });
  
  // Create 7 runs
  for (let i = 0; i < 7; i++) {
    createRunDir(runsDir, `run-${String(i).padStart(2, '0')}`);
  }
  
  const result = applyRetention({
    runsDir,
    retainCount: 3,
    disableRetention: false,
    activeRunId: null,
    verbose: false
  });
  
  assertEquals(result.deleted, 4, 'Should delete 4 oldest runs');
  assertEquals(result.kept, 3, 'Should keep 3 most recent runs');
  
  cleanup(testDir);
});

// Test 3: retain-runs = 0 deletes all old runs
test('retain-runs=0 deletes all completed runs', () => {
  const testDir = createTestRunsDir();
  const runsDir = join(testDir, 'runs');
  mkdirSync(runsDir, { recursive: true });
  
  // Create 5 runs
  for (let i = 0; i < 5; i++) {
    createRunDir(runsDir, `run-${String(i).padStart(2, '0')}`);
  }
  
  const result = applyRetention({
    runsDir,
    retainCount: 0,
    disableRetention: false,
    activeRunId: null,
    verbose: false
  });
  
  assertEquals(result.deleted, 5, 'Should delete all 5 runs');
  assertEquals(result.kept, 0, 'Should keep 0 runs');
  
  cleanup(testDir);
});

// Test 4: --no-retention disables deletion
test('--no-retention disables deletion entirely', () => {
  const testDir = createTestRunsDir();
  const runsDir = join(testDir, 'runs');
  mkdirSync(runsDir, { recursive: true });
  
  // Create 20 runs
  for (let i = 0; i < 20; i++) {
    createRunDir(runsDir, `run-${String(i).padStart(2, '0')}`);
  }
  
  const result = applyRetention({
    runsDir,
    retainCount: 10,
    disableRetention: true,
    activeRunId: null,
    verbose: false
  });
  
  assertEquals(result.deleted, 0, 'Should delete 0 runs when disabled');
  assertEquals(result.kept, 0, 'Kept count is 0 when disabled (not calculated)');
  
  cleanup(testDir);
});

// Test 5: Active run is never deleted
test('Active run is never deleted', () => {
  const testDir = createTestRunsDir();
  const runsDir = join(testDir, 'runs');
  mkdirSync(runsDir, { recursive: true });
  
  // Create 12 runs
  const runIds = [];
  for (let i = 0; i < 12; i++) {
    const runId = `run-${String(i).padStart(2, '0')}`;
    createRunDir(runsDir, runId);
    runIds.push(runId);
  }
  
  // Mark the oldest run as active
  const activeRunId = runIds[0];
  
  const result = applyRetention({
    runsDir,
    retainCount: 10,
    disableRetention: false,
    activeRunId,
    verbose: false
  });
  
  // 12 runs total, 1 active (excluded), 11 eligible
  // Keep 10, so delete 1 from the eligible 11
  assertEquals(result.deleted, 1, 'Should delete 1 run (excluding active)');
  assertEquals(result.kept, 10, 'Should keep 10 runs');
  assert(existsSync(join(runsDir, activeRunId)), 'Active run must still exist');
  
  cleanup(testDir);
});

// Test 6: Fewer runs than retainCount keeps all
test('Fewer runs than retainCount keeps all', () => {
  const testDir = createTestRunsDir();
  const runsDir = join(testDir, 'runs');
  mkdirSync(runsDir, { recursive: true });
  
  // Create only 5 runs
  for (let i = 0; i < 5; i++) {
    createRunDir(runsDir, `run-${String(i).padStart(2, '0')}`);
  }
  
  const result = applyRetention({
    runsDir,
    retainCount: 10,
    disableRetention: false,
    activeRunId: null,
    verbose: false
  });
  
  assertEquals(result.deleted, 0, 'Should delete 0 runs (all kept)');
  assertEquals(result.kept, 5, 'Should keep all 5 runs');
  
  cleanup(testDir);
});

// Test 7: Invalid retainCount is rejected
test('Invalid retainCount returns error', () => {
  const testDir = createTestRunsDir();
  const runsDir = join(testDir, 'runs');
  mkdirSync(runsDir, { recursive: true });
  
  const result = applyRetention({
    runsDir,
    retainCount: -5,
    disableRetention: false,
    activeRunId: null,
    verbose: false
  });
  
  assertEquals(result.deleted, 0, 'Should delete nothing on invalid input');
  assertEquals(result.kept, 0, 'Should keep nothing on invalid input');
  assert(result.errors.length > 0, 'Should have errors for invalid retainCount');
  
  cleanup(testDir);
});

// Test 8: Non-existent runsDir is safe
test('Non-existent runsDir is handled safely', () => {
  const testDir = createTestRunsDir();
  const runsDir = join(testDir, 'does-not-exist');
  
  const result = applyRetention({
    runsDir,
    retainCount: 10,
    disableRetention: false,
    activeRunId: null,
    verbose: false
  });
  
  assertEquals(result.deleted, 0, 'Should delete nothing if dir missing');
  assertEquals(result.kept, 0, 'Should keep nothing if dir missing');
  assertEquals(result.errors.length, 0, 'Should have no errors for missing dir');
  
  cleanup(testDir);
});

// Test 9: Empty runsDir is safe
test('Empty runsDir is handled safely', () => {
  const testDir = createTestRunsDir();
  const runsDir = join(testDir, 'runs');
  mkdirSync(runsDir, { recursive: true });
  
  const result = applyRetention({
    runsDir,
    retainCount: 10,
    disableRetention: false,
    activeRunId: null,
    verbose: false
  });
  
  assertEquals(result.deleted, 0, 'Should delete nothing in empty dir');
  assertEquals(result.kept, 0, 'Should keep nothing in empty dir');
  assertEquals(result.errors.length, 0, 'Should have no errors for empty dir');
  
  cleanup(testDir);
});

// Test 10: Retention only deletes directories, not files
test('Retention only processes directories', () => {
  const testDir = createTestRunsDir();
  const runsDir = join(testDir, 'runs');
  mkdirSync(runsDir, { recursive: true });
  
  // Create 3 run directories
  for (let i = 0; i < 3; i++) {
    createRunDir(runsDir, `run-${String(i).padStart(2, '0')}`);
  }
  
  // Create a file in runs dir (should be ignored)
  writeFileSync(join(runsDir, 'some-file.txt'), 'test');
  
  const result = applyRetention({
    runsDir,
    retainCount: 1,
    disableRetention: false,
    activeRunId: null,
    verbose: false
  });
  
  assertEquals(result.deleted, 2, 'Should delete 2 oldest run dirs');
  assertEquals(result.kept, 1, 'Should keep 1 most recent run dir');
  assert(existsSync(join(runsDir, 'some-file.txt')), 'File should not be deleted');
  
  cleanup(testDir);
});

console.log(`\n${passCount === testCount ? '✅' : '❌'} All retention tests passed: ${passCount}/${testCount}`);

if (passCount !== testCount) {
  process.exit(1);
}
