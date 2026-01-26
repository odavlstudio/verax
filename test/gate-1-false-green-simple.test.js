/**
 * GATE 1: Result Semantics - False Green Prevention
 *
 * Simple unit test of the truth classifier gate.
 * Verifies that INCOMPLETE is never misclassified as SUCCESS.
 */

import assert from 'assert';
import test from 'node:test';
import { classifyRunTruth } from '../src/verax/core/truth-classifier.js';

test('Gate 1: False Green Prevention', async (t) => {
  
  await t.test('20% coverage + zero findings MUST return INCOMPLETE', () => {
    const result = classifyRunTruth(
      {
        expectationsTotal: 50,
        attempted: 10,
        observed: 10,
        silentFailures: 0,               // No findings
        coverageRatio: 0.20,              // 20% (below 90% threshold)
        hasInfraFailure: false,
        isIncomplete: true,              // Coverage flag forces INCOMPLETE
        incompleteReasons: ['coverage_below_threshold'],
      },
      { minCoverage: 0.90 }
    );

    assert.strictEqual(result.truthState, 'INCOMPLETE');
    assert(result.whatThisMeans.includes('MUST NOT BE TREATED AS SAFE'));
  });

  await t.test('100% coverage + zero findings => SUCCESS', () => {
    const result = classifyRunTruth(
      {
        expectationsTotal: 25,
        attempted: 25,
        observed: 25,
        silentFailures: 0,
        coverageRatio: 1.0,
        hasInfraFailure: false,
        isIncomplete: false,
        incompleteReasons: [],
      },
      { minCoverage: 0.90 }
    );

    assert.strictEqual(result.truthState, 'SUCCESS');
  });

  await t.test('0 findings > SUCCESS path guard', () => {
    // Critical: Verify that zero findings alone doesn't guarantee SUCCESS
    const resultLowCoverage = classifyRunTruth(
      {
        expectationsTotal: 100,
        attempted: 50,
        observed: 50,
        silentFailures: 0,               // Zero findings
        coverageRatio: 0.50,             // But coverage is 50% (< 90%)
        hasInfraFailure: false,
        isIncomplete: true,              // isIncomplete flag overrides findings count
        incompleteReasons: ['coverage_below_threshold'],
      },
      { minCoverage: 0.90 }
    );

    assert.strictEqual(resultLowCoverage.truthState, 'INCOMPLETE');
  });
});
