/**
 * PHASE 21.6.1 — Run Resolver
 * 
 * Pure filesystem logic to resolve run IDs.
 * No side effects, no execution dependencies.
 */

import { readdirSync, statSync, existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Find the latest run ID from .verax/runs/
 * 
 * @param {string} projectDir - Project directory
 * @returns {string|null} Latest run ID or null if no runs found
 */
export function findLatestRunId(projectDir) {
  const runsDir = resolve(projectDir, '.verax', 'runs');
  
  if (!existsSync(runsDir)) {
    return null;
  }
  
  try {
    const runs = readdirSync(runsDir, { withFileTypes: true })
      // @ts-ignore - Dirent has name property
      .sort((a, b) => a.name.localeCompare(b.name, 'en'))
      .filter(dirent => dirent.isDirectory())
      .map(dirent => {
        const runPath = resolve(runsDir, dirent.name);
        try {
          const stats = statSync(runPath);
          return {
            name: dirent.name,
            mtimeMs: stats.mtimeMs
          };
        } catch {
          return null;
        }
      })
      .filter(run => run !== null);
    
    if (runs.length === 0) {
      return null;
    }
    
    // Sort by modification time (descending) and return latest
    runs.sort((a, b) => b.mtimeMs - a.mtimeMs);
    return runs[0].name;
  } catch (error) {
    return null;
  }
}

/**
 * Validate that a run ID exists
 * 
 * @param {string} projectDir - Project directory
 * @param {string} runId - Run ID to validate
 * @returns {boolean} Whether run exists
 */
export function validateRunId(projectDir, runId) {
  const runDir = resolve(projectDir, '.verax', 'runs', runId);
  return existsSync(runDir);
}




