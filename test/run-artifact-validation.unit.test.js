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

  writeJson(resolve(runDir, 'summary.json'), {
    runId: RUN_ID,
    status: 'COMPLETE',
    startedAt: '2024-01-01T00:00:00.000Z',
    completedAt: '2024-01-01T00:10:00.000Z',
    findingsCounts: { HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 },
  });

  writeJson(resolve(runDir, 'observe.json'), {
    observations: [],
    stats: { attempted: 0, observed: 0, notObserved: 0 },
  });

  writeJson(resolve(runDir, 'run.meta.json'), {
    contractVersion: 1,
    veraxVersion: '0.0.0',
    startedAt: '2024-01-01T00:00:00.000Z',
  });

  writeJson(resolve(runDir, 'run.status.json'), {
    status: 'COMPLETE',
    runId: RUN_ID,
    startedAt: '2024-01-01T00:00:00.000Z',
  });

  writeCompletionSentinel(runDir);

  const validation = validateRunDirectory(runDir);
  assert.strictEqual(validation.valid, false);
  assert.strictEqual(determineRunStatus(validation, 'COMPLETE'), 'INCOMPLETE');
  assert.strictEqual(validationExitCode(validation), 30);
});

test('findings count mismatch triggers validation failure', () => {
  const runDir = createRunDir();

  writeJson(resolve(runDir, 'summary.json'), {
    runId: RUN_ID,
    status: 'COMPLETE',
    startedAt: '2024-01-01T00:00:00.000Z',
    completedAt: '2024-01-01T00:10:00.000Z',
    findingsCounts: { HIGH: 1, MEDIUM: 0, LOW: 0, UNKNOWN: 0 },
  });

  writeJson(resolve(runDir, 'findings.json'), {
    contractVersion: 1,
    findings: [{ id: 'f-1' }],
    stats: { total: 0, silentFailures: 0, observed: 0, coverageGaps: 0, unproven: 0, informational: 0 },
  });

  writeJson(resolve(runDir, 'observe.json'), {
    observations: [],
    stats: { attempted: 0, observed: 0, notObserved: 0 },
  });

  writeJson(resolve(runDir, 'run.meta.json'), {
    contractVersion: 1,
    veraxVersion: '0.0.0',
    startedAt: '2024-01-01T00:00:00.000Z',
  });

  writeJson(resolve(runDir, 'run.status.json'), {
    status: 'COMPLETE',
    runId: RUN_ID,
    startedAt: '2024-01-01T00:00:00.000Z',
  });

  writeCompletionSentinel(runDir);

  const validation = validateRunDirectory(runDir);
  assert.strictEqual(validation.valid, false);
  assert.strictEqual(determineRunStatus(validation, 'COMPLETE'), 'FAIL_DATA');
  assert.strictEqual(validationExitCode(validation), 30);
});

test('valid artifacts pass validation', () => {
  const runDir = createRunDir();

  writeJson(resolve(runDir, 'summary.json'), {
    runId: RUN_ID,
    status: 'COMPLETE',
    startedAt: '2024-01-01T00:00:00.000Z',
    completedAt: '2024-01-01T00:10:00.000Z',
    findingsCounts: { HIGH: 1, MEDIUM: 0, LOW: 0, UNKNOWN: 0 },
  });

  writeJson(resolve(runDir, 'findings.json'), {
    contractVersion: 1,
    findings: [{ id: 'f-1' }],
    stats: { total: 1, silentFailures: 0, observed: 0, coverageGaps: 0, unproven: 0, informational: 0 },
  });

  writeJson(resolve(runDir, 'observe.json'), {
    observations: [],
    stats: { attempted: 0, observed: 0, notObserved: 0 },
  });

  writeJson(resolve(runDir, 'run.meta.json'), {
    contractVersion: 1,
    veraxVersion: '0.0.0',
    startedAt: '2024-01-01T00:00:00.000Z',
  });

  writeJson(resolve(runDir, 'run.status.json'), {
    status: 'COMPLETE',
    runId: RUN_ID,
    startedAt: '2024-01-01T00:00:00.000Z',
  });

  writeCompletionSentinel(runDir);

  const validation = validateRunDirectory(runDir);
  assert.strictEqual(validation.valid, true);
  assert.strictEqual(determineRunStatus(validation, 'COMPLETE'), 'COMPLETE');
  assert.strictEqual(validationExitCode(validation), 0);
});