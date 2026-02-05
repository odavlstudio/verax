import os from 'os';
import { createHash } from 'crypto';
import { resolve, join, isAbsolute } from 'path';

/**
 * @param {string} projectRoot
 * @returns {string}
 */
function stableProjectKey(projectRoot) {
  const norm = String(projectRoot || '').replace(/\\/g, '/').toLowerCase();
  const hex = /** @type {string} */ (createHash('sha256').update(norm).digest('hex'));
  return hex.slice(0, 12);
}

/**
 * Canonical default output base for VERAX.
 *
 * Enterprise policy:
 * - Default outputs MUST NOT go to repo root.
 * - Default outputs MUST be deterministic and per-project.
 *
 * Override:
 * - VERAX_OUT_BASE: absolute or relative (resolved from CWD) base directory.
 *
 * @returns {string}
 */
export function getVeraxOutBaseDir() {
  const override = process.env.VERAX_OUT_BASE && String(process.env.VERAX_OUT_BASE).trim();
  if (override) return resolve(override);
  return join(os.tmpdir(), 'verax');
}

/**
 * Default per-project output directory (absolute).
 * Stored under the base directory using a stable hash of the projectRoot.
 *
 * @param {string} projectRoot
 * @returns {string}
 */
export function getDefaultVeraxOutDir(projectRoot) {
  const key = stableProjectKey(projectRoot);
  return join(getVeraxOutBaseDir(), 'projects', key);
}

/**
 * Normalize an --out value to an absolute directory path.
 * - If outDir is absolute: return it.
 * - If outDir is relative: resolve relative to projectRoot.
 * - If outDir is missing: return default per-project output directory.
 *
 * @param {string} projectRoot
 * @param {string|null|undefined} outDir
 * @returns {string}
 */
export function resolveVeraxOutDir(projectRoot, outDir) {
  const raw = outDir && String(outDir).trim();
  if (!raw) return getDefaultVeraxOutDir(projectRoot);
  if (isAbsolute(raw)) return raw;
  return resolve(projectRoot, raw);
}
