import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyRunTruth } from '../src/verax/core/truth-classifier.js';
import { mapFailureReasons } from '../src/verax/core/failures/failure-mode-matrix.js';

// CI trust: timing variance may only downgrade to INCOMPLETE, never flip SUCCESS ↔ FINDINGS
test('timing variance downgrades at most to INCOMPLETE', () => {
  const normal = classifyRunTruth({
    expectationsTotal: 3,
    attempted: 3,
    observed: 3,
    silentFailures: 0,
    coverageRatio: 1,
    hasInfraFailure: false,
    isIncomplete: false,
    incompleteReasons: [],
  }, { minCoverage: 0.9 });

  const delayed = classifyRunTruth({
    expectationsTotal: 3,
    attempted: 3,
    observed: 3,
    silentFailures: 0,
    coverageRatio: 1,
    hasInfraFailure: false,
    isIncomplete: true,
    incompleteReasons: ['incomplete:timing_instability'],
  }, { minCoverage: 0.9 });

  assert.equal(normal.truthState, 'SUCCESS');
  assert.equal(delayed.truthState, 'INCOMPLETE');
});

test('timing uncertainty does not convert findings into success', () => {
  const findings = classifyRunTruth({
    expectationsTotal: 2,
    attempted: 2,
    observed: 2,
    silentFailures: 1,
    coverageRatio: 1,
    hasInfraFailure: false,
    isIncomplete: false,
    incompleteReasons: [],
  }, { minCoverage: 0.9 });

  const delayedFindings = classifyRunTruth({
    expectationsTotal: 2,
    attempted: 2,
    observed: 2,
    silentFailures: 1,
    coverageRatio: 1,
    hasInfraFailure: false,
    isIncomplete: true,
    incompleteReasons: ['incomplete:timing_instability'],
  }, { minCoverage: 0.9 });

  assert.equal(findings.truthState, 'FINDINGS');
  assert.equal(delayedFindings.truthState, 'FINDINGS');
});

test('summary reasons surface runtime uncertainty for CI', () => {
  const reasons = mapFailureReasons([
    'incomplete:timing_instability',
    'incomplete:network_unavailable',
    'unsupported_framework'
  ]);

  const codes = reasons.map(r => r.code);
  assert.ok(codes.includes('interaction_timeout'));
  assert.ok(codes.includes('network_blocked'));
  assert.ok(codes.includes('unsupported_framework'));
  reasons.forEach(r => {
    assert.ok(typeof r.message === 'string' && r.message.length > 0);
    assert.equal(r.verdict, 'INCOMPLETE');
  });
});
