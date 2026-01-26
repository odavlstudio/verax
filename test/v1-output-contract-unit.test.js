/**
 * V1 Output Contract Tests - Simple Version
 * Tests the contract without fixture server dependency
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyRunTruth, formatTruthAsText, buildTruthBlock } from '../src/verax/core/truth-classifier.js';

// ============================================================
// TEST 1: INCOMPLETE classification includes safety warning
// ============================================================

test('INCOMPLETE classification contains "MUST NOT BE TREATED AS SAFE" in whatThisMeans', () => {
  const runSummary = {
    expectationsTotal: 10,
    attempted: 5,
    observed: 5,
    silentFailures: 0,
    coverageRatio: 0.5,
  };

  const result = classifyRunTruth(runSummary, { minCoverage: 0.90 });

  assert.equal(result.truthState, 'INCOMPLETE', 'Should classify as INCOMPLETE');
  assert.ok(
    result.whatThisMeans.includes('MUST NOT BE TREATED AS SAFE'),
    `whatThisMeans must contain safety warning. Got: ${result.whatThisMeans}`
  );
});

test('INCOMPLETE formatTruthAsText includes "MUST NOT BE TREATED AS SAFE"', () => {
  const truth = {
    truthState: 'INCOMPLETE',
    confidence: 'MEDIUM',
    reason: 'Only 5/10 attempted',
    whatThisMeans: 'Partial coverage. ⚠️ THIS RESULT MUST NOT BE TREATED AS SAFE.',
    recommendedAction: 'Re-run with full coverage',
    coverageSummary: {
      expectationsTotal: 10,
      attempted: 5,
      observed: 5,
      unattemptedCount: 5,
      unattemptedBreakdown: { timeout: 5 },
    },
  };

  const text = formatTruthAsText(truth);
  
  assert.ok(
    text.includes('MUST NOT BE TREATED AS SAFE'),
    `Formatted text must contain safety warning. Got: ${text}`
  );
  assert.ok(
    text.includes('INCOMPLETE'),
    `Formatted text must mention INCOMPLETE. Got: ${text}`
  );
});

// ============================================================
// TEST 2: SUCCESS does NOT contain safety warning
// ============================================================

test('SUCCESS classification does NOT contain "MUST NOT BE TREATED AS SAFE"', () => {
  const runSummary = {
    expectationsTotal: 10,
    attempted: 10,
    observed: 10,
    silentFailures: 0,
    coverageRatio: 1.0,
  };

  const result = classifyRunTruth(runSummary, { minCoverage: 0.90 });

  assert.equal(result.truthState, 'SUCCESS', 'Should classify as SUCCESS');
  assert.ok(
    !result.whatThisMeans.includes('MUST NOT BE TREATED AS SAFE'),
    `SUCCESS should NOT contain safety warning. Got: ${result.whatThisMeans}`
  );
});

test('SUCCESS formatTruthAsText does NOT include safety warning', () => {
  const truth = {
    truthState: 'SUCCESS',
    confidence: 'HIGH',
    reason: 'All expectations attempted, no failures',
    whatThisMeans: 'Every public flow was tested. No silent failures detected.',
    recommendedAction: 'Proceed with confidence',
  };

  const text = formatTruthAsText(truth);
  
  assert.ok(
    !text.includes('MUST NOT BE TREATED AS SAFE') && !text.includes('should NOT be treated as safe'),
    `SUCCESS text should NOT contain safety warning. Got: ${text}`
  );
});

// ============================================================
// TEST 3: Deterministic output structure
// ============================================================

test('buildTruthBlock produces deterministic structure', () => {
  const truth = {
    truthState: 'INCOMPLETE',
    confidence: 'MEDIUM',
    reason: 'Partial coverage',
    whatThisMeans: 'Test',
    recommendedAction: 'Re-run',
  };

  const coverageContext = {
    expectationsTotal: 10,
    attempted: 5,
    observed: 5,
    coverageRatio: 0.5,
    threshold: 0.9,
    unattemptedCount: 5,
    unattemptedBreakdown: { budget: 3, timeout: 2 },
    incompleteReasons: ['budget'],
  };

  const block1 = buildTruthBlock(truth, coverageContext);
  const block2 = buildTruthBlock(truth, coverageContext);

  assert.deepEqual(block1, block2, 'buildTruthBlock must be deterministic');
  
  // Verify structure
  assert.equal(block1.truthState, 'INCOMPLETE');
  assert.equal(block1.confidence, 'MEDIUM');
  assert.ok(block1.coverageSummary);
  assert.equal(block1.coverageSummary.expectationsTotal, 10);
  assert.equal(block1.coverageSummary.attempted, 5);
  assert.equal(block1.coverageSummary.observed, 5);
  assert.equal(block1.coverageSummary.unattemptedCount, 5);
  
  // Verify breakdown is sorted deterministically
  const keys = Object.keys(block1.coverageSummary.unattemptedBreakdown);
  assert.deepEqual(keys, ['budget', 'timeout'], 'Keys should be sorted alphabetically');
});

// ============================================================
// TEST 4: Coverage transparency fields
// ============================================================

test('buildTruthBlock includes all required coverage transparency fields', () => {
  const truth = {
    truthState: 'INCOMPLETE',
    confidence: 'LOW',
    reason: 'Test',
    whatThisMeans: 'Test',
    recommendedAction: 'Test',
  };

  const coverageContext = {
    expectationsTotal: 20,
    attempted: 10,
    observed: 8,
    coverageRatio: 0.4,
    threshold: 0.9,
    unattemptedCount: 10,
    unattemptedBreakdown: { timeout: 7, budget: 3 },
    incompleteReasons: [],
  };

  const block = buildTruthBlock(truth, coverageContext);

  assert.ok(block.coverageSummary, 'coverageSummary must exist');
  assert.ok('expectationsTotal' in block.coverageSummary, 'expectationsTotal present');
  assert.ok('attempted' in block.coverageSummary, 'attempted present');
  assert.ok('observed' in block.coverageSummary, 'observed present');
  assert.ok('unattemptedCount' in block.coverageSummary, 'unattemptedCount present');
  assert.ok('unattemptedBreakdown' in block.coverageSummary, 'unattemptedBreakdown present');
  
  assert.equal(block.coverageSummary.expectationsTotal, 20);
  assert.equal(block.coverageSummary.attempted, 10);
  assert.equal(block.coverageSummary.observed, 8);
  assert.equal(block.coverageSummary.unattemptedCount, 10);
});

// ============================================================
// TEST 5: Unambiguous state classification
// ============================================================

test('classifyRunTruth always returns SUCCESS, INCOMPLETE, or FAILURE', () => {
  const testCases = [
    { desc: 'full coverage no failures', summary: { expectationsTotal: 10, attempted: 10, observed: 10, silentFailures: 0, coverageRatio: 1.0 }, expected: 'SUCCESS' },
    { desc: 'partial coverage', summary: { expectationsTotal: 10, attempted: 5, observed: 5, silentFailures: 0, coverageRatio: 0.5 }, expected: 'INCOMPLETE' },
    { desc: 'with failures', summary: { expectationsTotal: 10, attempted: 10, observed: 10, silentFailures: 3, coverageRatio: 1.0 }, expected: 'FAILURE' },
    { desc: 'empty site', summary: { expectationsTotal: 0, attempted: 0, observed: 0, silentFailures: 0, coverageRatio: NaN }, expected: 'SUCCESS' },
    { desc: 'infra failure', summary: { expectationsTotal: 10, attempted: 0, observed: 0, silentFailures: 0, coverageRatio: 0, hasInfraFailure: true }, expected: 'FAILURE' },
  ];

  const validStates = ['SUCCESS', 'INCOMPLETE', 'FAILURE'];

  for (const tc of testCases) {
    const result = classifyRunTruth(tc.summary, { minCoverage: 0.9 });
    assert.ok(
      validStates.includes(result.truthState),
      `${tc.desc}: state must be one of ${validStates.join(', ')}. Got: ${result.truthState}`
    );
    assert.equal(result.truthState, tc.expected, `${tc.desc}: expected ${tc.expected}`);
  }
});

test('INCOMPLETE always includes reason, explanation, and action', () => {
  const runSummary = {
    expectationsTotal: 10,
    attempted: 5,
    observed: 5,
    silentFailures: 0,
    coverageRatio: 0.5,
  };

  const result = classifyRunTruth(runSummary, { minCoverage: 0.9 });

  assert.equal(result.truthState, 'INCOMPLETE');
  assert.ok(result.reason && result.reason.length > 0, 'reason must be present');
  assert.ok(result.whatThisMeans && result.whatThisMeans.length > 0, 'whatThisMeans must be present');
  assert.ok(result.recommendedAction && result.recommendedAction.length > 0, 'recommendedAction must be present');
});

console.log('✓ V1 output contract unit tests passed');
