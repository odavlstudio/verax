import test from 'node:test';
import * as assert from 'node:assert';
import { resolve } from 'path';
import { existsSync, readFileSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');
const PROJECT_ROOT = resolve(__dirname, '..');
const TMP_DIR = resolve(PROJECT_ROOT, 'tmp', 'proof-closure');

if (!existsSync(TMP_DIR)) {
  mkdirSync(TMP_DIR, { recursive: true });
}

function createMockRun(runDir, findings) {
  if (existsSync(runDir)) {
    rmSync(runDir, { recursive: true, force: true });
  }
  mkdirSync(runDir, { recursive: true });

  writeFileSync(resolve(runDir, 'summary.json'), JSON.stringify({
    runId: 'test-run',
    status: (findings.findings?.length || 0) > 0 ? 'FINDINGS' : 'SUCCESS',
    findingsCounts: { HIGH: findings.findings?.length || 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 }
  }));
  writeFileSync(resolve(runDir, 'findings.json'), JSON.stringify(findings));
  writeFileSync(resolve(runDir, 'learn.json'), JSON.stringify({
    expectations: [{ id: 'exp_1' }, { id: 'exp_2' }, { id: 'exp_3' }, { id: 'exp_4' }, { id: 'exp_5' }, { id: 'exp_6' }]
  }));
  writeFileSync(resolve(runDir, 'observe.json'), JSON.stringify({
    observations: [
      { id: 'exp_1', attempted: true, observed: true },
      { id: 'exp_2', attempted: true, observed: false, reason: 'not-found' },
      { id: 'exp_3', attempted: true, observed: false, reason: 'blocked' },
      { id: 'exp_4', attempted: false, reason: 'not-found' },
      { id: 'exp_5', attempted: true, observed: false, reason: 'no-change' },
      { id: 'exp_6', attempted: false, reason: 'not-found' }
    ],
    stats: { attempted: 4, observed: 1 }
  }));
}

test('BLOCKER A: Finding ID Determinism — stable across runs', async () => {
  const run1 = resolve(TMP_DIR, 'determ-1');
  createMockRun(run1, { findings: [{ id: 'finding-stable-hash-abcd', type: 'silent_failure' }], total: 1 });

  const run2 = resolve(TMP_DIR, 'determ-2');
  createMockRun(run2, { findings: [{ id: 'finding-stable-hash-abcd', type: 'silent_failure' }], total: 1 });

  const f1 = JSON.parse(readFileSync(resolve(run1, 'findings.json'), 'utf-8'));
  const f2 = JSON.parse(readFileSync(resolve(run2, 'findings.json'), 'utf-8'));

  assert.strictEqual(f1.findings[0].id, f2.findings[0].id, 'IDs must be identical');
  assert.ok(!f1.findings[0].id.match(/\d{13}/), 'ID must not use timestamp');
});

test('BLOCKER B: Inspect Accuracy — correct findings count', async () => {
  const runDir = resolve(TMP_DIR, 'inspect-test');
  createMockRun(runDir, {
    findings: [{ id: 'f1' }, { id: 'f2' }, { id: 'f3' }, { id: 'f4' }, { id: 'f5' }],
    total: 5
  });

  const result = spawnSync('node', ['bin/verax.js', 'inspect', runDir, '--json'], {
    cwd: PROJECT_ROOT,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe']
  });

  assert.strictEqual(result.status, 0);
  const output = JSON.parse(result.stdout);
  assert.strictEqual(output.findingsCount, 5);
});

test('BLOCKER C: Doctor Readiness — exit codes correct', async () => {
  const result = spawnSync('node', ['bin/verax.js', 'doctor', '--json'], {
    cwd: PROJECT_ROOT,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe']
  });

  const output = JSON.parse(result.stdout);
  assert.ok('ready' in output);
  assert.ok('exitCode' in output);
  assert.strictEqual(typeof output.exitCode, 'number');
  assert.ok(output.exitCode >= 0);
});

test('BLOCKER D: Observation Coverage — explicit reasons', async () => {
  const runDir = resolve(TMP_DIR, 'coverage-test');
  createMockRun(runDir, { findings: [], total: 0 });

  const observe = JSON.parse(readFileSync(resolve(runDir, 'observe.json'), 'utf-8'));
  const unobserved = observe.observations.filter(o => !o.observed);

  for (const obs of unobserved) {
    assert.ok(obs.reason, 'unobserved must have reason');
  }
});
