/**
 * PHASE 6A: Run Poisoning System
 * 
 * Prevents consumption of incomplete or failed runs.
 * Implements .INCOMPLETE marker for run safety.
 */

// @ts-ignore
import { getTimeProvider } from '../../../cli/util/support/time-provider.js';
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs';

import { join } from 'path';

/**
 * Create poisoning marker for run
 * 
 * @param {string} runDir - Run directory path
 * @param {string} runId - Run identifier
 * @returns {{ ok: boolean, path?: string, error?: Error }} Result
 */
export function createPoisonMarker(runDir, runId) {
  try {
    const markerPath = join(runDir, '.INCOMPLETE');
    const marker = {
      runId,
      createdAt: getTimeProvider().iso(),
      pid: process.pid,
      reason: 'Run in progress',
    };
    
    writeFileSync(markerPath, JSON.stringify(marker, null, 2), 'utf8');
    
    return { ok: true, path: markerPath };
  } catch (error) {
    return { ok: false, error };
  }
}

/**
 * Remove poisoning marker (only on successful completion)
 * 
 * @param {string} runDir - Run directory path
 * @returns {{ ok: boolean, error?: Error }} Result
 */
export function removePoisonMarker(runDir) {
  try {
    const markerPath = join(runDir, '.INCOMPLETE');
    
    if (existsSync(markerPath)) {
      unlinkSync(markerPath);
    }
    
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

/**
 * Check if run is poisoned (incomplete)
 * 
 * @param {string} runDir - Run directory path
 * @returns {{ poisoned: boolean, marker?: Object, reason?: string }} Poisoning status
 */
export function checkPoisonMarker(runDir) {
  try {
    const markerPath = join(runDir, '.INCOMPLETE');
    
    if (!existsSync(markerPath)) {
      return { poisoned: false };
    }
    
    const content = readFileSync(markerPath, 'utf8');
  // @ts-expect-error - readFileSync with encoding returns string
    const marker = JSON.parse(content);
    
    return {
      poisoned: true,
      marker,
      reason: marker.reason || 'Run incomplete',
    };
  } catch (error) {
    // If marker exists but is unreadable, consider it poisoned
    const markerPath = join(runDir, '.INCOMPLETE');
    if (existsSync(markerPath)) {
      return {
        poisoned: true,
        reason: 'Marker unreadable or corrupted',
      };
    }
    
    return { poisoned: false };
  }
}

/**
 * Enforce poisoning check - throw if run is poisoned
 * 
 * @param {string} runDir - Run directory path
 * @throws {Error} If run is poisoned
 */
export function enforcePoisonCheck(runDir) {
  const status = checkPoisonMarker(runDir);
  
  if (status.poisoned) {
    throw new Error(
      `Cannot read run: RUN_POISONED (${status.reason || 'incomplete'}). ` +
      `Run directory: ${runDir}`
    );
  }
}



