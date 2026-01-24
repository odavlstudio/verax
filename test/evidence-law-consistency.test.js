/**
 * Evidence Law consistency tests (CONFIRMED requires substantive evidence).
 */
import test from 'node:test';
import assert from 'node:assert';
import { computeConfidence } from '../src/verax/core/confidence/index.js';

test('CONFIRMED without evidence is downgraded to SUSPECTED', () => {
  const result = computeConfidence({
    findingType: 'test-finding',
    expectation: { proof: 'PROVEN_EXPECTATION' },
    sensors: {},
    comparisons: {},
    evidence: { isComplete: false, signals: {} },
    truthStatus: 'CONFIRMED'
  });

  assert.strictEqual(result.truthStatus, 'SUSPECTED');
  assert.ok(
    Array.isArray(result.appliedInvariants) &&
      result.appliedInvariants.includes('EVIDENCE_REQUIRED_FOR_CONFIRMED'),
    'Missing evidence invariant not applied'
  );
  assert.ok(
    Array.isArray(result.reasonCodes) &&
      result.reasonCodes.includes('EVIDENCE_COMPLETENESS_REQUIRED'),
    'Reason code should reflect missing evidence'
  );
});

test('CONFIRMED with network evidence remains CONFIRMED', () => {
  const result = computeConfidence({
    findingType: 'test-finding',
    expectation: { proof: 'PROVEN_EXPECTATION' },
    sensors: {
      network: {
        totalRequests: 2,
        failedRequests: 0,
        successfulRequests: 2,
        hasNetworkActivity: true
      }
    },
    comparisons: { hasUrlChange: true },
    evidence: {
      isComplete: true,
      signals: {
        network: {
          totalRequests: 2,
          failedRequests: 0,
          successfulRequests: 2,
          hasNetworkActivity: true
        }
      }
    },
    truthStatus: 'CONFIRMED'
  });

  assert.strictEqual(result.truthStatus, 'CONFIRMED');
  assert.ok(
    !result.appliedInvariants || !result.appliedInvariants.includes('EVIDENCE_REQUIRED_FOR_CONFIRMED'),
    'Evidence invariant should not fire when evidence is present'
  );
});
