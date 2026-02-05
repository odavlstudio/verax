/**
 * Determinism Timestamps Test (ISSUE #19)
 *
 * Verifies that when VERAX_TEST_TIME is set, evidence artifacts have
 * deterministic timestamps and produce byte-identical JSON across runs.
 *
 * STRICT: No schema changes, no duration/performance changes, no CLI semantics changes.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { rmSync, readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { ARTIFACT_REGISTRY } from '../../src/verax/core/artifacts/registry.js';
import { getTimeProvider } from '../../src/cli/util/support/time-provider.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '../..');
const TEST_TIME = '2026-01-19T10:00:00.000Z';

function startServer(rootDir, port) {
  return new Promise((resolvePromise, rejectPromise) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://localhost');
      const filePath = join(rootDir, url.pathname === '/' ? 'index.html' : url.pathname.split('?')[0]);
      try {
        const data = readFileSync(filePath);
        const ext = filePath.endsWith('.js') ? 'text/javascript'
          : filePath.endsWith('.css') ? 'text/css'
          : 'text/html';
        res.writeHead(200, { 'Content-Type': ext });
        res.end(data);
      } catch (err) {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(port, '127.0.0.1', (err) => {
      if (err) rejectPromise(err);
      else resolvePromise(server);
    });
  });
}

function runVeraxSync(args, env = {}) {
  const result = spawnSync('node', [join(ROOT, 'bin/verax.js'), ...args], {
    cwd: ROOT,
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 90000,
    encoding: 'utf8',
    shell: false,
    env: { ...process.env, VERAX_TEST_TIME: TEST_TIME, VERAX_TEST_MODE: '1', ...env }
  });

  return {
    exitCode: result.status !== null ? result.status : 2,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error
  };
}

function getLatestRunDir(outDir) {
  const runsDir = join(outDir, 'runs');
  const runs = readdirSync(runsDir)
    .map((name) => ({ name, mtime: statSync(join(runsDir, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  if (runs.length === 0) throw new Error('No runs found');
  return join(runsDir, runs[0].name);
}

test('determinism: evidence JSON is byte-identical with fixed VERAX_TEST_TIME', { skip: 'Covered by determinism-byte-lock.contract; skip to stay within harness budget' }, async () => {
  // Fixture: simple static site with deterministic behavior
  const fixture = join(ROOT, 'test/fixtures/nav-ok');
  const port = 9120;
  const server = await startServer(fixture, port);
  const url = `http://localhost:${port}`;

  const outDir1 = join(tmpdir(), `verax-determinism-timestamps-1-${getTimeProvider().now()}`);
  const outDir2 = join(tmpdir(), `verax-determinism-timestamps-2-${getTimeProvider().now()}`);

  try {
    // Run #1
    const run1 = runVeraxSync(['run', '--url', url, '--src', fixture, '--out', outDir1]);
    assert.strictEqual(run1.exitCode, 0, `Run 1 failed: ${run1.stderr}`);

    // Run #2
    const run2 = runVeraxSync(['run', '--url', url, '--src', fixture, '--out', outDir2]);
    assert.strictEqual(run2.exitCode, 0, `Run 2 failed: ${run2.stderr}`);

    // Locate latest runs
    const runDir1 = getLatestRunDir(outDir1);
    const runDir2 = getLatestRunDir(outDir2);

    // Evidence artifacts to compare
    const learnPath1 = join(runDir1, ARTIFACT_REGISTRY.learn.filename);
    const learnPath2 = join(runDir2, ARTIFACT_REGISTRY.learn.filename);
    const observePath1 = join(runDir1, ARTIFACT_REGISTRY.observe.filename);
    const observePath2 = join(runDir2, ARTIFACT_REGISTRY.observe.filename);

    // Ensure existence
    assert.ok(existsSync(learnPath1), 'learn.json should exist (run 1)');
    assert.ok(existsSync(learnPath2), 'learn.json should exist (run 2)');
    assert.ok(existsSync(observePath1), 'observe.json should exist (run 1)');
    assert.ok(existsSync(observePath2), 'observe.json should exist (run 2)');

    // Read raw JSON strings (byte-level comparison)
    const learn1 = readFileSync(learnPath1, 'utf8');
    const learn2 = readFileSync(learnPath2, 'utf8');
    const observe1 = readFileSync(observePath1, 'utf8');
    const observe2 = readFileSync(observePath2, 'utf8');

    // Verify timestamps are NOT present in deterministic artifacts (ISSUE #19)
    const learnObj1 = JSON.parse(learn1);
    const learnObj2 = JSON.parse(learn2);
    const observeObj1 = JSON.parse(observe1);
    const observeObj2 = JSON.parse(observe2);
    assert.ok(!learnObj1.learnedAt, 'learn.json must NOT contain learnedAt field');
    assert.ok(!learnObj2.learnedAt, 'learn.json must NOT contain learnedAt field');
    assert.ok(!observeObj1.observedAt, 'observe.json must NOT contain observedAt field');
    assert.ok(!observeObj2.observedAt, 'observe.json must NOT contain observedAt field');

    // Byte-identical JSON output across runs (without timestamps)
    assert.strictEqual(learn1, learn2, 'learn.json must be byte-identical across runs');
    assert.strictEqual(observe1, observe2, 'observe.json must be byte-identical across runs');
  } finally {
    // Cleanup output dirs
    rmSync(outDir1, { recursive: true, force: true });
    rmSync(outDir2, { recursive: true, force: true });

    // Close server with timeout guard
    await new Promise((resolveClose) => {
      const timer = setTimeout(resolveClose, 500);
      server.close(() => {
        clearTimeout(timer);
        resolveClose();
      });
      if (server.closeAllConnections) server.closeAllConnections();
    });
  }
});




