/**
 * ISSUE #19: No Timestamps in Deterministic Artifacts Contract Test
 *
 * Verifies that deterministic artifacts (findings.json, observe.json, summary.json,
 * learn.json) are completely free of timestamps and produce byte-identical output
 * across multiple runs.
 *
 * STRICT CONTRACT:
 * - findings.json MUST NOT contain detectedAt or any timestamp field
 * - observe.json MUST NOT contain observedAt or any timestamp field
 * - summary.json MUST NOT contain startedAt, completedAt, or any timestamp field
 * - learn.json MUST NOT contain learnedAt or any timestamp field
 * - All four artifacts MUST be byte-identical across identical runs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { rmSync, readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { ARTIFACT_REGISTRY } from '../../src/verax/core/artifacts/registry.js';
import { getTimeProvider } from '../../src/cli/util/support/time-provider.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '../../');
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

/**
 * Verifies no timestamp-like fields exist in the artifact
 */
function assertNoTimestamps(artifact, artifactName) {
  const timestampFields = ['detectedAt', 'observedAt', 'learnedAt', 'startedAt', 'completedAt', 'generatedAt'];
  
  const json = JSON.stringify(artifact);
  for (const field of timestampFields) {
    assert.ok(
      !json.includes(`"${field}"`),
      `${artifactName} must not contain timestamp field "${field}"`
    );
  }
}

/**
 * Removes volatileMetadata from an artifact before comparison
 * volatileMetadata contains timing-dependent information that varies between runs
 */
function stripVolatileMetadata(artifactJson) {
  const artifact = JSON.parse(artifactJson);
  if (artifact.volatileMetadata) {
    delete artifact.volatileMetadata;
  }
  return JSON.stringify(artifact, null, 2) + '\n';
}

test('ISSUE #19: Deterministic artifacts contain no timestamps', async (suite) => {
  const fixture = join(ROOT, 'test/fixtures/nav-ok');
  const port = 9121;
  const server = await startServer(fixture, port);
  const url = `http://localhost:${port}`;

  const outDir1 = join(ROOT, `tmp/no-timestamps-1-${getTimeProvider().now()}`);
  const outDir2 = join(ROOT, `tmp/no-timestamps-2-${getTimeProvider().now()}`);

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

    // Deterministic artifacts to compare
    const findingsPath1 = join(runDir1, ARTIFACT_REGISTRY.findings.filename);
    const findingsPath2 = join(runDir2, ARTIFACT_REGISTRY.findings.filename);
    const observePath1 = join(runDir1, ARTIFACT_REGISTRY.observe.filename);
    const observePath2 = join(runDir2, ARTIFACT_REGISTRY.observe.filename);
    const summaryPath1 = join(runDir1, ARTIFACT_REGISTRY.summary.filename);
    const summaryPath2 = join(runDir2, ARTIFACT_REGISTRY.summary.filename);
    const learnPath1 = join(runDir1, ARTIFACT_REGISTRY.learn.filename);
    const learnPath2 = join(runDir2, ARTIFACT_REGISTRY.learn.filename);

    await suite.test('findings.json: no timestamp fields', async () => {
      assert.ok(existsSync(findingsPath1), 'findings.json run 1 exists');
      const findingsData1 = JSON.parse(readFileSync(findingsPath1, 'utf-8'));
      assertNoTimestamps(findingsData1, 'findings.json');
    });

    await suite.test('observe.json: no timestamp fields', async () => {
      assert.ok(existsSync(observePath1), 'observe.json run 1 exists');
      const observeData1 = JSON.parse(readFileSync(observePath1, 'utf-8'));
      assertNoTimestamps(observeData1, 'observe.json');
    });

    await suite.test('summary.json: no timestamp fields', async () => {
      assert.ok(existsSync(summaryPath1), 'summary.json run 1 exists');
      const summaryData1 = JSON.parse(readFileSync(summaryPath1, 'utf-8'));
      assertNoTimestamps(summaryData1, 'summary.json');
    });

    await suite.test('learn.json: no timestamp fields', async () => {
      assert.ok(existsSync(learnPath1), 'learn.json run 1 exists');
      const learnData1 = JSON.parse(readFileSync(learnPath1, 'utf-8'));
      assertNoTimestamps(learnData1, 'learn.json');
    });

    await suite.test('findings.json: byte-identical across runs', async () => {
      const findings1 = readFileSync(findingsPath1, 'utf-8');
      const findings2 = readFileSync(findingsPath2, 'utf-8');
      assert.strictEqual(findings1, findings2, 'findings.json must be byte-identical');
    });

    await suite.test('observe.json: byte-identical across runs', async () => {
      const observe1 = readFileSync(observePath1, 'utf-8');
      const observe2 = readFileSync(observePath2, 'utf-8');
      assert.strictEqual(observe1, observe2, 'observe.json must be byte-identical');
    });

    await suite.test('summary.json: byte-identical across runs (excluding volatileMetadata)', async () => {
      const summary1 = stripVolatileMetadata(readFileSync(summaryPath1, 'utf-8'));
      const summary2 = stripVolatileMetadata(readFileSync(summaryPath2, 'utf-8'));
      assert.strictEqual(summary1, summary2, 'summary.json must be byte-identical (volatileMetadata excluded)');
    });

    await suite.test('learn.json: byte-identical across runs', async () => {
      const learn1 = readFileSync(learnPath1, 'utf-8');
      const learn2 = readFileSync(learnPath2, 'utf-8');
      assert.strictEqual(learn1, learn2, 'learn.json must be byte-identical');
    });

    await suite.test('all deterministic artifacts byte-identical', async () => {
      const findings1 = readFileSync(findingsPath1, 'utf-8');
      const findings2 = readFileSync(findingsPath2, 'utf-8');
      const observe1 = readFileSync(observePath1, 'utf-8');
      const observe2 = readFileSync(observePath2, 'utf-8');
      const summary1 = stripVolatileMetadata(readFileSync(summaryPath1, 'utf-8'));
      const summary2 = stripVolatileMetadata(readFileSync(summaryPath2, 'utf-8'));
      const learn1 = readFileSync(learnPath1, 'utf-8');
      const learn2 = readFileSync(learnPath2, 'utf-8');

      assert.strictEqual(findings1, findings2, 'findings.json byte-identical');
      assert.strictEqual(observe1, observe2, 'observe.json byte-identical');
      assert.strictEqual(summary1, summary2, 'summary.json byte-identical (volatileMetadata excluded)');
      assert.strictEqual(learn1, learn2, 'learn.json byte-identical');
    });

  } finally {
    await new Promise((resolve) => {
      server.close(() => {
        resolve();
      });
      setTimeout(() => {
        if (server.closeAllConnections) {
          server.closeAllConnections();
        }
        resolve();
      }, 500);
    });
    if (existsSync(outDir1)) rmSync(outDir1, { recursive: true, force: true });
    if (existsSync(outDir2)) rmSync(outDir2, { recursive: true, force: true });
  }
});

console.log('✓ No timestamps contract test loaded');





