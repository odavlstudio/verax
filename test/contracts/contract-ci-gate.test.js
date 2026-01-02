/**
 * CONTRACT A — CI GATE DEFAULT IS STRICT
 * 
 * Locks the behavior:
 * - CI gate without --mode flag defaults to strict mode (not advisory)
 * - Must fail with non-zero exit code when verdict is DO_NOT_LAUNCH
 * - Advisory mode requires explicit --mode advisory flag and prints warning
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  spawnGuardianCLI,
  createTempWorkspace,
  cleanupTempWorkspace,
} = require('./test-harness');

describe('CONTRACT A: CI Gate Default Strict Behavior', () => {
  let workspace;

  beforeEach(() => {
    workspace = createTempWorkspace('contract-ci-gate-');
  });

  afterEach(() => {
    cleanupTempWorkspace(workspace.tempDir);
  });

  it('CI gate without --mode flag defaults to strict mode', async function() {
    this.timeout(30000);

    // Create a minimal fixture that will fail (bad URL)
    const result = await spawnGuardianCLI(
      ['ci', '--url', 'http://invalid-url-test.local'],
      { cwd: workspace.tempDir }
    );

    // CI gate should run and return non-zero for error/failure
    assert.ok(result.exitCode !== 0, 
      'CI gate with failing URL must exit non-zero in strict mode (default)');
    
    // Output should NOT contain "advisory mode" text
    const combined = result.stdout + result.stderr;
    assert.ok(!combined.toLowerCase().includes('advisory mode'),
      'Default CI gate should NOT run in advisory mode');
  });

  it('CI gate fails with exit code 3 on system failures', async function() {
    this.timeout(30000);

    // Unreachable URL triggers ERROR (system failure), not DO_NOT_LAUNCH
    const result = await spawnGuardianCLI(
      ['ci', '--url', 'http://127.0.0.1:9999'],
      { cwd: workspace.tempDir }
    );

    // CANONICAL: System failures (unreachable) are ERROR, MUST exit 3
    assert.strictEqual(result.exitCode, 3,
      `CI gate with unreachable URL must exit with code 3 (ERROR), got ${result.exitCode}`);
  });

  it('Advisory mode requires explicit --mode advisory flag', async function() {
    this.timeout(30000);

    // Note: --mode advisory may not be implemented yet, but the contract
    // is that if advisory mode exists, it MUST require explicit flag
    // For now, we verify default is NOT advisory
    
    const result = await spawnGuardianCLI(
      ['ci', '--url', 'http://invalid-test.local'],
      { cwd: workspace.tempDir }
    );

    const combined = result.stdout + result.stderr;
    
    // Default CI gate must NOT print advisory warnings
    assert.ok(!combined.includes('ADVISORY'),
      'Default CI gate must NOT show advisory warnings');
    
    // CI gate must fail closed (non-zero exit) not advisory open
    assert.ok(result.exitCode !== 0,
      'Default CI gate must fail closed, not pass in advisory mode');
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
