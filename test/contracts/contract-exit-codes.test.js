/**
 * CONTRACT B — EXIT CODE TRUTH TABLE (CANONICAL)
 * 
 * Locks the behavior:
 * - READY → exit 0
 * - FRICTION → exit 1
 * - DO_NOT_LAUNCH → exit 2
 * - ERROR/UNKNOWN → exit 3
 * 
 * Must be verified via CLI execution paths, not just unit tests
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  spawnGuardianCLI,
  createTempWorkspace,
  cleanupTempWorkspace,
  readJSON,
} = require('./test-harness');

describe('CONTRACT B: Exit Code Truth Table', () => {
  let workspace;

  beforeEach(() => {
    workspace = createTempWorkspace('contract-exit-codes-');
  });

  afterEach(() => {
    cleanupTempWorkspace(workspace.tempDir);
  });

  it('ERROR/UNKNOWN exits with code 3 (unreachable URL)', async function() {
    this.timeout(30000);

    // Use unreachable host to trigger ERROR
    const result = await spawnGuardianCLI(
      ['smoke', '--url', 'http://127.0.0.1:9999'],
      { cwd: workspace.tempDir }
    );

    // CANONICAL: Unreachable URLs are system failures (ERROR), MUST exit 3
    assert.strictEqual(result.exitCode, 3,
      `Unreachable URL must exit with code 3 (ERROR), got ${result.exitCode}`);
  });

  it('Invalid command syntax exits with non-zero', async function() {
    this.timeout(10000);

    const result = await spawnGuardianCLI(
      ['reality'], // Missing required --url flag
      { cwd: workspace.tempDir }
    );

    // Missing required flag should fail validation
    assert.ok(result.exitCode !== 0,
      `Invalid command must exit non-zero, got ${result.exitCode}`);
    
    const combined = result.stdout + result.stderr;
    assert.ok(combined.includes('missing') || combined.includes('required'),
      'Error message should mention missing/required flag');
  });

  it('Verdict mapping to exit codes is consistent', () => {
    // Unit test to verify the mapping function
    const { mapExitCodeFromCanonical } = require('../../src/guardian/verdicts');
    
    assert.strictEqual(mapExitCodeFromCanonical('READY'), 0,
      'READY must map to exit code 0');
    assert.strictEqual(mapExitCodeFromCanonical('FRICTION'), 1,
      'FRICTION must map to exit code 1');
    assert.strictEqual(mapExitCodeFromCanonical('DO_NOT_LAUNCH'), 2,
      'DO_NOT_LAUNCH must map to exit code 2');
    assert.strictEqual(mapExitCodeFromCanonical('ERROR'), 3,
      'ERROR must map to exit code 3');
    assert.strictEqual(mapExitCodeFromCanonical('UNKNOWN'), 3,
      'UNKNOWN must map to exit code 3');
    
    // Default case for invalid input
    assert.strictEqual(mapExitCodeFromCanonical('INVALID'), 3,
      'Invalid verdict must default to exit code 3');
    assert.strictEqual(mapExitCodeFromCanonical(null), 3,
      'Null verdict must default to exit code 3');
  });

  it('CLI help exits with code 0', async function() {
    this.timeout(10000);

    const result = await spawnGuardianCLI(
      ['--help'],
      { cwd: workspace.tempDir }
    );

    assert.strictEqual(result.exitCode, 0,
      'Help command must exit with code 0');
    assert.ok(result.stdout.includes('Guardian'),
      'Help output should contain Guardian text');
  });

  it('Version flag exits with code 0', async function() {
    this.timeout(10000);

    const result = await spawnGuardianCLI(
      ['--version'],
      { cwd: workspace.tempDir }
    );

    assert.strictEqual(result.exitCode, 0,
      'Version command must exit with code 0');
  });
});

// Run if directly invoked
if (require.main === module) {
  const Mocha = require('mocha');
  const mocha = new Mocha({ timeout: 60000 });
  mocha.addFile(__filename);
  mocha.run((failures) => {
    process.exit(failures > 0 ? 1 : 0);
  });
}
