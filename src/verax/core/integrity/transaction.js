/**
 * PHASE 6A: Transactional Artifact System
 * 
 * Provides ALL-OR-NOTHING artifact writes with staging directory.
 * Ensures atomic finalization of complete artifact sets.
 */

import { mkdirSync, renameSync, existsSync, rmSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Create staging directory for transactional writes
 * 
 * @param {string} runDir - Run directory path
 * @returns {{ ok: boolean, stagingDir?: string, error?: Error }} Result
 */
export function createStagingDir(runDir) {
  try {
    const stagingDir = join(runDir, '.staging');
    
    // Clean up any existing staging directory from previous crash
    if (existsSync(stagingDir)) {
      rmSync(stagingDir, { recursive: true, force: true });
    }
    
    mkdirSync(stagingDir, { recursive: true });
    
    return { ok: true, stagingDir };
  } catch (error) {
    return { ok: false, error };
  }
}

/**
 * Commit staging directory to final location (atomic rename)
 * 
 * @param {string} runDir - Run directory path
 * @returns {{ ok: boolean, error?: Error }} Result
 */
export function commitStagingDir(runDir) {
  try {
    const stagingDir = join(runDir, '.staging');
    const artifactsDir = join(runDir, 'artifacts');
    
    if (!existsSync(stagingDir)) {
      return {
        ok: false,
        error: new Error('Staging directory does not exist'),
      };
    }
    
    // Ensure parent directory exists
    mkdirSync(runDir, { recursive: true });
    
    // Clean up existing artifacts directory if present
    if (existsSync(artifactsDir)) {
      rmSync(artifactsDir, { recursive: true, force: true });
    }
    
    // Atomic rename
    renameSync(stagingDir, artifactsDir);
    
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

/**
 * Rollback staging directory (cleanup on failure)
 * 
 * @param {string} runDir - Run directory path
 * @returns {{ ok: boolean, error?: Error }} Result
 */
export function rollbackStagingDir(runDir) {
  try {
    const stagingDir = join(runDir, '.staging');
    
    if (existsSync(stagingDir)) {
      rmSync(stagingDir, { recursive: true, force: true });
    }
    
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

/**
 * Get staging artifact path
 * 
 * @param {string} runDir - Run directory path
 * @param {string} artifactName - Artifact filename
 * @returns {string} Path to artifact in staging directory
 */
export function getStagingPath(runDir, artifactName) {
  return join(runDir, '.staging', artifactName);
}

/**
 * Get final artifact path
 * 
 * @param {string} runDir - Run directory path
 * @param {string} artifactName - Artifact filename
 * @returns {string} Path to artifact in final location
 */
export function getFinalPath(runDir, artifactName) {
  return join(runDir, 'artifacts', artifactName);
}

/**
 * Check if staging directory exists
 * 
 * @param {string} runDir - Run directory path
 * @returns {boolean} True if staging exists
 */
export function hasStagingDir(runDir) {
  const stagingDir = join(runDir, '.staging');
  return existsSync(stagingDir);
}

/**
 * List files in staging directory
 * 
 * @param {string} runDir - Run directory path
 * @returns {string[]} List of filenames in staging
 */
export function listStagingFiles(runDir) {
  try {
    const stagingDir = join(runDir, '.staging');
    
    if (!existsSync(stagingDir)) {
      return [];
    }
    
    return readdirSync(stagingDir);
  } catch (error) {
    return [];
  }
}
