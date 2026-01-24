/**
 * PHASE 21.11 — Baseline Enforcer
 * 
 * Enforces baseline integrity. Detects drift and blocks changes after GA.
 */

import { loadBaselineSnapshot, buildBaselineSnapshot } from './baseline.snapshot.js';
import { FAILURE_CODE, createInternalFailure } from '../failures/index.js';

/**
 * Compare two baseline snapshots
 * 
 * @param {Object} current - Current baseline
 * @param {Object} frozen - Frozen baseline (from GA)
 * @returns {Object} Comparison result
 */
export function compareBaselines(current, frozen) {
  if (!frozen) {
    return {
      drifted: false,
      message: 'No frozen baseline found (pre-GA)',
      differences: []
    };
  }
  
  if (!frozen.frozen) {
    return {
      drifted: false,
      message: 'Baseline not frozen (pre-GA)',
      differences: []
    };
  }
  
  const differences = [];
  
  // Compare baseline hash
  if (current.baselineHash !== frozen.baselineHash) {
    differences.push({
      type: 'BASELINE_HASH_MISMATCH',
      message: 'Baseline hash changed',
      current: current.baselineHash,
      frozen: frozen.baselineHash
    });
  }
  
  // Compare individual hashes
  for (const [key, frozenHash] of Object.entries(frozen.hashes || {})) {
    const currentHash = current.hashes?.[key];
    if (currentHash && currentHash !== frozenHash) {
      differences.push({
        type: 'HASH_MISMATCH',
        component: key,
        message: `${key} hash changed`,
        current: currentHash,
        frozen: frozenHash
      });
    }
  }
  
  return {
    drifted: differences.length > 0,
    message: differences.length > 0 
      ? `Baseline drift detected: ${differences.length} difference(s)`
      : 'No baseline drift',
    differences
  };
}

/**
 * Enforce baseline integrity
 * 
 * @param {string} projectDir - Project directory
 * @param {Object} failureLedger - Failure ledger instance
 * @returns {Object} Enforcement result
 */
export function enforceBaseline(projectDir, failureLedger) {
  const frozen = loadBaselineSnapshot(projectDir);
  
  // If no frozen baseline, allow (pre-GA)
  if (!frozen || !frozen.frozen) {
    return {
      blocked: false,
      message: 'No frozen baseline (pre-GA)',
      drifted: false
    };
  }
  
  // Build current baseline
  const current = buildBaselineSnapshot(projectDir);
  
  // Compare
  const comparison = compareBaselines(current, frozen);
  
  if (comparison.drifted) {
    // Record BLOCKING failure
    const failure = createInternalFailure(
      FAILURE_CODE.BASELINE_DRIFT,
      `BASELINE_DRIFT: ${comparison.message}. Changes to core contracts/policies after GA require MAJOR version bump and baseline regeneration.`,
      'baseline',
      {
        differences: comparison.differences,
        frozenCommit: frozen.gitCommit,
        currentCommit: current.gitCommit,
        frozenVersion: frozen.veraxVersion,
        currentVersion: current.veraxVersion
      },
      false // Not recoverable
    );
    
    failureLedger.record(failure);
    
    return {
      blocked: true,
      message: comparison.message,
      drifted: true,
      differences: comparison.differences
    };
  }
  
  return {
    blocked: false,
    message: 'Baseline integrity maintained',
    drifted: false
  };
}

/**
 * Check if baseline is frozen
 * 
 * @param {string} projectDir - Project directory
 * @returns {boolean} True if frozen
 */
export function isBaselineFrozen(projectDir) {
  const snapshot = loadBaselineSnapshot(projectDir);
  return snapshot?.frozen === true;
}




