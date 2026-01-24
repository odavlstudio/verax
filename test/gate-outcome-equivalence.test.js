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

test('GateOutcome: CONFIRMED + decisionUsefulness FIX -> FAIL', () => {
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
  assert.equal(result.truthStatus, 'CONFIRMED');
  assert.equal(result.meta?.decisionUsefulness, 'FIX');
  assert.equal(result.meta?.gateOutcome, 'FAIL');
});

test('GateOutcome: SUSPECTED + level MEDIUM via guardrails delta -> WARN', () => {
  const params = baseParams({
    truthStatus: 'SUSPECTED',
    guardrailsOutcome: { confidenceDelta: 0.65 }
  });

  const result = computeConfidence(params);
  // Decision Usefulness should be INVESTIGATE when level is MEDIUM/HIGH
  assert.equal(result.level === 'MEDIUM' || result.level === 'HIGH', true);
  assert.equal(result.meta?.decisionUsefulness, 'INVESTIGATE');
  assert.equal(result.meta?.gateOutcome, 'WARN');
});

test('GateOutcome: INFORMATIONAL -> PASS', () => {
  const result = computeConfidence(baseParams({ truthStatus: 'INFORMATIONAL' }));
  assert.equal(result.meta?.gateOutcome, 'PASS');
});

test('Determinism: metadata-only, score/level unchanged across runs', () => {
  const params = baseParams({
    comparisons: { hasDomChange: true },
    evidence: { before: { screenshot: 'x' }, after: { screenshot: 'y' } },
    truthStatus: 'SUSPECTED',
    guardrailsOutcome: { confidenceDelta: 0.15 }
  });

  const a = computeConfidence(params);
  const b = computeConfidence(params);
  assert.equal(a.score, b.score);
  assert.equal(a.level, b.level);
  assert.deepEqual(a.reasonCodes, b.reasonCodes);
  assert.equal(a.meta?.decisionUsefulness, b.meta?.decisionUsefulness);
  assert.equal(a.meta?.gateOutcome, b.meta?.gateOutcome);
});
