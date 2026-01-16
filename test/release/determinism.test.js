/**
 * Phase 8.3 Determinism Test
 * Verifies that same inputs produce stable outputs: same IDs, same order, same classifications
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { extractExpectations } from '../src/cli/util/expectation-extractor.js';
import { compareExpectations, expIdFromHash, findingIdFromExpectationId } from '../src/cli/util/idgen.js';

// Mock project profile for a simple test fixture
const mockProjectProfile = {
  framework: 'nextjs',
  router: 'app',
  sourceRoot: './test-fixtures/static-html',
  packageJsonPath: './test-fixtures/static-html/package.json',
};

test('determinism: first learn produces consistent expectation IDs', async () => {
  const run1 = await extractExpectations(mockProjectProfile, './test-fixtures/static-html');
  const run2 = await extractExpectations(mockProjectProfile, './test-fixtures/static-html');
  
  // Both runs should have same number of expectations
  assert.strictEqual(run1.expectations.length, run2.expectations.length, 'Same number of expectations');
  
  // IDs must be identical for same source locations
  run1.expectations.forEach((exp1, idx) => {
    const exp2 = run2.expectations[idx];
    assert.strictEqual(exp1.id, exp2.id, 
      `Expectation ${idx}: ID mismatch for ${exp1.source.file}:${exp1.source.line}`);
  });
});

test('determinism: expectations are deterministically ordered', async () => {
  const result = await extractExpectations(mockProjectProfile, './test-fixtures/static-html');
  const expectations = result.expectations;
  
  if (expectations.length < 2) {
    // Skip test if insufficient expectations
    return;
  }
  
  // Verify expectations are sorted
  for (let i = 0; i < expectations.length - 1; i++) {
    const curr = expectations[i];
    const next = expectations[i + 1];
    
    // compareExpectations returns <= 0 if curr <= next (correct order)
    const comparison = compareExpectations(curr, next);
    assert.ok(comparison <= 0, 
      `Expectations at index ${i} and ${i + 1} are not in sorted order: ` +
      `${curr.source.file}:${curr.source.line} vs ${next.source.file}:${next.source.line}`);
  }
});

test('determinism: extracting twice produces identical ID sequence', async () => {
  const run1 = await extractExpectations(mockProjectProfile, './test-fixtures/static-html');
  const run2 = await extractExpectations(mockProjectProfile, './test-fixtures/static-html');
  
  // Get ID sequences
  const ids1 = run1.expectations.map(e => e.id);
  const ids2 = run2.expectations.map(e => e.id);
  
  // IDs must match exactly in order
  assert.deepStrictEqual(ids1, ids2, 'ID sequences must be identical');
});

test('determinism: same expectation source produces same ID', () => {
  // Call same function multiple times with same inputs
  const id1 = expIdFromHash('pages/index.tsx', 42, 10, 'navigate', '/products');
  const id2 = expIdFromHash('pages/index.tsx', 42, 10, 'navigate', '/products');
  const id3 = expIdFromHash('pages/index.tsx', 42, 10, 'navigate', '/products');
  
  assert.strictEqual(id1, id2, 'Same inputs should produce same ID');
  assert.strictEqual(id2, id3, 'Same inputs should produce same ID (third call)');
  assert.ok(id1.startsWith('exp_'), 'ID format should be exp_<hash>');
});

test('determinism: different sources produce different IDs', () => {
  const id1 = expIdFromHash('pages/index.tsx', 42, 10, 'navigate', '/products');
  const id2 = expIdFromHash('pages/index.tsx', 42, 11, 'navigate', '/products'); // diff column
  const id3 = expIdFromHash('pages/index.tsx', 43, 10, 'navigate', '/products'); // diff line
  const id4 = expIdFromHash('pages/other.tsx', 42, 10, 'navigate', '/products'); // diff file
  const id5 = expIdFromHash('pages/index.tsx', 42, 10, 'navigate', '/other');    // diff value
  const id6 = expIdFromHash('pages/index.tsx', 42, 10, 'click', '/products');    // diff kind
  
  // All should be different
  const ids = [id1, id2, id3, id4, id5, id6];
  const uniqueIds = new Set(ids);
  assert.strictEqual(uniqueIds.size, ids.length, 
    'Different inputs should produce different IDs');
});

test('determinism: finding IDs are deterministic from expectation IDs', () => {
  const expId = 'exp_a1b2c3';
  const finding1 = findingIdFromExpectationId(expId);
  const finding2 = findingIdFromExpectationId(expId);
  
  assert.strictEqual(finding1, finding2, 'Same expectation ID should produce same finding ID');
  assert.ok(finding1.startsWith('finding_'), 'Finding ID format should be finding_<expId>');
  assert.strictEqual(finding1, 'finding_exp_a1b2c3', 'Finding ID should be properly formatted');
});

test('determinism: expectations maintain order after multiple extractions', async () => {
  const run1 = await extractExpectations(mockProjectProfile, './test-fixtures/static-html');
  const run2 = await extractExpectations(mockProjectProfile, './test-fixtures/static-html');
  const run3 = await extractExpectations(mockProjectProfile, './test-fixtures/static-html');
  
  // Build comparison tuples (file, line, column, kind, value) for each run
  const toTuple = (exp) => [
    exp.source.file,
    exp.source.line,
    exp.source.column,
    exp.promise.kind,
    exp.promise.value,
  ];
  
  const tuples1 = run1.expectations.map(toTuple);
  const tuples2 = run2.expectations.map(toTuple);
  const tuples3 = run3.expectations.map(toTuple);
  
  // All three runs should have identical order
  assert.deepStrictEqual(tuples1, tuples2, 'Run 1 and 2 order mismatch');
  assert.deepStrictEqual(tuples2, tuples3, 'Run 2 and 3 order mismatch');
});

test('determinism: file path normalization handles backslashes', () => {
  // Forward slashes and backslashes should produce same ID
  const idForward = expIdFromHash('pages/index.tsx', 42, 10, 'navigate', '/products');
  const idBackslash = expIdFromHash('pages\\index.tsx', 42, 10, 'navigate', '/products');
  
  assert.strictEqual(idForward, idBackslash, 
    'Forward slashes and backslashes should produce same ID (cross-platform)');
});
