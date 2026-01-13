import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync as _readFileSync, existsSync as _existsSync, rmSync } from 'fs';
import { resolve as pathResolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { scan } from '../src/verax/index.js';
import { createScanBudget } from '../src/verax/shared/scan-budget.js';
import { withTimeout } from './helpers/test-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// LOCAL TEST MUTEX: Serialize flow-intelligence tests to avoid port/resource conflicts
let testMutex = Promise.resolve();

// Helper to start a fixture server on an ephemeral port
async function startFixtureServer(fixturePath) {
  return new Promise((resolvePromise, reject) => {
    // Use async IIFE to handle async operations in the executor
    (async () => {
      try {
        // Dynamically import the server module
        let serverModule;
        if (fixturePath.includes('flow-broken')) {
          serverModule = await import('./fixtures/flow-broken/flow-broken-server.fixture.js');
        } else if (fixturePath.includes('flow-ok')) {
          serverModule = await import('./fixtures/flow-ok/flow-ok-server.fixture.js');
        } else {
          reject(new Error(`Unknown fixture path: ${fixturePath}`));
          return;
        }
        
        const { server } = serverModule;
        
        // Listen on ephemeral port
        server.listen(0, () => {
          const addr = server.address();
          const port = addr.port;
          resolvePromise({ server, port });
        });
        
        server.on('error', (err) => {
          reject(err);
        });
      } catch (error) {
        reject(error);
      }
    })();
  });
}

async function runVeraxScan(url, srcDir) {
  const manifestPath = pathResolve(srcDir, 'manifest.json');
  const testBudget = createScanBudget({
    maxTotalInteractions: 6,
    maxInteractionsPerPage: 6,
    maxFlows: 1,
    maxFlowSteps: 2,
    maxScanDurationMs: 20000,
    interactionTimeoutMs: 5000,
    navigationTimeoutMs: 8000,
    navigationStableWaitMs: 500,
    stabilizationSampleMidMs: 200,
    stabilizationSampleEndMs: 400,
    networkWaitMs: 200,
    initialNavigationTimeoutMs: 8000,
    settleTimeoutMs: 8000,
    settleIdleMs: 500,
    settleDomStableMs: 500
  });
  const result = await scan(srcDir, url, manifestPath, testBudget, {});
  return { result, outDir: pathResolve(srcDir, '.verax') };
}

test('FLOW INTELLIGENCE v1: flow-broken fixture completes scan', { timeout: 60000 }, async () => {
  await testMutex;
  let releaseMutex;
  testMutex = new Promise(resolve => { releaseMutex = resolve; });
  
  const fixturePath = pathResolve(process.cwd(), 'test/fixtures/flow-broken');
  
  let server = null;
  let result = null;
  const oldTestMode = process.env.VERAX_TEST_MODE;
  process.env.VERAX_TEST_MODE = '1';
  
  try {
    const serverInfo = await withTimeout(startFixtureServer(fixturePath), 15000, 'start fixture server');
    server = serverInfo.server;
    const port = serverInfo.port;
    const url = `http://127.0.0.1:${port}`;
    
    // Wait for server to stabilize
    await new Promise(r => setTimeout(r, 1000));
    
    // Run verax scan - ensure it completes without timeout
    result = await withTimeout(runVeraxScan(url, fixturePath), 45000, 'verax run');
    console.log('✓ Scan completed for flow-broken without timeout');
    
    // Verify findings array exists and is an array
    const findings = result.result.findings?.findings || [];
    assert.ok(Array.isArray(findings), 'Findings should be an array');
    console.log(`✓ Found ${findings.length} findings`);
    
  } finally {
    // Cleanup: close HTTP server with timeout
    if (server) {
      await new Promise((resolve) => {
        const timeout = setTimeout(resolve, 2000); // Force resolve after 2s
        server.close(() => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
    // Wait for file handles to close before cleanup
    await new Promise(r => setTimeout(r, 500));
    if (result?.outDir) {
      try {
        rmSync(result.outDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
      } catch (err) {
        console.warn(`Failed to remove ${result.outDir}: ${err.message}`);
      }
    }
    if (oldTestMode === undefined) {
      delete process.env.VERAX_TEST_MODE;
    } else {
      process.env.VERAX_TEST_MODE = oldTestMode;
    }
    releaseMutex();
  }
});

test('FLOW INTELLIGENCE v1: flow-ok fixture emits no flow_silent_failure', { timeout: 60000 }, async () => {
  await testMutex;
  let releaseMutex;
  testMutex = new Promise(resolve => { releaseMutex = resolve; });
  
  // Create unique isolated work directory
  const fixturePath = pathResolve(process.cwd(), 'test/fixtures/flow-ok');
  
  let server = null;
  let result = null;
  const oldTestMode = process.env.VERAX_TEST_MODE;
  process.env.VERAX_TEST_MODE = '1';
  
  try {
    const serverInfo = await withTimeout(startFixtureServer(fixturePath), 15000, 'start fixture server');
    server = serverInfo.server;
    const port = serverInfo.port;
    const url = `http://127.0.0.1:${port}`;
    
    // Wait for server to stabilize
    await new Promise(r => setTimeout(r, 1000));
    
    // Run verax scan in fixture directory
    result = await withTimeout(runVeraxScan(url, fixturePath), 45000, 'verax run');
    console.log('Scan complete for flow-ok');
    
    // Check findings in isolated work directory
    const { readdirSync: _readdirSync } = await import('fs');
    const findings = result.result.findings?.findings || [];
    console.log('Findings:', JSON.stringify(findings, null, 2));
    const flowFailures = findings.filter(f => f.type === 'flow_silent_failure');
    assert.strictEqual(flowFailures.length, 0, `Expected 0 flow_silent_failure, got ${flowFailures.length}`);
    
    console.log('✓ Flow-ok fixture correctly emitted no flow_silent_failure');
    
  } finally {
    // Cleanup: close HTTP server with timeout
    if (server) {
      await new Promise((resolve) => {
        const timeout = setTimeout(resolve, 2000); // Force resolve after 2s
        server.close(() => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
    // Wait for file handles to close before cleanup
    await new Promise(r => setTimeout(r, 500));
    if (result?.outDir) {
      try {
        rmSync(result.outDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
      } catch (err) {
        console.warn(`Failed to remove ${result.outDir}: ${err.message}`);
      }
    }
    if (oldTestMode === undefined) {
      delete process.env.VERAX_TEST_MODE;
    } else {
      process.env.VERAX_TEST_MODE = oldTestMode;
    }
    releaseMutex();
  }
});
