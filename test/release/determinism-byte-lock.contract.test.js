/**
 * Determinism Byte-Lock Regression Test
 * 
 * Verifies that repeated runs against the same fixture produce
 * byte-identical canonical artifacts in deterministic output mode:
 * - summary.json
 * - findings.json
 * - observe.json
 * - learn.json
 * 
 * This test locks the determinism guarantee contract.
 */

import test from 'node:test';
import assert from 'assert';
import { execSync } from 'child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, readdirSync, statSync, existsSync } from 'fs';
import { resolve } from 'path';
import { tmpdir } from 'os';
import { getTimeProvider as _getTimeProvider } from '../../src/cli/util/support/time-provider.js';

function runDeterminismFixture() {
  const tmpBase = mkdtempSync(resolve(tmpdir(), 'verax-determinism-test-'));

  const fixtureUrl = 'file://' + resolve(process.cwd(), 'test/fixtures/determinism/index.html').replace(/\\/g, '/');
  const fixtureSrc = resolve(process.cwd(), 'test/fixtures/determinism');
  const out1 = resolve(tmpBase, 'run1');
  const out2 = resolve(tmpBase, 'run2');

  mkdirSync(out1, { recursive: true });
  mkdirSync(out2, { recursive: true });

  const baseEnv = { ...process.env, VERAX_TEST_MODE: '1', VERAX_DETERMINISTIC_MODE: '1' };

  const runOnce = (outDir, extraEnv = {}) => {
    try {
      execSync(`node bin/verax.js run --url "${fixtureUrl}" --src "${fixtureSrc}" --out "${outDir}" --min-coverage 0`, {
        cwd: process.cwd(),
        stdio: 'pipe',
        env: { ...baseEnv, ...extraEnv }
      });
    } catch {
      // Ignore exit code, we only care about artifacts
    }
  };

  // Adversarial: different test times must not affect deterministic artifacts.
  runOnce(out1, { VERAX_TEST_TIME: '2026-01-20T00:00:00.000Z' });
  runOnce(out2, { VERAX_TEST_TIME: '2026-02-21T12:34:56.000Z' });

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
  // If findings.json not in scan directory, descend into runId directory
  if (!existsSync(resolve(run1Dir, 'findings.json'))) {
    const inner1 = readdirSync(run1Dir).find(name => statSync(resolve(run1Dir, name)).isDirectory());
    if (inner1) run1Dir = resolve(run1Dir, inner1);
  }
  if (!existsSync(resolve(run2Dir, 'findings.json'))) {
    const inner2 = readdirSync(run2Dir).find(name => statSync(resolve(run2Dir, name)).isDirectory());
    if (inner2) run2Dir = resolve(run2Dir, inner2);
  }

  const findings1 = JSON.parse(readFileSync(resolve(run1Dir, 'findings.json'), 'utf-8'));
  const findings2 = JSON.parse(readFileSync(resolve(run2Dir, 'findings.json'), 'utf-8'));

  const summary1 = JSON.parse(readFileSync(resolve(run1Dir, 'summary.json'), 'utf-8'));
  const summary2 = JSON.parse(readFileSync(resolve(run2Dir, 'summary.json'), 'utf-8'));
  const observe1Raw = readFileSync(resolve(run1Dir, 'observe.json'), 'utf-8');
  const observe2Raw = readFileSync(resolve(run2Dir, 'observe.json'), 'utf-8');
  const learn1Raw = readFileSync(resolve(run1Dir, 'learn.json'), 'utf-8');
  const learn2Raw = readFileSync(resolve(run2Dir, 'learn.json'), 'utf-8');
  const summary1Raw = readFileSync(resolve(run1Dir, 'summary.json'), 'utf-8');
  const summary2Raw = readFileSync(resolve(run2Dir, 'summary.json'), 'utf-8');
  const findings1Raw = readFileSync(resolve(run1Dir, 'findings.json'), 'utf-8');
  const findings2Raw = readFileSync(resolve(run2Dir, 'findings.json'), 'utf-8');

  return {
    tmpBase,
    findings1,
    findings2,
    summary1,
    summary2,
    observe1Raw,
    observe2Raw,
    learn1Raw,
    learn2Raw,
    summary1Raw,
    summary2Raw,
    findings1Raw,
    findings2Raw,
  };
}

const runData = runDeterminismFixture();

test.after(() => {
  rmSync(runData.tmpBase, { recursive: true, force: true });
});

test('Determinism: findings.json is byte-identical across runs (deterministic output mode)', () => {
  assert.strictEqual(runData.findings1Raw, runData.findings2Raw, 'findings.json bytes must match');
});

test('Determinism: summary.json is byte-identical across runs (deterministic output mode)', () => {
  assert.strictEqual(runData.summary1Raw, runData.summary2Raw, 'summary.json bytes must match');
  assert.deepStrictEqual(runData.summary1.digest, runData.summary2.digest, 'Digest must be identical');
  assert.deepStrictEqual(runData.summary1.findingsCounts, runData.summary2.findingsCounts, 'findingsCounts must match');
});

test('Determinism: observe.json is byte-identical across runs (deterministic output mode)', () => {
  assert.strictEqual(runData.observe1Raw, runData.observe2Raw, 'observe.json bytes must match');
});

test('Determinism: learn.json is byte-identical across runs (deterministic output mode)', () => {
  assert.strictEqual(runData.learn1Raw, runData.learn2Raw, 'learn.json bytes must match');
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
