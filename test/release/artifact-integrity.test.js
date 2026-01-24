/**
 *  Cryptographic Integrity Tests
 * 
 * Verifies SHA256-based artifact integrity system.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { getTimeProvider } from '../../src/cli/util/support/time-provider.js';
import {
  computeFileIntegrity,
  generateIntegrityManifest,
  writeIntegrityManifest,
  verifyArtifactIntegrity,
  loadIntegrityManifest,
  verifyAllArtifacts,
  discoverArtifacts,
} from '../../src/verax/core/integrity/integrity.js';

const testDir = join(tmpdir(), `verax-integrity-test-${getTimeProvider().now()}`);

describe(' Cryptographic Integrity', () => {
  test.beforeEach(() => {
    if (rmSync(testDir, { recursive: true, force: true })) {
      // Cleanup
    }
    mkdirSync(testDir, { recursive: true });
  });
  
  test.afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });
  
  test('should compute file integrity (SHA256)', () => {
    const filePath = join(testDir, 'test.json');
    const content = { test: 'data', value: 42 };
    writeFileSync(filePath, JSON.stringify(content));
    
    const integrity = computeFileIntegrity(filePath);
    
    assert.strictEqual(typeof integrity.hash, 'string');
    assert.strictEqual(integrity.hash.length, 64); // SHA256 hex length
    assert.strictEqual(integrity.size, JSON.stringify(content).length);
    assert.strictEqual(integrity.error, undefined);
  });
  
  test('should return error for non-existent file', () => {
    const filePath = join(testDir, 'missing.json');
    const integrity = computeFileIntegrity(filePath);
    
    assert.strictEqual(integrity.hash, null);
    assert.strictEqual(integrity.size, 0);
    assert.strictEqual(typeof integrity.error, 'string');
  });
  
  test('should generate integrity manifest for artifacts', () => {
    // Create artifacts
    writeFileSync(join(testDir, 'summary.json'), JSON.stringify({ test: 1 }));
    writeFileSync(join(testDir, 'findings.json'), JSON.stringify({ test: 2 }));
    writeFileSync(join(testDir, 'ledger.json'), JSON.stringify({ test: 3 }));
    
    const { manifest, errors } = generateIntegrityManifest(testDir, [
      'summary.json',
      'findings.json',
      'ledger.json',
    ]);
    
    assert.strictEqual(errors.length, 0);
    assert.strictEqual(manifest.version, 1);
    assert.strictEqual(typeof manifest.generatedAt, 'string');
    assert.strictEqual(Object.keys(manifest.artifacts).length, 3);
    
    // Verify each artifact has hash and size
    assert.ok(manifest.artifacts['summary.json'].sha256);
    assert.ok(manifest.artifacts['findings.json'].sha256);
    assert.ok(manifest.artifacts['ledger.json'].sha256);
    assert.strictEqual(typeof manifest.artifacts['summary.json'].size, 'number');
  });
  
  test('should write integrity manifest atomically', () => {
    const manifest = {
      version: 1,
      generatedAt: getTimeProvider().iso(),
      runDir: testDir,
      artifacts: {
        'test.json': {
          sha256: 'abc123',
          size: 100,
        },
      },
    };
    
    const result = writeIntegrityManifest(testDir, manifest);
    
    assert.strictEqual(result.ok, true);
    assert.strictEqual(typeof result.path, 'string');
    
    // Verify file exists and is valid JSON
    const content = readFileSync(result.path, 'utf8');
    const loaded = JSON.parse(content);
    assert.strictEqual(loaded.version, 1);
  });
  
  test('should verify artifact integrity against manifest', () => {
    const content = JSON.stringify({ test: 'data' });
    const filePath = join(testDir, 'test.json');
    writeFileSync(filePath, content);
    
    const integrity = computeFileIntegrity(filePath);
    const manifest = {
      artifacts: {
        'test.json': {
          sha256: integrity.hash,
          size: integrity.size,
        },
      },
    };
    
    const result = verifyArtifactIntegrity(testDir, 'test.json', manifest);
    
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.error, undefined);
  });
  
  test('should detect hash mismatch (tampering)', () => {
    const content = JSON.stringify({ test: 'original' });
    const filePath = join(testDir, 'test.json');
    writeFileSync(filePath, content);
    
    const integrity = computeFileIntegrity(filePath);
    
    // Tamper with file
    writeFileSync(filePath, JSON.stringify({ test: 'tampered' }));
    
    const manifest = {
      artifacts: {
        'test.json': {
          sha256: integrity.hash,
          size: integrity.size,
        },
      },
    };
    
    const result = verifyArtifactIntegrity(testDir, 'test.json', manifest);
    
    assert.strictEqual(result.ok, false);
    assert.ok(result.error.includes('hash mismatch'));
    assert.strictEqual(typeof result.expectedHash, 'string');
    assert.strictEqual(typeof result.actualHash, 'string');
    assert.notStrictEqual(result.expectedHash, result.actualHash);
  });
  
  test('should detect size mismatch', () => {
    const content = JSON.stringify({ test: 'data' });
    const filePath = join(testDir, 'test.json');
    writeFileSync(filePath, content);
    
    const manifest = {
      artifacts: {
        'test.json': {
          sha256: computeFileIntegrity(filePath).hash,
          size: 999, // Wrong size
        },
      },
    };
    
    const result = verifyArtifactIntegrity(testDir, 'test.json', manifest);
    
    assert.strictEqual(result.ok, false);
    assert.ok(result.error.includes('size mismatch'));
  });
  
  test('should load integrity manifest', () => {
    const manifest = {
      version: 1,
      generatedAt: getTimeProvider().iso(),
      artifacts: {},
    };
    
    const manifestPath = join(testDir, 'integrity.manifest.json');
    writeFileSync(manifestPath, JSON.stringify(manifest));
    
    const result = loadIntegrityManifest(testDir);
    
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.manifest.version, 1);
  });
  
  test('should verify all artifacts in manifest', () => {
    // Create artifacts
    writeFileSync(join(testDir, 'file1.json'), JSON.stringify({ a: 1 }));
    writeFileSync(join(testDir, 'file2.json'), JSON.stringify({ b: 2 }));
    
    const { manifest } = generateIntegrityManifest(testDir, ['file1.json', 'file2.json']);
    
    const result = verifyAllArtifacts(testDir, manifest);
    
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.verified.length, 2);
    assert.strictEqual(result.failed.length, 0);
  });
  
  test('should report all failed verifications', () => {
    // Create artifacts
    writeFileSync(join(testDir, 'file1.json'), JSON.stringify({ a: 1 }));
    writeFileSync(join(testDir, 'file2.json'), JSON.stringify({ b: 2 }));
    
    const { manifest } = generateIntegrityManifest(testDir, ['file1.json', 'file2.json']);
    
    // Tamper with both files
    writeFileSync(join(testDir, 'file1.json'), JSON.stringify({ a: 999 }));
    writeFileSync(join(testDir, 'file2.json'), JSON.stringify({ b: 999 }));
    
    const result = verifyAllArtifacts(testDir, manifest);
    
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.verified.length, 0);
    assert.strictEqual(result.failed.length, 2);
    assert.ok(result.failed[0].error.includes('mismatch'));
  });
  
  test('should discover JSON artifacts', () => {
    writeFileSync(join(testDir, 'summary.json'), '{}');
    writeFileSync(join(testDir, 'findings.json'), '{}');
    writeFileSync(join(testDir, 'other.txt'), 'text');
    writeFileSync(join(testDir, 'integrity.manifest.json'), '{}');
    
    const artifacts = discoverArtifacts(testDir);
    
    assert.strictEqual(artifacts.length, 2); // Excludes integrity.manifest.json and .txt
    assert.ok(artifacts.includes('summary.json'));
    assert.ok(artifacts.includes('findings.json'));
    assert.ok(!artifacts.includes('other.txt'));
    assert.ok(!artifacts.includes('integrity.manifest.json'));
  });
  
  test('should handle empty directory', () => {
    const artifacts = discoverArtifacts(testDir);
    assert.strictEqual(artifacts.length, 0);
  });
});


