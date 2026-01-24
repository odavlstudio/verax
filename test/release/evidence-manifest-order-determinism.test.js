/**
 * Evidence Manifest Ordering Determinism Test (ISSUE #24)
 * Proves sorting determinism and guards against removal of sort.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { buildEvidenceManifest } from '../../src/cli/util/evidence/evidence-manifest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '../..');

test('evidence-manifest: static guard ensures path sort is present', () => {
  const source = readFileSync(join(ROOT, 'src/cli/util/evidence/evidence-manifest.js'), 'utf8');
  assert.ok(
    source.includes("manifest.evidenceFiles.sort((a, b) => a.path.localeCompare(b.path, 'en', { sensitivity: 'base' }))"),
    'Path-based sort with locale-independent comparison must exist to ensure determinism'
  );
});

test('evidence-manifest: runtime output is sorted by path', () => {
  const tmpRoot = mkdtempSync(join(os.tmpdir(), 'verax-evidence-'));
  const runDir = join(tmpRoot, 'runs', 'RUN123');
  const evidenceDir = join(runDir, 'evidence');
  const imgDir = join(evidenceDir, 'img');
  const txtDir = join(evidenceDir, 'txt');
  mkdirSync(imgDir, { recursive: true });
  mkdirSync(txtDir, { recursive: true });

  writeFileSync(join(imgDir, 'b.png'), Buffer.from('IMG_B'));
  writeFileSync(join(imgDir, 'a.png'), Buffer.from('IMG_A'));
  writeFileSync(join(txtDir, 'd.txt'), Buffer.from('TXT_D'));
  writeFileSync(join(txtDir, 'c.txt'), Buffer.from('TXT_C'));

  const manifest = buildEvidenceManifest(evidenceDir, runDir);
  const paths = manifest.evidenceFiles.map(e => e.path);
  const sorted = [...paths].sort((a, b) => a.localeCompare(b));
  assert.deepStrictEqual(paths, sorted, 'Manifest entries must be sorted by path');
});




