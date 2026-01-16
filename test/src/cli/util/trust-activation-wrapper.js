/**
 * Phase 6A Integration Wrapper for Run Command
 * 
 * Wraps the run command to add:
 * - Poison markers to detect incomplete runs
 * - Artifact staging for atomic writes
 * - Integrity verification
 * - Atomic commits
 * - Rollback on failure
 */

import { initPhase6A, completePhase6A, rollbackPhase6A, checkPoisonMarker, getStagingPath, redirectArtifactWrites } from './trust-activation-integration.js';

/**
 * Wrap run execution with Phase 6A artifact management
 * 
 * @param {Function} runFn - Async function that executes the run
 * @param {string} artifactDir - Artifact directory for run
 * @returns {Promise<any>} Result from runFn
 */
export async function withPhase6A(runFn, artifactDir) {
  // Check for incomplete previous run
  const poisonCheck = checkPoisonMarker(artifactDir);
  if (poisonCheck.hasPoisonMarker) {
    console.warn('⚠️  WARNING: Incomplete previous run detected (poison marker present)');
    console.warn('    This run may be building on corrupted or incomplete artifacts');
  }

  // Initialize Phase 6A
  const initResult = await initPhase6A(artifactDir);
  if (!initResult.success) {
    throw new Error(`Phase 6A initialization failed: ${initResult.error.message}`);
  }

  try {
    // Execute the run function with artifact staging
    const result = await runFn();

    // Complete Phase 6A on success
    const completeResult = await completePhase6A(artifactDir);
    if (!completeResult.success) {
      throw new Error(`Phase 6A completion failed: ${completeResult.error.message}`);
    }

    return {
      ...result,
      phase6a: {
        success: true,
        verification: completeResult.verification,
      },
    };
  } catch (error) {
    // Rollback on error
    const rollbackResult = await rollbackPhase6A(artifactDir, error);
    if (!rollbackResult.success) {
      console.error(`Phase 6A rollback failed: ${rollbackResult.error.message}`);
    }

    // Re-throw the original error
    throw error;
  }
}

/**
 * Create a path redirector for artifact writes
 * 
 * This function returns a redirector that can be passed to artifact writers
 * to automatically route writes to staging.
 * 
 * @param {string} artifactDir - Artifact directory
 * @returns {Function} Redirector function
 */
export function createArtifactPathRedirector(artifactDir) {
  return (filename) => redirectArtifactWrites(artifactDir, filename);
}

/**
 * Get staging directory path for a run
 * 
 * @param {string} runDir - Run directory (e.g., .verax/runs/<runId>)
 * @returns {string} Staging directory path
 */
export function getStagingDirectory(runDir) {
  return getStagingPath(runDir, '').replace(/\/$/, '');
}
