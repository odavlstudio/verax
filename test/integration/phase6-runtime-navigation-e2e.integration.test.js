// PHASE 6: Runtime Navigation E2E - Category: heavy-playwright

import test from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import http from 'node:http';
import { observeExpectations } from '../../src/cli/util/observation/observation-engine.js';
import { detectSilentFailures } from '../../src/cli/util/detection-engine.js';

/**
 * Create a minimal HTTP server serving fixture files
 * Resolves to { server, baseUrl } where baseUrl is http://127.0.0.1:<port>
 */
async function createTestServer() {
  return new Promise((promiseResolve, reject) => {
    const server = http.createServer((req, res) => {
      const fixturePath = resolve(process.cwd(), 'test/release/fixtures/dynamic-links');
      
      console.log(`[SERVER] Received request for: ${req.url}`);
      
      // Route "/" -> index.html
      if (req.url === '/') {
        try {
          const html = readFileSync(join(fixturePath, 'index.html'), 'utf-8');
          console.log(`[SERVER] Serving index.html (${html.length} bytes)`);
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(html);
        } catch (e) {
          console.log(`[SERVER] Error reading index.html:`, e.message);
          res.writeHead(500);
          res.end('Internal server error');
        }
        return;
      }

      // Route "/user/123", "/settings", "/dashboard" -> minimal HTML responses
      if (req.url.startsWith('/user/') || req.url === '/settings' || req.url === '/dashboard') {
        const pageName = req.url.split('/').pop() || 'page';
        const html = `<!DOCTYPE html>
<html>
<head>
  <title>${pageName}</title>
</head>
<body>
  <h1>${pageName}</h1>
  <p>Navigated successfully</p>
</body>
</html>`;
        console.log(`[SERVER] Serving ${pageName} page`);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
        return;
      }

      // 404 for unknown routes
      console.log(`[SERVER] 404 for: ${req.url}`);
      res.writeHead(404);
      res.end('Not found');
    });

    // Listen on ephemeral port (0 = OS picks available port)
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const baseUrl = `http://${addr.address}:${addr.port}`;
      console.log(`[SERVER] Listening on ${baseUrl}`);
      promiseResolve({ server, baseUrl });
    });

    server.on('error', reject);
  });
}

// PHASE 6: End-to-end runtime navigation integration
// Discover runtime navigation targets, execute them, and detect broken promises.
test('Runtime navigation end-to-end detection', async () => {
  // CRITICAL: Disable test mode for this test so real browser discovery runs
  const originalTestMode = process.env.VERAX_TEST_MODE;
  delete process.env.VERAX_TEST_MODE;

  const evidenceDir = mkdtempSync(resolve(tmpdir(), 'verax-runtime-nav-'));
  const { server, baseUrl } = await createTestServer();
  
  // Register server with test cleanup infrastructure
  if (global.__veraxTestServers) {
    global.__veraxTestServers.add(server);
  }

  try {
    console.log('\n=== PHASE 6 E2E TEST START ===');
    console.log('baseUrl:', baseUrl);
    console.log('Full URL to navigate:', baseUrl + '/');
    console.log('evidenceDir:', evidenceDir);
    
    const observeData = await observeExpectations(
      [],
      baseUrl + '/',
      evidenceDir,
      null,
      { runtimeNavigation: { enabled: true, maxTargets: 20 } }
    );

    console.log('\n=== RUNTIME NAV INTEGRATION TEST DEBUG ===');
    console.log('baseUrl:', baseUrl);
    console.log('runtimeExpectations count:', observeData.runtimeExpectations?.length || 0);
    console.log('runtimeExpectations:', JSON.stringify(observeData.runtimeExpectations?.slice(0, 2), null, 2));
    console.log('observations count:', observeData.observations?.length || 0);
    console.log('observations sample:', JSON.stringify(observeData.observations?.slice(0, 2), null, 2));

    const runtimeObservations = observeData.observations.filter(
      (obs) => obs.source?.type === 'runtime-dom'
    );

    console.log('filtered runtimeObservations count:', runtimeObservations.length);
    console.log('=== END DEBUG ===\n');

    assert.ok(observeData.runtimeExpectations?.length > 0, 'Should persist runtime expectations');
    assert.ok(runtimeObservations.length > 0, 'Should record runtime navigation observations');

    // Detect findings using runtime expectations
    const findings = await detectSilentFailures({ expectations: [] }, observeData);
    const brokenNavigation = findings.filter((f) => f.type === 'broken_navigation_promise');

    assert.ok(brokenNavigation.length >= 1, 'Should flag broken runtime navigation promises');
    assert.ok(
      runtimeObservations.some((obs) => obs.signals?.navigationChanged === true),
      'Should capture at least one successful runtime navigation'
    );
    assert.ok(
      runtimeObservations.some((obs) => obs.signals?.navigationChanged === false),
      'Should capture at least one failed runtime navigation'
    );
  } finally {
    // Restore test mode
    if (originalTestMode !== undefined) {
      process.env.VERAX_TEST_MODE = originalTestMode;
    }
    
    // Unregister from global tracker
    if (global.__veraxTestServers) {
      global.__veraxTestServers.delete(server);
    }
    
    rmSync(evidenceDir, { recursive: true, force: true });
    
    // Properly close server - wrap in promise to ensure it's fully closed
    await new Promise((resolve) => {
      server.close(() => {
        resolve();
      });
      // Safety timeout: if server doesn't close in 2 seconds, force it
      setTimeout(() => {
        if (server.listening) {
          server.closeAllConnections?.();
        }
        resolve();
      }, 2000);
    });
  }
});

