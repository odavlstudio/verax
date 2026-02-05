import { test } from 'node:test';
import assert from 'node:assert/strict';
import { batchValidateFindings } from '../../src/verax/detect/constitution-validator.js';

test('CONTRACT: if observe mapping cannot prove evidence linkage, CONFIRMED silent-failure is downgraded', () => {
  const finding = {
    id: 'f1',
    type: 'dead_interaction_silent_failure',
    status: 'CONFIRMED',
    severity: 'MEDIUM',
    confidence: 0.9,
    promise: { kind: 'click', value: 'x' },
    observed: { result: 'no effect' },
    evidence: { evidence_files: ['exp_1_before.png', 'exp_1_after.png', 'exp_1_dom_diff.json'] },
    impact: 'x',
  };

  // Observe evidence map does NOT include exp_1_before.png, so linkage cannot be proven.
  const observeEvidenceByExpNum = new Map([[1, new Set(['exp_1_after.png', 'exp_1_dom_diff.json'])]]);
  const evidenceFileIndex = new Set(['exp_1_before.png', 'exp_1_after.png', 'exp_1_dom_diff.json']);

  const { valid, downgraded } = batchValidateFindings([finding], { evidenceFileIndex, observeEvidenceByExpNum });
  assert.equal(downgraded, 1);
  assert.equal(valid.length, 1);
  assert.equal(valid[0].status, 'SUSPECTED');
  assert.ok(Array.isArray(valid[0]?.enrichment?.evidenceCrossArtifactNotes));
  assert.ok(valid[0].enrichment.evidenceCrossArtifactNotes.includes('evidence_not_in_observation'));
});
