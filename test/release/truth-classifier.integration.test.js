/**
 * Integration test for Stage 4: Truth Classification Engine
 * Verifies that truth blocks are correctly written to summary.json artifacts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyRunTruth, buildTruthBlock } from '../../src/verax/core/truth-classifier.js';

test('buildTruthBlock produces valid summary.json truth block', (_t) => {
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

  // Verify structure
  assert.strictEqual(block.truthState, 'SUCCESS', 'truthState present and correct');
  assert.strictEqual(block.confidence, 'HIGH', 'confidence present and correct');
  assert.strictEqual(typeof block.reason, 'string', 'reason is string');
  assert.strictEqual(typeof block.explanation, 'string', 'explanation is string');
  assert.strictEqual(typeof block.action, 'string', 'action is string');

  // Verify JSON serialization
  const json = JSON.stringify(block);
  assert.ok(json.length > 0, 'block is JSON-serializable');
  assert.ok(json.includes('SUCCESS'), 'JSON contains truthState');
});

test('truth block is properly nested in summary.json structure', (_t) => {
  const truth = classifyRunTruth({
    expectationsTotal: 0,
    attempted: 0,
    observed: 0,
    silentFailures: 0,
    coverageRatio: 0,
    hasInfraFailure: false,
    isIncomplete: false,
  });

  const summaryLike = {
    contractVersion: '1',
    runId: 'test-run-123',
    status: 'COMPLETE',
    digest: {
      expectationsTotal: 0,
      attempted: 0,
      observed: 0,
      silentFailures: 0,
    },
    truth: buildTruthBlock(truth),
  };

  // Simulate artifact writing
  const json = JSON.stringify(summaryLike, null, 2);
  const parsed = JSON.parse(json);

  assert.ok(parsed.truth, 'truth block exists in parsed artifact');
  assert.strictEqual(parsed.truth.truthState, 'SUCCESS', 'truth block truthState preserved');
  assert.strictEqual(parsed.truth.confidence, 'HIGH', 'truth block confidence preserved');
});

test('all truth states are serializable', (_t) => {
  const scenarios = [
    { name: 'SUCCESS', result: { truthState: 'SUCCESS', confidence: 'HIGH' } },
    { name: 'INCOMPLETE', result: { truthState: 'INCOMPLETE', confidence: 'MEDIUM' } },
    { name: 'FAILURE', result: { truthState: 'FAILURE', confidence: 'HIGH' } },
  ];

  for (const scenario of scenarios) {
    const mockResult = {
      truthState: scenario.result.truthState,
      confidence: scenario.result.confidence,
      reason: `Test ${scenario.name}`,
      whatThisMeans: 'This is a test',
      recommendedAction: 'Do something',
    };

    const block = buildTruthBlock(mockResult);
    const json = JSON.stringify(block);
    const parsed = JSON.parse(json);

    assert.strictEqual(parsed.truthState, scenario.result.truthState, `${scenario.name} serializes correctly`);
  }
});

test('confidence levels serialize correctly', (_t) => {
  const confidenceLevels = ['HIGH', 'MEDIUM', 'LOW'];

  for (const confidence of confidenceLevels) {
    const mockResult = {
      truthState: 'SUCCESS',
      confidence,
      reason: 'Test',
      whatThisMeans: 'Test',
      recommendedAction: 'Test',
    };

    const block = buildTruthBlock(mockResult);
    const json = JSON.stringify(block);
    const parsed = JSON.parse(json);

    assert.strictEqual(parsed.confidence, confidence, `${confidence} confidence serializes correctly`);
  }
});

test('truth block includes all required fields for audit', (_t) => {
  const truth = classifyRunTruth({
    expectationsTotal: 100,
    attempted: 50,
    observed: 50,
    silentFailures: 0,
    coverageRatio: 0.5,
    hasInfraFailure: false,
    isIncomplete: false,
  });

  const block = buildTruthBlock(truth);

  // For audit trail, all fields should be present
  const requiredFields = ['truthState', 'confidence', 'reason', 'explanation', 'action'];
  for (const field of requiredFields) {
    assert.ok(field in block, `${field} is present in truth block`);
    assert.ok(block[field] !== null && block[field] !== undefined, `${field} is not null/undefined`);
  }
});

test('truth classification is deterministic across multiple calls', (_t) => {
  const runMetrics = {
    expectationsTotal: 75,
    attempted: 60,
    observed: 60,
    silentFailures: 1,
    coverageRatio: 0.8,
    hasInfraFailure: false,
    isIncomplete: false,
  };

  // Call multiple times
  const result1 = classifyRunTruth(runMetrics, { minCoverage: 0.9 });
  const result2 = classifyRunTruth(runMetrics, { minCoverage: 0.9 });
  const result3 = classifyRunTruth(runMetrics, { minCoverage: 0.9 });

  // Serialize each
  const json1 = JSON.stringify(buildTruthBlock(result1));
  const json2 = JSON.stringify(buildTruthBlock(result2));
  const json3 = JSON.stringify(buildTruthBlock(result3));

  // All should be identical
  assert.strictEqual(json1, json2, 'First and second calls produce identical serialization');
  assert.strictEqual(json2, json3, 'Second and third calls produce identical serialization');
});
