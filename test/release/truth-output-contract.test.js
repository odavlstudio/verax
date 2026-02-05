/**
 * Truth-First Output Contract — Phase 2
 *
 * Verifies:
 * - summary.json always includes top-level keys: truth, observe, learn, detect, digest, meta
 * - CLI --json final line includes truth, digest, runId, url
 * - Digest is deterministic across repeated runs on the same input
 */

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import http from 'node:http';
import { resolveRunDir } from '../../src/cli/util/support/run-dir-resolver.js';
import { getTimeProvider } from '../../src/cli/util/support/time-provider.js';
import { createFixtureServer } from '../fixtures/serve-fixtures.fixture.js';

let server;
let SERVER_URL;

async function waitForServerReady(url, timeoutMs = 5000) {
  const deadline = getTimeProvider().now() + timeoutMs;
  return new Promise((resolveReady) => {
    const tryOnce = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 500) {
          resolveReady(true);
        } else {
          if (getTimeProvider().now() < deadline) setTimeout(tryOnce, 200);
          else resolveReady(false);
        }
      });
      req.on('error', () => {
        if (getTimeProvider().now() < deadline) setTimeout(tryOnce, 200);
        else resolveReady(false);
      });
    };
    tryOnce();
  });
}

before(async () => {
  server = createFixtureServer();
  await new Promise((resolveStart, rejectStart) => {
    try {
      server.listen(0, '127.0.0.1', () => resolveStart());
    } catch (e) {
      rejectStart(e);
    }
  });
  const port = server.address()?.port;
  SERVER_URL = `http://127.0.0.1:${port}`;
  const ready = await waitForServerReady(SERVER_URL, 8000);
  assert.equal(ready, true, 'Fixture server should become ready');
});

after(() => {
  try { server.close(); } catch (_err) { /* ignore */ }
});

function runVeraxJson(url) {
  const result = spawnSync('node', ['bin/verax.js', 'run', '--url', url, '--src', '.', '--json'], {
    cwd: process.cwd(),
    encoding: 'utf-8',
  });
  assert.ok([0,20,30].includes(result.status), `verax run should exit 0, 20, or 30; stderr=${result.stderr || ''}`);
  const lines = String(result.stdout || '').trim().split(/\r?\n/);
  const last = lines.filter(Boolean).pop();
  assert.ok(last && last.startsWith('{'), 'Final line should be JSON');
  return JSON.parse(last);
}

test('CLI --json includes truth, digest, runId, url', () => {
  const outcome = runVeraxJson(SERVER_URL);
  assert.ok(outcome.truth !== undefined, 'truth present');
  assert.ok(outcome.digest !== undefined, 'digest present');
  assert.ok(typeof outcome.runId === 'string' && outcome.runId.length > 0, 'runId present');
  assert.equal(outcome.url, SERVER_URL, 'url matches input');

  // Basic digest shape
  const d = outcome.digest || {};
  for (const key of ['expectationsTotal','attempted','observed','silentFailures','coverageGaps','unproven','informational']) {
    assert.ok(typeof d[key] === 'number', `digest.${key} is number`);
  }
});

test('summary.json has required top-level keys', () => {
  const outcome = runVeraxJson(SERVER_URL);
  const runDir = resolveRunDir(process.cwd(), outcome.runId);
  const summaryPath = join(runDir, 'summary.json');
  const summary = JSON.parse(String(readFileSync(summaryPath, 'utf-8')));

  for (const key of ['truth','observe','learn','detect','digest','meta']) {
    assert.ok(key in summary, `${key} exists in summary.json`);
  }

  // Observe schema minimal checks
  assert.ok(typeof summary.observe.expectationsTotal === 'number', 'observe.expectationsTotal number');
  assert.ok(typeof summary.observe.attempted === 'number', 'observe.attempted number');
  assert.ok(typeof summary.observe.observed === 'number', 'observe.observed number');
  assert.ok(typeof summary.observe.coverageRatio === 'number', 'observe.coverageRatio number');
  assert.ok(typeof summary.observe.unattemptedReasons === 'object', 'observe.unattemptedReasons object');
});

test('digest is deterministic across two runs', () => {
  const o1 = runVeraxJson(SERVER_URL);
  const d1Dir = resolveRunDir(process.cwd(), o1.runId);
  const s1 = JSON.parse(String(readFileSync(join(d1Dir, 'summary.json'), 'utf-8')));

  const o2 = runVeraxJson(SERVER_URL);
  const d2Dir = resolveRunDir(process.cwd(), o2.runId);
  const s2 = JSON.parse(String(readFileSync(join(d2Dir, 'summary.json'), 'utf-8')));

  assert.deepEqual(s1.digest, s2.digest, 'digest blocks should match across runs');
});
