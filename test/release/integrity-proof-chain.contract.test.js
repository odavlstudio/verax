import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { validateRunDirectory, validationExitCode } from '../../src/cli/util/run-artifact-validation.js';
import { EXIT_CODES } from '../../src/verax/shared/exit-codes.js';

function writeJson(path, obj) {
  writeFileSync(path, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function setupMinimalRunDir({ includeManifest, manifestPaths, findingEvidenceFiles, observeEvidenceFiles }) {
  const base = mkdtempSync(join(tmpdir(), 'verax-proof-chain-'));
  const runId = 'run_abc';
  const runDir = join(base, runId);
  mkdirSync(runDir, { recursive: true });
  mkdirSync(join(runDir, 'evidence'), { recursive: true });

  // Required sentinels
  writeFileSync(join(runDir, '.run-complete'), 'ok\n', 'utf8');
  writeFileSync(join(runDir, 'traces.jsonl'), JSON.stringify({ evt: 'x' }) + '\n', 'utf8');

  const startedAt = '2026-01-01T00:00:00.000Z';

  writeJson(join(runDir, 'run.status.json'), { contractVersion: 1, status: 'SUCCESS', runId, startedAt });
  writeJson(join(runDir, 'run.meta.json'), { contractVersion: 1, veraxVersion: '0.4.9', startedAt });
  writeJson(join(runDir, 'project.json'), { contractVersion: 1, framework: 'unknown', sourceRoot: '.' });

  writeJson(join(runDir, 'learn.json'), {
    contractVersion: 1,
    expectations: [],
    skipped: [],
    stats: {},
  });

  writeJson(join(runDir, 'observe.json'), {
    contractVersion: 1,
    observations: [
      {
        id: 'exp_1',
        attempted: true,
        observed: false,
        evidenceFiles: observeEvidenceFiles,
      }
    ],
    stats: { totalExpectations: 1, attempted: 1, completed: 0, observed: 0, notObserved: 1, skipped: 1, skippedReasons: {}, coverageRatio: 0 },
  });

  // Evidence files exist on disk (create deterministically small files).
  const allEvidence = new Set([...(findingEvidenceFiles || []), ...(observeEvidenceFiles || [])]);
  for (const f of allEvidence) {
    if (typeof f !== 'string' || f.length === 0) continue;
    const safe = f.replace(/\\/g, '/');
    if (safe.includes('..') || safe.startsWith('/') || /^[a-zA-Z]:\//.test(safe)) continue;
    writeFileSync(join(runDir, 'evidence', safe), Buffer.from([0]));
  }

  writeJson(join(runDir, 'findings.json'), {
    contractVersion: 1,
    findings: [
      {
        id: 'f1',
        type: 'dead_interaction_silent_failure',
        status: 'CONFIRMED',
        severity: 'MEDIUM',
        confidence: 0.9,
        promise: { kind: 'click', value: 'x' },
        observed: { result: 'no effect' },
        evidence: { evidence_files: findingEvidenceFiles },
        impact: 'x',
      }
    ],
    stats: { total: 1 },
  });

  writeJson(join(runDir, 'summary.json'), {
    contractVersion: 1,
    runId,
    status: 'SUCCESS',
    startedAt,
    findingsCounts: { HIGH: 0, MEDIUM: 1, LOW: 0, UNKNOWN: 0 },
  });

  if (includeManifest) {
    writeJson(join(runDir, 'integrity.manifest.json'), {
      manifestVersion: '6B-1',
      generatedAt: startedAt,
      artifactCount: Array.isArray(manifestPaths) ? manifestPaths.length : 0,
      artifacts: (manifestPaths || []).map((p) => ({ path: p, sha256: 'x', bytes: 1, kind: 'json' })),
    });
  }

  return { base, runDir };
}

test('CONTRACT: integrity.manifest.json must cover findings evidence refs (missing => invariant violation 50)', () => {
  const { base, runDir } = setupMinimalRunDir({
    includeManifest: true,
    manifestPaths: ['summary.json', 'findings.json'], // missing evidence/a.png
    findingEvidenceFiles: ['exp_1_before.png', 'exp_1_after.png'],
    observeEvidenceFiles: ['exp_1_before.png', 'exp_1_after.png'],
  });

  try {
    const validation = validateRunDirectory(runDir);
    assert.equal(validation.valid, false);
    const exit = validationExitCode(validation);
    assert.equal(exit, EXIT_CODES.INVARIANT_VIOLATION);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('CONTRACT: manifest coverage satisfied => run directory validates', () => {
  const { base, runDir } = setupMinimalRunDir({
    includeManifest: true,
    manifestPaths: ['summary.json', 'findings.json', 'evidence/exp_1_before.png', 'evidence/exp_1_after.png'],
    findingEvidenceFiles: ['exp_1_before.png', 'exp_1_after.png'],
    observeEvidenceFiles: ['exp_1_before.png', 'exp_1_after.png'],
  });

  try {
    const validation = validateRunDirectory(runDir);
    assert.equal(validation.valid, true);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('CONTRACT: CONFIRMED silent-failure evidence must be traceable to observe.json (otherwise invariant)', () => {
  const { base, runDir } = setupMinimalRunDir({
    includeManifest: false,
    manifestPaths: [],
    findingEvidenceFiles: ['exp_1_before.png'],
    observeEvidenceFiles: ['exp_1_after.png'], // mismatch
  });

  try {
    const validation = validateRunDirectory(runDir);
    assert.equal(validation.valid, false);
    const exit = validationExitCode(validation);
    assert.equal(exit, EXIT_CODES.INVARIANT_VIOLATION);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
