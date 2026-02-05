import { test } from 'node:test';
import assert from 'node:assert/strict';
import { batchValidateFindings } from '../../src/verax/detect/constitution-validator.js';

function makeConfirmedSilentFailureFinding({ evidenceFiles }) {
  return {
    id: 'exp_1',
    type: 'dead_interaction_silent_failure',
    status: 'CONFIRMED',
    severity: 'MEDIUM',
    confidence: 0.9,
    promise: { kind: 'click', value: 'Test button' },
    observed: { result: 'no visible effect' },
    evidence: {
      evidence_files: evidenceFiles,
      // Keep within Evidence Law v2 expectations: dom_diff evidence is inferred from evidence_files name.
      meaningfulDomChange: false,
    },
    impact: 'Click produced no user-visible response',
    enrichment: { existing: true },
  };
}

test('CONTRACT: missing evidence file downgrades CONFIRMED silent-failure finding', () => {
  const finding = makeConfirmedSilentFailureFinding({
    evidenceFiles: [
      'exp_1_before.png',
      'exp_1_after.png',
      'exp_1_dom_diff.json', // referenced but missing from index
    ],
  });

  const evidenceFileIndex = new Set([
    'exp_1_before.png',
    'exp_1_after.png',
    // dom_diff intentionally missing
  ]);

  const { valid, downgraded, dropped } = batchValidateFindings([finding], { evidenceFileIndex });
  assert.equal(dropped, 0);
  assert.equal(downgraded, 1);
  assert.equal(valid.length, 1);
  assert.equal(valid[0].status, 'SUSPECTED');

  const reasons = valid[0]?.enrichment?.evidenceFileLawDowngradeReasons;
  assert.ok(Array.isArray(reasons), 'must include evidenceFileLawDowngradeReasons array');
  assert.ok(reasons.includes('evidence_file_missing'), 'must include evidence_file_missing');
  assert.ok(valid[0].enrichment.existing, 'must not clobber existing enrichment');
});

test('CONTRACT: present evidence files keep CONFIRMED silent-failure finding', () => {
  const finding = makeConfirmedSilentFailureFinding({
    evidenceFiles: [
      'exp_1_before.png',
      'exp_1_after.png',
      'exp_1_dom_diff.json',
    ],
  });

  const evidenceFileIndex = new Set([
    'exp_1_before.png',
    'exp_1_after.png',
    'exp_1_dom_diff.json',
  ]);

  const { valid, downgraded, dropped } = batchValidateFindings([finding], { evidenceFileIndex });
  assert.equal(dropped, 0);
  assert.equal(downgraded, 0);
  assert.equal(valid.length, 1);
  assert.equal(valid[0].status, 'CONFIRMED');
});

