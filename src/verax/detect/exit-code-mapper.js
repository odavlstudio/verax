/**
 * Exit Code Mapping (Official Contract)
 *
 * This maps internal judgment classifications to the official VERAX exit codes.
 * User-facing exit codes MUST be one of:
 * - 0  SUCCESS
 * - 20 FINDINGS
 * - 30 INCOMPLETE
 * - 50 INVARIANT_VIOLATION
 * - 64 USAGE_ERROR
 */

import { JUDGMENT_TYPES } from './judgment-mapper.js';
import { EXIT_CODES as OFFICIAL_EXIT_CODES } from '../shared/exit-codes.js';

/**
 * Exit Codes
 */
export const EXIT_CODES = OFFICIAL_EXIT_CODES;

/**
 * Determine exit code from judgments
 * 
 * Precedence: evidence law > infra > misleading > silent > review > success
 * 
 * @param {Array<Object>} judgments - Array of judgment objects
 * @param {Object} runStatus - Run status object
 * @returns {number} - Exit code
 */
export function determineExitCode(judgments, runStatus = {}) {
  // Evidence law violated / invariant violated (highest priority)
  if (runStatus.evidenceLawViolated) {
    return EXIT_CODES.INVARIANT_VIOLATION;
  }

  // Infrastructure failure and other non-findings runtime issues → INCOMPLETE
  if (runStatus.infraFailure || runStatus.status === 'FAILED' || runStatus.status === 'INCOMPLETE') {
    return EXIT_CODES.INCOMPLETE;
  }

  // No judgments = success
  if (!judgments || judgments.length === 0) {
    return EXIT_CODES.SUCCESS;
  }

  // Count judgment types
  const counts = countJudgmentTypes(judgments);

  // Any confirmed silent/misleading failure judgments → FINDINGS
  if (counts.FAILURE_MISLEADING > 0 || counts.FAILURE_SILENT > 0) {
    return EXIT_CODES.FINDINGS;
  }

  // Ambiguity is not a “finding” in the official truth vocabulary → INCOMPLETE
  if (counts.NEEDS_REVIEW > 0) {
    return EXIT_CODES.INCOMPLETE;
  }

  // Only PASS / WEAK_PASS
  return EXIT_CODES.SUCCESS;
}

/**
 * Count judgment types
 * 
 * @param {Array<Object>} judgments - Array of judgments
 * @returns {Object} - Counts by type
 */
export function countJudgmentTypes(judgments) {
  const counts = {
    [JUDGMENT_TYPES.PASS]: 0,
    [JUDGMENT_TYPES.WEAK_PASS]: 0,
    [JUDGMENT_TYPES.NEEDS_REVIEW]: 0,
    [JUDGMENT_TYPES.FAILURE_SILENT]: 0,
    [JUDGMENT_TYPES.FAILURE_MISLEADING]: 0,
  };

  for (const judgment of judgments) {
    if (counts[judgment.judgment] !== undefined) {
      counts[judgment.judgment]++;
    }
  }

  return counts;
}

/**
 * Get exit code name
 * 
 * @param {number} exitCode - Exit code
 * @returns {string} - Exit code name
 */
export function getExitCodeName(exitCode) {
  const names = {
    [EXIT_CODES.SUCCESS]: 'SUCCESS',
    [EXIT_CODES.FINDINGS]: 'FINDINGS',
    [EXIT_CODES.INCOMPLETE]: 'INCOMPLETE',
    [EXIT_CODES.INVARIANT_VIOLATION]: 'INVARIANT_VIOLATION',
    [EXIT_CODES.USAGE_ERROR]: 'USAGE_ERROR',
  };

  return names[exitCode] || `UNKNOWN(${exitCode})`;
}

/**
 * Get exit code explanation
 * 
 * @param {number} exitCode - Exit code
 * @returns {string} - Explanation
 */
export function explainExitCode(exitCode) {
  const explanations = {
    [EXIT_CODES.SUCCESS]: 'No findings detected',
    [EXIT_CODES.FINDINGS]: 'Findings detected',
    [EXIT_CODES.INCOMPLETE]: 'Run is incomplete or ambiguous',
    [EXIT_CODES.INVARIANT_VIOLATION]: 'Invariant or evidence contract violation',
    [EXIT_CODES.USAGE_ERROR]: 'Invalid CLI usage',
  };

  return explanations[exitCode] || 'Unknown exit code';
}

/**
 * Check if exit code represents success
 * 
 * @param {number} exitCode - Exit code
 * @returns {boolean}
 */
export function isSuccessExitCode(exitCode) {
  return exitCode === EXIT_CODES.SUCCESS;
}

/**
 * Check if exit code represents failure
 * 
 * @param {number} exitCode - Exit code
 * @returns {boolean}
 */
export function isFailureExitCode(exitCode) {
  return exitCode !== EXIT_CODES.SUCCESS;
}

/**
 * Get recommended action for exit code
 * 
 * @param {number} exitCode - Exit code
 * @returns {string} - Recommended action
 */
export function getRecommendedAction(exitCode) {
  const actions = {
    [EXIT_CODES.SUCCESS]: 'Proceed',
    [EXIT_CODES.FINDINGS]: 'Address findings and rerun',
    [EXIT_CODES.INCOMPLETE]: 'Increase coverage or rerun with higher budget',
    [EXIT_CODES.INVARIANT_VIOLATION]: 'Repair or regenerate required artifacts',
    [EXIT_CODES.USAGE_ERROR]: 'Fix CLI usage and retry',
  };

  return actions[exitCode] || 'Unknown action';
}
