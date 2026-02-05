import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyRunTruth, summarizeCriticalSilences } from '../../src/verax/core/truth-classifier.js';

test('CONTRACT: critical silence records must block SUCCESS (no false green)', () => {
  const observeLike = {
    observations: [
      { id: 'a', silenceDetected: { kind: 'intent_blocked' } },
      { id: 'b', silenceDetected: { kind: 'navigation_ambiguous' } },
      { id: 'c' },
    ],
  };

  const summary = summarizeCriticalSilences(observeLike.observations);
  assert.equal(summary.criticalSilenceCount, 2);
  assert.deepEqual(summary.criticalSilenceKinds, ['intent_blocked', 'navigation_ambiguous']);

  const result = classifyRunTruth(
    {
      expectationsTotal: 2,
      attempted: 2,
      observed: 2,
      silentFailures: 0,
      coverageRatio: 1.0,
      hasInfraFailure: false,
      isIncomplete: false,
      ...summary,
    },
    { minCoverage: 0.9 }
  );

  assert.equal(result.truthState, 'INCOMPLETE');
  assert.match(result.reason, /Critical ambiguity detected/i);
  assert.match(result.whatThisMeans, /MUST NOT BE TREATED AS SAFE/);
});

test('CONTRACT: findings take precedence even if critical silences exist', () => {
  const result = classifyRunTruth(
    {
      expectationsTotal: 2,
      attempted: 2,
      observed: 2,
      silentFailures: 1,
      coverageRatio: 1.0,
      hasInfraFailure: false,
      isIncomplete: false,
      criticalSilenceCount: 1,
      criticalSilenceKinds: ['intent_blocked'],
    },
    { minCoverage: 0.9 }
  );

  assert.equal(result.truthState, 'FINDINGS');
});

