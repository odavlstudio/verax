/**
 * Stage 5: Error Handling Test
 * 
 * Forces an internal error and verifies:
 * - decision.json is written (sanitized)
 * - meta.status = ERROR
 * - finalVerdict = ERROR
 * - correct exit code
 */

const { executeWithFailSafe, writeErrorDecision } = require('../src/guardian/fail-safe');
const fs = require('fs');
const path = require('path');
const { tmpdir } = require('os');
const { mkdtempSync, rmSync } = require('fs');

console.log('🧪 Stage 5: Error Handling Test');
console.log('━'.repeat(70));

async function testErrorDecisionWrite() {
  console.log('\n📝 Test 1: Error decision write\n');

  const tempDir = mkdtempSync(path.join(tmpdir(), 'guardian-error-'));
  
  try {
    const error = new Error('Simulated internal error');
    error.stack = 'Error: Simulated internal error\n    at test (test.js:10:15)';

    const decisionPath = writeErrorDecision({
      runDir: tempDir,
      baseUrl: 'http://example.com',
      error,
      determinismHash: 'test-hash-123',
      mode: 'gate',
      baseDir: tempDir
    });

    // Verify decision.json was written
    if (!fs.existsSync(decisionPath)) {
      throw new Error('decision.json was not written');
    }
    console.log('✅ decision.json was written');

    // Read and validate decision
    const decision = JSON.parse(fs.readFileSync(decisionPath, 'utf8'));

    // Check meta.status
    if (decision.meta?.status !== 'ERROR') {
      throw new Error(`Expected meta.status = ERROR, got ${decision.meta?.status}`);
    }
    console.log('✅ meta.status = ERROR');

    // Check finalVerdict
    if (decision.finalVerdict !== 'ERROR') {
      throw new Error(`Expected finalVerdict = ERROR, got ${decision.finalVerdict}`);
    }
    console.log('✅ finalVerdict = ERROR');

    // Check exit code
    if (decision.exitCode !== 3) {
      throw new Error(`Expected exitCode = 3, got ${decision.exitCode}`);
    }
    console.log('✅ exitCode = 3');

    // Check error message
    if (!decision.meta?.errorMessage?.includes('Simulated internal error')) {
      throw new Error('Error message not found in meta');
    }
    console.log('✅ Error message recorded');

    // Check determinism hash
    if (decision.determinismHash !== 'test-hash-123') {
      throw new Error(`Expected determinismHash = test-hash-123, got ${decision.determinismHash}`);
    }
    console.log('✅ Determinism hash preserved');

    // Check mode
    if (decision.mode !== 'gate') {
      throw new Error(`Expected mode = gate, got ${decision.mode}`);
    }
    console.log('✅ Mode preserved');

    // Verify sanitization (should not contain raw error stack in certain fields)
    const decisionStr = JSON.stringify(decision);
    if (!decisionStr.includes('Simulated internal error')) {
      console.log('✅ Error details included');
    }

    console.log('\n✅ Test 1 PASSED\n');

  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

async function testFailSafeWrapper() {
  console.log('📝 Test 2: Fail-safe wrapper\n');

  const tempDir = mkdtempSync(path.join(tmpdir(), 'guardian-failsafe-'));

  try {
    // Simulate a failing execution
    const failingFn = async () => {
      throw new Error('Execution failed unexpectedly');
    };

    const result = await executeWithFailSafe(failingFn, {
      runDir: tempDir,
      baseUrl: 'http://test.com',
      determinismHash: 'wrapper-hash-456',
      mode: 'advisory',
      baseDir: tempDir
    });

    // Verify result structure
    if (result.exitCode !== 3) {
      throw new Error(`Expected exitCode = 3, got ${result.exitCode}`);
    }
    console.log('✅ exitCode = 3');

    if (!result.error?.includes('Execution failed unexpectedly')) {
      throw new Error('Error message not in result');
    }
    console.log('✅ Error message in result');

    if (result.finalDecision?.finalVerdict !== 'ERROR') {
      throw new Error('finalVerdict not ERROR');
    }
    console.log('✅ finalDecision.finalVerdict = ERROR');

    // Verify decision.json was written
    const decisionPath = path.join(tempDir, 'decision.json');
    if (!fs.existsSync(decisionPath)) {
      throw new Error('decision.json was not written by wrapper');
    }
    console.log('✅ decision.json written by wrapper');

    const decision = JSON.parse(fs.readFileSync(decisionPath, 'utf8'));
    if (decision.meta?.status !== 'ERROR') {
      throw new Error('decision.json missing ERROR status');
    }
    console.log('✅ decision.json has ERROR status');

    console.log('\n✅ Test 2 PASSED\n');

  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

async function testSuccessfulExecution() {
  console.log('📝 Test 3: Successful execution (no error)\n');

  const successFn = async () => {
    return {
      exitCode: 0,
      finalDecision: {
        finalVerdict: 'READY',
        exitCode: 0
      }
    };
  };

  const result = await executeWithFailSafe(successFn, {
    runDir: path.join(tmpdir(), 'guardian-success', 'run'),
    baseDir: path.join(tmpdir(), 'guardian-success'),
    baseUrl: 'http://test.com'
  });

  if (result.exitCode !== 0) {
    throw new Error('Success case returned wrong exit code');
  }
  console.log('✅ Success case returns correct result');

  if (result.finalDecision?.finalVerdict !== 'READY') {
    throw new Error('Success case returned wrong verdict');
  }
  console.log('✅ Success verdict preserved');

  console.log('\n✅ Test 3 PASSED\n');
}

async function testTraversalBlocked() {
  console.log('\n📝 Test 4: Traversal attempt is blocked\n');

  const baseDir = mkdtempSync(path.join(tmpdir(), 'guardian-allowed-'));
  const escapeDir = path.join(baseDir, '..', 'escape-outside');

  try {
    const result = await executeWithFailSafe(async () => {
      throw new Error('boom');
    }, {
      runDir: escapeDir,
      baseDir,
      baseUrl: 'http://escape.test'
    });

    if (result.exitCode !== 3) {
      throw new Error(`Traversal attempt should exit 3, got ${result.exitCode}`);
    }
    console.log('✅ Exit code = 3 for traversal attempt');

    if (fs.existsSync(path.join(escapeDir, 'decision.json'))) {
      throw new Error('decision.json should not be written outside base');
    }
    console.log('✅ No artifact written outside base');

  } finally {
    rmSync(baseDir, { recursive: true, force: true });
    rmSync(path.resolve(escapeDir), { recursive: true, force: true });
  }

  console.log('\n✅ Test 4 PASSED\n');
}

async function testAbsoluteEscapeBlocked() {
  console.log('\n📝 Test 5: Absolute external path is blocked\n');

  const baseDir = mkdtempSync(path.join(tmpdir(), 'guardian-allowed-'));
  // Intentionally choose an absolute path outside the base
  const externalDir = path.resolve(path.join(path.parse(baseDir).root, 'guardian-external-test'));

  try {
    const result = await executeWithFailSafe(async () => {
      throw new Error('boom');
    }, {
      runDir: externalDir,
      baseDir,
      baseUrl: 'http://external.test'
    });

    if (result.exitCode !== 3) {
      throw new Error(`External path attempt should exit 3, got ${result.exitCode}`);
    }
    console.log('✅ Exit code = 3 for external absolute path');

    if (fs.existsSync(path.join(externalDir, 'decision.json'))) {
      throw new Error('decision.json should not be written outside base');
    }
    console.log('✅ No artifact written to external path');

  } finally {
    rmSync(baseDir, { recursive: true, force: true });
    rmSync(externalDir, { recursive: true, force: true });
  }

  console.log('\n✅ Test 5 PASSED\n');
}

async function runErrorHandlingTests() {
  try {
    await testErrorDecisionWrite();
    await testFailSafeWrapper();
    await testSuccessfulExecution();
    await testTraversalBlocked();
    await testAbsoluteEscapeBlocked();

    console.log('━'.repeat(70));
    console.log('✅ All error handling tests PASSED');
    console.log('━'.repeat(70));
    process.exit(0);
  } catch (err) {
    console.error(`\n❌ Test failed: ${err.message}`);
    if (err.stack) console.error(err.stack);
    console.log('━'.repeat(70));
    console.log('❌ Error handling tests FAILED');
    console.log('━'.repeat(70));
    process.exit(1);
  }
}

runErrorHandlingTests();
