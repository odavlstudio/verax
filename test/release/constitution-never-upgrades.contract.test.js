import { test } from 'node:test';
import assert from 'node:assert/strict';
import { batchValidateFindings } from '../../src/verax/detect/constitution-validator.js';

test('CONTRACT: constitution validator never upgrades SUSPECTED to CONFIRMED', () => {
  const finding = {
    id: 'f1',
    type: 'dead_interaction_silent_failure',
    status: 'SUSPECTED',
    severity: 'MEDIUM',
    confidence: 0.9,
    promise: { kind: 'click', value: 'x' },
    observed: { result: 'no effect' },
    evidence: {
      evidence_files: ['exp_1_before.png', 'exp_1_after.png', 'exp_1_dom_diff.json'],
      meaningfulDomChange: false,
    },
    impact: 'x',
  };

  const evidenceFileIndex = new Set(['exp_1_before.png', 'exp_1_after.png', 'exp_1_dom_diff.json']);
  const observeEvidenceByExpNum = new Map([[1, new Set(['exp_1_before.png', 'exp_1_after.png', 'exp_1_dom_diff.json'])]]);

  const { valid } = batchValidateFindings([finding], { evidenceFileIndex, observeEvidenceByExpNum });
  assert.equal(valid.length, 1);
  assert.equal(valid[0].status, 'SUSPECTED');
});

