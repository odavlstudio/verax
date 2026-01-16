/**
 * Exit Codes Contract v1
 * 
 * Exit codes with explicit precedence (highest wins):
 * - 64: USAGE ERROR (invalid CLI usage)
 * - 2:  TOOL FAILURE (crash, invariant, runtime error)
 * - 20: FAILURE (any CONFIRMED finding)
 * - 10: WARNING (only SUSPECTED/INFORMATIONAL findings)
 * - 0:  OK (no CONFIRMED findings)
 */

import { FAILURE_SEVERITY as _FAILURE_SEVERITY } from './failure.types.js';

/**
 * Exit Code Constants (Contract v1)
 */
export const EXIT_CODE = {
  OK: 0,                       // No CONFIRMED findings
  WARNING: 10,                 // Only SUSPECTED/INFORMATIONAL
  FAILURE: 20,                 // Any CONFIRMED finding
  TOOL_FAILURE: 2,             // Crash, invariant, runtime error
  USAGE_ERROR: 64              // Invalid CLI usage
};

/**
 * Determine exit code with precedence (highest wins)
 * Precedence: 64 > 2 > 20 > 10 > 0
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
  
  // Precedence 2: TOOL FAILURE (2) - Internal corruption or contract violations
  const hasInternalCorruption = ledgerSummary.byCategory?.INTERNAL > 0 ||
                                 ledgerSummary.byCategory?.CONTRACT > 0;
  if (hasInternalCorruption) {
    return EXIT_CODE.TOOL_FAILURE;
  }
  
  // Precedence 2: TOOL FAILURE (2) - BLOCKING failures
  if (ledgerSummary.bySeverity?.BLOCKING > 0) {
    return EXIT_CODE.TOOL_FAILURE;
  }
  
  // Precedence 2: TOOL FAILURE (2) - DEGRADED failures
  if (ledgerSummary.bySeverity?.DEGRADED > 0) {
    return EXIT_CODE.TOOL_FAILURE;
  }
  
  // Precedence 2: TOOL FAILURE (2) - Evidence Law violation
  if (evidenceLawViolated) {
    return EXIT_CODE.TOOL_FAILURE;
  }
  
  // Note: Precedence 3-5 (FAILURE/WARNING/OK) handled by run-result.js
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
    [EXIT_CODE.OK]: 'OK (no CONFIRMED findings)',
    [EXIT_CODE.WARNING]: 'WARNING (only SUSPECTED/INFORMATIONAL findings)',
    [EXIT_CODE.FAILURE]: 'FAILURE (CONFIRMED finding detected)',
    [EXIT_CODE.TOOL_FAILURE]: 'TOOL FAILURE (crash, invariant, or runtime error)',
    [EXIT_CODE.USAGE_ERROR]: 'USAGE ERROR (invalid CLI usage)'
  };
  
  return meanings[exitCode] || `Unknown exit code: ${exitCode}`;
}

