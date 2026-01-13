import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolve, join, dirname } from 'path';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import http from 'http';

import { observe } from '../src/verax/observe/index.js';
import { detect } from '../src/verax/detect/index.js';
import { createScanBudget } from '../src/verax/shared/scan-budget.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = 8135;
let server = null;

const fixtureDir = resolve(__dirname, 'fixtures', 'observed-expectations');
const manifestPath = join(fixtureDir, 'manifest.json');

function startServer() {
  return new Promise((resolveServer) => {
    server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${PORT}`);

      if (url.pathname === '/api/ping') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      const requestedPath = url.pathname === '/' ? '/nav-success.html' : url.pathname;
      const filePath = join(fixtureDir, requestedPath.replace(/^\//, ''));

      if (existsSync(filePath)) {
        const content = readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(content);
      } else {
        res.writeHead(404);
        res.end('not found');
      }
    });

    server.listen(PORT, () => resolveServer());
  });
}

function stopServer() {
  return new Promise((resolveServer) => {
    if (!server) {
      resolveServer();
      return;
    }
    server.close(() => resolveServer());
  });
}

const scanBudget = createScanBudget({
  maxPages: 5,
  maxTotalInteractions: 30,
  maxScanDurationMs: 20000
});

function findTraceByObservedType(traces, type) {
  return traces.find((t) => t.observedExpectation && t.observedExpectation.type === type);
}

test('data-href navigation yields an OBSERVED expectation and verifies', async () => {
  await startServer();
  try {
    const url = `http://localhost:${PORT}/nav-success.html`;
    const observation = await observe(url, manifestPath, scanBudget);

    const navTrace = observation.traces.find(
      (t) => t.observedExpectation && t.observedExpectation.type === 'navigation' && t.observedExpectation.evidence?.attributeSource === 'data-href'
    );

    assert.ok(navTrace, 'navigation trace with observed expectation should exist');
    assert.strictEqual(navTrace.observedExpectation.outcome, 'VERIFIED');
    assert.strictEqual(navTrace.observedExpectation.expectationStrength, 'OBSERVED');
    assert.ok(navTrace.observedExpectation.evidence?.observedUrl?.includes('/nav-target'), 'observed expectation should carry target path');
  } finally {
    await stopServer();
  }
});

test('blocked navigation records observed_break instead of silent_failure', async () => {
  await startServer();
  try {
    const url = `http://localhost:${PORT}/nav-blocked.html`;
    const observation = await observe(url, manifestPath, scanBudget);

    const navTrace = findTraceByObservedType(observation.traces, 'navigation');
    assert.ok(navTrace, 'navigation observed expectation trace should exist');
    assert.strictEqual(navTrace.observedExpectation.outcome, 'OBSERVED_BREAK');

    const detection = await detect(manifestPath, observation.tracesPath, null, observation.expectationCoverageGaps || []);
    const observedBreak = detection.findings.find((f) => f.type === 'observed_break');
    assert.ok(observedBreak, 'observed_break finding should be produced');
    assert.match(observedBreak.reason, /navigation/i);
  } finally {
    await stopServer();
  }
});

test('repeating observed expectation raises confidence to MEDIUM', async () => {
  await startServer();
  try {
    const url = `http://localhost:${PORT}/network-repeat.html`;
    const observation = await observe(url, manifestPath, scanBudget);

    const networkTrace = findTraceByObservedType(observation.traces, 'network_action');
    assert.ok(networkTrace, 'network observed expectation trace should exist');
    assert.strictEqual(networkTrace.observedExpectation.repeated, true, 'network expectation should be repeated when feasible');
    assert.strictEqual(networkTrace.observedExpectation.confidenceLevel, 'MEDIUM');

    const repeatTrace = observation.traces.find(
      (t) => t.repeatExecution === true && t.repeatOfObservedExpectationId === networkTrace.observedExpectation.id
    );
    assert.ok(repeatTrace, 'repeat trace should be recorded for transparency');
  } finally {
    await stopServer();
  }
});
