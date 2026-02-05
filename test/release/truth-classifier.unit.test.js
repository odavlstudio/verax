/**
 * Unit tests for Stage 4: Truth Classification Engine
 * 
 * Validates that run classifications follow non-negotiable rules:
 * - SUCCESS: no expectations OR (full coverage AND no failures)
 * - INCOMPLETE: partial coverage or attempts
 * - FAILURE: confirmed failures OR infra crash
 * - Confidence scoring: HIGH/MEDIUM/LOW based on coverage and stability
 */

import { test } from 'node:test';
import * as assert from 'node:assert';
import {
  classifyRunTruth,
  formatTruthAsText,
  buildTruthBlock,
} from '../../src/verax/core/truth-classifier.js';

// =============================================================================
// Test Cases: Empty Sites (No Expectations)
// =============================================================================

test('empty site → SUCCESS with HIGH confidence', () => {
  const result = classifyRunTruth({
    expectationsTotal: 0,
    attempted: 0,
    observed: 0,
    silentFailures: 0,
    coverageRatio: 0,
    hasInfraFailure: false,
    isIncomplete: false,
  });

  assert.strictEqual(result.truthState, 'SUCCESS');
  assert.strictEqual(result.confidence, 'HIGH');
  assert.match(result.reason, /no testable expectations/i);
  assert.match(result.whatThisMeans, /nothing to verify/i);
});

// =============================================================================
// Test Cases: Infrastructure Failures (HIGHEST PRIORITY)
// =============================================================================

test('infra failure flag 4 INCOMPLETE with LOW confidence', () => {
  const result = classifyRunTruth({
    expectationsTotal: 10,
    attempted: 0,
    observed: 0,
    silentFailures: 0,
    coverageRatio: 0,
    hasInfraFailure: true,
    isIncomplete: false,
  });

  assert.strictEqual(result.truthState, 'INCOMPLETE');
  assert.strictEqual(result.confidence, 'LOW');
  assert.match(result.reason, /infrastructure failure/i);
  assert.match(result.whatThisMeans, /cannot be trusted/i);
});

test('zero attempts with infra incomplete 4 INCOMPLETE with LOW confidence', () => {
  const result = classifyRunTruth({
    expectationsTotal: 10,
    attempted: 0,
    observed: 0,
    silentFailures: 0,
    coverageRatio: 0,
    hasInfraFailure: false,
    isIncomplete: true,
  });

  assert.strictEqual(result.truthState, 'INCOMPLETE');
  assert.strictEqual(result.confidence, 'LOW');
  assert.match(result.reason, /incomplete run.*zero attempts/i);
});

// =============================================================================
// Test Cases: Full Coverage, No Failures (SUCCESS)
// =============================================================================

test('100% coverage, zero failures, high threshold → SUCCESS HIGH', () => {
  const result = classifyRunTruth(
    {
      expectationsTotal: 10,
      attempted: 10,
      observed: 10,
      silentFailures: 0,
      coverageRatio: 1.0,
      hasInfraFailure: false,
      isIncomplete: false,
    },
    { minCoverage: 0.9 }
  );

  assert.strictEqual(result.truthState, 'SUCCESS');
  assert.strictEqual(result.confidence, 'HIGH');
  assert.match(result.reason, /10.*10.*(zero failures|no silent failures)/i);
  assert.match(result.whatThisMeans, /(covered public flows|public flows were exercised)/i);
});

test('95% coverage, zero failures, 90% threshold SUCCESS HIGH', () => {
  const result = classifyRunTruth(
    {
      expectationsTotal: 100,
      attempted: 95,
      observed: 95,
      silentFailures: 0,
      coverageRatio: 0.95,
      hasInfraFailure: false,
      isIncomplete: false,
    },
    { minCoverage: 0.9 }
  );

  assert.strictEqual(result.truthState, 'SUCCESS');
  assert.strictEqual(result.confidence, 'HIGH');
});

test('exactly at threshold (90%), zero failures SUCCESS HIGH', () => {
  const result = classifyRunTruth(
    {
      expectationsTotal: 100,
      attempted: 90,
      observed: 90,
      silentFailures: 0,
      coverageRatio: 0.9,
      hasInfraFailure: false,
      isIncomplete: false,
    },
    { minCoverage: 0.9 }
  );

  assert.strictEqual(result.truthState, 'SUCCESS');
  assert.strictEqual(result.confidence, 'HIGH');
});

// =============================================================================
// Test Cases: Silent Failures Detected (FAILURE)
// =============================================================================

test('confirmed failures 4 FINDINGS with HIGH confidence', () => {
  const result = classifyRunTruth(
    {
      expectationsTotal: 10,
      attempted: 10,
      observed: 10,
      silentFailures: 1,
      coverageRatio: 1.0,
      hasInfraFailure: false,
      isIncomplete: false,
    },
    { minCoverage: 0.9 }
  );

  assert.strictEqual(result.truthState, 'FINDINGS');
  assert.strictEqual(result.confidence, 'HIGH');
  assert.match(result.reason, /1 silent failure/i);
  assert.match(result.whatThisMeans, /interactions that appeared to work/i);
});

test('multiple failures 4 FINDINGS with HIGH confidence', () => {
  const result = classifyRunTruth(
    {
      expectationsTotal: 20,
      attempted: 20,
      observed: 20,
      silentFailures: 3,
      coverageRatio: 1.0,
      hasInfraFailure: false,
      isIncomplete: false,
    },
    { minCoverage: 0.9 }
  );

  assert.strictEqual(result.truthState, 'FINDINGS');
  assert.strictEqual(result.confidence, 'HIGH');
  assert.match(result.reason, /3 silent failure/i);
});

// =============================================================================
// Test Cases: Partial Coverage (INCOMPLETE)
// =============================================================================

test('below threshold → INCOMPLETE MEDIUM', () => {
  const result = classifyRunTruth(
    {
      expectationsTotal: 100,
      attempted: 80,
      observed: 80,
      silentFailures: 0,
      coverageRatio: 0.8,
      hasInfraFailure: false,
      isIncomplete: false,
    },
    { minCoverage: 0.9 }
  );

  assert.strictEqual(result.truthState, 'INCOMPLETE');
  assert.strictEqual(result.confidence, 'MEDIUM');
  assert.match(result.reason, /Only\s+80\/100/i);
});

test('below 50% coverage → INCOMPLETE LOW', () => {
  const result = classifyRunTruth(
    {
      expectationsTotal: 100,
      attempted: 40,
      observed: 40,
      silentFailures: 0,
      coverageRatio: 0.4,
      hasInfraFailure: false,
      isIncomplete: false,
    },
    { minCoverage: 0.9 }
  );

  assert.strictEqual(result.truthState, 'INCOMPLETE');
  assert.strictEqual(result.confidence, 'LOW');
});

test('partial attempts, no coverage threshold breach → INCOMPLETE', () => {
  const result = classifyRunTruth(
    {
      expectationsTotal: 50,
      attempted: 25,
      observed: 25,
      silentFailures: 0,
      coverageRatio: 0.5,
      hasInfraFailure: false,
      isIncomplete: false,
    },
    { minCoverage: 0.9 }
  );

  assert.strictEqual(result.truthState, 'INCOMPLETE');
  assert.match(result.reason, /25.*50.*attempted/i);
});

test('incomplete flag set → INCOMPLETE', () => {
  const result = classifyRunTruth(
    {
      expectationsTotal: 10,
      attempted: 8,
      observed: 8,
      silentFailures: 0,
      coverageRatio: 0.8,
      hasInfraFailure: false,
      isIncomplete: true,
    },
    { minCoverage: 0.9 }
  );

  assert.strictEqual(result.truthState, 'INCOMPLETE');
});

// =============================================================================
// Test Cases: Confidence Levels
// =============================================================================

test('HIGH confidence: 100% coverage, no attempts limit', () => {
  const result = classifyRunTruth({
    expectationsTotal: 10,
    attempted: 10,
    observed: 10,
    silentFailures: 0,
    coverageRatio: 1.0,
    hasInfraFailure: false,
    isIncomplete: false,
  });

  assert.strictEqual(result.confidence, 'HIGH');
});

test('MEDIUM confidence: 80% coverage, some attempts', () => {
  const result = classifyRunTruth(
    {
      expectationsTotal: 100,
      attempted: 80,
      observed: 80,
      silentFailures: 0,
      coverageRatio: 0.8,
      hasInfraFailure: false,
      isIncomplete: false,
    },
    { minCoverage: 0.9 }
  );

  assert.strictEqual(result.confidence, 'MEDIUM');
});

test('LOW confidence: zero attempts', () => {
  const result = classifyRunTruth(
    {
      expectationsTotal: 100,
      attempted: 0,
      observed: 0,
      silentFailures: 0,
      coverageRatio: NaN,
      hasInfraFailure: false,
      isIncomplete: true,
    },
    { minCoverage: 0.9 }
  );

  assert.strictEqual(result.confidence, 'LOW');
});

test('LOW confidence: 30% coverage', () => {
  const result = classifyRunTruth(
    {
      expectationsTotal: 100,
      attempted: 30,
      observed: 30,
      silentFailures: 0,
      coverageRatio: 0.3,
      hasInfraFailure: false,
      isIncomplete: false,
    },
    { minCoverage: 0.9 }
  );

  assert.strictEqual(result.confidence, 'LOW');
});

// =============================================================================
// Test Cases: Edge Cases and Defaults
// =============================================================================

test('undefined thresholds use default 0.90', () => {
  const result = classifyRunTruth({
    expectationsTotal: 100,
    attempted: 89,
    observed: 89,
    silentFailures: 0,
    coverageRatio: 0.89,
    hasInfraFailure: false,
    isIncomplete: false,
  });

  assert.strictEqual(result.truthState, 'INCOMPLETE');
  assert.match(result.reason, /Only\s+89\/100/i);
});

test('custom threshold respected (80%)', () => {
  const result = classifyRunTruth(
    {
      expectationsTotal: 100,
      attempted: 81,
      observed: 81,
      silentFailures: 0,
      coverageRatio: 0.81,
      hasInfraFailure: false,
      isIncomplete: false,
    },
    { minCoverage: 0.8 }
  );

  assert.strictEqual(result.truthState, 'SUCCESS');
  assert.strictEqual(result.confidence, 'HIGH');
});

test('NaN coverage ratio with empty expectations → SUCCESS', () => {
  const result = classifyRunTruth({
    expectationsTotal: 0,
    attempted: 0,
    observed: 0,
    silentFailures: 0,
    coverageRatio: NaN,
    hasInfraFailure: false,
    isIncomplete: false,
  });

  assert.strictEqual(result.truthState, 'SUCCESS');
});

// =============================================================================
// Test Cases: Formatting Functions
// =============================================================================

test('formatTruthAsText produces single-paragraph output', () => {
  const result = classifyRunTruth({
    expectationsTotal: 0,
    attempted: 0,
    observed: 0,
    silentFailures: 0,
    coverageRatio: 0,
    hasInfraFailure: false,
    isIncomplete: false,
  });

  const text = formatTruthAsText(result);
  assert.strictEqual(typeof text, 'string');
  assert.ok(text.length > 0);
  assert.match(text, /SUCCESS/);
  assert.match(text, /Confidence:/);
});

test('formatTruthAsText uses confidence level', () => {
  const result = classifyRunTruth({
    expectationsTotal: 100,
    attempted: 80,
    observed: 80,
    silentFailures: 0,
    coverageRatio: 0.8,
    hasInfraFailure: false,
    isIncomplete: false,
  });

  const text = formatTruthAsText(result);
  assert.match(text, /Confidence:\s*(HIGH|MEDIUM|LOW|UNKNOWN)/i);
});

test('buildTruthBlock produces JSON-serializable object', () => {
  const result = classifyRunTruth({
    expectationsTotal: 10,
    attempted: 10,
    observed: 10,
    silentFailures: 0,
    coverageRatio: 1.0,
    hasInfraFailure: false,
    isIncomplete: false,
  });

  const block = buildTruthBlock(result);
  const keys = Object.keys(block).sort();
  const expectedKeys = ['action', 'confidence', 'explanation', 'reason', 'truthState', 'coverageSummary'].sort();
  assert.deepStrictEqual(keys, expectedKeys);
  
  assert.ok(JSON.stringify(block).length > 0);
});

test('buildTruthBlock preserves all fields', () => {
  const result = classifyRunTruth({
    expectationsTotal: 0,
    attempted: 0,
    observed: 0,
    silentFailures: 0,
    coverageRatio: 0,
    hasInfraFailure: false,
    isIncomplete: false,
  });

  const block = buildTruthBlock(result);
  assert.strictEqual(block.truthState, 'SUCCESS');
  assert.strictEqual(block.confidence, 'HIGH');
  assert.strictEqual(typeof block.reason, 'string');
  assert.strictEqual(typeof block.explanation, 'string');
  assert.strictEqual(typeof block.action, 'string');
});

// =============================================================================
// Test Cases: Priority Rules (FOUNDATIONAL)
// =============================================================================

test('infra failure overrides other signals', () => {
  const result = classifyRunTruth({
    expectationsTotal: 100,
    attempted: 100,
    observed: 100,
    silentFailures: 0,  // No failures
    coverageRatio: 1.0,  // Perfect coverage
    hasInfraFailure: true,  // But infra crashed
    isIncomplete: false,
  });

  assert.strictEqual(result.truthState, 'INCOMPLETE');
  assert.ok(['LOW','MEDIUM','HIGH'].includes(result.confidence));
});

test('silent failures override coverage checks', () => {
  const result = classifyRunTruth({
    expectationsTotal: 100,
    attempted: 50,  // Only 50% attempted
    observed: 50,
    silentFailures: 1,  // But we found a failure
    coverageRatio: 0.5,  // Below threshold
    hasInfraFailure: false,
    isIncomplete: false,
  });

  assert.strictEqual(result.truthState, 'FINDINGS');
  assert.strictEqual(result.confidence, 'HIGH');
});

test('coverage checks happen after failure checks', () => {
  const result = classifyRunTruth(
    {
      expectationsTotal: 100,
      attempted: 89,
      observed: 89,
      silentFailures: 0,  // No failures
      coverageRatio: 0.89,  // Below default 0.9
      hasInfraFailure: false,
      isIncomplete: false,
    },
    { minCoverage: 0.9 }
  );

  assert.strictEqual(result.truthState, 'INCOMPLETE');
  assert.strictEqual(result.confidence, 'MEDIUM');
});

// =============================================================================
// Test Cases: Real-world Scenarios
// =============================================================================

test('first run: low coverage with no failures → INCOMPLETE', () => {
  const result = classifyRunTruth(
    {
      expectationsTotal: 50,
      attempted: 25,
      observed: 25,
      silentFailures: 0,
      coverageRatio: 0.5,
      hasInfraFailure: false,
      isIncomplete: false,
    },
    { minCoverage: 0.9 }
  );

  assert.strictEqual(result.truthState, 'INCOMPLETE');
  assert.strictEqual(result.confidence, 'LOW');
});

test('production scan: full coverage with one finding 4 FINDINGS', () => {
  const result = classifyRunTruth(
    {
      expectationsTotal: 200,
      attempted: 200,
      observed: 200,
      silentFailures: 1,
      coverageRatio: 1.0,
      hasInfraFailure: false,
      isIncomplete: false,
    },
    { minCoverage: 0.95 }
  );

  assert.strictEqual(result.truthState, 'FINDINGS');
  assert.strictEqual(result.confidence, 'HIGH');
});

test('regression scan: custom threshold respected', () => {
  const result = classifyRunTruth(
    {
      expectationsTotal: 150,
      attempted: 135,
      observed: 135,
      silentFailures: 0,
      coverageRatio: 0.9,
      hasInfraFailure: false,
      isIncomplete: false,
    },
    { minCoverage: 0.85 }
  );

  assert.strictEqual(result.truthState, 'SUCCESS');
  assert.strictEqual(result.confidence, 'HIGH');
});
