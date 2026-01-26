import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve as _resolve } from 'path';
import { existsSync, readFileSync } from 'fs';
import { runCommand } from '../../src/cli/commands/run.js';

function readJson(p) {
  try { return JSON.parse(readFileSync(p, 'utf-8')); } catch { return null; }
}

// Smoke: two runs with same URL should not overwrite (same scanId, different runId)
test('run directories do not overwrite across consecutive runs', async () => {
  const projectRoot = process.cwd(); // eslint-disable-line no-unused-vars
  const out = '.verax';
  const url = 'https://example.com';

  const r1 = await runCommand({ url, src: '.', out, json: false, verbose: false, minCoverage: 0, ciMode: 'advisory' });
  assert.ok(r1 && r1.paths && r1.paths.baseDir, 'first run produced paths');
  const p1 = r1.paths.baseDir;
  assert.ok(existsSync(p1), 'first run directory exists');

  const r2 = await runCommand({ url, src: '.', out, json: false, verbose: false, minCoverage: 0, ciMode: 'advisory' });
  assert.ok(r2 && r2.paths && r2.paths.baseDir, 'second run produced paths');
  const p2 = r2.paths.baseDir;

  assert.notStrictEqual(p1, p2, 'run directories differ');
  assert.ok(existsSync(p2), 'second run directory exists');

  // Latest pointer exists under scanId
  const latestPtr = r2.paths.latestPointerJson;
  assert.ok(existsSync(latestPtr), 'latest.json pointer exists');
  const latest = readJson(latestPtr);
  const runId = r2.paths.baseDir.replace(/\\/g, '/').split('/').pop();
  assert.strictEqual(latest.runId, runId, 'latest points to last runId');
});

// Coverage enforcement: below threshold forces exit 30
// VERAX_TEST_MODE stub returns attempted=0, observed=0 so coverage ratio 0
// With minCoverage default 0.90, exit must be 30
test('coverage below threshold enforces exit 30', async () => {
  const url = 'https://example.com';
  const r = await runCommand({ url, src: '.', out: '.verax', json: false, verbose: false, minCoverage: 0.90, ciMode: 'balanced' });
  assert.strictEqual(r.exitCode, 30);
});

// Advisory mode: always exit 0 for findings; also when minCoverage=0, exit 0
test('advisory mode exits 0 or 30 depending on completeness', async () => {
  const url = 'https://example.com';
  const r = await runCommand({ url, src: '.', out: '.verax', json: false, verbose: false, minCoverage: 0, ciMode: 'advisory' });
  assert.ok([0,30].includes(r.exitCode));
});
