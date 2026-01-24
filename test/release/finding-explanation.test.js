import { describe, test } from 'node:test';
import assert from 'node:assert';
import { formatFindingExplanation } from '../../src/cli/util/detection/finding-explanation.js';

const confirmedFinding = {
  id: 'exp_confirmed',
  status: 'CONFIRMED',
  classification: 'silent-failure:no-change',
  promise: { kind: 'click', value: 'Submit' },
  impact: 'HIGH',
  evidence: [{ type: 'screenshot', path: 'evidence/submit.png' }, { type: 'network-log', path: 'evidence/request.json' }],
  reason: 'No visible change after click'
};

const suspectedFinding = {
  id: 'exp_suspected',
  status: 'SUSPECTED',
  classification: 'unproven',
  promise: { kind: 'navigation', value: '/dashboard' },
  impact: 'MEDIUM',
  evidence: [],
  reason: 'Attempted navigation but no signals recorded'
};

describe('Finding Explanation Formatter', () => {
  test('adds required fields for CONFIRMED finding', () => {
    const formatted = formatFindingExplanation(confirmedFinding);
    assert.ok(formatted.expectedOutcome.includes('Clicking'));
    assert.ok(formatted.observedOutcome.includes('not observed'));
    assert.ok(formatted.evidenceSummary.includes('screenshot'));
    assert.ok(formatted.whyThisMatters.length > 0);
  });

  test('adds required fields for SUSPECTED finding with no evidence', () => {
    const formatted = formatFindingExplanation(suspectedFinding);
    assert.ok(formatted.expectedOutcome.includes('Navigating'));
    assert.ok(formatted.observedOutcome.includes('unproven'));
    assert.ok(formatted.evidenceSummary.includes('none'));
    assert.ok(formatted.whyThisMatters.includes('unknown'));
  });

  test('deterministic output for identical input', () => {
    const a = formatFindingExplanation(confirmedFinding);
    const b = formatFindingExplanation(confirmedFinding);
    assert.strictEqual(JSON.stringify(a), JSON.stringify(b));
  });
});




