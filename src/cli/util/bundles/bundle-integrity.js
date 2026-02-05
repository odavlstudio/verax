import { join } from 'path';
import { existsSync } from 'fs';
import { DataError } from '../support/errors.js';
import { getTimeProvider } from '../support/time-provider.js';
import {
  MANIFEST_FILENAME,
  generateRunIntegrityManifest,
  loadRunIntegrityManifest,
  writeRunIntegrityManifest,
  verifyRunIntegrityManifest,
} from '../evidence/integrity-manifest.js';

function formatVerificationIssueSummary(verification) {
  const missing = Array.isArray(verification?.missing) ? verification.missing : [];
  const mismatched = Array.isArray(verification?.mismatched) ? verification.mismatched : [];
  const extra = Array.isArray(verification?.extraArtifacts) ? verification.extraArtifacts : [];
  const parts = [];
  if (missing.length > 0) parts.push(`missing=${missing.length}`);
  if (mismatched.length > 0) parts.push(`mismatched=${mismatched.length}`);
  if (extra.length > 0) parts.push(`extra=${extra.length}`);
  return parts.length > 0 ? parts.join(', ') : 'unknown';
}

export function writeAndVerifyBundleIntegrityManifest(bundleDir, { bundleId = null, toolVersion = null } = {}) {
  const timeProvider = getTimeProvider();
  const { manifest, errors } = generateRunIntegrityManifest(bundleDir, { runId: bundleId, toolVersion });

  if (errors.length > 0) {
    throw new DataError(`Failed to generate integrity manifest: ${errors[0]}`);
  }

  const manifestWithMeta = {
    ...manifest,
    // keep deterministic in tests via time-provider
    generatedAt: manifest.generatedAt || timeProvider.iso(),
  };

  const write = writeRunIntegrityManifest(bundleDir, manifestWithMeta);
  if (!write.ok) {
    throw new DataError('Failed to write integrity manifest.');
  }

  const verification = verifyRunIntegrityManifest(bundleDir, manifestWithMeta);
  if (!verification.ok) {
    throw new DataError(
      `Bundle integrity verification failed (${formatVerificationIssueSummary(verification)}).`
    );
  }

  return {
    ok: true,
    manifestPath: join(bundleDir, MANIFEST_FILENAME),
    manifest: manifestWithMeta,
  };
}

export function verifyBundleIntegrityOrThrow(bundleDir) {
  const manifestPath = join(bundleDir, MANIFEST_FILENAME);
  if (!existsSync(manifestPath)) {
    const err = new DataError('Integrity manifest missing in bundle.');
    err.action = `Regenerate the bundle; expected ${MANIFEST_FILENAME} in the bundle root.`;
    throw err;
  }

  const loaded = loadRunIntegrityManifest(bundleDir);
  if (!loaded.ok) {
    const err = new DataError(`Integrity manifest is invalid: ${loaded.error}`);
    err.action = 'Regenerate the bundle from the original artifacts.';
    throw err;
  }

  const verification = verifyRunIntegrityManifest(bundleDir, loaded.manifest);
  if (!verification.ok) {
    const err = new DataError(
      `Bundle appears to be tampered or incomplete (${formatVerificationIssueSummary(verification)}).`
    );
    err.action = 'Do not trust this bundle. Regenerate it from the original run directory.';
    throw err;
  }

  return { ok: true, manifest: loaded.manifest, verification };
}
