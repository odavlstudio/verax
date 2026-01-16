/**
 * PHASE 6A: Cryptographic Integrity System
 * 
 * Provides SHA256-based integrity verification for all run artifacts.
 * Ensures tamper detection and corruption protection.
 */

import { createHash } from 'crypto';
import { readFileSync, statSync as _statSync, readdirSync } from 'fs';
import { join, basename as _basename } from 'path';
import { atomicWriteJson } from '../../../cli/util/atomic-write.js';

/**
 * Compute SHA256 hash of file contents
 * 
 * @param {string} filePath - Absolute path to file
 * @returns {{ hash: string, size: number, error?: string }} Hash result
 */
export function computeFileIntegrity(filePath) {
  try {
    const content = readFileSync(filePath);
    const hash = createHash('sha256').update(content).digest('hex');
    const size = content.length;
    // @ts-expect-error - digest returns string
    return { hash, size };
  } catch (error) {
    return { hash: null, size: 0, error: error.message };
  }
}

/**
 * Generate integrity manifest for all artifacts in run directory
 * 
 * @param {string} runDir - Run directory path
 * @param {string[]} artifactNames - List of artifact filenames to include
 * @returns {{ manifest: Object, errors: string[] }} Manifest and any errors
 */
export function generateIntegrityManifest(runDir, artifactNames) {
  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    runDir,
    artifacts: {},
  };
  
  const errors = [];
  
  for (const name of artifactNames) {
    const filePath = join(runDir, name);
    const integrity = computeFileIntegrity(filePath);
    
    if (integrity.error) {
      errors.push(`Failed to hash ${name}: ${integrity.error}`);
      continue;
    }
    
    manifest.artifacts[name] = {
      sha256: integrity.hash,
      size: integrity.size,
      verifiedAt: null, // Set when verified
    };
  }
  
  return { manifest, errors };
}

/**
 * Write integrity manifest to run directory
 * 
 * @param {string} runDir - Run directory path
 * @param {Object} manifest - Integrity manifest object
 * @returns {{ ok: boolean, path?: string, error?: Error }} Write result
 */
export function writeIntegrityManifest(runDir, manifest) {
  const manifestPath = join(runDir, 'integrity.manifest.json');
  
  try {
    atomicWriteJson(manifestPath, manifest);
    return { ok: true, path: manifestPath };
  } catch (error) {
    return { ok: false, error };
  }
}

/**
 * Verify artifact integrity against manifest
 * 
 * @param {string} runDir - Run directory path
 * @param {string} artifactName - Artifact filename
 * @param {Object} manifest - Integrity manifest
 * @returns {{ ok: boolean, error?: string, expectedHash?: string, actualHash?: string }} Verification result
 */
export function verifyArtifactIntegrity(runDir, artifactName, manifest) {
  const artifactPath = join(runDir, artifactName);
  
  // Check if artifact exists in manifest
  if (!manifest.artifacts[artifactName]) {
    return {
      ok: false,
      error: `Artifact ${artifactName} not found in integrity manifest`,
    };
  }
  
  const expected = manifest.artifacts[artifactName];
  const integrity = computeFileIntegrity(artifactPath);
  
  if (integrity.error) {
    return {
      ok: false,
      error: `Failed to read artifact ${artifactName}: ${integrity.error}`,
    };
  }
  
  if (integrity.hash !== expected.sha256) {
    return {
      ok: false,
      error: `Integrity violation: ${artifactName} hash mismatch`,
      expectedHash: expected.sha256,
      actualHash: integrity.hash,
    };
  }
  
  if (integrity.size !== expected.size) {
    return {
      ok: false,
      error: `Integrity violation: ${artifactName} size mismatch (expected ${expected.size}, got ${integrity.size})`,
    };
  }
  
  return { ok: true };
}

/**
 * Load and verify integrity manifest
 * 
 * @param {string} runDir - Run directory path
 * @returns {{ ok: boolean, manifest?: Object, error?: string }} Load result
 */
export function loadIntegrityManifest(runDir) {
  try {
    const manifestPath = join(runDir, 'integrity.manifest.json');
    const content = readFileSync(manifestPath, 'utf8');
  // @ts-expect-error - readFileSync with encoding returns string
    const manifest = JSON.parse(content);
    
    if (!manifest.version || !manifest.artifacts) {
      return {
        ok: false,
        error: 'Invalid integrity manifest format',
      };
    }
    
    return { ok: true, manifest };
  } catch (error) {
    return {
      ok: false,
      error: `Failed to load integrity manifest: ${error.message}`,
    };
  }
}

/**
 * Verify all artifacts in manifest
 * 
 * @param {string} runDir - Run directory path
 * @param {Object} manifest - Integrity manifest
 * @returns {{ ok: boolean, verified: string[], failed: Array<{name: string, error: string}> }} Verification results
 */
export function verifyAllArtifacts(runDir, manifest) {
  const verified = [];
  const failed = [];
  
  for (const artifactName of Object.keys(manifest.artifacts)) {
    const result = verifyArtifactIntegrity(runDir, artifactName, manifest);
    
    if (result.ok) {
      verified.push(artifactName);
    } else {
      failed.push({
        name: artifactName,
        error: result.error,
        expectedHash: result.expectedHash,
        actualHash: result.actualHash,
      });
    }
  }
  
  return {
    ok: failed.length === 0,
    verified,
    failed,
  };
}

/**
 * Discover all JSON artifacts in run directory
 * 
 * @param {string} runDir - Run directory path
 * @returns {string[]} List of artifact filenames
 */
export function discoverArtifacts(runDir) {
  try {
    const files = readdirSync(runDir);
    return files.filter(f => f.endsWith('.json') && f !== 'integrity.manifest.json');
  } catch (error) {
    return [];
  }
}
