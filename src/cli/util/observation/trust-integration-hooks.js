/**
 * PHASE 6B: ACTIVATION
 * 
 * Activates Phase 6A by enforcing it as MANDATORY for all scan paths.
 * 
 * This module wraps Phase 6A and integrates it with run.js to ensure:
 * 1. All scans use Phase 6A (no bypass possible)
 * 2. Artifacts can only be written to staging
 * 3. Integrity is verified before commit
 * 4. Poison markers prevent reading corrupted runs
 */

import { initPhase6A as phase6aInit, completePhase6A as phase6aComplete, rollbackPhase6A as phase6aRollback, checkPoisonMarker } from './trust-activation-integration.js';
import { join } from 'path';
import { existsSync } from 'fs';

/**
 * Initialize Phase 6A (poison marker + staging directory)
 * MANDATORY at run start - called before any artifact writing
 * 
 * @param {string} runDir - Run directory (e.g., .verax/runs/<runId>)
 * @returns {Promise<{ success: boolean, error?: Error }>}
 */
export async function initializePhase6A(runDir) {
  try {
    const result = await phase6aInit(runDir);
    return result;
  } catch (error) {
    return { success: false, error };
  }
}

/**
 * Get paths with staging directory redirection
 * MANDATORY - replaces all artifact paths to point to staging directory
 * 
 * This ensures ALL artifact writes go to staging instead of final location.
 * 
 * @param {Object} paths - Original paths from getRunPaths()
 * @returns {Object} Modified paths with staging redirection
 */
export function getStagingRedirectedPaths(paths) {
  const stagingDir = join(paths.baseDir, '.staging');
  
  const redirected = { ...paths };
  
  // List of artifact path keys that should be redirected to staging
  const artifactKeys = [
    'summary', 'findings', 'ledger', 'learn', 'observe',
    'summaryJson', 'findingsJson', 'learnJson', 'observeJson', 'ledgerJson'
  ];
  
  for (const key of artifactKeys) {
    if (redirected[key] && typeof redirected[key] === 'string') {
      // Extract just the filename from the path (works on Windows and Unix)
      // Split by both / and \ to handle any path separator
      const parts = redirected[key].replace(/\\/g, '/').split('/');
      const filename = parts[parts.length - 1];
      
      if (filename) {
        // Place in staging directory
        redirected[key] = join(stagingDir, filename);
      }
    }
  }
  
  return redirected;
}

/**
 * Complete Phase 6A - verify integrity and commit artifacts
 * MANDATORY on success - generates manifest, verifies, commits staging to final
 * 
 * @param {string} runDir - Run directory (base, not staging)
 * @returns {Promise<{ success: boolean, verification?: any, error?: Error }>}
 */
export async function completePhase6A(runDir) {
  try {
    const result = await phase6aComplete(runDir);
    return result;
  } catch (error) {
    return { success: false, error };
  }
}

/**
 * Rollback Phase 6A on error
 * MANDATORY in catch block - cleans staging but KEEPS poison marker
 * 
 * @param {string} runDir - Run directory (base, not staging)
 * @returns {Promise<{ success: boolean, error?: Error }>}
 */
export async function rollbackPhase6A(runDir) {
  try {
    // Pass generic error - the phase6a module will record it
    const error = new Error('Scan execution failed or was interrupted');
    const result = await phase6aRollback(runDir, error);
    return result;
  } catch (error) {
    return { success: false, error };
  }
}

/**
 * Enforce poison marker check before reading a run
 * MANDATORY before inspect, before loading artifacts, etc
 * 
 * Prevents reading from incomplete/corrupted previous runs.
 * 
 * @param {string} runDir - Run directory
 * @throws {Error} If poison marker exists
 */
export function enforcePoisonCheckBeforeRead(runDir) {
  const poisonCheck = checkPoisonMarker(runDir);
  
  if (poisonCheck.hasPoisonMarker) {
    throw new Error(
      `Cannot read from this run: poison marker present (incomplete/corrupted run). ` +
      `The previous scan did not complete successfully. ` +
      `Artifacts may be incomplete or corrupted. ` +
      `Run 'verax doctor' to diagnose.`
    );
  }
  return { safe: true };
}

/**
 * Verify artifacts before reading (check integrity manifest)
 * RECOMMENDED before loading summary.json, findings.json, etc
 * 
 * @param {string} runDir - Run directory
 * @returns {{ ok: boolean, error?: string }}
 */
export function verifyArtifactsBeforeRead(runDir) {
  try {
    // Check that integrity manifest exists (in staging directory)
    const stagingDir = join(runDir, '.staging');
    const manifestPath = join(stagingDir, 'integrity.manifest.json');
    
    if (!existsSync(manifestPath)) {
      return {
        ok: false,
        error: 'Integrity manifest missing - run may be incomplete or from older version'
      };
    }
    
    // In future: verify checksums match manifest
    
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}



