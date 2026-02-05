import { describe, test } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createDecisionSnapshot, writeDecisionSnapshot } from '../../src/cli/util/support/decision-snapshot.js';

function readSnapshot(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

describe('Decision Snapshot Artifact', () => {
  test('writes clean snapshot with defaults', () => {
    const baseDir = mkdtempSync(join(tmpdir(), 'verax-decision-clean-'));
    const runDir = join(baseDir, 'runs', 'run_clean');

    const { path: snapshotPath } = writeDecisionSnapshot({
      runId: 'run_clean',
      runDir,
      outDir: baseDir,
      exitCode: 0,
      counts: {},
      findings: [],
    });

    const snapshot = readSnapshot(snapshotPath);
    assert.strictEqual(snapshot.outcome, 'SUCCESS');
    assert.strictEqual(snapshot.exitCode, 0);
    assert.strictEqual(snapshot.runPath, 'runs/run_clean');
    assert.strictEqual(snapshot.counts.silentFailures, 0);
    assert.ok(Array.isArray(snapshot.actions));
    assert.strictEqual(snapshot.actions.length, 3);

    rmSync(baseDir, { recursive: true, force: true });
  });

  test('orders top findings deterministically', () => {
    const findings = [
      { id: 'exp_a', status: 'SUSPECTED', impact: 'MEDIUM', confidence: 0.8, promise: { kind: 'click', value: 'A' }, evidence: [{ path: 'evidence/a.png' }] },
      { id: 'exp_b', status: 'CONFIRMED', impact: 'LOW', confidence: 0.3, promise: { kind: 'click', value: 'B' }, evidence: [{ path: 'evidence/b.png' }] },
      { id: 'exp_c', status: 'UNKNOWN', impact: 'HIGH', confidence: 0.9, promise: { kind: 'navigate', value: '/home' }, evidence: [{ path: 'evidence/c.png' }] },
      { id: 'exp_d', status: 'OBSERVED', impact: 'HIGH', confidence: 0.2, promise: { kind: 'submit', value: 'form' }, evidence: [{ path: 'evidence/d.png' }] },
    ];

    const snapshot = createDecisionSnapshot({
      runId: 'run_findings',
      outDir: '/tmp/verax',
      exitCode: 20,
      counts: {},
      findings,
    });

    const orderedIds = snapshot.topFindings.map((f) => f.findingId);
    assert.deepStrictEqual(orderedIds, [
      'finding_exp_b',
      'finding_exp_a',
      'finding_exp_d',
      'finding_exp_c'
    ]);
  });

  test('is deterministic for identical inputs', () => {
    const input = {
      runId: 'run_repeat',
      outDir: '/tmp/verax',
      exitCode: 30,
      counts: {
        expectationsTotal: 5,
        attempted: 5,
        observed: 4,
        silentFailures: 1,
        coverageGaps: 0,
        unproven: 0,
        informational: 0,
      },
      findings: [
        { id: 'exp_z', status: 'SUSPECTED', impact: 'HIGH', confidence: 0.6, promise: { kind: 'click', value: 'Save' }, evidence: [{ path: 'evidence/save.png' }] },
      ],
    };

    const snapshotA = createDecisionSnapshot(input);
    const snapshotB = createDecisionSnapshot(input);

    assert.strictEqual(JSON.stringify(snapshotA), JSON.stringify(snapshotB));
  });
});




