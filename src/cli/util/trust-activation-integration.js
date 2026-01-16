/**
 * Phase 6A: Artifact Staging, Integrity, & Atomicity
 * 
 * Provides production-ready artifact management:
 * - Poison markers to detect incomplete runs
 * - Staging directories for atomic writes
 * - Integrity verification with checksums
 * - Atomic commit of verified artifacts
 * - Rollback with ledger on failures
 * 
 * Integration points:
 * 1. initPhase6A() - Called at scan START
 * 2. redirectArtifactWrites() - Intercepts ALL artifact writes
 * 3. completePhase6A() - Called on successful completion
 * 4. rollbackPhase6A() - Called on ANY error
 * 5. checkPoisonMarker() - Called before reading previous runs
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync as _rmSync, renameSync, readdirSync, unlinkSync, statSync } from 'fs';
import { join, dirname as _dirname } from 'path';
import { createHash } from 'crypto';

/**
 * Initialize Phase 6A on scan START
 * 
 * Actions:
 * 1. Create staging directory
 * 2. Create poison marker
 * 
 * @param {string} artifactDir - Artifact directory
 * @returns {Promise<{ success: boolean, poisonMarkerPath?: string, stagingDir?: string, error?: Error }>}
 */
export async function initPhase6A(artifactDir) {
  try {
    // Create staging directory if it doesn't exist
    const stagingDir = getStagingPath(artifactDir, '').replace(/\/$/, '');
    mkdirSync(stagingDir, { recursive: true });

    // Create poison marker indicating scan in progress
    const poisonMarkerPath = getPoisonMarkerPath(artifactDir);
    const poisonContent = JSON.stringify({
      timestamp: new Date().toISOString(),
      version: '1.0',
      status: 'in-progress',
    }, null, 2);
    
    writeFileSync(poisonMarkerPath, poisonContent, 'utf-8');

    return {
      success: true,
      poisonMarkerPath,
      stagingDir,
    };
  } catch (error) {
    return { success: false, error };
  }
}

/**
 * Redirect artifact write to staging directory
 * 
 * This function is called for EVERY artifact write.
 * It routes the write to the staging directory instead of the final location.
 * 
 * @param {string} artifactDir - Artifact directory
 * @param {string} filename - Artifact filename (e.g., 'summary.json')
 * @returns {string} Path to staging artifact
 */
export function redirectArtifactWrites(artifactDir, filename) {
  // Validate artifact name
  validateArtifactPath(artifactDir, filename);
  
  // Return staging path
  return getStagingPath(artifactDir, filename);
}

/**
 * Validate artifact path (whitelist approach)
 * 
 * @param {string} artifactDir - Artifact directory
 * @param {string} filename - Filename to validate
 * @throws {Error} If filename is not a valid artifact
 */
export function validateArtifactPath(artifactDir, filename) {
  const validArtifacts = [
    'summary.json',
    'findings.json',
    'ledger.json',
    'observations.json',
    'report.html',
    'learn.json',
    'manifest.json',
    'observations-legacy.json',
    'observations-legacy-formatted.json',
  ];

  if (!validArtifacts.includes(filename)) {
    throw new Error(`Invalid artifact: ${filename}. Must be one of: ${validArtifacts.join(', ')}`);
  }
}

/**
 * Complete Phase 6A on successful run
 * 
 * Actions:
 * 1. Generate integrity manifest
 * 2. Verify all artifacts
 * 3. Atomically commit staging to final
 * 4. Remove poison marker
 * 
 * @param {string} artifactDir - Artifact directory
 * @returns {Promise<{ success: boolean, verification?: any, error?: Error }>}
 */
export async function completePhase6A(artifactDir) {
  try {
    const stagingDir = getStagingPath(artifactDir, '').replace(/\/$/, '');
    
    // Check if staging directory exists
    if (!existsSync(stagingDir)) {
      return {
        success: false,
        error: new Error('Staging directory does not exist'),
      };
    }
    
    // Discover artifacts in staging
    const allFiles = readdirSync(stagingDir);
    const artifacts = allFiles.filter(f => f.endsWith('.json') && f !== 'integrity.manifest.json');
    
    if (artifacts.length === 0) {
      return {
        success: false,
        error: new Error('No artifacts found in staging directory'),
      };
    }
    
    // Generate integrity manifest
    const manifestResult = generateIntegrityManifest(stagingDir, artifacts);
    if (manifestResult.errors.length > 0) {
      return {
        success: false,
        error: new Error(`Failed to generate integrity manifest: ${manifestResult.errors.join(', ')}`),
      };
    }
    
    // Write manifest to staging
    const writeResult = writeIntegrityManifest(stagingDir, manifestResult);
    if (!writeResult.ok) {
      return {
        success: false,
        error: writeResult.error,
      };
    }
    
    // Verify all artifacts
    const verification = verifyAllArtifacts(stagingDir, manifestResult);
    
    if (!verification.ok) {
      return {
        success: false,
        verification,
        error: new Error(`Artifact integrity verification failed: ${verification.failed.map(f => f.name).join(', ')}`),
      };
    }
    
    // Commit staging directory atomically
    await commitStagingDir(artifactDir);
    
    // Remove poison marker only after successful commit
    removePoisonMarker(artifactDir);
    
    return {
      success: true,
      verification,
    };
  } catch (error) {
    return { success: false, error };
  }
}

/**
 * Rollback Phase 6A on error
 * 
 * Actions:
 * 1. Write ledger entry with error details
 * 2. Clean staging artifacts
 * 3. KEEP poison marker (prevents retry)
 * 
 * @param {string} artifactDir - Artifact directory
 * @param {Error} error - Error that occurred
 * @returns {Promise<{ success: boolean, ledgerEntry?: any, error?: Error }>}
 */
export async function rollbackPhase6A(artifactDir, error) {
  try {
    // Create ledger entry
    const ledgerEntry = createLedgerEntry('error', error);
    
    // Append to ledger
    const ledgerPath = join(artifactDir, 'ledger.json');
    let ledger = [];
    
    if (existsSync(ledgerPath)) {
      const content = readFileSync(ledgerPath, 'utf-8');
      try {
  // @ts-expect-error - readFileSync with encoding returns string
        ledger = JSON.parse(content);
      } catch (e) {
        // If ledger is corrupted, start fresh
        ledger = [];
      }
    }
    
    ledger.push(ledgerEntry);
    writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2), 'utf-8');
    
    // Clean staging artifacts but KEEP poison marker
    const stagingDir = getStagingPath(artifactDir, '').replace(/\/$/, '');
    if (existsSync(stagingDir)) {
      const files = readdirSync(stagingDir);
      for (const file of files) {
        const filePath = join(stagingDir, file);
        try {
          if (statSync(filePath).isFile()) {
            unlinkSync(filePath);
          }
        } catch (e) {
          // Ignore file deletion errors
        }
      }
    }
    
    return {
      success: true,
      ledgerEntry,
    };
  } catch (error) {
    return { success: false, error };
  }
}

/**
 * Check for poison marker indicating incomplete run
 * 
 * This should be called BEFORE reading previous run results to detect
 * incomplete or corrupted previous runs.
 * 
 * @param {string} artifactDir - Artifact directory
 * @returns {{ hasPoisonMarker: boolean, entry?: any }}
 */
export function checkPoisonMarker(artifactDir) {
  const poisonPath = getPoisonMarkerPath(artifactDir);
  
  if (!existsSync(poisonPath)) {
    return { hasPoisonMarker: false };
  }
  
  try {
    const content = readFileSync(poisonPath, 'utf-8');
  // @ts-expect-error - readFileSync with encoding returns string
    const entry = JSON.parse(content);
    return { hasPoisonMarker: true, entry };
  } catch (e) {
    return { hasPoisonMarker: true };
  }
}

/**
 * Create ledger entry for a run event
 * 
 * @param {string} status - 'success', 'error', or 'partial'
 * @param {Error} error - Error object (if status is 'error')
 * @param {object} metadata - Additional metadata
 * @returns {object} Ledger entry
 */
export function createLedgerEntry(status, error, metadata = {}) {
  return {
    timestamp: new Date().toISOString(),
    status,
    error: error ? error.message : undefined,
    stack: error ? error.stack : undefined,
    metadata,
  };
}

/**
 * Get poison marker path
 * 
 * @param {string} artifactDir - Artifact directory
 * @returns {string} Path to poison marker
 */
export function getPoisonMarkerPath(artifactDir) {
  return join(artifactDir, '.poison-marker.json');
}

/**
 * Get staging directory path for artifacts
 * 
 * @param {string} artifactDir - Artifact directory
 * @param {string} filename - Optional filename to append
 * @returns {string} Path to staging location
 */
export function getStagingPath(artifactDir, filename) {
  const stagingDir = join(artifactDir, '.staging');
  if (filename) {
    return join(stagingDir, filename);
  }
  return stagingDir + '/'; // Return with trailing slash for consistency
}

/**
 * Generate integrity manifest for all artifacts
 * 
 * Creates SHA256 checksums for each artifact to detect corruption.
 * 
 * @param {string} stagingDir - Staging directory
 * @param {string[]} artifacts - List of artifact filenames
 * @returns {{ checksums: object, generatedAt: string, errors: string[] }}
 */
export function generateIntegrityManifest(stagingDir, artifacts) {
  const checksums = {};
  const errors = [];
  
  for (const artifact of artifacts) {
    try {
      const filePath = join(stagingDir, artifact);
      if (!existsSync(filePath)) {
        errors.push(`Artifact not found: ${artifact}`);
        continue;
      }
      
      const content = readFileSync(filePath, 'utf-8');
      if (typeof content !== 'string') {
        errors.push(`Failed to read ${artifact}: content is not a string`);
        continue;
      }
      
      const hash = createHash('sha256').update(content).digest('hex');
      checksums[artifact] = hash;
    } catch (error) {
      errors.push(`Failed to hash ${artifact}: ${error.message}`);
    }
  }
  
  return {
    checksums,
    generatedAt: new Date().toISOString(),
    errors,
  };
}

/**
 * Write integrity manifest to staging directory
 * 
 * @param {string} stagingDir - Staging directory
 * @param {object} manifest - Manifest object
 * @returns {{ ok: boolean, error?: Error }}
 */
export function writeIntegrityManifest(stagingDir, manifest) {
  try {
    if (!manifest || typeof manifest !== 'object') {
      return { ok: false, error: new Error('Invalid manifest object') };
    }
    
    const manifestPath = join(stagingDir, 'integrity.manifest.json');
    const manifestContent = JSON.stringify(manifest, null, 2);
    
    if (typeof manifestContent !== 'string') {
      return { ok: false, error: new Error('Failed to serialize manifest') };
    }
    
    writeFileSync(manifestPath, manifestContent, 'utf-8');
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

/**
 * Verify all artifacts match their checksums in the manifest
 * 
 * @param {string} stagingDir - Staging directory
 * @param {object} manifest - Manifest object with checksums
 * @returns {{ ok: boolean, verified: any[], failed: any[] }}
 */
export function verifyAllArtifacts(stagingDir, manifest) {
  const verified = [];
  const failed = [];
  
  for (const [filename, expectedHash] of Object.entries(manifest.checksums)) {
    try {
      const filePath = join(stagingDir, filename);
      if (!existsSync(filePath)) {
        failed.push({
          name: filename,
          reason: 'File not found',
        });
        continue;
      }
      
      const content = readFileSync(filePath, 'utf-8');
      const actualHash = createHash('sha256').update(content).digest('hex');
      
      if (actualHash === expectedHash) {
        verified.push({ name: filename });
      } else {
        failed.push({
          name: filename,
          reason: 'Checksum mismatch',
          expected: expectedHash,
          actual: actualHash,
        });
      }
    } catch (error) {
      failed.push({
        name: filename,
        reason: `Verification failed: ${error.message}`,
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
 * Atomically commit staging directory to final location
 * 
 * Uses atomic rename operations to prevent partial writes.
 * 
 * @param {string} artifactDir - Artifact directory
 * @returns {Promise<void>}
 */
export async function commitStagingDir(artifactDir) {
  const stagingDir = getStagingPath(artifactDir, '').replace(/\/$/, '');
  
  if (!existsSync(stagingDir)) {
    throw new Error('Staging directory does not exist');
  }
  
  // Get all files in staging
  const files = readdirSync(stagingDir);
  
  // Move each file from staging to final location (atomic per-file)
  for (const file of files) {
    const stagingPath = join(stagingDir, file);
    const finalPath = join(artifactDir, file);
    
    // Only move actual artifact files, not internal manifest
    if (file === 'integrity.manifest.json') {
      // Manifest stays in staging for verification purposes
      continue;
    }
    
    if (existsSync(stagingPath)) {
      // Atomic rename: staging -> final
      renameSync(stagingPath, finalPath);
    }
  }
}

/**
 * Remove poison marker after successful completion
 * 
 * @param {string} artifactDir - Artifact directory
 */
export function removePoisonMarker(artifactDir) {
  const poisonPath = getPoisonMarkerPath(artifactDir);
  try {
    if (existsSync(poisonPath)) {
      unlinkSync(poisonPath);
    }
  } catch (error) {
    // Ignore errors removing poison marker
  }
}

/**
 * Discover artifacts in a directory
 * 
 * @param {string} dir - Directory to scan
 * @returns {string[]} Array of artifact filenames
 */
export function discoverArtifacts(dir) {
  if (!existsSync(dir)) {
    return [];
  }
  
  try {
    return readdirSync(dir).filter(f => f.endsWith('.json'));
  } catch (error) {
    return [];
  }
}
