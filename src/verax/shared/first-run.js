/**
 * Wave 9 — First-Run Detection
 * 
 * Detects and tracks first-ever CLI run.
 */

import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';

/**
 * Get first-run marker path
 * @param {string} projectRoot - Project root directory
 * @returns {string} Marker file path
 */
function getMarkerPath(projectRoot) {
  const veraxDir = resolve(projectRoot, '.verax');
  return resolve(veraxDir, '.first-run-complete');
}

/**
 * Check if this is the first run
 * @param {string} projectRoot - Project root directory
 * @returns {boolean} True if first run
 */
export function isFirstRun(projectRoot) {
  const markerPath = getMarkerPath(projectRoot);
  return !existsSync(markerPath);
}

/**
 * Mark first run as complete
 * @param {string} projectRoot - Project root directory
 */
export function markFirstRunComplete(projectRoot) {
  const markerPath = getMarkerPath(projectRoot);
  const veraxDir = dirname(markerPath);
  
  // Ensure .verax directory exists
  mkdirSync(veraxDir, { recursive: true });
  
  // Write marker file (empty file is sufficient)
  writeFileSync(markerPath, '', 'utf-8');
}




