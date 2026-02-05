/*
Command: verax bundle
Purpose: Deterministically pack an existing VERAX run directory into a bundle directory for upload/sharing.
Required: <runDir> <bundleDir>
Optional: none
Outputs: Exactly one RESULT/REASON/ACTION block (text only).
Exit Codes: 0 SUCCESS | 50 INVARIANT_VIOLATION | 64 USAGE_ERROR
Forbidden: interactive prompts; non-deterministic logs.
*/

import { resolve } from 'path';
import { existsSync, statSync } from 'fs';
import { DataError, UsageError } from '../util/support/errors.js';
import { packArtifacts } from '../util/ci/artifact-pack.js';
import { buildOutcome, EXIT_CODES } from '../config/cli-contract.js';
import { validateRunDirectory } from '../util/run-artifact-validation.js';
import { verifyBundleIntegrityOrThrow } from '../util/bundles/bundle-integrity.js';

export async function bundleCommand(runDir, bundleDir) {
  if (!runDir || !bundleDir) {
    throw new UsageError('bundle requires <runDir> <bundleDir>');
  }

  const fullRunDir = resolve(runDir);
  const fullBundleDir = resolve(bundleDir);

  if (!existsSync(fullRunDir)) {
    throw new DataError(`Run directory not found: ${fullRunDir}`);
  }

  try {
    if (!statSync(fullRunDir).isDirectory()) {
      throw new DataError(`Run path is not a directory: ${fullRunDir}`);
    }
  } catch (error) {
    if (error instanceof DataError) throw error;
    throw new DataError(`Failed to access run directory: ${fullRunDir}`);
  }

  const validation = validateRunDirectory(fullRunDir);
  if (!validation.valid) {
    const missing = Array.isArray(validation.missingFiles) ? validation.missingFiles.map((p) => String(p)).sort() : [];
    const corrupted = Array.isArray(validation.corruptedFiles) ? validation.corruptedFiles.map((c) => String(c.filePath)).sort() : [];
    const details = [
      missing.length > 0 ? `missing=${missing.map((p) => p.split(/[/\\\\]/).pop()).join(', ')}` : null,
      corrupted.length > 0 ? `corrupted=${corrupted.map((p) => p.split(/[/\\\\]/).pop()).join(', ')}` : null,
    ].filter(Boolean).join(' ');
    throw new DataError(`Run directory is missing REQUIRED artifacts. ${details}`.trim());
  }

  try {
    const result = packArtifacts(fullRunDir, fullBundleDir);
    verifyBundleIntegrityOrThrow(fullBundleDir);
    const outcome = buildOutcome({
      command: 'bundle',
      exitCode: EXIT_CODES.SUCCESS,
      reason: `Packed ${result.fileCount} file(s)`,
      action: `Bundle created at ${result.bundleDir}`,
    });
    return { outcome };
  } catch (error) {
    if (error instanceof DataError || error instanceof UsageError) {
      throw error;
    }
    throw new DataError(error instanceof Error ? error.message : 'Failed to bundle artifacts');
  }
}
