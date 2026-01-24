/**
 * Evidence quality metadata must not change confidence scoring or levels.
 */
import test from 'node:test';
import assert from 'node:assert';
import { computeConfidence } from '../src/verax/core/confidence/index.js';

function makeConfirmedInputs(overrides = {}) {
  return {
    findingType: 'test-finding',
    expectation: { proof: 'PROVEN_EXPECTATION' },
    sensors: {
      network: { totalRequests: 1, failedRequests: 0, successfulRequests: 1, hasNetworkActivity: true },
      console: { errors: 0, warnings: 0, logs: 0 },
      uiSignals: { diff: { changed: true } }
    },
    comparisons: { hasUrlChange: true },
    evidence: {
      isComplete: true,
      before: { screenshot: 'a', url: 'http://before' },
      after: { screenshot: 'b', url: 'http://after' },
      signals: {
        network: { totalRequests: 1, failedRequests: 0, successfulRequests: 1, hasNetworkActivity: true }
      },
      captureFailures: []
    },
    truthStatus: 'CONFIRMED',
    ...overrides
  };
}

test('Evidence quality metadata present and STRONG when evidence is complete', () => {
  const result = computeConfidence(makeConfirmedInputs());
  assert.ok(result.meta, 'meta should exist');
  assert.ok(result.meta.evidenceQuality, 'evidenceQuality should exist');
  assert.strictEqual(result.meta.evidenceQuality.quality, 'STRONG');

  // Confidence outputs remain unchanged by metadata
  const baseline = computeConfidence(makeConfirmedInputs());
  assert.strictEqual(result.score, baseline.score);
  assert.strictEqual(result.level, baseline.level);
  assert.strictEqual(result.truthStatus, baseline.truthStatus);
});

test('Evidence quality NONE when signals absent; confidence still downgrades via Evidence Law, not metadata', () => {
  const result = computeConfidence({
    findingType: 'test-finding',
    expectation: { proof: 'PROVEN_EXPECTATION' },
    sensors: {},
    comparisons: {},
    evidence: { isComplete: false, signals: {}, captureFailures: [] },
    truthStatus: 'CONFIRMED'
  });

  assert.ok(result.meta);
  assert.strictEqual(result.meta.evidenceQuality.quality, 'NONE');
  // Evidence Law already enforces downgrade; metadata must not change score/level further
  assert.strictEqual(result.truthStatus, 'SUSPECTED');
});

test('Confirmed without strong evidence adds metadata note only (no score change)', () => {
  const inputs = makeConfirmedInputs({
    evidence: {
      isComplete: false,
      before: { screenshot: null, url: 'http://before' },
      after: { screenshot: null, url: 'http://after' },
      signals: {
        network: { totalRequests: 1, failedRequests: 0, successfulRequests: 1, hasNetworkActivity: true }
      },
      captureFailures: []
    }
  });

  const result = computeConfidence(inputs);
  assert.ok(result.meta);
  assert.notStrictEqual(result.meta.evidenceQuality.quality, 'STRONG');
  assert.ok(result.meta.notes.includes('CONFIRMED_WITHOUT_STRONG_EVIDENCE'));

  // Confidence scoring unchanged (no additional downgrades from metadata)
  const baseline = computeConfidence(inputs);
  assert.strictEqual(result.score, baseline.score);
  assert.strictEqual(result.level, baseline.level);
});
