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

test('Decision usefulness: CONFIRMED with PARTIAL quality -> FIX', () => {
  // Substantive evidence present via url change + screenshots (PARTIAL)
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

  // Evidence Law should not downgrade (substantive evidence present)
  assert.equal(result.truthStatus, 'CONFIRMED');

  // Metadata-only decision usefulness
  assert.equal(result.meta?.decisionUsefulness, 'FIX');

  // Confidence fields remain present and numeric
  assert.equal(typeof result.score, 'number');
  assert.ok(['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'].includes(result.level));
});

test('Decision usefulness: SUSPECTED with LOW + NONE -> IGNORE', () => {
  const params = baseParams({
    sensors: {},
    comparisons: {},
    evidence: {},
    truthStatus: 'SUSPECTED'
  });

  const result = computeConfidence(params);

  // With no signals, expect LOW level from unified mapping
  assert.equal(result.meta?.decisionUsefulness, 'IGNORE');
});

test('Decision usefulness: INFORMATIONAL -> IGNORE', () => {
  const params = baseParams({
    truthStatus: 'INFORMATIONAL',
    sensors: {},
    comparisons: {},
    evidence: {}
  });

  const result = computeConfidence(params);
  assert.equal(result.meta?.decisionUsefulness, 'IGNORE');
});

test('Evidence Law unchanged: CONFIRMED without evidence downgrades to SUSPECTED', () => {
  const params = baseParams({
    truthStatus: 'CONFIRMED',
    sensors: {},
    comparisons: {},
    evidence: {}
  });

  const result = computeConfidence(params);
  assert.equal(result.truthStatus, 'SUSPECTED');
  assert.equal(result.meta?.decisionUsefulness, 'IGNORE');
});

test('Equivalence: score and level deterministic; metadata-only addition', () => {
  const params = baseParams({
    comparisons: { hasDomChange: true },
    evidence: { before: { screenshot: 'x' }, after: { screenshot: 'y' } },
    truthStatus: 'SUSPECTED'
  });

  const a = computeConfidence(params);
  const b = computeConfidence(params);

  // Deterministic (unchanged by metadata computation)
  assert.equal(a.score, b.score);
  assert.equal(a.level, b.level);
  assert.deepEqual(a.reasonCodes, b.reasonCodes);
});
