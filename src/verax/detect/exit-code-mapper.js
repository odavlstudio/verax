/**
 * STAGE 4.5: CI Exit Code Contract 2.0
 * 
 * Exit codes based on judgment classifications.
 * 
 * EXIT CODES:
 * - 0  → PASS / WEAK_PASS only
 * - 10 → NEEDS_REVIEW only
 * - 20 → FAILURE_SILENT present
 * - 30 → FAILURE_MISLEADING present
 * - 40 → INFRA failure
 * - 50 → Evidence law violated
 * 
 * Precedence (highest first):
 * 50 > 40 > 30 > 20 > 10 > 0
 * 
 * NO ambiguity, NO exceptions.
 */

import { JUDGMENT_TYPES } from './judgment-mapper.js';

/**
 * Exit Codes
 */
export const EXIT_CODES = {
  SUCCESS: 0,
  NEEDS_REVIEW: 10,
  FAILURE_SILENT: 20,
  FAILURE_MISLEADING: 30,
  INFRA_FAILURE: 40,
  EVIDENCE_LAW_VIOLATED: 50,
  
  // Legacy codes (for compatibility)
  USAGE_ERROR: 64,
  DATA_ERROR: 65,
  INCOMPLETE: 66,
  FAILED: 2,
};

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
  // Evidence law violated (highest priority)
  if (runStatus.evidenceLawViolated) {
    return EXIT_CODES.EVIDENCE_LAW_VIOLATED;
  }

  // Infrastructure failure
  if (runStatus.infraFailure || runStatus.status === 'FAILED') {
    return EXIT_CODES.INFRA_FAILURE;
  }

  // Incomplete run
  if (runStatus.status === 'INCOMPLETE') {
    return EXIT_CODES.INCOMPLETE;
  }

  // No judgments = success
  if (!judgments || judgments.length === 0) {
    return EXIT_CODES.SUCCESS;
  }

  // Count judgment types
  const counts = countJudgmentTypes(judgments);

  // FAILURE_MISLEADING present (highest severity failure)
  if (counts.FAILURE_MISLEADING > 0) {
    return EXIT_CODES.FAILURE_MISLEADING;
  }

  // FAILURE_SILENT present
  if (counts.FAILURE_SILENT > 0) {
    return EXIT_CODES.FAILURE_SILENT;
  }

  // NEEDS_REVIEW only
  if (counts.NEEDS_REVIEW > 0) {
    return EXIT_CODES.NEEDS_REVIEW;
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
    [EXIT_CODES.NEEDS_REVIEW]: 'NEEDS_REVIEW',
    [EXIT_CODES.FAILURE_SILENT]: 'FAILURE_SILENT',
    [EXIT_CODES.FAILURE_MISLEADING]: 'FAILURE_MISLEADING',
    [EXIT_CODES.INFRA_FAILURE]: 'INFRA_FAILURE',
    [EXIT_CODES.EVIDENCE_LAW_VIOLATED]: 'EVIDENCE_LAW_VIOLATED',
    [EXIT_CODES.USAGE_ERROR]: 'USAGE_ERROR',
    [EXIT_CODES.DATA_ERROR]: 'DATA_ERROR',
    [EXIT_CODES.INCOMPLETE]: 'INCOMPLETE',
    [EXIT_CODES.FAILED]: 'FAILED',
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
    [EXIT_CODES.SUCCESS]: 'All promises fulfilled (PASS or WEAK_PASS)',
    [EXIT_CODES.NEEDS_REVIEW]: 'Ambiguous outcomes require manual review',
    [EXIT_CODES.FAILURE_SILENT]: 'Silent failures detected - promises not fulfilled',
    [EXIT_CODES.FAILURE_MISLEADING]: 'Misleading outcomes detected - contradictory signals',
    [EXIT_CODES.INFRA_FAILURE]: 'Infrastructure or tool failure',
    [EXIT_CODES.EVIDENCE_LAW_VIOLATED]: 'Evidence law violated - invalid judgment',
    [EXIT_CODES.USAGE_ERROR]: 'Usage error - invalid arguments',
    [EXIT_CODES.DATA_ERROR]: 'Data error - invalid input',
    [EXIT_CODES.INCOMPLETE]: 'Incomplete run - timeout or budget exceeded',
    [EXIT_CODES.FAILED]: 'Run failed - internal error',
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
  return exitCode === EXIT_CODES.FAILURE_SILENT || 
         exitCode === EXIT_CODES.FAILURE_MISLEADING ||
         exitCode === EXIT_CODES.INFRA_FAILURE ||
         exitCode === EXIT_CODES.EVIDENCE_LAW_VIOLATED ||
         exitCode === EXIT_CODES.FAILED;
}

/**
 * Get recommended action for exit code
 * 
 * @param {number} exitCode - Exit code
 * @returns {string} - Recommended action
 */
export function getRecommendedAction(exitCode) {
  const actions = {
    [EXIT_CODES.SUCCESS]: 'No action needed - all checks passed',
    [EXIT_CODES.NEEDS_REVIEW]: 'Review ambiguous findings manually',
    [EXIT_CODES.FAILURE_SILENT]: 'Fix silent failures - promises not fulfilled',
    [EXIT_CODES.FAILURE_MISLEADING]: 'Fix misleading outcomes - contradictory behavior',
    [EXIT_CODES.INFRA_FAILURE]: 'Check infrastructure and tool configuration',
    [EXIT_CODES.EVIDENCE_LAW_VIOLATED]: 'Fix evidence law violation - invalid judgment',
    [EXIT_CODES.USAGE_ERROR]: 'Fix command usage',
    [EXIT_CODES.DATA_ERROR]: 'Fix input data',
    [EXIT_CODES.INCOMPLETE]: 'Increase budget or timeout',
    [EXIT_CODES.FAILED]: 'Check logs for errors',
  };

  return actions[exitCode] || 'Unknown action';
}
