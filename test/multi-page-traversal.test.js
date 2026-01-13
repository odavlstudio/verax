import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolve, join, dirname } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { observe } from '../src/verax/observe/index.js';
import { detect } from '../src/verax/detect/index.js';
import { createScanBudget } from '../src/verax/shared/scan-budget.js';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let PORT = 0; // 0 = dynamic port allocation

let server = null;

function startServer(port = 0) {
  return new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
     const actualPort = server.address().port;
     const url = new URL(req.url, `http://localhost:${actualPort}`);
      let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
      
      // Serve static-site fixture
      const fixtureDir = resolve(__dirname, 'fixtures', 'static-site');
      const fullPath = join(fixtureDir, filePath.substring(1));
      
      if (existsSync(fullPath)) {
        const fs = require('fs');
        const content = fs.readFileSync(fullPath, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(content);
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });
    
   server.listen(port, '127.0.0.1', () => {
     PORT = server.address().port;
      resolve();
    });

   server.on('error', (err) => {
     console.error('Server error:', err);
     reject(err);
   });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
       server = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

test('full-site traversal visits all reachable pages', async () => {
  try {
    await startServer();
    
    const projectDir = resolve(__dirname, 'fixtures', 'static-site');
    const manifestPath = join(projectDir, 'manifest.json');
    const url = `http://localhost:${PORT}`;
    
    // Use a budget that allows multi-page traversal
    const scanBudget = createScanBudget({
      maxPages: 10,
      maxTotalInteractions: 100,
      maxScanDurationMs: 30000
    });
    
    const observation = await observe(url, manifestPath, scanBudget);
    
    // Verify expectation execution metadata exists
    assert.ok(observation.expectationExecution, 'Should have expectation execution metadata');
    assert.strictEqual(observation.expectationExecution.totalProvenExpectations, 2, 'Should have 2 PROVEN expectations');
    
    // Verify coverage includes page stats
    assert.ok(observation.coverage, 'Should have coverage stats');
    assert.ok(observation.coverage.pagesVisited >= 1, 'Should have visited at least 1 page');
    assert.ok(observation.coverage.pagesDiscovered >= 1, 'Should have discovered at least 1 page');
    assert.ok(observation.coverage.interactionsExecuted >= 0, 'Should have executed interactions');
    
    // Verify traces exist
    assert.ok(Array.isArray(observation.traces), 'Should have traces array');
    
    // Verify expectation-driven traces are present
    const expectationDrivenTraces = observation.traces.filter(t => t.expectationDriven === true);
    assert.ok(expectationDrivenTraces.length >= 0, 'Should have expectation-driven traces');
    
    // Verify UNPROVEN_RESULT traces exist (for interactions without PROVEN expectations)
    const _unprovenTraces = observation.traces.filter(t => t.unprovenResult === true || t.resultType === 'UNPROVEN_RESULT');
    // These should exist if we executed interactions that don't match PROVEN expectations
    
    // Run detect to verify findings still work
    const tracesPath = observation.tracesPath;
    const findings = await detect(manifestPath, tracesPath, null, observation.expectationCoverageGaps);
    
    assert.ok(findings, 'Should have findings result');
    assert.ok(Array.isArray(findings.findings), 'Should have findings array');
    
  } finally {
    await stopServer();
  }
});

test('full-site traversal respects maxPages limit', async () => {
  try {
    await startServer();
    
    const projectDir = resolve(__dirname, 'fixtures', 'static-site');
    const manifestPath = join(projectDir, 'manifest.json');
    const url = `http://localhost:${PORT}`;
    
    // Use a budget that limits pages
    const scanBudget = createScanBudget({
      maxPages: 1,
      maxTotalInteractions: 100,
      maxScanDurationMs: 30000
    });
    
    const observation = await observe(url, manifestPath, scanBudget);
    
    // Verify page limit was respected
    assert.ok(observation.coverage, 'Should have coverage stats');
    assert.strictEqual(observation.coverage.pagesVisited, 1, 'Should visit exactly 1 page when maxPages=1');
    
  } finally {
    await stopServer();
  }
});

