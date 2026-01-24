import { getTimeProvider } from '../../../cli/util/support/time-provider.js';
/**
 * PHASE 5: Failure Ledger Writer
 * 
 * Ensures durable failure evidence is ALWAYS written when analysis fails/is incomplete.
 * This is the safety net - if we can't write primary artifacts, at least write this.
 */

import { atomicWriteJson } from '../support/atomic-write.js';
import { VERSION } from '../../../version.js';

function getVersion() {
  return VERSION;
}

/**
 * Write failure ledger to run directory
 * 
 * @param {string} runDir - Run directory path
 * @param {object} failureInfo - Failure details
 * @param {string} failureInfo.runId - Run ID
 * @param {string} failureInfo.url - Target URL
 * @param {string} failureInfo.src - Source directory
 * @param {string} failureInfo.state - ANALYSIS_FAILED or ANALYSIS_INCOMPLETE
 * @param {number} failureInfo.exitCode - Exit code (2 for FAILED, 66 for INCOMPLETE)
 * @param {Error} failureInfo.primaryError - The error that caused failure
 * @param {string} failureInfo.phase - Phase where failure occurred
 * @param {string[]} failureInfo.notes - Additional context notes
 * @returns {{ ok: boolean, path?: string, error?: Error }}
 */
export function writeLedger(runDir, failureInfo) {
  const {
    runId,
    url,
    src,
    state,
    exitCode,
    primaryError,
    phase = 'unknown',
    notes = [],
  } = failureInfo;
  
  const ledgerPath = `${runDir}/ledger.json`;
  
  const ledger = {
    meta: {
      runId,
      url,
      src,
      timestamp: getTimeProvider().iso(),
      version: getVersion(),
    },
    state, // "ANALYSIS_FAILED" | "ANALYSIS_INCOMPLETE"
    exitCode,
    primaryError: {
      name: primaryError?.name || 'Error',
      message: primaryError?.message || 'Unknown error',
      stack: primaryError?.stack || null,
    },
    phase,
    notes,
  };
  
  try {
    atomicWriteJson(ledgerPath, ledger);
    return { ok: true, path: ledgerPath };
  } catch (writeError) {
    // Ledger write failed - this is EXTREMELY BAD
    // Print loud warning but don't throw - we're already in error handling
    console.error('═══════════════════════════════════════════════════════');
    console.error('🚨 CRITICAL: FAILURE LEDGER COULD NOT BE WRITTEN');
    console.error('═══════════════════════════════════════════════════════');
    console.error('Run directory:', runDir);
    console.error('Ledger path:', ledgerPath);
    console.error('Write error:', writeError?.message || 'Unknown');
    console.error('═══════════════════════════════════════════════════════');
    
    return { ok: false, error: writeError };
  }
}

/**
 * Create integrity stamp for artifacts
 * 
 * @param {string} status - "COMPLETE" | "PARTIAL" | "FAILED_WRITE"
 * @param {boolean} atomic - Whether atomic write was used
 * @param {string[]} notes - Additional notes
 * @returns {object} Integrity object
 */
export function createIntegrityStamp(status, atomic = true, notes = []) {
  return {
    status,
    atomic,
    writer: 'verax',
    writerVersion: getVersion(),
    writtenAt: getTimeProvider().iso(),
    notes,
  };
}



