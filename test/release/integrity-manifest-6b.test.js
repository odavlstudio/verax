/**
 * Evidence Integrity & Anti-Tampering
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { generateRunIntegrityManifest, writeRunIntegrityManifest, verifyRunIntegrityManifest } from '../../src/cli/util/evidence/integrity-manifest.js';
import { inspectCommand } from '../../src/cli/commands/inspect.js';

function createRunDir(name) {
  const dir = mkdtempSync(join(tmpdir(), `${name}-`));
  writeFileSync(join(dir, 'summary.json'), JSON.stringify({ runId: name, status: 'SUCCESS' }));
  writeFileSync(join(dir, 'findings.json'), JSON.stringify({ findings: [] }));
  writeFileSync(join(dir, 'decision.json'), JSON.stringify({ runId: name, outcome: 'CLEAN', counts: {} }));
  mkdirSync(join(dir, 'evidence'), { recursive: true });
  writeFileSync(join(dir, 'evidence', 'proof.txt'), 'evidence');
  mkdirSync(join(dir, '.staging'), { recursive: true });
  writeFileSync(join(dir, '.staging', 'skip.txt'), 'ignore');
  return dir;
}

describe('Stage 6B: Integrity manifest', () => {
  const createdDirs = [];

  test.afterEach(() => {
    while (createdDirs.length > 0) {
      const dir = createdDirs.pop();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('produces deterministic manifest and excludes staging/self', () => {
    const dir = createRunDir('integrity-6b-deterministic');
    createdDirs.push(dir);

    const first = generateRunIntegrityManifest(dir, { runId: 'det-1' });
    const second = generateRunIntegrityManifest(dir, { runId: 'det-1' });

    const firstPaths = first.manifest.artifacts.map((a) => a.path);
    const secondPaths = second.manifest.artifacts.map((a) => a.path);

    assert.deepStrictEqual(firstPaths, secondPaths);
    assert.ok(firstPaths.every((p) => !p.startsWith('.staging')));
    assert.ok(firstPaths.every((p) => p !== 'integrity.manifest.json'));
    assert.deepStrictEqual(first.manifest.artifacts.map((a) => a.sha256), second.manifest.artifacts.map((a) => a.sha256));
  });

  test('detects tampered artifacts', () => {
    const dir = createRunDir('integrity-6b-tamper');
    createdDirs.push(dir);

    const { manifest } = generateRunIntegrityManifest(dir, { runId: 'tamper-1' });
    writeRunIntegrityManifest(dir, manifest);

    writeFileSync(join(dir, 'summary.json'), JSON.stringify({ tampered: true }));
    const verification = verifyRunIntegrityManifest(dir, manifest);

    assert.strictEqual(verification.status, 'FAILED');
    assert.ok(verification.mismatched.some((m) => m.path === 'summary.json'));
  });

  test('detects missing and extra artifacts', () => {
    const dir = createRunDir('integrity-6b-missing-extra');
    createdDirs.push(dir);

    const { manifest } = generateRunIntegrityManifest(dir, { runId: 'mix-1' });
    writeRunIntegrityManifest(dir, manifest);

    rmSync(join(dir, 'findings.json'));
    writeFileSync(join(dir, 'extra.json'), JSON.stringify({ extra: true }));

    const verification = verifyRunIntegrityManifest(dir, manifest);

    assert.strictEqual(verification.status, 'FAILED');
    assert.ok(verification.missing.some((m) => m.path === 'findings.json'));
    assert.ok(verification.extraArtifacts.includes('extra.json'));
  });

  test('inspect reports PASSED when manifest matches artifacts', async () => {
    const dir = createRunDir('integrity-6b-inspect-pass');
    createdDirs.push(dir);

    const { manifest } = generateRunIntegrityManifest(dir, { runId: 'inspect-pass' });
    writeRunIntegrityManifest(dir, manifest);

    const result = await inspectCommand(dir, { json: true });

    assert.strictEqual(result.jsonPayload.integrity.status, 'PASSED');
    assert.strictEqual(result.jsonPayload.integrity.missing.length, 0);
    assert.strictEqual(result.jsonPayload.integrity.extraArtifacts.length, 0);
  });

  test('inspect reports missing manifest for incomplete runs', async () => {
    const dir = createRunDir('integrity-6b-inspect-missing');
    createdDirs.push(dir);

    const result = await inspectCommand(dir, { json: true });

    assert.strictEqual(result.jsonPayload.integrity.status, 'MISSING');
  });

  test('incomplete runs still emit manifest for existing artifacts', () => {
    const dir = createRunDir('integrity-6b-incomplete');
    createdDirs.push(dir);

    // Simulate incomplete status but keep artifacts present
    writeFileSync(join(dir, 'run.status.json'), JSON.stringify({ status: 'INCOMPLETE' }));

    const { manifest } = generateRunIntegrityManifest(dir, { runId: 'incomplete-1' });
    writeRunIntegrityManifest(dir, manifest);

    const verification = verifyRunIntegrityManifest(dir, manifest);
    assert.strictEqual(verification.status, 'PASSED');
    assert.ok(manifest.artifactCount >= 4);
  });
});




