/**
 * First-Run Detection
 * 
 * Detects if this is the first VERAX run in the repository.
 * Used to apply relaxed defaults for better first-time UX.
 * 
 * Detection criteria:
 * - CI environments ALWAYS return false (no relaxed defaults in CI)
 * - No .verax/ directory exists, OR
 * - No scan directories present in .verax/runs/ OR .verax/scans/
 * 
 * CI Detection: process.env.CI === 'true' (set by GitHub Actions, CircleCI, Travis, etc.)
 */

import { existsSync, readdirSync, statSync } from 'fs';
import { resolve } from 'path';

/**
 * Check if a directory contains any scan-* subdirectories
 * @param {string} dirPath - Directory to check
 * @returns {boolean} true if scan directories found
 */
function hasScanDirectories(dirPath) {
  if (!existsSync(dirPath)) {
    return false;
  }
  
  try {
    const entries = readdirSync(dirPath);
    const scanDirs = entries.filter((entry) => {
      if (!entry.startsWith('scan-')) {
        return false;
      }
      
      try {
        const entryPath = resolve(dirPath, entry);
        return statSync(entryPath).isDirectory();
      } catch {
        return false;
      }
    });
    
    return scanDirs.length > 0;
  } catch {
    return false;
  }
}

/**
 * Detect if this is the first VERAX run
 * @param {string} projectRoot - Absolute path to project root
 * @returns {boolean} true if first run (false in CI environments)
 */
export function isFirstRun(projectRoot) {
  // CI environments NEVER use first-run relaxed defaults
  // This ensures deterministic, strict behavior in CI/CD pipelines
  if (process.env.CI === 'true') {
    return false;
  }
  
  const veraxDir = resolve(projectRoot, '.verax');
  
  // No .verax directory at all → first run
  if (!existsSync(veraxDir)) {
    return true;
  }
  
  // Check both legacy (.verax/runs/) and new (.verax/scans/) locations
  const runsDir = resolve(veraxDir, 'runs');
  const scansDir = resolve(veraxDir, 'scans');
  
  // If scan directories exist in either location → NOT first run
  if (hasScanDirectories(runsDir) || hasScanDirectories(scansDir)) {
    return false;
  }
  
  // .verax exists but no scan directories → first run
  return true;
}
