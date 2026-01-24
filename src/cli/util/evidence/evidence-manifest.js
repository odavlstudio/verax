/**
 * Evidence Manifest Engine
 * Produces deterministic SHA256 hashes and manifest of all evidence files
 * Enables verification that evidence bytes are identical across runs
 */

import { createHash } from 'crypto';
import { readdirSync, readFileSync, statSync } from 'fs';
import { resolve, relative } from 'path';
import { getTimeProvider } from '../support/time-provider.js';
import { atomicWriteJson } from '../support/atomic-write.js';
import { normalizeToPosixPath } from '../support/normalize-path.js';

/**
 * Compute SHA256 hash of a file
 * @param {string} filePath - absolute path to file
 * @returns {string} hex-encoded SHA256 hash
 */
export function hashFile(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const hash = createHash('sha256');
    hash.update(content);
    // @ts-expect-error - hash.digest('hex') returns string
    return hash.digest('hex');
  } catch (e) {
    return null;
  }
}

/**
 * Build deterministic evidence manifest
 * Scans evidence directory and creates manifest with stable ordering
 * @param {string} evidencePath - path to evidence directory
 * @param {string} runDir - path to run directory (for relative paths)
 * @returns {Object} manifest with entries sorted by relative path
 */
export function buildEvidenceManifest(evidencePath, runDir) {
  const manifest = {
    version: 1,
    evidenceFiles: [],
    manifestGeneratedAt: getTimeProvider().iso(), // volatile, excluded from digest
  };

  try {
    // Recursively collect all files
    const collectFiles = (dir, basePath = '') => {
      const files = readdirSync(dir, { withFileTypes: true })
        // @ts-ignore - Dirent has name property
        .sort((a, b) => a.name.localeCompare(b.name, 'en'));
      for (const file of files) {
        const fullPath = resolve(dir, file.name);
        const relPath = normalizeToPosixPath(relative(runDir, fullPath));

        if (file.isDirectory()) {
          collectFiles(fullPath, basePath ? `${basePath}/${file.name}` : file.name);
        } else if (file.isFile()) {
          const stat = statSync(fullPath);
          const hash = hashFile(fullPath);

          if (hash) {
            manifest.evidenceFiles.push({
              path: relPath,
              sha256: hash,
              sizeBytes: stat.size,
              type: file.name.split('.').pop() || 'unknown',
            });
          }
        }
      }
    };

    collectFiles(evidencePath);

    // CRITICAL: This sort is required for determinism. Filesystem order is non-deterministic across platforms.
    // CRITICAL: Sorting must be locale-independent for determinism.
    manifest.evidenceFiles.sort((a, b) => a.path.localeCompare(b.path, 'en', { sensitivity: 'base' }));

    return manifest;
  } catch (e) {
    // If evidence directory doesn't exist, return empty manifest
    return manifest;
  }
}

/**
 * Write evidence manifest to evidence.manifest.json
 * @param {string} runDir - path to run directory
 * @param {string} evidencePath - path to evidence directory
 */
export function writeEvidenceManifest(runDir, evidencePath) {
  try {
    const manifest = buildEvidenceManifest(evidencePath, runDir);
    const manifestPath = resolve(runDir, 'evidence.manifest.json');
    atomicWriteJson(manifestPath, manifest);
    return manifest;
  } catch (e) {
    // Silently fail if manifest cannot be written
    return null;
  }
}








