/**
 * Incident triage engine contract tests
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { generateTriage } from '../src/cli/util/triage/triage-engine.js';
import { DataError } from '../src/cli/util/support/errors.js';

function writeJson(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2));
}

function setupRun({ stabilityClassification = 'STABLE', includeStability = true, state = 'ANALYSIS_COMPLETE' } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'verax-triage-'));
  const runId = 'run-1';
  const runDir = resolve(root, '.verax', 'runs', runId);
  mkdirSync(runDir, { recursive: true });

  const summary = {
    meta: { version: '0.0.0-test', timestamp: '2026-01-14T11:08:27.704Z' },
    analysis: {
      state,
      analysisComplete: state === 'ANALYSIS_COMPLETE',
      expectationsDiscovered: 3,
      expectationsAnalyzed: 2,
      expectationsSkipped: 1,
      timeouts: { observeMs: 10, detectMs: 20, totalMs: 40 }
    },
    digest: { expectationsTotal: 3, attempted: 2, observed: 2, coverageGaps: 1 }
  };
  writeJson(resolve(runDir, 'summary.json'), summary);

  const traces = [
    {
      expectationId: 'exp-1',
      observed: true,
      evidence: {
        timing: { startedAt: '2026-01-14T11:00:00.000Z', endedAt: '2026-01-14T11:00:00.120Z' }
      }
    },
    {
      expectationId: 'exp-2',
      observed: true,
      evidence: {
        timing: { startedAt: '2026-01-14T11:00:01.000Z', endedAt: '2026-01-14T11:00:01.250Z' }
      }
    }
  ];
  writeJson(resolve(runDir, 'traces.json'), traces);

  const findings = [
    { id: 'f1', type: 'TEST', status: 'OPEN', confidence: 0.9 }
  ];
  writeJson(resolve(runDir, 'findings.json'), findings);

  const expectations = { expectations: [{ id: 'exp-1' }, { id: 'exp-2' }, { id: 'exp-3' }] };
  writeJson(resolve(runDir, 'expectations.json'), expectations);

  if (includeStability) {
    const stability = {
      classification: stabilityClassification,
      confidence: 0.72,
      findings: { signatureHash: 'abc123' }
    };
    writeJson(resolve(runDir, 'stability.json'), stability);
  }

  return { root, runId, runDir };
}

function stripGenerated(report) {
  const clone = JSON.parse(JSON.stringify(report));
  delete clone.meta.generatedAt;
  return clone;
}

test('generateTriage returns structured triage report', () => {
  const { root, runId } = setupRun();
  const triage = generateTriage(root, runId);

  assert.strictEqual(triage.meta.runId, runId);
  assert.strictEqual(triage.status.state, 'ANALYSIS_COMPLETE');
  assert.strictEqual(triage.coverage.expectations.discovered, 3);
  assert.strictEqual(triage.coverage.findings.total, 1);
  assert.strictEqual(triage.trust.level, 'TRUSTED');
  assert.ok(Array.isArray(triage.actionPlan));
  rmSync(root, { recursive: true, force: true });
});

test('generateTriage is deterministic aside from generatedAt', () => {
  const { root, runId } = setupRun();
  const first = stripGenerated(generateTriage(root, runId));
  const second = stripGenerated(generateTriage(root, runId));
  assert.deepStrictEqual(first, second);
  rmSync(root, { recursive: true, force: true });
});

test('generateTriage throws DataError when run is missing', () => {
  const root = mkdtempSync(join(tmpdir(), 'verax-triage-missing-'));
  assert.throws(() => generateTriage(root, 'nope'), DataError);
  rmSync(root, { recursive: true, force: true });
});

test('missing optional artifacts are reported but not fatal', () => {
  const { root, runId } = setupRun({ includeStability: false });
  const triage = generateTriage(root, runId);
  assert.ok(triage.missingInputs.includes('stability.json'));
  assert.strictEqual(triage.stability.classification, 'UNKNOWN');
  rmSync(root, { recursive: true, force: true });
});

test('unstable stability downgrades trust to UNTRUSTED', () => {
  const { root, runId } = setupRun({ stabilityClassification: 'UNSTABLE' });
  const triage = generateTriage(root, runId);
  assert.strictEqual(triage.trust.level, 'UNTRUSTED');
  assert.ok(triage.trust.reasons.includes('stability unstable'));
  rmSync(root, { recursive: true, force: true });
});
