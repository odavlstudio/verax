import { readdirSync, statSync, rmSync } from 'fs';
// eslint-disable-next-line no-unused-vars
import { resolve, join as _join } from 'path';

/**
 * Apply retention policy to .verax/runs directory
 * Deletes excess runs beyond retainCount, keeping most recent runs
 * 
 * SAFETY RULES:
 * - Only operates inside runsDir
 * - Never follows symlinks
 * - Sorts by directory creation time (deterministic)
 * - Never deletes active run (HARD GUARD: activeRunId must always be provided by caller)
 * 
 * HARD GUARD: activeRunId is REQUIRED and must never be null/undefined
 * If activeRunId is missing, retention is skipped with an error returned (never silent no-op).
 * Caller (run command) MUST always pass activeRunId of current run.
 * 
 * @param {Object} options
 * @param {string} options.runsDir - Path to .verax/runs directory
 * @param {number} options.retainCount - Number of runs to keep (must be >= 0)
 * @param {boolean} options.disableRetention - If true, skip retention entirely
 * @param {string} options.activeRunId - Current run ID (REQUIRED; never deleted) - MUST NOT BE NULL
 * @param {boolean} options.verbose - If true, log deletion activity
 * @returns {Object} { deleted: number, kept: number, errors: string[] }
 */
export function applyRetention(options) {
  const {
    runsDir,
    retainCount,
    disableRetention = false,
    activeRunId = null,
    verbose = false
  } = options;
  
  // HARD GUARD: activeRunId must be provided to avoid accidental deletion of current run
  if (activeRunId === null || activeRunId === undefined || activeRunId === '') {
    return {
      deleted: 0,
      kept: 0,
      errors: ['ERROR: activeRunId is required for retention safety. Cannot delete runs without knowing which one is active.']
    };
  }
  
  // Validation
  if (typeof retainCount !== 'number' || retainCount < 0) {
    return {
      deleted: 0,
      kept: 0,
      errors: [`Invalid retainCount: ${retainCount}. Must be integer >= 0.`]
    };
  }
  
  if (disableRetention) {
    if (verbose) {
      console.log('[retention] Retention disabled via --no-retention');
    }
    return { deleted: 0, kept: 0, errors: [] };
  }
  
  // Safety: verify runsDir exists and is actually a runs directory
  try {
    const stat = statSync(runsDir, { throwIfNoEntry: false });
    if (!stat) {
      // Directory doesn't exist - nothing to clean
      return { deleted: 0, kept: 0, errors: [] };
    }
    if (!stat.isDirectory()) {
      return { deleted: 0, kept: 0, errors: [`runsDir is not a directory: ${runsDir}`] };
    }
  } catch (error) {
    // Directory doesn't exist or not accessible - nothing to clean
    return { deleted: 0, kept: 0, errors: [] };
  }
  
  // List all directories in runsDir
  let runDirs = [];
  try {
    const entries = readdirSync(runsDir, { withFileTypes: true })
      // @ts-ignore - Dirent has name property
      .sort((a, b) => a.name.localeCompare(b.name, 'en'));
    runDirs = entries
      .filter(dirent => dirent.isDirectory() && !dirent.isSymbolicLink())
      .map(dirent => ({
        name: dirent.name,
        path: resolve(runsDir, dirent.name),
      }));
  } catch (error) {
    return {
      deleted: 0,
      kept: 0,
      errors: [`Failed to read runsDir: ${error.message}`]
    };
  }
  
  if (runDirs.length === 0) {
    return { deleted: 0, kept: 0, errors: [] };
  }
  
  // Get creation times for all runs
  const runsWithTime = [];
  for (const runDir of runDirs) {
    try {
      const stat = statSync(runDir.path);
      runsWithTime.push({
        name: runDir.name,
        path: runDir.path,
        birthtime: stat.birthtime.getTime(),
      });
    } catch (error) {
      // Skip runs that can't be stat'd
      continue;
    }
  }
  
  // Sort by creation time (oldest first)
  runsWithTime.sort((a, b) => a.birthtime - b.birthtime);
  
  // Filter out active run
  const eligibleRuns = runsWithTime.filter(run => run.name !== activeRunId);
  
  // Determine how many to delete
  const toDelete = eligibleRuns.length - retainCount;
  if (toDelete <= 0) {
    if (verbose) {
      console.log(`[retention] ${eligibleRuns.length} runs found, keeping all (retain=${retainCount})`);
    }
    return { deleted: 0, kept: eligibleRuns.length, errors: [] };
  }
  
  // Delete oldest runs
  const runsToDelete = eligibleRuns.slice(0, toDelete);
  const errors = [];
  let deleted = 0;
  
  for (const run of runsToDelete) {
    try {
      rmSync(run.path, { recursive: true, force: true, maxRetries: 3 });
      deleted++;
      if (verbose) {
        console.log(`[retention] Deleted run: ${run.name}`);
      }
    } catch (error) {
      errors.push(`Failed to delete ${run.name}: ${error.message}`);
    }
  }
  
  const kept = eligibleRuns.length - deleted;
  
  if (verbose && deleted > 0) {
    console.log(`[retention] Retention complete: deleted ${deleted}, kept ${kept}`);
  }
  
  return { deleted, kept, errors };
}
