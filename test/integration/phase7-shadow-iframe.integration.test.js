// PHASE 7: Shadow DOM and iFrame Navigation - Category: heavy-playwright

import test from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import http from 'node:http';
import { observeExpectations } from '../../src/cli/util/observation/observation-engine.js';
import { writeObserveJson } from '../../src/cli/util/observation/observe-writer.js';

async function createServer() {
  return new Promise((resolvePromise, reject) => {
    const server = http.createServer((req, res) => {
      const shadowPath = resolve(process.cwd(), 'test/fixtures/shadow-dom');
      const iframePath = resolve(process.cwd(), 'test/fixtures/iframe');

      if (req.url === '/shadow') {
        try {
          const html = readFileSync(join(shadowPath, 'index.html'), 'utf-8');
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(html);
        } catch (e) {
          res.writeHead(500);
          res.end('shadow fixture error');
        }
        return;
      }

      if (req.url === '/iframe') {
        try {
          const html = readFileSync(join(iframePath, 'index.html'), 'utf-8');
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(html);
        } catch (e) {
          res.writeHead(500);
          res.end('iframe fixture error');
        }
        return;
      }

      if (req.url === '/fixtures/iframe/same.html') {
        try {
          const html = readFileSync(join(iframePath, 'same.html'), 'utf-8');
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(html);
        } catch (e) {
          res.writeHead(404);
          res.end('not found');
        }
        return;
      }

      if (req.url === '/ok') {
        const html = `<!DOCTYPE html><html><head><title>OK</title></head><body><h1>OK</h1></body></html>`;
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
        return;
      }

      res.writeHead(404);
      res.end('not found');
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const baseUrl = `http://${addr.address}:${addr.port}`;
      resolvePromise({ server, baseUrl });
    });

    server.on('error', reject);
  });
}

// PHASE 7: Shadow DOM + iframe discovery/execution integration
// Verifies observations include shadow-dom and iframe contexts with runtime counters.
test('Shadow DOM and iframe runtime discovery', async () => {
  const originalTestMode = process.env.VERAX_TEST_MODE;
  delete process.env.VERAX_TEST_MODE;

  const { server, baseUrl } = await createServer();
  
  // Register server with test cleanup infrastructure
  if (global.__veraxTestServers) {
    global.__veraxTestServers.add(server);
  }
  
  const evidenceDir = mkdtempSync(resolve(tmpdir(), 'verax-phase7-evidence-'));
  const runDir = mkdtempSync(resolve(tmpdir(), 'verax-phase7-run-'));

  try {
    // Shadow DOM page - run twice to check determinism
    const shadowObs = await observeExpectations(
      [],
      baseUrl + '/shadow',
      evidenceDir,
      null,
      { runtimeNavigation: { enabled: true, maxTargets: 1 } }
    );
    const shadowObs2 = await observeExpectations(
      [],
      baseUrl + '/shadow',
      evidenceDir,
      null,
      { runtimeNavigation: { enabled: true, maxTargets: 1 } }
    );

    assert.ok(Array.isArray(shadowObs.observations), 'observations should exist (shadow)');
    const shadowRuntime = shadowObs.observations.filter(o => o.isRuntimeNav && o.source?.kind === 'shadow-dom');
    assert.ok(shadowRuntime.length > 0, 'Should record shadow-dom runtime observations');
    assert.ok(shadowObs.runtime?.shadow?.discoveredCount >= 1, 'runtime.shadow.discoveredCount should be >= 1');
    // Determinism: compare runtime expectation IDs for shadow-dom across runs
    const shadowIds1 = (shadowObs.runtimeExpectations || [])
      .filter(e => e.source?.kind === 'shadow-dom')
      .map(e => e.id)
      .sort();
    const shadowIds2 = (shadowObs2.runtimeExpectations || [])
      .filter(e => e.source?.kind === 'shadow-dom')
      .map(e => e.id)
      .sort();
    assert.deepStrictEqual(shadowIds1, shadowIds2, 'Shadow DOM runtime expectation IDs must be stable across runs');

    // Iframe page - run twice to check determinism
    const iframeObs = await observeExpectations(
      [],
      baseUrl + '/iframe',
      evidenceDir,
      null,
      { runtimeNavigation: { enabled: true, maxTargets: 1 } }
    );
    const iframeObs2 = await observeExpectations(
      [],
      baseUrl + '/iframe',
      evidenceDir,
      null,
      { runtimeNavigation: { enabled: true, maxTargets: 1 } }
    );

    assert.ok(Array.isArray(iframeObs.observations), 'observations should exist (iframe)');
    const iframeRuntime = iframeObs.observations.filter(o => o.isRuntimeNav && o.source?.kind === 'iframe');
    assert.ok(iframeRuntime.length > 0, 'Should record iframe runtime observations');
    assert.ok((iframeObs.runtime?.iframes?.sameOriginDiscovered || 0) >= 1, 'runtime.iframes.sameOriginDiscovered should be >= 1');
    assert.ok((iframeObs.runtime?.iframes?.crossOriginSkipped || 0) >= 1, 'runtime.iframes.crossOriginSkipped should be >= 1 for cross-origin frame');
    // Ensure at least one iframe interaction reported navigation change
    assert.ok(iframeRuntime.some(o => o.signals?.navigationChanged === true), 'At least one iframe runtime observation should show navigationChanged=true');
    // Determinism for iframe expectations
    const iframeIds1 = (iframeObs.runtimeExpectations || [])
      .filter(e => e.source?.kind === 'iframe')
      .map(e => e.id)
      .sort();
    const iframeIds2 = (iframeObs2.runtimeExpectations || [])
      .filter(e => e.source?.kind === 'iframe')
      .map(e => e.id)
      .sort();
    assert.deepStrictEqual(iframeIds1, iframeIds2, 'Iframe runtime expectation IDs must be stable across runs');

    // Cross-origin iframe should be skipped and must not produce a failure
    // No static expectations; findings derive from observations only
    const { detectSilentFailures } = await import('../../src/cli/util/detection-engine.js');
    const findings = await detectSilentFailures({ expectations: [] }, iframeObs);
    const iframeBroken = findings.filter(f => f.type === 'broken_navigation_promise' && f.source?.kind === 'iframe');
    assert.strictEqual(iframeBroken.length, 0, 'Cross-origin iframes must not produce broken navigation findings');

    // Write observe.json and ensure runtime fields persisted
    writeObserveJson(runDir, iframeObs);
    const observeText = readFileSync(join(runDir, 'observe.json'), 'utf-8');
    const observeObj = JSON.parse(observeText);
    assert.ok(observeObj.runtime?.shadow, 'observe.json should include runtime.shadow');
    assert.ok(observeObj.runtime?.iframes, 'observe.json should include runtime.iframes');
  } finally {
    if (originalTestMode !== undefined) process.env.VERAX_TEST_MODE = originalTestMode;
    
    // Unregister from global tracker
    if (global.__veraxTestServers) {
      global.__veraxTestServers.delete(server);
    }
    
    rmSync(evidenceDir, { recursive: true, force: true });
    rmSync(runDir, { recursive: true, force: true });
    
    // Properly close server
    await new Promise((resolve) => {
      server.close(() => {
        resolve();
      });
      setTimeout(() => {
        if (server.listening) {
          server.closeAllConnections?.();
        }
        resolve();
      }, 2000);
    });
  }
});
