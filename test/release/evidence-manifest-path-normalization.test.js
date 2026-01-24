/**
 * Evidence Manifest Path Normalization Regression Test (ISSUE #25 - Batch A4.1)
 * Ensures manifest always contains POSIX-style paths regardless of platform
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
import { buildEvidenceManifest } from '../../src/cli/util/evidence/evidence-manifest.js';

test('evidence-manifest: paths always use forward slashes (no backslashes)', () => {
  const tmpRoot = mkdtempSync(join(os.tmpdir(), 'verax-path-norm-'));
  const runDir = join(tmpRoot, 'runs', 'RUN_NORM');
  const evidenceDir = join(runDir, 'evidence');
  const nestedDir = join(evidenceDir, 'deep', 'nested', 'structure');
  
  mkdirSync(nestedDir, { recursive: true });
  
  // Create evidence files at various nesting levels
  writeFileSync(join(evidenceDir, 'root.txt'), 'root');
  writeFileSync(join(evidenceDir, 'deep', 'level1.txt'), 'level1');
  writeFileSync(join(evidenceDir, 'deep', 'nested', 'level2.txt'), 'level2');
  writeFileSync(join(evidenceDir, 'deep', 'nested', 'structure', 'level3.txt'), 'level3');
  
  const manifest = buildEvidenceManifest(evidenceDir, runDir);
  
  // Assert: All paths must contain only forward slashes
  for (const entry of manifest.evidenceFiles) {
    assert.ok(
      !entry.path.includes('\\'),
      `Path "${entry.path}" contains backslash - must use forward slashes only`
    );
    assert.ok(
      entry.path.includes('/') || !entry.path.includes('\\'),
      `Path "${entry.path}" must use forward slashes for cross-platform determinism`
    );
  }
  
  // Assert: Paths are valid POSIX-style relative paths
  const expectedPaths = [
    'evidence/root.txt',
    'evidence/deep/level1.txt',
    'evidence/deep/nested/level2.txt',
    'evidence/deep/nested/structure/level3.txt'
  ];
  
  const actualPaths = manifest.evidenceFiles.map(e => e.path).sort();
  assert.deepStrictEqual(actualPaths, expectedPaths.sort());
});

test('evidence-manifest: JSON output is stable (no platform-specific separators)', () => {
  const tmpRoot = mkdtempSync(join(os.tmpdir(), 'verax-json-stable-'));
  const runDir = join(tmpRoot, 'runs', 'RUN_STABLE');
  const evidenceDir = join(runDir, 'evidence');
  
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(join(evidenceDir, 'test.txt'), 'data');
  
  const manifest = buildEvidenceManifest(evidenceDir, runDir);
  const json = JSON.stringify(manifest, null, 2);
  
  // Assert: JSON contains no backslashes in paths (only content escaping allowed)
  const pathMatches = json.match(/"path":\s*"([^"]+)"/g) || [];
  for (const match of pathMatches) {
    const pathValue = match.match(/"path":\s*"([^"]+)"/)[1];
    assert.ok(
      !pathValue.includes('\\'),
      `JSON path value "${pathValue}" contains backslash - violates determinism`
    );
  }
});

test('evidence-manifest: deterministic across multiple builds (path normalization)', () => {
  const tmpRoot = mkdtempSync(join(os.tmpdir(), 'verax-deterministic-'));
  const runDir = join(tmpRoot, 'runs', 'RUN_DET');
  const evidenceDir = join(runDir, 'evidence');
  
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(join(evidenceDir, 'file.txt'), 'content');
  
  // Build manifest twice
  const manifest1 = buildEvidenceManifest(evidenceDir, runDir);
  const manifest2 = buildEvidenceManifest(evidenceDir, runDir);
  
  // Paths must be identical across runs
  assert.strictEqual(manifest1.evidenceFiles[0].path, manifest2.evidenceFiles[0].path);
  assert.ok(!manifest1.evidenceFiles[0].path.includes('\\'));
  assert.ok(!manifest2.evidenceFiles[0].path.includes('\\'));
});




