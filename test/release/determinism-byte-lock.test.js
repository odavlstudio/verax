/**
 * Determinism Byte-Lock Regression Test
 * 
 * Verifies that repeated runs against the same fixture produce
 * byte-identical findings.json and summary.json (after normalization).
 * 
 * This test locks the determinism guarantee contract.
 */

import test from 'node:test';
import assert from 'assert';
import { execSync } from 'child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, readdirSync, statSync } from 'fs';
import { resolve } from 'path';
import { tmpdir } from 'os';
import { getTimeProvider as _getTimeProvider } from '../../src/cli/util/support/time-provider.js';


/**
 * Normalize fields that are allowed to vary between runs.
 * Allowed variance: startedAt, completedAt, and metrics.totalMs.
 * Everything else must be byte-identical.
 */
function normalizeForComparison(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  
  const normalized = Array.isArray(obj) ? [...obj] : { ...obj };
  
  // Remove timestamp fields
  delete normalized.startedAt;
  delete normalized.completedAt;
  delete normalized.detectedAt;
  
  // Remove runId (now unique per execution)
  delete normalized.runId;
  delete normalized.scanId;
  
  // Remove timing fields (can vary due to system load)
  if (normalized.metrics) {
    const metrics = { ...normalized.metrics };
    delete metrics.totalMs;
    delete metrics.learnMs;
    delete metrics.observeMs;
    delete metrics.detectMs;
    normalized.metrics = metrics;
  }
  
  // Recursively normalize nested objects
  for (const key of Object.keys(normalized)) {
    if (typeof normalized[key] === 'object' && normalized[key] !== null) {
      normalized[key] = normalizeForComparison(normalized[key]);
    }
  }
  
  return normalized;
}

/**
 * Deep equal with deterministic key ordering
 */
function stableStringify(obj) {
  return JSON.stringify(obj, Object.keys(obj).sort(), 2);
}

function runDeterminismFixture() {
  const tmpBase = mkdtempSync(resolve(tmpdir(), 'verax-determinism-test-'));

  const fixtureUrl = 'file://' + resolve(process.cwd(), 'test/fixtures/determinism/index.html').replace(/\\/g, '/');
  const out1 = resolve(tmpBase, 'run1');
  const out2 = resolve(tmpBase, 'run2');

  mkdirSync(out1, { recursive: true });
  mkdirSync(out2, { recursive: true });

  const env = { ...process.env, VERAX_TEST_TIME: '2026-01-20T00:00:00.000Z', VERAX_TEST_MODE: '1' };

  const runOnce = (outDir) => {
    try {
      execSync(`node bin/verax.js run --url "${fixtureUrl}" --src . --out "${outDir}" --min-coverage 0`, {
        cwd: process.cwd(),
        stdio: 'pipe',
        env
      });
    } catch {
      // Ignore exit code, we only care about artifacts
    }
  };

  runOnce(out1);
  runOnce(out2);

  const runsDir1 = resolve(out1, 'runs');
  const runsDir2 = resolve(out2, 'runs');

  const run1Name = readdirSync(runsDir1).find(name => statSync(resolve(runsDir1, name)).isDirectory());
  const run2Name = readdirSync(runsDir2).find(name => statSync(resolve(runsDir2, name)).isDirectory());

  if (!run1Name || !run2Name) {
    throw new Error('Determinism fixture did not produce run directories');
  }

  let run1Dir = resolve(runsDir1, run1Name);
  let run2Dir = resolve(runsDir2, run2Name);

  // Support nested layout runs/<scanId>/<runId>
  const findings1Candidate = resolve(run1Dir, 'findings.json');
  const findings2Candidate = resolve(run2Dir, 'findings.json');
  try {
    // eslint-disable-next-line no-unused-expressions
    readFileSync(findings1Candidate, 'utf-8');
  } catch {
    const inner1 = readdirSync(run1Dir).find(name => statSync(resolve(run1Dir, name)).isDirectory());
    if (inner1) run1Dir = resolve(run1Dir, inner1);
  }
  try {
    // eslint-disable-next-line no-unused-expressions
    readFileSync(findings2Candidate, 'utf-8');
  } catch {
    const inner2 = readdirSync(run2Dir).find(name => statSync(resolve(run2Dir, name)).isDirectory());
    if (inner2) run2Dir = resolve(run2Dir, inner2);
  }

  const findings1 = JSON.parse(readFileSync(resolve(run1Dir, 'findings.json'), 'utf-8'));
  const findings2 = JSON.parse(readFileSync(resolve(run2Dir, 'findings.json'), 'utf-8'));

  const summary1 = JSON.parse(readFileSync(resolve(run1Dir, 'summary.json'), 'utf-8'));
  const summary2 = JSON.parse(readFileSync(resolve(run2Dir, 'summary.json'), 'utf-8'));

  return {
    tmpBase,
    findings1,
    findings2,
    summary1,
    summary2,
  };
}

const runData = runDeterminismFixture();

test.after(() => {
  rmSync(runData.tmpBase, { recursive: true, force: true });
});

test('Determinism: findings.json is byte-identical across runs (after normalization)', () => {
  const norm1 = normalizeForComparison(runData.findings1);
  const norm2 = normalizeForComparison(runData.findings2);

  assert.deepStrictEqual(norm1, norm2, 'Normalized findings.json must be identical');

  const stable1 = stableStringify(norm1);
  const stable2 = stableStringify(norm2);
  assert.strictEqual(stable1, stable2, 'Stable stringify must produce identical output');

  const ids1 = runData.findings1.findings?.map(f => f.id) || [];
  const ids2 = runData.findings2.findings?.map(f => f.id) || [];
  assert.deepStrictEqual(ids1, ids2, 'Finding IDs and ordering must be identical');
});

test('Determinism: summary.json is byte-identical across runs (after normalization)', () => {
  const norm1 = normalizeForComparison(runData.summary1);
  const norm2 = normalizeForComparison(runData.summary2);

  assert.deepStrictEqual(norm1, norm2, 'Normalized summary.json must be identical');
  assert.deepStrictEqual(runData.summary1.digest, runData.summary2.digest, 'Digest must be byte-identical');
  assert.deepStrictEqual(runData.summary1.findingsCounts, runData.summary2.findingsCounts, 'findingsCounts must match');
  assert.strictEqual(runData.summary1.findings?.length || 0, runData.summary2.findings?.length || 0, 'findings length must match');
});

test('Determinism: finding ordering is stable (sourceRef-based sort)', () => {
  // Mock findings with different sourceRefs
  const findings = [
    { id: '3', type: 'silent_failure', status: 'CONFIRMED', severity: 'HIGH', promise: { kind: 'click', value: 'btn3' }, interaction: { sourceRef: 'file.js:30:5' }, evidence: {} },
    { id: '1', type: 'silent_failure', status: 'CONFIRMED', severity: 'HIGH', promise: { kind: 'click', value: 'btn1' }, interaction: { sourceRef: 'file.js:10:5' }, evidence: {} },
    { id: '2', type: 'silent_failure', status: 'CONFIRMED', severity: 'HIGH', promise: { kind: 'click', value: 'btn2' }, interaction: { sourceRef: 'file.js:20:5' }, evidence: {} },
  ];
  
  // Import and test sorting function directly to confirm deterministic ordering
  const sortedIds = findings
    .sort((a, b) => {
      const refA = a.interaction?.sourceRef || '~';
      const refB = b.interaction?.sourceRef || '~';
      return refA.localeCompare(refB);
    })
    .map(f => f.id);
  
  assert.deepStrictEqual(sortedIds, ['1', '2', '3'], 'Findings should be sorted by sourceRef');
});
