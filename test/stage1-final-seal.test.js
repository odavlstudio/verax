/**
 * Stage 1 Final Seal - End-to-End Integration Test
 * 
 * Validates:
 * A) End-to-end CLI run generates decision.json with required fields
 * B) Runtime guard prevents double calls within same run
 * C) Exit code matches verdict
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { startFixtureServer } = require('./fixture-server');
const { resetCallTracker } = require('../src/guardian/decision-authority');

describe('Stage 1 Final Seal - E2E Integration Test', function() {
  this.timeout(60000); // Allow 60 seconds for full E2E run
  
  let server = null;
  let tempDir = null;

  before(async function() {
    // Start the fixture server on an ephemeral port
    server = await startFixtureServer(0);
    console.log(`\n  Fixture server started at ${server.baseUrl}`);
    
    // Create a temp directory for this test run
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guardian-e2e-'));
    console.log(`  Temp directory: ${tempDir}`);
  });

  after(async function() {
    // Close the server
    if (server) {
      await server.close();
      console.log(`  Fixture server closed`);
    }
    
    // Clean up temp directory
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log(`  Temp directory cleaned`);
    }
  });

  it('should generate decision.json with all required fields via CLI', async function() {
    const cliPath = path.join(__dirname, '..', 'bin', 'guardian.js');
    
    // Run guardian reality command against the fixture server
    const args = [
      'reality',
      '--url', server.baseUrl,
      '--attempts', 'site_smoke',
      '--artifacts', tempDir,
      '--timeout-profile', 'fast'
    ];

    console.log(`\n  Running: node ${cliPath} ${args.join(' ')}`);

    const exitCode = await runCliCommand(cliPath, args);
    
    // Find the decision.json file in the temp directory
    const decisionJsonPath = findFile(tempDir, 'decision.json');
    assert(decisionJsonPath, `decision.json not found in ${tempDir}`);
    console.log(`  ✓ decision.json found at ${decisionJsonPath}`);

    // Read and validate the decision artifact
    const decisionData = JSON.parse(fs.readFileSync(decisionJsonPath, 'utf-8'));
    
    // A) Validate required fields exist
    assert(decisionData.finalVerdict, 'finalVerdict is missing');
    assert(['READY', 'FRICTION', 'DO_NOT_LAUNCH'].includes(decisionData.finalVerdict), 
      `finalVerdict "${decisionData.finalVerdict}" not in allowed set`);
    console.log(`  ✓ finalVerdict: ${decisionData.finalVerdict}`);

    assert(decisionData.verdictSource, 'verdictSource is missing');
    assert(typeof decisionData.verdictSource === 'string', 'verdictSource must be a string');
    console.log(`  ✓ verdictSource: ${decisionData.verdictSource}`);

    assert(Array.isArray(decisionData.verdictHistory), 'verdictHistory must be an array');
    assert(decisionData.verdictHistory.length >= 2, 
      `verdictHistory has ${decisionData.verdictHistory.length} entries, expected >= 2`);
    console.log(`  ✓ verdictHistory: ${decisionData.verdictHistory.length} entries`);
    
    // Validate verdictHistory structure
    decisionData.verdictHistory.forEach((entry, idx) => {
      assert(entry.phase !== undefined, `verdictHistory[${idx}].phase is missing`);
      assert(entry.source, `verdictHistory[${idx}].source is missing`);
      assert(entry.timestamp, `verdictHistory[${idx}].timestamp is missing`);
    });

    assert(decisionData.meta, 'meta object is missing');
    assert(decisionData.meta.status === 'OK' || decisionData.meta.status === 'ok', 
      `meta.status "${decisionData.meta.status}" not OK`);
    console.log(`  ✓ meta.status: ${decisionData.meta.status}`);

    const finalExitCode = decisionData.finalExitCode || decisionData.exitCode;
    assert(finalExitCode !== undefined, 'finalExitCode or exitCode is missing');
    assert([0, 1, 2].includes(finalExitCode), `exitCode ${finalExitCode} not in [0, 1, 2]`);
    console.log(`  ✓ finalExitCode: ${finalExitCode}`);

    // B) Validate exit code matches verdict
    const verdictToExitCode = {
      'READY': 0,
      'FRICTION': 1,
      'DO_NOT_LAUNCH': 2
    };
    const expectedExitCode = verdictToExitCode[decisionData.finalVerdict];
    assert.strictEqual(finalExitCode, expectedExitCode, 
      `Exit code ${finalExitCode} does not match verdict ${decisionData.finalVerdict} (expected ${expectedExitCode})`);
    console.log(`  ✓ Exit code ${finalExitCode} matches verdict ${decisionData.finalVerdict}`);

    // Validate CLI process exit code matches
    assert.strictEqual(exitCode, expectedExitCode, 
      `CLI process exited with ${exitCode}, but decision indicates ${expectedExitCode}`);
    console.log(`  ✓ CLI process exit code ${exitCode} matches verdict exit code`);
  });

  it('should enforce single call per run in decision authority', async function() {
    // This test validates the runtime guard by attempting double calls
    // and verifying the guard throws an error
    
    const { computeDecisionAuthority } = require('../src/guardian/decision-authority');
    
    // Reset tracker for this test
    resetCallTracker('test-double-call-run');
    
    const signals = {
      flows: [{ outcome: 'SUCCESS' }],
      attempts: [{ outcome: 'SUCCESS', executed: true }],
      rulesEngineOutput: null,
      journeyVerdict: null,
      policyEval: {},
      baseline: {},
      coverage: {}
    };
    
    // First call should succeed
    const decision1 = computeDecisionAuthority(signals, { ciMode: true, runId: 'test-double-call-run' });
    assert(decision1.finalVerdict, 'First call should produce a verdict');
    console.log(`  ✓ First call succeeded: ${decision1.finalVerdict}`);
    
    // Second call with same runId should throw (in non-production)
    let throwError = false;
    try {
      const decision2 = computeDecisionAuthority(signals, { ciMode: true, runId: 'test-double-call-run' });
    } catch (err) {
      throwError = true;
      assert(err.message.includes('called twice'), 
        `Expected error about double call, got: ${err.message}`);
      console.log(`  ✓ Second call correctly threw: ${err.message}`);
    }
    
    assert(throwError, 'Second call should throw an error in non-production mode');
    
    // Reset for other tests
    resetCallTracker('test-double-call-run');
  });

  it('should have deterministic decision verdicts for same inputs', async function() {
    const { computeDecisionAuthority, resetCallTracker } = require('../src/guardian/decision-authority');
    
    const signals = {
      flows: [{ outcome: 'SUCCESS' }],
      attempts: [{ outcome: 'SUCCESS', executed: true }],
      rulesEngineOutput: null,
      journeyVerdict: null,
      policyEval: {},
      baseline: {},
      coverage: {}
    };
    
    // Call 1
    resetCallTracker('deterministic-test-1');
    const d1 = computeDecisionAuthority(signals, { ciMode: true, runId: 'deterministic-test-1' });
    
    // Call 2 with different runId (since guard prevents same runId)
    resetCallTracker('deterministic-test-2');
    const d2 = computeDecisionAuthority(signals, { ciMode: true, runId: 'deterministic-test-2' });
    
    assert.strictEqual(d1.finalVerdict, d2.finalVerdict, 'Same inputs should produce same verdict');
    assert.strictEqual(d1.exitCode, d2.exitCode, 'Same inputs should produce same exit code');
    console.log(`  ✓ Deterministic verdict: ${d1.finalVerdict} (exit ${d1.exitCode})`);
  });
});

/**
 * Helper: Run a CLI command and return exit code
 */
function runCliCommand(cliPath, args) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [cliPath, ...args], {
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'test' }
    });
    
    child.on('exit', (code) => {
      resolve(code || 0);
    });
    
    child.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Helper: Recursively find a file by name
 */
function findFile(dir, filename) {
  if (!fs.existsSync(dir)) return null;
  
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (file === filename) {
      return fullPath;
    }
    
    if (stat.isDirectory()) {
      const result = findFile(fullPath, filename);
      if (result) return result;
    }
  }
  
  return null;
}
