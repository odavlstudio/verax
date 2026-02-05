/**
 * Phase 5: Bundle Integrity + Capability Schema Lock
 *
 * Locks trust for:
 * - `verax bundle` outputs (integrity.manifest.json required + verifiable)
 * - capability bundles (integrity manifest + strict capability.json schema)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import { packArtifacts } from '../../src/cli/util/ci/artifact-pack.js';
import { verifyBundleIntegrityOrThrow, writeAndVerifyBundleIntegrityManifest } from '../../src/cli/util/bundles/bundle-integrity.js';
import { validateCapabilityBundleDirOrThrow } from '../../src/cli/util/bundles/capability-bundle-validator.js';

test('verax bundle output carries integrity.manifest.json and detects tampering', () => {
  const base = mkdtempSync(join(tmpdir(), 'verax-bundle-integrity-'));
  try {
    const runDir = join(base, 'run');
    const bundleDir = join(base, 'bundle');
    mkdirSync(runDir, { recursive: true });
    mkdirSync(join(runDir, 'evidence'), { recursive: true });
    writeFileSync(join(runDir, 'summary.json'), JSON.stringify({ status: 'SUCCESS' }, null, 2));
    writeFileSync(join(runDir, 'evidence', 'e1.json'), JSON.stringify({ id: 'e1' }, null, 2));

    packArtifacts(runDir, bundleDir);

    const manifestText = readFileSync(join(bundleDir, 'integrity.manifest.json'), 'utf8');
    const manifest = JSON.parse(manifestText);
    assert.ok(manifest.manifestVersion, 'manifest must include manifestVersion');
    assert.ok(manifest.generatedAt, 'manifest must include generatedAt');
    assert.ok(Array.isArray(manifest.artifacts), 'manifest must include artifacts array');

    assert.doesNotThrow(() => verifyBundleIntegrityOrThrow(bundleDir), 'valid bundle must verify');

    // Tamper with a file in the bundle
    writeFileSync(join(bundleDir, 'summary.json'), JSON.stringify({ tampered: true }, null, 2));
    assert.throws(() => verifyBundleIntegrityOrThrow(bundleDir), /tampered|integrity|FAILED/i);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('bundle integrity fails when a manifest-listed file is missing', () => {
  const base = mkdtempSync(join(tmpdir(), 'verax-bundle-missing-'));
  try {
    const runDir = join(base, 'run');
    const bundleDir = join(base, 'bundle');
    mkdirSync(runDir, { recursive: true });
    writeFileSync(join(runDir, 'summary.json'), JSON.stringify({ status: 'SUCCESS' }, null, 2));
    writeFileSync(join(runDir, 'findings.json'), JSON.stringify({ findings: [] }, null, 2));

    packArtifacts(runDir, bundleDir);
    assert.doesNotThrow(() => verifyBundleIntegrityOrThrow(bundleDir));

    unlinkSync(join(bundleDir, 'findings.json'));
    assert.throws(() => verifyBundleIntegrityOrThrow(bundleDir), /missing|tampered|integrity/i);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('capability bundle schema rejects unknown top-level keys (even if manifest matches)', () => {
  const base = mkdtempSync(join(tmpdir(), 'verax-cap-schema-'));
  try {
    const bundleDir = join(base, 'capability');
    mkdirSync(bundleDir, { recursive: true });

    const capabilityJson = {
      header: 'This bundle is diagnostic-only. It does NOT evaluate site quality or correctness.',
      command: 'capability-bundle',
      generatedAt: '2026-01-01T00:00:00.000Z',
      target: { url: 'https://example.com/' },
      readiness: { readinessLevel: 'PARTIAL', estimatedValuePercent: 20, reasons: [] },
      signals: {},
      interactionSurfaceSummary: { links: 0, buttons: 0, forms: 0, inputs: 0 },
      stopPoints: [],
      _noUserData: true,
      _noSelectors: true,
      _noAuth: true,
      _noSource: true,
      _noVerdicts: true,
      _schemaVersion: 1,
    };

    writeFileSync(join(bundleDir, 'capability.json'), JSON.stringify(capabilityJson, null, 2) + '\n', 'utf8');
    writeFileSync(join(bundleDir, 'capability-summary.txt'), 'diagnostic-only\n', 'utf8');

    writeAndVerifyBundleIntegrityManifest(bundleDir, { bundleId: 'test', toolVersion: 'verax 0.4.9' });
    assert.doesNotThrow(() => validateCapabilityBundleDirOrThrow(bundleDir));

    // Add extra key and re-seal manifest to simulate adversary recomputation
    const tampered = { ...capabilityJson, extraKey: 'not allowed' };
    writeFileSync(join(bundleDir, 'capability.json'), JSON.stringify(tampered, null, 2) + '\n', 'utf8');
    writeAndVerifyBundleIntegrityManifest(bundleDir, { bundleId: 'test', toolVersion: 'verax 0.4.9' });

    assert.throws(() => validateCapabilityBundleDirOrThrow(bundleDir), /unknown top-level key/i);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

