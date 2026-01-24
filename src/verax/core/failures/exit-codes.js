/**
 * Exit Codes Contract — Stage 7
 * 
 * Exit codes with explicit precedence (highest wins):
 * - 64: USAGE ERROR (invalid CLI usage)
 * - 50: EVIDENCE VIOLATION (data/contract corruption)
 * - 40: INFRA FAILURE (crash, invariant, runtime error)
 * - 30: INCOMPLETE (partial/incomplete analysis)
 * - 20: FAILURE (confirmed findings)
 * - 10: NEEDS REVIEW (suspected findings)
 * - 0:  OK (no actionable findings)
 */

import { FAILURE_SEVERITY as _FAILURE_SEVERITY } from './failure.types.js';

/**
 * Exit Code Constants (Stage 7)
 */
export const EXIT_CODE = {
  OK: 0,
  NEEDS_REVIEW: 10,
  FAILURE: 20,
  INCOMPLETE: 30,
  INFRA_FAILURE: 40,
  EVIDENCE_VIOLATION: 50,
  USAGE_ERROR: 64,
};

/**
 * Determine exit code with precedence (highest wins)
 * Precedence: 64 > 50 > 40 > 30 > (20/10/0)
 * 
 * @param {Object} ledgerSummary - Failure ledger summary
 * @param {string} _determinismVerdict - Determinism verdict
 * @ts-expect-error - JSDoc param documented but unused
 * @param {boolean} evidenceLawViolated - Whether Evidence Law was violated
 * @param {boolean} policyInvalid - Whether policy was invalid
 * @returns {number} Exit code
 */
export function determineExitCode(ledgerSummary, _determinismVerdict = null, evidenceLawViolated = false, policyInvalid = false) {
  // Precedence 1: USAGE ERROR (64)
  if (policyInvalid) {
    return EXIT_CODE.USAGE_ERROR;
  }
  
  // Precedence 2: EVIDENCE VIOLATION (50) - Internal corruption or contract violations
  const hasInternalCorruption = ledgerSummary.byCategory?.INTERNAL > 0 ||
                                 ledgerSummary.byCategory?.CONTRACT > 0;
  if (hasInternalCorruption) {
    return EXIT_CODE.EVIDENCE_VIOLATION;
  }
  
  // Precedence 3: INFRA FAILURE (40) - BLOCKING failures
  if (ledgerSummary.bySeverity?.BLOCKING > 0) {
    return EXIT_CODE.INFRA_FAILURE;
  }
  
  // Precedence 3: INFRA FAILURE (40) - DEGRADED failures
  if (ledgerSummary.bySeverity?.DEGRADED > 0) {
    return EXIT_CODE.INFRA_FAILURE;
  }
  
  // Precedence 2: EVIDENCE VIOLATION (50)
  if (evidenceLawViolated) {
    return EXIT_CODE.EVIDENCE_VIOLATION;
  }
  
  // Note: Finding-based codes (20/10/0) handled by RunResult
  // This function handles system failures only
  
  // No system failures → delegate to findings-based logic
  return EXIT_CODE.OK;
}

/**
 * Get exit code meaning
 * 
 * @param {number} exitCode - Exit code
 * @returns {string} Human-readable meaning
 */
export function getExitCodeMeaning(exitCode) {
  const meanings = {
    [EXIT_CODE.OK]: 'OK (no actionable findings)',
    [EXIT_CODE.NEEDS_REVIEW]: 'NEEDS REVIEW (suspected findings)',
    [EXIT_CODE.FAILURE]: 'FAILURE (confirmed findings detected)',
    [EXIT_CODE.INCOMPLETE]: 'INCOMPLETE (analysis did not complete)',
    [EXIT_CODE.INFRA_FAILURE]: 'INFRA FAILURE (crash, invariant, or runtime error)',
    [EXIT_CODE.EVIDENCE_VIOLATION]: 'EVIDENCE VIOLATION (data or contract corruption)',
    [EXIT_CODE.USAGE_ERROR]: 'USAGE ERROR (invalid CLI usage)'
  };
  
  return meanings[exitCode] || `Unknown exit code: ${exitCode}`;
}




