/**
 * Exit Codes (Official Contract)
 *
 * This module is used by core failure summarizers. It MUST only expose the
 * official exit codes.
 */

import { EXIT_CODES } from '../../shared/exit-codes.js';

export { EXIT_CODES };

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
export function determineExitCode(
  ledgerSummary,
  _determinismVerdict = null,
  evidenceLawViolated = false,
  policyInvalid = false
) {
  // Precedence 1: Usage errors (invalid flags/inputs)
  if (policyInvalid) {
    return EXIT_CODES.USAGE_ERROR;
  }

  // Precedence 2: Evidence/invariant violations (corruption or law broken)
  const hasInternalCorruption =
    (ledgerSummary.byCategory?.INTERNAL ?? 0) > 0 || (ledgerSummary.byCategory?.CONTRACT ?? 0) > 0;
  if (hasInternalCorruption || evidenceLawViolated) {
    return EXIT_CODES.INVARIANT_VIOLATION;
  }

  // Precedence 3: Infrastructure/runtime failures → incomplete (not findings)
  const hasInfraFailure = (ledgerSummary.bySeverity?.BLOCKING ?? 0) > 0 || (ledgerSummary.bySeverity?.DEGRADED ?? 0) > 0;
  if (hasInfraFailure) {
    return EXIT_CODES.INCOMPLETE;
  }

  // No system failures detected here (finding-based codes are decided elsewhere)
  return EXIT_CODES.SUCCESS;
}

/**
 * Get exit code meaning
 * 
 * @param {number} exitCode - Exit code
 * @returns {string} Human-readable meaning
 */
export function getExitCodeMeaning(exitCode) {
  const meanings = {
    [EXIT_CODES.SUCCESS]: 'SUCCESS (no findings)',
    [EXIT_CODES.FINDINGS]: 'FINDINGS (findings detected)',
    [EXIT_CODES.INCOMPLETE]: 'INCOMPLETE (analysis did not complete)',
    [EXIT_CODES.INVARIANT_VIOLATION]: 'INVARIANT_VIOLATION (evidence/invariant broken)',
    [EXIT_CODES.USAGE_ERROR]: 'USAGE_ERROR (invalid CLI usage)',
  };
  
  return meanings[exitCode] || `Unknown exit code: ${exitCode}`;
}




