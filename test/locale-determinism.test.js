/**
 * Locale Determinism Tests (ISSUE #25 - Batch A4.2)
 * Ensures artifact generation is locale-independent
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
import { buildEvidenceManifest } from '../src/cli/util/evidence/evidence-manifest.js';

/**
 * Helper to temporarily override locale environment variables
 */
function withLocale(locale, fn) {
  const original = {
    LC_ALL: process.env.LC_ALL,
    LANG: process.env.LANG,
    LC_COLLATE: process.env.LC_COLLATE
  };

  try {
    process.env.LC_ALL = locale;
    process.env.LANG = locale;
    process.env.LC_COLLATE = locale;
    return fn();
  } finally {
    // Restore original values
    if (original.LC_ALL !== undefined) {
      process.env.LC_ALL = original.LC_ALL;
    } else {
      delete process.env.LC_ALL;
    }
    if (original.LANG !== undefined) {
      process.env.LANG = original.LANG;
    } else {
      delete process.env.LANG;
    }
    if (original.LC_COLLATE !== undefined) {
      process.env.LC_COLLATE = original.LC_COLLATE;
    } else {
      delete process.env.LC_COLLATE;
    }
  }
}

test('evidence-manifest: deterministic across different locales', () => {
  const tmpRoot = mkdtempSync(join(os.tmpdir(), 'verax-locale-'));
  const runDir = join(tmpRoot, 'runs', 'RUN_LOCALE');
  const evidenceDir = join(runDir, 'evidence');

  mkdirSync(evidenceDir, { recursive: true });

  // Create files with names that sort differently in different locales
  // German: ä comes after z
  // Turkish: i and İ are different
  // English: standard ASCII order
  writeFileSync(join(evidenceDir, 'apple.txt'), 'A');
  writeFileSync(join(evidenceDir, 'banana.txt'), 'B');
  writeFileSync(join(evidenceDir, 'ärger.txt'), 'Ä'); // German word
  writeFileSync(join(evidenceDir, 'zebra.txt'), 'Z');

  // Generate manifest under different locale settings
  const manifestEnUS = withLocale('en_US.UTF-8', () => 
    buildEvidenceManifest(evidenceDir, runDir)
  );

  const manifestDeDE = withLocale('de_DE.UTF-8', () => 
    buildEvidenceManifest(evidenceDir, runDir)
  );

  const manifestTrTR = withLocale('tr_TR.UTF-8', () => 
    buildEvidenceManifest(evidenceDir, runDir)
  );

  const manifestArEG = withLocale('ar_EG.UTF-8', () => 
    buildEvidenceManifest(evidenceDir, runDir)
  );

  // Extract paths for comparison (excluding volatile manifestGeneratedAt)
  const getPathOrder = (manifest) => manifest.evidenceFiles.map(e => e.path);

  const pathsEnUS = getPathOrder(manifestEnUS);
  const pathsDeDE = getPathOrder(manifestDeDE);
  const pathsTrTR = getPathOrder(manifestTrTR);
  const pathsArEG = getPathOrder(manifestArEG);

  // Assert: All locales produce identical path ordering
  assert.deepStrictEqual(pathsDeDE, pathsEnUS, 'German locale must produce same order as English');
  assert.deepStrictEqual(pathsTrTR, pathsEnUS, 'Turkish locale must produce same order as English');
  assert.deepStrictEqual(pathsArEG, pathsEnUS, 'Arabic locale must produce same order as English');

  // Assert: Ordering is stable and predictable
  const expectedOrder = [
    'evidence/apple.txt',
    'evidence/banana.txt',
    'evidence/zebra.txt',
    'evidence/ärger.txt'
  ].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));

  assert.deepStrictEqual(pathsEnUS, expectedOrder, 'Path order must match locale-independent sort');
});

test('evidence-manifest: JSON output byte-identical across locales', () => {
  const tmpRoot = mkdtempSync(join(os.tmpdir(), 'verax-json-locale-'));
  const runDir = join(tmpRoot, 'runs', 'RUN_JSON');
  const evidenceDir = join(runDir, 'evidence');

  mkdirSync(evidenceDir, { recursive: true });

  writeFileSync(join(evidenceDir, 'test.txt'), 'data');

  // Generate manifest under different locales
  const manifestEnUS = withLocale('en_US.UTF-8', () => 
    buildEvidenceManifest(evidenceDir, runDir)
  );

  const manifestDeDE = withLocale('de_DE.UTF-8', () => 
    buildEvidenceManifest(evidenceDir, runDir)
  );

  // Remove volatile timestamp field for comparison
  const normalize = (m) => {
    const copy = JSON.parse(JSON.stringify(m));
    delete copy.manifestGeneratedAt;
    return copy;
  };

  const normalizedEnUS = normalize(manifestEnUS);
  const normalizedDeDE = normalize(manifestDeDE);

  // Assert: Normalized manifests are byte-identical
  assert.deepStrictEqual(
    normalizedDeDE,
    normalizedEnUS,
    'Manifests must be identical across locales (excluding timestamps)'
  );

  // Assert: JSON serialization is identical
  const jsonEnUS = JSON.stringify(normalizedEnUS, null, 2);
  const jsonDeDE = JSON.stringify(normalizedDeDE, null, 2);

  assert.strictEqual(jsonDeDE, jsonEnUS, 'JSON output must be byte-identical across locales');
});

test('locale-determinism: sorting preserves order with Unicode characters', () => {
  // Test that our locale-independent sort handles Unicode correctly
  const paths = [
    'evidence/café.txt',
    'evidence/resume.txt',
    'evidence/résumé.txt',
    'evidence/Über.txt',
    'evidence/zoo.txt'
  ];

  // Sort using same approach as evidence-manifest
  const sorted = [...paths].sort((a, b) => 
    a.localeCompare(b, 'en', { sensitivity: 'base' })
  );

  // Verify deterministic ordering
  const sortedAgain = [...paths].sort((a, b) => 
    a.localeCompare(b, 'en', { sensitivity: 'base' })
  );

  assert.deepStrictEqual(sorted, sortedAgain, 'Sort must be deterministic');

  // Verify with different locale doesn't change order
  const sortedDifferentLocale = withLocale('de_DE.UTF-8', () => 
    [...paths].sort((a, b) => 
      a.localeCompare(b, 'en', { sensitivity: 'base' })
    )
  );

  assert.deepStrictEqual(
    sortedDifferentLocale,
    sorted,
    'Explicit locale parameter must override system locale'
  );
});




