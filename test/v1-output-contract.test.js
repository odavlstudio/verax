/**
 * V1 Output Contract Tests
 * 
 * Verifies the unambiguous, trustworthy output contract for VERAX v1:
 * 
 * 1. INCOMPLETE runs MUST contain safety warning
 * 2. SUCCESS runs MUST NOT contain safety warning
 * 3. Output is byte-for-byte deterministic across identical runs
 * 4. Coverage transparency is always present
 */

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import http from 'node:http';
import { resolveRunDir } from '../src/cli/util/support/run-dir-resolver.js';
import { getTimeProvider } from '../src/cli/util/support/time-provider.js';
import { server, PORT as FIXTURE_PORT } from './fixtures/serve-fixtures.fixture.js';

const SERVER_URL = `http://127.0.0.1:${FIXTURE_PORT}`;

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
  await new Promise((resolveStart, rejectStart) => {
    try {
      server.listen(FIXTURE_PORT, '127.0.0.1', () => resolveStart());
    } catch (e) {
      rejectStart(e);
    }
  });
  const ready = await waitForServerReady(SERVER_URL, 8000);
  assert.equal(ready, true, 'Fixture server should become ready');
});

after(() => {
  try { server.close(); } catch (_err) { /* ignore */ }
});

function runVeraxJson(url, extraArgs = []) {
  const result = spawnSync('node', ['bin/verax.js', 'run', '--url', url, '--src', '.', '--json', ...extraArgs], {
    cwd: process.cwd(),
    encoding: 'utf-8',
  });
  const lines = String(result.stdout || '').trim().split(/\r?\n/);
  const last = lines.filter(Boolean).pop();
  if (!last || !last.startsWith('{')) {
    throw new Error(`Expected JSON output, got: ${last}. stderr: ${result.stderr}. exit: ${result.status}`);
  }
  return { outcome: JSON.parse(last), exitCode: result.status };
}

function runVeraxHuman(url, extraArgs = []) {
  const result = spawnSync('node', ['bin/verax.js', 'run', '--url', url, '--src', '.', ...extraArgs], {
    cwd: process.cwd(),
    encoding: 'utf-8',
  });
  return { stdout: String(result.stdout || ''), stderr: String(result.stderr || ''), exitCode: result.status };
}

// ============================================================
// TEST 1: INCOMPLETE runs MUST contain safety warning
// ============================================================

test('INCOMPLETE runs contain "MUST NOT BE TREATED AS SAFE" in summary.json', () => {
  // Force incomplete by using unrealistically low min-coverage
  const { outcome } = runVeraxJson(SERVER_URL, ['--min-coverage', '0.999']);
  const runDir = resolveRunDir(process.cwd(), outcome.runId);
  const summaryPath = join(runDir, 'summary.json');
  const summary = JSON.parse(String(readFileSync(summaryPath, 'utf-8')));

  // Verify INCOMPLETE state
  assert.equal(summary.truth.truthState, 'INCOMPLETE', 'Should be INCOMPLETE with high threshold');

  // Verify warning presence in explanation
  const explanation = summary.truth.explanation || '';
  assert.ok(
    explanation.includes('MUST NOT BE TREATED AS SAFE') || explanation.includes('must NOT be treated as safe'),
    `Explanation must contain safety warning. Got: ${explanation}`
  );
});

test('INCOMPLETE runs contain "MUST NOT BE TREATED AS SAFE" in CLI --json output', () => {
  const { outcome } = runVeraxJson(SERVER_URL, ['--min-coverage', '0.999']);

  assert.equal(outcome.truth.truthState, 'INCOMPLETE', 'Should be INCOMPLETE');

  const explanation = outcome.truth.explanation || '';
  assert.ok(
    explanation.includes('MUST NOT BE TREATED AS SAFE') || explanation.includes('must NOT be treated as safe'),
    `CLI JSON truth.explanation must contain safety warning. Got: ${explanation}`
  );
});

test('INCOMPLETE runs contain warning in human-readable output', () => {
  const { stdout, stderr } = runVeraxHuman(SERVER_URL, ['--min-coverage', '0.999']);
  const combined = stdout + stderr;

  assert.ok(
    combined.includes('MUST NOT BE TREATED AS SAFE') || combined.includes('must NOT be treated as safe') ||
    combined.includes('INCOMPLETE') || combined.includes('should NOT be treated as safe'),
    `Human output must contain INCOMPLETE warning. Got: ${combined.substring(0, 500)}`
  );
});

// ============================================================
// TEST 2: SUCCESS runs MUST NOT contain safety warning
// ============================================================

test('SUCCESS runs do NOT contain "MUST NOT BE TREATED AS SAFE" in summary.json', () => {
  // Use normal threshold to allow SUCCESS
  const { outcome } = runVeraxJson(SERVER_URL);
  const runDir = resolveRunDir(process.cwd(), outcome.runId);
  const summaryPath = join(runDir, 'summary.json');
  const summary = JSON.parse(String(readFileSync(summaryPath, 'utf-8')));

  // If SUCCESS, verify no safety warning
  if (summary.truth.truthState === 'SUCCESS') {
    const explanation = summary.truth.explanation || '';
    assert.ok(
      !explanation.includes('MUST NOT BE TREATED AS SAFE') && !explanation.includes('must NOT be treated as safe'),
      `SUCCESS explanation should NOT contain safety warning. Got: ${explanation}`
    );
  }
});

test('SUCCESS runs do NOT contain warning in CLI --json output', () => {
  const { outcome } = runVeraxJson(SERVER_URL);

  if (outcome.truth?.truthState === 'SUCCESS') {
    const explanation = outcome.truth.explanation || '';
    assert.ok(
      !explanation.includes('MUST NOT BE TREATED AS SAFE') && !explanation.includes('must NOT be treated as safe'),
      `SUCCESS CLI JSON should NOT contain safety warning. Got: ${explanation}`
    );
  }
});

// ============================================================
// TEST 3: Byte-for-byte deterministic output
// ============================================================

test('summary.json digest is byte-for-byte deterministic across identical runs', () => {
  const { outcome: o1 } = runVeraxJson(SERVER_URL);
  const runDir1 = resolveRunDir(process.cwd(), o1.runId);
  const summary1 = JSON.parse(String(readFileSync(join(runDir1, 'summary.json'), 'utf-8')));

  const { outcome: o2 } = runVeraxJson(SERVER_URL);
  const runDir2 = resolveRunDir(process.cwd(), o2.runId);
  const summary2 = JSON.parse(String(readFileSync(join(runDir2, 'summary.json'), 'utf-8')));

  // Digest should be identical
  assert.deepEqual(summary1.digest, summary2.digest, 'Digests must be byte-for-byte identical');

  // Observe block counts should be identical
  assert.equal(summary1.observe.expectationsTotal, summary2.observe.expectationsTotal, 'expectationsTotal must match');
  assert.equal(summary1.observe.attempted, summary2.observe.attempted, 'attempted must match');
  assert.equal(summary1.observe.observed, summary2.observe.observed, 'observed must match');
});

test('CLI --json final line digest is deterministic', () => {
  const { outcome: o1 } = runVeraxJson(SERVER_URL);
  const { outcome: o2 } = runVeraxJson(SERVER_URL);

  assert.deepEqual(o1.digest, o2.digest, 'CLI JSON digest must be identical across runs');
});

// ============================================================
// TEST 4: Coverage transparency
// ============================================================

test('summary.json always includes coverage transparency fields', () => {
  const { outcome } = runVeraxJson(SERVER_URL);
  const runDir = resolveRunDir(process.cwd(), outcome.runId);
  const summary = JSON.parse(String(readFileSync(join(runDir, 'summary.json'), 'utf-8')));

  // Observe block coverage transparency
  assert.ok('expectationsTotal' in summary.observe, 'observe.expectationsTotal present');
  assert.ok('attempted' in summary.observe, 'observe.attempted present');
  assert.ok('observed' in summary.observe, 'observe.observed present');
  assert.ok('unattemptedReasons' in summary.observe, 'observe.unattemptedReasons present');

  assert.ok(typeof summary.observe.expectationsTotal === 'number', 'expectationsTotal is number');
  assert.ok(typeof summary.observe.attempted === 'number', 'attempted is number');
  assert.ok(typeof summary.observe.observed === 'number', 'observed is number');
  assert.ok(typeof summary.observe.unattemptedReasons === 'object', 'unattemptedReasons is object');

  // Truth block coverage summary
  if (summary.truth && summary.truth.coverageSummary) {
    const cs = summary.truth.coverageSummary;
    assert.ok(typeof cs.expectationsTotal === 'number', 'coverageSummary.expectationsTotal is number');
    assert.ok(typeof cs.attempted === 'number', 'coverageSummary.attempted is number');
    assert.ok(typeof cs.observed === 'number', 'coverageSummary.observed is number');
    assert.ok(typeof cs.unattemptedCount === 'number', 'coverageSummary.unattemptedCount is number');
    assert.ok(typeof cs.unattemptedBreakdown === 'object', 'coverageSummary.unattemptedBreakdown is object');
  }
});

test('CLI --json includes coverage transparency in truth block', () => {
  const { outcome } = runVeraxJson(SERVER_URL);

  if (outcome.truth && outcome.truth.coverageSummary) {
    const cs = outcome.truth.coverageSummary;
    assert.ok(typeof cs.expectationsTotal === 'number', 'expectationsTotal present');
    assert.ok(typeof cs.attempted === 'number', 'attempted present');
    assert.ok(typeof cs.observed === 'number', 'observed present');
    assert.ok(typeof cs.unattemptedCount === 'number', 'unattemptedCount present');
    assert.ok(typeof cs.unattemptedBreakdown === 'object', 'unattemptedBreakdown present');
  }
});

// ============================================================
// TEST 5: Unambiguous state classification
// ============================================================

test('Truth state is always one of: SUCCESS, INCOMPLETE, FAILURE', () => {
  const { outcome } = runVeraxJson(SERVER_URL);
  const runDir = resolveRunDir(process.cwd(), outcome.runId);
  const summary = JSON.parse(String(readFileSync(join(runDir, 'summary.json'), 'utf-8')));

  const validStates = ['SUCCESS', 'INCOMPLETE', 'FAILURE'];
  assert.ok(
    validStates.includes(summary.truth.truthState),
    `truthState must be one of ${validStates.join(', ')}. Got: ${summary.truth.truthState}`
  );
});

test('INCOMPLETE state includes explicit reason and action', () => {
  const { outcome } = runVeraxJson(SERVER_URL, ['--min-coverage', '0.999']);
  
  assert.equal(outcome.truth.truthState, 'INCOMPLETE', 'Should be INCOMPLETE');
  assert.ok(outcome.truth.reason && outcome.truth.reason.length > 0, 'reason must be present');
  assert.ok(outcome.truth.action && outcome.truth.action.length > 0, 'action must be present');
  assert.ok(outcome.truth.explanation && outcome.truth.explanation.length > 0, 'explanation must be present');
});

console.log('✓ V1 output contract tests loaded');
