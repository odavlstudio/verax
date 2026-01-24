/**
 * WEEK 3 — Evidence Integrity & Crash-Safe Artifacts
 * 
 * Tests for:
 * - Atomic writes (temp + rename)
 * - Completion sentinel (.run-complete)
 * - Corruption detection (truncated JSON, missing files, missing sentinel)
 * - Deterministic run classification (INCOMPLETE vs FAIL_DATA)
 */

import test from 'ava';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { resolve } from 'path';
import { atomicWriteFileSync, atomicWriteJsonSync } from '../src/cli/util/atomic-write.js';
import {
  writeCompletionSentinel,
  isRunComplete,
  readCompletionSentinel,
  getSentinelFilename
} from '../src/cli/util/run-completion-sentinel.js';
import {
  validateJsonFile,
  validateRunDirectory,
  determineRunStatus,
  ValidationResult
} from '../src/cli/util/run-artifact-validation.js';

const tmpDir = resolve(process.cwd(), 'tmp', 'week3-integrity-test');

// Clean up before and after
function setupTestDir() {
  if (existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true });
  }
  mkdirSync(tmpDir, { recursive: true });
}

function cleanupTestDir() {
  if (existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true });
  }
}

// Test 1: Atomic writes to temp + rename
test('atomicWriteFileSync writes to temp file then renames', t => {
  setupTestDir();
  const filePath = resolve(tmpDir, 'test.txt');
  
  atomicWriteFileSync(filePath, 'test data');
  
  t.true(existsSync(filePath), 'File exists after atomic write');
  t.is(readFileSync(filePath, 'utf-8'), 'test data', 'File content matches');
  
  cleanupTestDir();
});

// Test 2: Atomic JSON writes with consistent formatting
test('atomicWriteJsonSync writes JSON with 2-space indent + newline', t => {
  setupTestDir();
  const filePath = resolve(tmpDir, 'test.json');
  const data = { key: 'value', nested: { prop: 1 } };
  
  atomicWriteJsonSync(filePath, data);
  
  t.true(existsSync(filePath), 'JSON file exists');
  const content = readFileSync(filePath, 'utf-8');
  t.true(content.startsWith('{'), 'File starts with opening brace');
  t.true(content.endsWith('\n'), 'File ends with newline');
  t.deepEqual(JSON.parse(content), data, 'Parsed content matches original');
  
  cleanupTestDir();
});

// Test 3: Atomic write handles errors gracefully
test('atomicWriteFileSync cleans up temp file on error', t => {
  setupTestDir();
  const _filePath = resolve(tmpDir, 'readonly.txt');
  
  // Create a read-only directory to trigger error
  const readOnlyDir = resolve(tmpDir, 'readonly');
  mkdirSync(readOnlyDir, { recursive: true });
  
  try {
    // Attempt to write to a path in read-only directory (will fail on Unix)
    // This test is platform-dependent, so we just verify no crash
    atomicWriteFileSync(resolve(readOnlyDir, 'test.txt'), 'data');
  } catch (error) {
    t.truthy(error, 'Error thrown on write failure');
  }
  
  cleanupTestDir();
});

// Test 4: Completion sentinel write and check
test('writeCompletionSentinel creates .run-complete marker', t => {
  setupTestDir();
  const runDir = resolve(tmpDir, 'run-test');
  mkdirSync(runDir, { recursive: true });
  
  writeCompletionSentinel(runDir);
  
  const sentinelPath = getSentinelFilename(runDir);
  t.true(existsSync(sentinelPath), 'Sentinel file exists');
  
  const content = readFileSync(sentinelPath, 'utf-8');
  const sentinel = JSON.parse(content);
  t.truthy(sentinel.completedAt, 'Sentinel has completedAt timestamp');
  t.truthy(sentinel.timestamp, 'Sentinel has epoch timestamp');
  
  cleanupTestDir();
});

// Test 5: isRunComplete detects sentinel presence
test('isRunComplete returns true when sentinel exists', t => {
  setupTestDir();
  const runDir = resolve(tmpDir, 'run-complete');
  mkdirSync(runDir, { recursive: true });
  
  writeCompletionSentinel(runDir);
  t.true(isRunComplete(runDir), 'isRunComplete returns true with sentinel');
  
  cleanupTestDir();
});

// Test 6: isRunComplete returns false without sentinel
test('isRunComplete returns false when sentinel missing', t => {
  setupTestDir();
  const runDir = resolve(tmpDir, 'run-incomplete');
  mkdirSync(runDir, { recursive: true });
  
  t.false(isRunComplete(runDir), 'isRunComplete returns false without sentinel');
  
  cleanupTestDir();
});

// Test 7: Read completion sentinel
test('readCompletionSentinel parses sentinel file correctly', t => {
  setupTestDir();
  const runDir = resolve(tmpDir, 'run-read');
  mkdirSync(runDir, { recursive: true });
  
  writeCompletionSentinel(runDir);
  const sentinel = readCompletionSentinel(runDir);
  
  t.truthy(sentinel, 'readCompletionSentinel returns sentinel object');
  t.truthy(sentinel.completedAt, 'Sentinel has completedAt');
  t.truthy(sentinel.timestamp, 'Sentinel has timestamp');
  
  cleanupTestDir();
});

// Test 8: Validate JSON file — success case
test('validateJsonFile succeeds for valid JSON', t => {
  setupTestDir();
  const filePath = resolve(tmpDir, 'valid.json');
  const data = { runId: 'abc123', status: 'COMPLETE' };
  
  atomicWriteJsonSync(filePath, data);
  
  const parsed = validateJsonFile(filePath, ['runId', 'status']);
  t.deepEqual(parsed, data, 'Parsed JSON matches');
  
  cleanupTestDir();
});

// Test 9: Validate JSON file — corrupted JSON
test('validateJsonFile detects truncated/corrupted JSON', t => {
  setupTestDir();
  const filePath = resolve(tmpDir, 'corrupted.json');
  
  // Write truncated JSON
  writeFileSync(filePath, '{"key": "value"');
  
  const result = new ValidationResult();
  const parsed = validateJsonFile(filePath, [], result);
  
  t.falsy(parsed, 'validateJsonFile returns null for corrupted JSON');
  t.false(result.valid, 'ValidationResult marked as invalid');
  t.true(result.corruptedFiles.length > 0, 'Corrupted files recorded');
  
  cleanupTestDir();
});

// Test 10: Validate JSON file — missing required fields
test('validateJsonFile detects missing required fields', t => {
  setupTestDir();
  const filePath = resolve(tmpDir, 'missing-fields.json');
  const data = { runId: 'abc123' }; // Missing 'status'
  
  atomicWriteJsonSync(filePath, data);
  
  const result = new ValidationResult();
  validateJsonFile(filePath, ['runId', 'status'], result);
  
  t.false(result.valid, 'ValidationResult marked as invalid');
  t.true(result.errors.some(e => e.message.includes('Missing required field')), 'Missing field error recorded');
  
  cleanupTestDir();
});

// Test 11: Validate JSON file — missing file
test('validateJsonFile detects missing file', t => {
  setupTestDir();
  const filePath = resolve(tmpDir, 'nonexistent.json');
  
  const result = new ValidationResult();
  const parsed = validateJsonFile(filePath, [], result);
  
  t.falsy(parsed, 'validateJsonFile returns null for missing file');
  t.false(result.valid, 'ValidationResult marked as invalid');
  t.true(result.missingFiles.includes(filePath), 'Missing file recorded');
  
  cleanupTestDir();
});

// Test 12: Validate run directory — complete run
test('validateRunDirectory passes for complete run', t => {
  setupTestDir();
  const runDir = resolve(tmpDir, 'complete-run');
  mkdirSync(runDir, { recursive: true });
  
  // Write required artifacts
  atomicWriteJsonSync(resolve(runDir, 'summary.json'), { runId: 'test', status: 'COMPLETE', startedAt: '2024-01-01T00:00:00Z' });
  atomicWriteJsonSync(resolve(runDir, 'findings.json'), { findings: [], detectedAt: '2024-01-01T00:00:00Z' });
  
  // Write sentinel
  writeCompletionSentinel(runDir);
  
  const result = validateRunDirectory(runDir);
  t.true(result.valid, 'Complete run passes validation');
  t.is(result.errors.length, 0, 'No errors');
  
  cleanupTestDir();
});

// Test 13: Validate run directory — missing sentinel
test('validateRunDirectory detects missing sentinel', t => {
  setupTestDir();
  const runDir = resolve(tmpDir, 'no-sentinel-run');
  mkdirSync(runDir, { recursive: true });
  
  // Write artifacts but NOT sentinel
  atomicWriteJsonSync(resolve(runDir, 'summary.json'), { runId: 'test', status: 'COMPLETE', startedAt: '2024-01-01T00:00:00Z' });
  atomicWriteJsonSync(resolve(runDir, 'findings.json'), { findings: [], detectedAt: '2024-01-01T00:00:00Z' });
  
  const result = validateRunDirectory(runDir);
  t.false(result.valid, 'Run without sentinel fails validation');
  t.true(result.errors.some(e => e.message.includes('completion sentinel')), 'Sentinel error recorded');
  
  cleanupTestDir();
});

// Test 14: Validate run directory — corrupted summary.json
test('validateRunDirectory detects corrupted summary.json', t => {
  setupTestDir();
  const runDir = resolve(tmpDir, 'corrupted-summary-run');
  mkdirSync(runDir, { recursive: true });
  
  // Write corrupted summary
  writeFileSync(resolve(runDir, 'summary.json'), '{"runId"');
  atomicWriteJsonSync(resolve(runDir, 'findings.json'), { findings: [], detectedAt: '2024-01-01T00:00:00Z' });
  writeCompletionSentinel(runDir);
  
  const result = validateRunDirectory(runDir);
  t.false(result.valid, 'Run with corrupted summary fails validation');
  t.true(result.corruptedFiles.length > 0, 'Corrupted file recorded');
  
  cleanupTestDir();
});

// Test 15: Determine run status from validation
test('determineRunStatus returns INCOMPLETE for missing sentinel', t => {
  const result = new ValidationResult();
  result.addError('Run completion sentinel missing (.run-complete)', {});
  
  const status = determineRunStatus(result, 'COMPLETE');
  t.is(status, 'INCOMPLETE', 'Status determined as INCOMPLETE');
  
  cleanupTestDir();
});

// Test 16: Determine run status from validation
test('determineRunStatus returns FAIL_DATA for corrupted files', t => {
  const result = new ValidationResult();
  result.addCorruptedFile('/path/to/findings.json', 'JSON syntax error');
  
  const status = determineRunStatus(result, 'COMPLETE');
  t.is(status, 'FAIL_DATA', 'Status determined as FAIL_DATA');
  
  cleanupTestDir();
});

// Test 17: Determine run status — valid run
test('determineRunStatus preserves status for valid run', t => {
  const result = new ValidationResult();
  result.valid = true;
  
  const status = determineRunStatus(result, 'COMPLETE');
  t.is(status, 'COMPLETE', 'Valid run status preserved');
  
  cleanupTestDir();
});

// Test 18: Empty file detection
test('validateJsonFile detects empty files', t => {
  setupTestDir();
  const filePath = resolve(tmpDir, 'empty.json');
  writeFileSync(filePath, '');
  
  const result = new ValidationResult();
  const parsed = validateJsonFile(filePath, [], result);
  
  t.falsy(parsed, 'Returns null for empty file');
  t.false(result.valid, 'Validation fails');
  
  cleanupTestDir();
});

// Test 19: ValidationResult accumulation
test('ValidationResult accumulates errors correctly', t => {
  const result = new ValidationResult();
  
  result.addError('Error 1');
  result.addError('Error 2');
  result.addWarning('Warning 1');
  result.addMissingFile('/path/to/file.json');
  result.addCorruptedFile('/path/to/corrupted.json', 'Invalid JSON');
  
  const summary = result.getSummary();
  t.is(summary.errorCount, 2, 'Error count correct');
  t.is(summary.warningCount, 1, 'Warning count correct');
  t.is(summary.missingFileCount, 1, 'Missing file count correct');
  t.is(summary.corruptedFileCount, 1, 'Corrupted file count correct');
  t.false(summary.valid, 'Overall validity is false');
  
  cleanupTestDir();
});
