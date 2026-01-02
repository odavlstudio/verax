/**
 * Export API Tests
 * Tests for guardian export --type api functionality
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert');
const { exportRunToAPI, createZipBuffer, httpPostWithRetry } = require('../src/guardian/run-export');

const TEST_ARTIFACTS_DIR = path.join(__dirname, '.test-export-api-artifacts');
const TEST_PORT = 19876;
let testServer = null;

// Create test run fixture
function createTestRun(runId, url, verdict) {
  const runDir = path.join(TEST_ARTIFACTS_DIR, runId);
  
  fs.mkdirSync(runDir, { recursive: true });
  
  // Create META.json
  const meta = {
    version: 1,
    timestamp: new Date().toISOString(),
    url: url,
    siteSlug: url.replace(/https?:\/\//, '').replace(/[^a-z0-9]/gi, '-'),
    policy: 'custom',
    result: verdict,
    durationMs: 12345,
    attempts: []
  };
  fs.writeFileSync(path.join(runDir, 'META.json'), JSON.stringify(meta, null, 2));
  
  // Create decision.json
  const decision = {
    runId,
    url,
    finalVerdict: verdict,
    exitCode: verdict === 'READY' ? 0 : 1,
    timestamp: meta.timestamp
  };
  fs.writeFileSync(path.join(runDir, 'decision.json'), JSON.stringify(decision, null, 2));
  
  // Create summary.md
  fs.writeFileSync(path.join(runDir, 'summary.md'), `# Guardian Run Summary\n\nVerdict: ${verdict}\n`);
  
  return { runDir, runId, meta };
}

// Create LATEST.json pointer
function createLatestPointer(runId) {
  const meta = JSON.parse(fs.readFileSync(path.join(TEST_ARTIFACTS_DIR, runId, 'META.json'), 'utf8'));
  const pointer = {
    version: 1,
    timestamp: new Date().toISOString(),
    pointedRun: runId,
    pointedRunMeta: {
      timestamp: meta.timestamp,
      url: meta.url,
      siteSlug: meta.siteSlug,
      policy: meta.policy,
      result: meta.result,
      durationMs: meta.durationMs
    }
  };
  fs.writeFileSync(path.join(TEST_ARTIFACTS_DIR, 'LATEST.json'), JSON.stringify(pointer, null, 2));
}

// Cleanup test directories
function cleanup() {
  if (fs.existsSync(TEST_ARTIFACTS_DIR)) {
    fs.rmSync(TEST_ARTIFACTS_DIR, { recursive: true, force: true });
  }
}

// Start mock HTTP server
function startMockServer(handler) {
  return new Promise((resolve) => {
    testServer = http.createServer(handler);
    testServer.listen(TEST_PORT, () => {
      resolve(testServer);
    });
  });
}

// Stop mock HTTP server
function stopMockServer() {
  return new Promise((resolve) => {
    if (testServer) {
      testServer.close(() => {
        testServer = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

// Run tests
async function runTests() {
  console.log('Running API export tests...\n');
  
  let passed = 0;
  let failed = 0;
  
  // Setup
  cleanup();
  
  // Test 1: Create ZIP buffer from run directory
  try {
    console.log('Test 1: Create ZIP buffer...');
    const testRun = createTestRun('test-api-001', 'https://example.com', 'READY');
    
    const zipBuffer = await createZipBuffer(testRun.runDir);
    assert(zipBuffer instanceof Buffer, 'Should return Buffer');
    assert(zipBuffer.length > 0, 'Buffer should not be empty');
    
    // Check ZIP magic bytes
    assert.strictEqual(zipBuffer[0], 0x50, 'ZIP magic byte 1');
    assert.strictEqual(zipBuffer[1], 0x4B, 'ZIP magic byte 2');
    
    console.log(`  ✓ Created ZIP buffer (${zipBuffer.length} bytes)\n`);
    passed++;
  } catch (err) {
    console.error('  ✗ FAILED:', err.message, '\n');
    failed++;
  }
  
  // Test 2: HTTP POST success (200)
  try {
    console.log('Test 2: HTTP POST success (200)...');
    
    let receivedHeaders = null;
    let receivedBody = null;
    
    await startMockServer((req, res) => {
      receivedHeaders = req.headers;
      const chunks = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        receivedBody = Buffer.concat(chunks);
        res.writeHead(200);
        res.end('OK');
      });
    });
    
    const testRun = createTestRun('test-api-002', 'https://test.com', 'READY');
    const zipBuffer = await createZipBuffer(testRun.runDir);
    const metadata = {
      runId: 'test-api-002',
      url: 'https://test.com',
      timestamp: new Date().toISOString(),
      verdict: 'READY',
      exitCode: 0
    };
    
    const result = await httpPostWithRetry(
      `http://localhost:${TEST_PORT}/upload`,
      zipBuffer,
      metadata
    );
    
    assert.strictEqual(result.success, true, 'Should succeed');
    assert.strictEqual(result.statusCode, 200, 'Should return 200');
    assert(receivedHeaders, 'Should receive headers');
    assert.strictEqual(receivedHeaders['x-guardian-contract'], 'v1', 'Should have contract header');
    assert.strictEqual(receivedHeaders['x-guardian-run-id'], 'test-api-002', 'Should have run ID header');
    assert.strictEqual(receivedHeaders['x-guardian-verdict'], 'READY', 'Should have verdict header');
    assert.strictEqual(receivedHeaders['content-type'], 'application/zip', 'Should have correct content type');
    assert(receivedBody, 'Should receive body');
    assert(receivedBody.length > 0, 'Body should not be empty');
    
    await stopMockServer();
    
    console.log('  ✓ HTTP POST succeeded with correct headers\n');
    passed++;
  } catch (err) {
    console.error('  ✗ FAILED:', err.message, '\n');
    await stopMockServer();
    failed++;
  }
  
  // Test 3: Retry on 500 then success
  try {
    console.log('Test 3: Retry on 500 then success...');
    
    let attemptCount = 0;
    
    await startMockServer((req, res) => {
      attemptCount++;
      const chunks = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        if (attemptCount === 1) {
          res.writeHead(500);
          res.end('Server Error');
        } else {
          res.writeHead(200);
          res.end('OK');
        }
      });
    });
    
    const testRun = createTestRun('test-api-003', 'https://retry.com', 'READY');
    const zipBuffer = await createZipBuffer(testRun.runDir);
    const metadata = {
      runId: 'test-api-003',
      url: 'https://retry.com',
      timestamp: new Date().toISOString(),
      verdict: 'READY',
      exitCode: 0
    };
    
    const result = await httpPostWithRetry(
      `http://localhost:${TEST_PORT}/upload`,
      zipBuffer,
      metadata
    );
    
    assert.strictEqual(result.success, true, 'Should eventually succeed');
    assert.strictEqual(result.statusCode, 200, 'Should return 200');
    assert.strictEqual(attemptCount, 2, 'Should have made 2 attempts');
    
    await stopMockServer();
    
    console.log('  ✓ Retry logic works (500 → 200)\n');
    passed++;
  } catch (err) {
    console.error('  ✗ FAILED:', err.message, '\n');
    await stopMockServer();
    failed++;
  }
  
  // Test 4: No retry on 400
  try {
    console.log('Test 4: No retry on 400...');
    
    let attemptCount = 0;
    
    await startMockServer((req, res) => {
      attemptCount++;
      const chunks = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        res.writeHead(400);
        res.end('Bad Request');
      });
    });
    
    const testRun = createTestRun('test-api-004', 'https://badreq.com', 'READY');
    const zipBuffer = await createZipBuffer(testRun.runDir);
    const metadata = {
      runId: 'test-api-004',
      url: 'https://badreq.com',
      timestamp: new Date().toISOString(),
      verdict: 'READY',
      exitCode: 0
    };
    
    const result = await httpPostWithRetry(
      `http://localhost:${TEST_PORT}/upload`,
      zipBuffer,
      metadata
    );
    
    assert.strictEqual(result.success, false, 'Should fail');
    assert.strictEqual(result.statusCode, 400, 'Should return 400');
    assert.strictEqual(attemptCount, 1, 'Should only attempt once');
    
    await stopMockServer();
    
    console.log('  ✓ No retry on 400\n');
    passed++;
  } catch (err) {
    console.error('  ✗ FAILED:', err.message, '\n');
    await stopMockServer();
    failed++;
  }
  
  // Test 5: Retry on 429 (rate limit)
  try {
    console.log('Test 5: Retry on 429 (rate limit)...');
    
    let attemptCount = 0;
    
    await startMockServer((req, res) => {
      attemptCount++;
      const chunks = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        if (attemptCount < 2) {
          res.writeHead(429);
          res.end('Rate Limited');
        } else {
          res.writeHead(200);
          res.end('OK');
        }
      });
    });
    
    const testRun = createTestRun('test-api-005', 'https://ratelimit.com', 'READY');
    const zipBuffer = await createZipBuffer(testRun.runDir);
    const metadata = {
      runId: 'test-api-005',
      url: 'https://ratelimit.com',
      timestamp: new Date().toISOString(),
      verdict: 'READY',
      exitCode: 0
    };
    
    const result = await httpPostWithRetry(
      `http://localhost:${TEST_PORT}/upload`,
      zipBuffer,
      metadata
    );
    
    assert.strictEqual(result.success, true, 'Should eventually succeed');
    assert.strictEqual(result.statusCode, 200, 'Should return 200');
    assert.strictEqual(attemptCount, 2, 'Should have made 2 attempts');
    
    await stopMockServer();
    
    console.log('  ✓ Retry on 429 works\n');
    passed++;
  } catch (err) {
    console.error('  ✗ FAILED:', err.message, '\n');
    await stopMockServer();
    failed++;
  }
  
  // Test 6: exportRunToAPI end-to-end
  try {
    console.log('Test 6: exportRunToAPI end-to-end...');
    
    let receivedHeaders = null;
    
    await startMockServer((req, res) => {
      receivedHeaders = req.headers;
      const chunks = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        res.writeHead(200);
        res.end('OK');
      });
    });
    
    createTestRun('test-api-006', 'https://e2e.com', 'FRICTION');
    createLatestPointer('test-api-006');
    
    const exitCode = await exportRunToAPI({
      endpoint: `http://localhost:${TEST_PORT}/guardian/runs`,
      run: null, // Use latest
      artifactsDir: TEST_ARTIFACTS_DIR
    });
    
    assert.strictEqual(exitCode, 0, 'Should exit with 0');
    assert(receivedHeaders, 'Should have received request');
    assert.strictEqual(receivedHeaders['x-guardian-contract'], 'v1', 'Should have contract header');
    assert.strictEqual(receivedHeaders['x-guardian-run-id'], 'test-api-006', 'Should have run ID');
    assert.strictEqual(receivedHeaders['x-guardian-verdict'], 'FRICTION', 'Should have verdict');
    
    await stopMockServer();
    
    console.log('  ✓ End-to-end API export works\n');
    passed++;
  } catch (err) {
    console.error('  ✗ FAILED:', err.message, '\n');
    await stopMockServer();
    failed++;
  }
  
  // Test 7: exportRunToAPI with missing run
  try {
    console.log('Test 7: exportRunToAPI with missing run...');
    
    const exitCode = await exportRunToAPI({
      endpoint: `http://localhost:${TEST_PORT}/upload`,
      run: 'nonexistent-run',
      artifactsDir: TEST_ARTIFACTS_DIR
    });
    
    assert.strictEqual(exitCode, 2, 'Should exit with 2 for missing run');
    
    console.log('  ✓ Missing run handled correctly\n');
    passed++;
  } catch (err) {
    console.error('  ✗ FAILED:', err.message, '\n');
    failed++;
  }
  
  // Test 8: Exponential backoff timing (verify it doesn't retry immediately)
  try {
    console.log('Test 8: Exponential backoff timing...');
    
    const attemptTimes = [];
    
    await startMockServer((req, res) => {
      attemptTimes.push(Date.now());
      const chunks = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        res.writeHead(500);
        res.end('Error');
      });
    });
    
    const testRun = createTestRun('test-api-008', 'https://backoff.com', 'READY');
    const zipBuffer = await createZipBuffer(testRun.runDir);
    const metadata = {
      runId: 'test-api-008',
      url: 'https://backoff.com',
      timestamp: new Date().toISOString(),
      verdict: 'READY',
      exitCode: 0
    };
    
    await httpPostWithRetry(
      `http://localhost:${TEST_PORT}/upload`,
      zipBuffer,
      metadata
    );
    
    assert.strictEqual(attemptTimes.length, 3, 'Should have made 3 attempts');
    
    // Check backoff timing (1s, 2s between attempts)
    if (attemptTimes.length >= 2) {
      const delay1 = attemptTimes[1] - attemptTimes[0];
      assert(delay1 >= 900, 'First retry should wait ~1s');
    }
    if (attemptTimes.length >= 3) {
      const delay2 = attemptTimes[2] - attemptTimes[1];
      assert(delay2 >= 1900, 'Second retry should wait ~2s');
    }
    
    await stopMockServer();
    
    console.log('  ✓ Exponential backoff timing verified\n');
    passed++;
  } catch (err) {
    console.error('  ✗ FAILED:', err.message, '\n');
    await stopMockServer();
    failed++;
  }
  
  // Cleanup
  cleanup();
  await stopMockServer();
  
  // Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Tests completed: ${passed + failed}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests
runTests().catch(err => {
  console.error('Fatal test error:', err);
  cleanup();
  stopMockServer().then(() => process.exit(1));
});
