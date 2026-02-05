/*
Command: verax bundle create
Purpose: Create a shareable .tgz bundle from an existing VERAX run directory.
Required: create <runDir>
Optional: --out <dir|file.tgz>
Outputs: Exactly one RESULT/REASON/ACTION block (text only).
Exit Codes: 0 SUCCESS | 50 INVARIANT_VIOLATION | 64 USAGE_ERROR
Forbidden: interactive prompts; writing bundle outputs to repo root by default.
*/

import { resolve, dirname, basename, join } from 'path';
import { existsSync, statSync, mkdirSync } from 'fs';
import { spawnSync } from 'child_process';
import { DataError, UsageError } from '../util/support/errors.js';
import { buildOutcome, EXIT_CODES } from '../config/cli-contract.js';
import { validateRunDirectory } from '../util/run-artifact-validation.js';
import { resolveVeraxOutDir } from '../util/support/default-output-dir.js';

function isTgzPath(p) {
  const s = String(p || '').toLowerCase();
  return s.endsWith('.tgz') || s.endsWith('.tar.gz');
}

function createTgzOrThrow(inputDir, outputFile) {
  const absInput = resolve(inputDir);
  const absOut = resolve(outputFile);

  const parent = dirname(absInput);
  const name = basename(absInput);

  const proc = spawnSync('tar', ['-czf', absOut, '-C', parent, name], {
    encoding: 'utf8',
    windowsHide: true,
  });

  if (proc.error) {
    throw new DataError(`Failed to create bundle archive: ${proc.error.message}`);
  }
  if (proc.status !== 0) {
    const stderr = String(proc.stderr || '').trim();
    throw new DataError(`Failed to create bundle archive (tar exit ${proc.status}). ${stderr}`.trim());
  }

  return absOut;
}

export async function bundleCreateCommand({ runDir, out } = /** @type {{ runDir: string, out?: string }} */ ({})) {
  if (!runDir) {
    throw new UsageError('bundle create requires <runDir>');
  }

  const fullRunDir = resolve(runDir);
  if (!existsSync(fullRunDir)) {
    throw new DataError(`Run directory not found: ${fullRunDir}`);
  }
  if (!statSync(fullRunDir).isDirectory()) {
    throw new DataError(`Run path is not a directory: ${fullRunDir}`);
  }

  const validation = validateRunDirectory(fullRunDir);
  if (!validation.valid) {
    const missing = Array.isArray(validation.missingFiles) ? validation.missingFiles.map((p) => String(p)).sort() : [];
    const details = missing.length > 0 ? `missing=${missing.map((p) => p.split(/[/\\\\]/).pop()).join(', ')}` : '';
    throw new DataError(`Run directory is missing REQUIRED artifacts. ${details}`.trim());
  }

  const projectRoot = resolve(process.cwd());
  const defaultOutDir = resolveVeraxOutDir(projectRoot, null);
  const dest = out ? resolveVeraxOutDir(projectRoot, out) : join(defaultOutDir, 'bundles');

  const outputFile = isTgzPath(dest)
    ? dest
    : join(dest, `verax-bundle-${basename(fullRunDir)}.tgz`);

  mkdirSync(dirname(outputFile), { recursive: true });

  const bundlePath = createTgzOrThrow(fullRunDir, outputFile);

  const outcome = buildOutcome({
    command: 'bundle',
    exitCode: EXIT_CODES.SUCCESS,
    reason: 'Bundle archive created',
    action: `Bundle written to ${bundlePath}`,
  });

  return { outcome, bundlePath };
}

