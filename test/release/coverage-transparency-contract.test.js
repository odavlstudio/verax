import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

function runCliJson(url) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['bin/verax.js', 'run', '--url', url, '--src', '.', '--json'], { cwd: process.cwd() });
    let lastLine = '';
    child.stdout.on('data', (d) => {
      const s = d.toString();
      const parts = s.trim().split(/\n/);
      lastLine = parts[parts.length - 1];
    });
    child.on('error', reject);
    child.on('close', (code) => {
      try {
        const obj = JSON.parse(lastLine);
        resolve({ code, obj });
      } catch (e) {
        reject(new Error(`Failed to parse final JSON line: ${e.message}\nLastLine=${lastLine}`));
      }
    });
  });
}

function runCliHuman(url) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['bin/verax.js', 'run', '--url', url, '--src', '.'], { cwd: process.cwd() });
    let output = '';
    child.stdout.on('data', (d) => { output += d.toString(); });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, output }));
  });
}

const URL = 'http://127.0.0.1:3456';

test('INCOMPLETE run includes coverageSummary with correct counts', async () => {
  const { obj } = await runCliJson(URL);
  assert.ok(obj.truth, 'truth present');
  assert.equal(obj.truth.truthState, 'INCOMPLETE');
  assert.ok(obj.truth.coverageSummary, 'coverageSummary present');
  const cs = obj.truth.coverageSummary;
  assert.equal(typeof cs.expectationsTotal, 'number');
  assert.equal(typeof cs.attempted, 'number');
  assert.equal(typeof cs.observed, 'number');
  assert.equal(typeof cs.coverageRatio, 'number');
  assert.equal(typeof cs.threshold, 'number');
  assert.equal(cs.unattemptedCount, Math.max(0, cs.expectationsTotal - cs.attempted));
});

test('unattemptedBreakdown keys exist and are numbers', async () => {
  const { obj } = await runCliJson(URL);
  const breakdown = obj.truth.coverageSummary.unattemptedBreakdown;
  assert.equal(typeof breakdown, 'object');
  for (const [k, v] of Object.entries(breakdown)) {
    assert.equal(typeof v, 'number', `breakdown value for ${k} should be a number`);
  }
});

test('CLI human output contains NOT be treated as safe', async () => {
  const { output } = await runCliHuman(URL);
  assert.ok(output.toLowerCase().includes('not be treated as safe'));
});

test('Deterministic equality of coverageSummary across two identical runs', async () => {
  const a = await runCliJson(URL);
  const b = await runCliJson(URL);
  assert.deepEqual(a.obj.truth.coverageSummary, b.obj.truth.coverageSummary);
});
