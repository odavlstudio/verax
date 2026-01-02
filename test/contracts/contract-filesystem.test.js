/**
 * CONTRACT C — FILESYSTEM CONTAINMENT
 * 
 * Locks the behavior:
 * - Any attempt to set runDir/output to path outside safe base must:
 *   - Fail closed (exit with ERROR code 3)
 *   - NOT create files outside base
 * - Test traversal paths (..)
 * - Test absolute external paths
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  spawnGuardianCLI,
  createTempWorkspace,
  cleanupTempWorkspace,
} = require('./test-harness');

describe('CONTRACT C: Filesystem Containment', () => {
  let workspace;

  beforeEach(() => {
    workspace = createTempWorkspace('contract-filesystem-');
  });

  afterEach(() => {
    cleanupTempWorkspace(workspace.tempDir);
  });

  it('Traversal path (..) is rejected with error exit code', async function() {
    this.timeout(30000);

    const escapePath = path.join(workspace.artifactsDir, '..', '..', 'escape.txt');
    
    const result = await spawnGuardianCLI(
      ['smoke', '--url', 'http://example.com', '--artifacts', escapePath],
      { cwd: workspace.tempDir }
    );

    // CANONICAL: Filesystem containment violations are ERROR, MUST exit 3
    assert.strictEqual(result.exitCode, 3,
      `Traversal path must exit with code 3 (ERROR), got ${result.exitCode}`);

    // Verify no files created outside workspace
    const escapedPath = path.resolve(workspace.tempDir, '..', '..', 'escape.txt');
    assert.ok(!fs.existsSync(escapedPath),
      'Traversal path must NOT create files outside base directory');
  });

  it('Absolute external path is rejected with error exit code', async function() {
    this.timeout(30000);

    // Try to write to system temp directory (outside workspace)
    const externalPath = path.join(os.tmpdir(), 'guardian-evil-' + Date.now());
    
    const result = await spawnGuardianCLI(
      ['smoke', '--url', 'http://example.com', '--artifacts', externalPath],
      { cwd: workspace.tempDir }
    );

    // CANONICAL: Filesystem containment violations are ERROR, MUST exit 3
    assert.strictEqual(result.exitCode, 3,
      `External absolute path must exit with code 3 (ERROR), got ${result.exitCode}`);

    // Verify no guardian artifacts created at external path
    // (Some temp files from OS might exist, but no Guardian structure)
    const guardianMarkerFiles = ['.odavlguardian', 'decision.json', 'summary.md'];
    const hasGuardianArtifacts = guardianMarkerFiles.some(marker => {
      const checkPath = path.join(externalPath, marker);
      return fs.existsSync(checkPath);
    });
    
    assert.ok(!hasGuardianArtifacts,
      'External path must NOT contain Guardian artifacts');
    
    // Cleanup test path if it was somehow created
    if (fs.existsSync(externalPath)) {
      try {
        fs.rmSync(externalPath, { recursive: true, force: true });
      } catch (err) {
        // Ignore cleanup errors
      }
    }
  });

  it('Path safety module enforces containment at API level', () => {
    const { ensurePathWithinBase } = require('../../src/guardian/path-safety');
    
    const safeBase = path.resolve('/safe/base');
    
    // Valid path within base (must resolve within base)
    const validPath = ensurePathWithinBase(safeBase, path.join(safeBase, 'sub', 'file.txt'), 'test');
    assert.ok(validPath.includes('base'),
      'Valid path should be allowed');
    
    // Traversal attempt
    assert.throws(() => {
      ensurePathWithinBase(safeBase, path.join(safeBase, '..', '..', '..', 'etc', 'passwd'), 'test');
    }, /must stay within/, 'Traversal path must throw error');
    
    // Absolute external path
    assert.throws(() => {
      ensurePathWithinBase(safeBase, '/external/path', 'test');
    }, /must stay within/, 'External path must throw error');
    
    // Windows absolute path (if on Windows)
    if (process.platform === 'win32') {
      assert.throws(() => {
        ensurePathWithinBase('C:\\safe\\base', 'D:\\external', 'test');
      }, /must stay within/, 'Cross-drive path must throw error');
    }
  });

  it('Containment error has code EOUTOFBASE', () => {
    const { ensurePathWithinBase } = require('../../src/guardian/path-safety');
    
    try {
      ensurePathWithinBase('/safe/base', '/evil/path', 'test');
      assert.fail('Should have thrown error');
    } catch (err) {
      assert.strictEqual(err.code, 'EOUTOFBASE',
        'Containment error must have code EOUTOFBASE');
      assert.ok(err.message.includes('must stay within'),
        'Error message must explain containment requirement');
    }
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
