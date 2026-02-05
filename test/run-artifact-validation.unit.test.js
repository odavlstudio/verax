import test from 'node:test';
import assert from 'node:assert';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import * as supportAtomic from '../src/cli/util/support/atomic-write.js';
import { writeCompletionSentinel } from '../src/cli/util/run-completion-sentinel.js';
import { validateRunDirectory, determineRunStatus, validationExitCode } from '../src/cli/util/run-artifact-validation.js';

const RUN_ID = 'run-abc123';

function createRunDir() {
  const base = mkdtempSync(join(tmpdir(), 'verax-run-'));
  const runDir = join(base, RUN_ID);
  mkdirSync(runDir, { recursive: true });
  return runDir;
}

function writeJson(filePath, data) {
  supportAtomic.atomicWriteJson(filePath, data);
}

function writeRequiredArtifacts(runDir, { includeFindings = true, findingsStatsTotal = 0, findingsCounts = { HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 } } = {}) {
  // Required: summary.json
  writeJson(resolve(runDir, 'summary.json'), {
    runId: RUN_ID,
    status: 'SUCCESS',
    startedAt: '2024-01-01T00:00:00.000Z',
    completedAt: '2024-01-01T00:10:00.000Z',
    findingsCounts,
  });

  // Required: findings.json
  if (includeFindings) {
    writeJson(resolve(runDir, 'findings.json'), {
      contractVersion: 1,
      findings: findingsStatsTotal > 0 ? [{ id: 'f-1' }] : [],
      stats: { total: findingsStatsTotal, silentFailures: 0, observed: 0, coverageGaps: 0, unproven: 0, informational: 0 },
    });
  }

  // Required: observe.json
  writeJson(resolve(runDir, 'observe.json'), {
    contractVersion: 1,
    observations: [],
    stats: { attempted: 0, observed: 0, notObserved: 0 },
  });

  // Required: learn.json
  writeJson(resolve(runDir, 'learn.json'), {
    contractVersion: 1,
    expectations: [],
    stats: { extractionVersion: '1.0', totalExpectations: 0, byType: { navigation: 0, network: 0, state: 0, feedback: 0 } },
    skipped: { total: 0 },
  });

  // Required: project.json
  writeJson(resolve(runDir, 'project.json'), {
    contractVersion: 1,
    framework: 'unknown',
    sourceRoot: '.',
  });

  // Required: run.meta.json
  writeJson(resolve(runDir, 'run.meta.json'), {
    contractVersion: 1,
    veraxVersion: '0.0.0',
    startedAt: '2024-01-01T00:00:00.000Z',
  });

  // Required: run.status.json
  writeJson(resolve(runDir, 'run.status.json'), {
    contractVersion: 1,
    status: 'SUCCESS',
    runId: RUN_ID,
    startedAt: '2024-01-01T00:00:00.000Z',
  });

  // Required: traces.jsonl
  supportAtomic.atomicWriteText(resolve(runDir, 'traces.jsonl'), '{"type":"trace"}\n');

  // Required: evidence/ directory
  mkdirSync(resolve(runDir, 'evidence'), { recursive: true });

  // Required: completion sentinel
  writeCompletionSentinel(runDir);
}

test('atomic writes persist files without leaving temp artifacts', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'verax-atomic-'));
  const jsonPath = join(tempDir, 'atomic-test.json');
  const textPath = join(tempDir, 'atomic-test.txt');

  // Precreate files to ensure replacement works
  supportAtomic.atomicWriteText(jsonPath, 'old');
  supportAtomic.atomicWriteText(textPath, 'old');

  supportAtomic.atomicWriteJson(jsonPath, { ok: true });
  supportAtomic.atomicWriteText(textPath, 'hello');

  const jsonContent = JSON.parse(readFileSync(jsonPath, 'utf-8'));
  const textContent = readFileSync(textPath, 'utf-8');
  const tempFiles = readdirSync(tempDir).filter((name) => name.includes('.tmp'));

  assert.deepStrictEqual(jsonContent, { ok: true });
  assert.strictEqual(textContent, 'hello');
  assert.strictEqual(tempFiles.length, 0);
});

test('missing findings.json marks run incomplete with exit 30', () => {
  const runDir = createRunDir();

  writeRequiredArtifacts(runDir, { includeFindings: false });

  const validation = validateRunDirectory(runDir);
  assert.strictEqual(validation.valid, false);
  assert.strictEqual(determineRunStatus(validation, 'SUCCESS'), 'INCOMPLETE');
  assert.strictEqual(validationExitCode(validation), 30);
});

test('findings count mismatch triggers validation failure', () => {
  const runDir = createRunDir();

  writeRequiredArtifacts(runDir, { includeFindings: true, findingsStatsTotal: 0, findingsCounts: { HIGH: 1, MEDIUM: 0, LOW: 0, UNKNOWN: 0 } });

  const validation = validateRunDirectory(runDir);
  assert.strictEqual(validation.valid, false);
  assert.strictEqual(determineRunStatus(validation, 'SUCCESS'), 'INCOMPLETE');
  assert.strictEqual(validationExitCode(validation), 30);
});

test('valid artifacts pass validation', () => {
  const runDir = createRunDir();

  writeRequiredArtifacts(runDir, { includeFindings: true, findingsStatsTotal: 1, findingsCounts: { HIGH: 1, MEDIUM: 0, LOW: 0, UNKNOWN: 0 } });

  const validation = validateRunDirectory(runDir);
  assert.strictEqual(validation.valid, true);
  assert.strictEqual(determineRunStatus(validation, 'SUCCESS'), 'SUCCESS');
  assert.strictEqual(validationExitCode(validation), 0);
});

test('missing OPTIONAL artifacts does not fail validation', () => {
  const runDir = createRunDir();
  writeRequiredArtifacts(runDir, { includeFindings: true, findingsStatsTotal: 0 });

  // Deliberately omit optional verax-summary.md / judgments.json / coverage.json / run-manifest.json
  const validation = validateRunDirectory(runDir);
  assert.strictEqual(validation.valid, true);
  assert.ok(validation.warnings.length > 0, 'should warn on missing optional artifacts');
  assert.ok(validation.warnings.some(w => String(w.message).includes('Optional artifact missing')), 'should include optional missing warning');
});
