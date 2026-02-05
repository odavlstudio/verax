import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFinding } from '../../src/verax/detect/finding-contract.js';
import { batchValidateFindings, validateFindingConstitution, applyValidationResult } from '../../src/verax/detect/constitution-validator.js';

const SILENT_FAILURE_TYPES = [
  'dead_interaction_silent_failure',
  'broken_navigation_promise',
  'silent_submission',
];

function mkFinding(type, evidence) {
  return createFinding({
    id: `test-${type}`,
    type,
    status: 'CONFIRMED',
    severity: 'HIGH',
    confidence: 0.8,
    promise: { kind: 'test', value: 'x' },
    observed: { result: 'y' },
    evidence,
    impact: 'Test',
  });
}

function assertNoForbiddenKeys(obj) {
  const json = JSON.stringify(obj);
  const forbidden = ['selector', 'html', 'dom', 'screenshot', 'trace', 'har', 'networkLog', 'networkLogs'];
  for (const key of forbidden) {
    assert.ok(!json.toLowerCase().includes(key.toLowerCase()), `must not include forbidden key "${key}"`);
  }
  assert.ok(json.length < 4000, 'record must be small');
}

test('CONTRACT: silent-failure types cannot remain CONFIRMED with weak/empty strong evidence', () => {
  const weakEvidence = {
    // Adversarial: includes common boolean keys but no strong artifacts/signals.
    navigation_changed: false,
    meaningful_dom_change: false,
    feedback_seen: false,
    network_activity: false,
    // Weak-only signals:
    console_errors: true,
    blocked_writes: true,
    // Screenshots only are explicitly not a strong category.
    evidence_files: ['exp_1_before.png', 'exp_1_after.png'],
  };

  const findings = SILENT_FAILURE_TYPES.map((t) => mkFinding(t, weakEvidence));
  const { valid } = batchValidateFindings(findings);

  assert.equal(valid.length, SILENT_FAILURE_TYPES.length, 'downgraded findings must remain present');

  for (const f of valid) {
    assert.notEqual(f.status, 'CONFIRMED', `${f.type} must not remain CONFIRMED`);
    assert.equal(f.status, 'SUSPECTED', `${f.type} must downgrade to SUSPECTED`);
    assert.ok(Array.isArray(f.enrichment?.evidenceLawDowngradeReasons), 'must include downgrade reason array');
    assert.ok(f.enrichment.evidenceLawDowngradeReasons.includes('missing_strong_evidence'), 'must include missing_strong_evidence');
    assertNoForbiddenKeys(f.enrichment.evidenceLawDowngradeReasons);
  }
});

test('CONTRACT: silent-failure types stay CONFIRMED when dom_diff artifact exists (meaningful_dom category present)', () => {
  const strongEvidence = {
    // Strong via meaningful_dom: dom diff file present (can still represent "no change" findings).
    evidence_files: ['exp_1_before.png', 'exp_1_after.png', 'exp_1_dom_diff.json'],
    meaningful_dom_change: false,
    navigation_changed: false,
    feedback_seen: false,
    network_activity: false,
  };

  const findings = SILENT_FAILURE_TYPES.map((t) => mkFinding(t, strongEvidence));
  const { valid } = batchValidateFindings(findings);
  assert.equal(valid.length, SILENT_FAILURE_TYPES.length);
  valid.forEach((f) => {
    assert.equal(f.status, 'CONFIRMED', `${f.type} must remain CONFIRMED with strong evidence`);
  });
});

test('ADVERSARIAL: validateFindingConstitution blocks CONFIRMED silent_submission with only screenshots', () => {
  const finding = mkFinding('silent_submission', {
    evidence_files: ['exp_1_before.png', 'exp_1_after.png'],
    meaningful_dom_change: false,
    navigation_changed: false,
    feedback_seen: false,
    network_activity: false,
  });

  const result = validateFindingConstitution(finding);
  assert.equal(result.valid, false);
  assert.equal(result.action, 'DOWNGRADE');

  const sanitized = applyValidationResult(finding, result);
  assert.ok(sanitized, 'must not drop');
  assert.equal(sanitized.status, 'SUSPECTED');
  assert.ok(sanitized.enrichment?.evidenceLawDowngradeReasons?.includes('missing_strong_evidence'));
  assertNoForbiddenKeys(sanitized.enrichment?.evidenceLawDowngradeReasons || []);
});

