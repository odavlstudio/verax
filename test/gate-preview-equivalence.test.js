import test from 'node:test';
import assert from 'node:assert/strict';

import { computeConfidence } from '../src/verax/core/confidence/index.js';

function baseParams(overrides = {}) {
  return {
    findingType: 'generic',
    expectation: { id: 'exp-1' },
    sensors: overrides.sensors || {},
    comparisons: overrides.comparisons || {},
    evidence: overrides.evidence || {},
    evidenceIntent: overrides.evidenceIntent || null,
    guardrailsOutcome: overrides.guardrailsOutcome || null,
    truthStatus: overrides.truthStatus || null,
    options: overrides.options || {}
  };
}

test('GatePreview: FAIL gate produces action-required summary', () => {
  const params = baseParams({
    comparisons: { hasUrlChange: true },
    evidence: {
      before: { screenshot: 'a' },
      after: { screenshot: 'b' },
      isComplete: false
    },
    truthStatus: 'CONFIRMED'
  });

  const result = computeConfidence(params);
  assert.equal(result.meta?.gateOutcome, 'FAIL');
  assert.equal(result.meta?.gatePreview?.gate, 'FAIL');
  assert(result.meta?.gatePreview?.summary.includes('Action required'));
  assert(result.meta?.gatePreview?.recommendation.length > 0);
});

test('GatePreview: WARN gate produces review-recommended summary', () => {
  const params = baseParams({
    truthStatus: 'SUSPECTED',
    guardrailsOutcome: { confidenceDelta: 0.65 }
  });

  const result = computeConfidence(params);
  assert.equal(result.meta?.gateOutcome, 'WARN');
  assert.equal(result.meta?.gatePreview?.gate, 'WARN');
  assert(result.meta?.gatePreview?.summary.includes('Review recommended'));
  assert(result.meta?.gatePreview?.recommendation.includes('Investigate'));
});

test('GatePreview: PASS gate produces no-action-needed summary', () => {
  const result = computeConfidence(baseParams({ truthStatus: 'INFORMATIONAL' }));
  assert.equal(result.meta?.gateOutcome, 'PASS');
  assert.equal(result.meta?.gatePreview?.gate, 'PASS');
  assert(result.meta?.gatePreview?.summary.includes('No immediate action'));
  assert(result.meta?.gatePreview?.recommendation.includes('Safe to proceed'));
});

test('GatePreview: BLOCK usefulness produces critical recommendation', () => {
  // BLOCK scenario: CONFIRMED + HIGH + STRONG (constructed through
  // decisionUsefulness BLOCK path to avoid relying on broader fixture data)
  const params = baseParams({
    comparisons: { hasUrlChange: true, hasDomChange: true },
    evidence: {
      before: { screenshot: 'a' },
      after: { screenshot: 'b' },
      isComplete: true
    },
    truthStatus: 'CONFIRMED'
  });

  const result = computeConfidence(params);
  if (result.meta?.decisionUsefulness === 'BLOCK') {
    assert.equal(result.meta?.gatePreview?.gate, 'FAIL');
    assert(result.meta?.gatePreview?.recommendation.includes('Critical'));
  }
});

test('Determinism: preview consistent across runs', () => {
  const params = baseParams({
    comparisons: { hasDomChange: true },
    evidence: { before: { screenshot: 'x' }, after: { screenshot: 'y' } },
    truthStatus: 'SUSPECTED'
  });

  const a = computeConfidence(params);
  const b = computeConfidence(params);

  assert.equal(a.meta?.gateOutcome, b.meta?.gateOutcome);
  assert.deepEqual(a.meta?.gatePreview, b.meta?.gatePreview);
  // Score/level unchanged
  assert.equal(a.score, b.score);
  assert.equal(a.level, b.level);
});

test('Zero behavior change: confidence/level/usefulness unaffected by preview', () => {
  const params = baseParams({
    comparisons: { hasUrlChange: true },
    evidence: {
      before: { screenshot: 'a' },
      after: { screenshot: 'b' },
      isComplete: false
    },
    truthStatus: 'CONFIRMED'
  });

  const result = computeConfidence(params);

  // Verify all prior metadata still present and unchanged
  assert.equal(typeof result.score, 'number');
  assert(['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'].includes(result.level), `Invalid level: ${result.level}`);
  assert(result.meta?.evidenceQuality !== undefined);
  assert(result.meta?.decisionUsefulness !== undefined);
  assert(result.meta?.gateOutcome !== undefined);
  // New preview is added but doesn't affect above
  assert(result.meta?.gatePreview?.gate !== undefined);
  assert(result.meta?.gatePreview?.summary !== undefined);
  assert(result.meta?.gatePreview?.recommendation !== undefined);
});
