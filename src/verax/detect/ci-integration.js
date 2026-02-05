/**
 * CI Semantics (Contract-Aligned)
 *
 * Integrates execution tracking + coverage enforcement and produces only the
 * official VERAX exit codes:
 * - 0  SUCCESS
 * - 20 FINDINGS
 * - 30 INCOMPLETE
 * - 50 INVARIANT_VIOLATION
 * - 64 USAGE_ERROR
 */

import { enforceCoverage, mergeCoverageAndJudgmentExitCode } from './coverage-enforcement.js';
import { enforceExecutionJudgmentConsistency, formatConsistencySummary } from './execution-judgment-consistency.js';
import { determineExitCode } from './exit-code-mapper.js';
import { EXIT_CODES } from '../shared/exit-codes.js';

/**
 * Run result with execution tracking
 * 
 * @typedef {Object} ExecutionRunResult
 * @property {number} exitCode - Exit code (official contract only)
 * @property {string} status - Truth vocabulary ('SUCCESS' | 'FINDINGS' | 'INCOMPLETE')
 * @property {Array<Object>} judgments - Judgments
 * @property {Array<Object>} executionRecords - Execution records
 * @property {Object} coverageEnforcement - Coverage enforcement result
 * @property {Object} consistencyValidation - Consistency validation result
 * @property {string} summary - Human-readable summary
 */

/**
 * Determine run outcome with execution tracking
 * 
 * Integrates:
 * 1. Execution-judgment consistency validation (exit 50 if violated)
 * 2. Coverage enforcement (exit 30 if failed)
 * 3. Judgment-based exit codes (STAGE 4)
 * 
 * @param {Array<Object>} judgments - Judgments
 * @param {Array<Object>} executionRecords - Execution records
 * @param {Object} options - Options
 * @param {number} [options.minCoverage=0.9] - Minimum coverage threshold
 * @param {boolean} [options.strictCoverage=false] - Treat incomplete as failure
 * @param {boolean} [options.enforceConsistency=true] - Enforce execution-judgment consistency
 * @returns {ExecutionRunResult}
 */
export function determineRunOutcome(judgments, executionRecords, options = {}) {
  const minCoverage = options.minCoverage ?? 0.9;
  const strictCoverage = options.strictCoverage ?? false;
  const enforceConsistency = options.enforceConsistency ?? true;

  /** @type {number} */ let exitCode = EXIT_CODES.SUCCESS;
  let status = 'SUCCESS';
  const summaryParts = [];

  // STEP 1: Validate execution-judgment consistency (capture but don't early-return)
  let consistencyValidation = null;
  let evidenceViolationDetected = false;
  
  if (enforceConsistency) {
    try {
      enforceExecutionJudgmentConsistency(executionRecords, judgments);
      consistencyValidation = {
        valid: true,
        violations: [],
        summary: null,
      };
      summaryParts.push('Execution-judgment consistency: ✓');
    } catch (error) {
      if (error.name === 'EvidenceLawViolation') {
        evidenceViolationDetected = true;
        consistencyValidation = {
          valid: false,
          violations: error.violations,
          summary: error.message,
        };
        summaryParts.push(`Execution-judgment consistency: ✗\n${formatConsistencySummary(executionRecords, judgments)}`);
      } else {
        throw error; // Re-throw unexpected errors
      }
    }
  }

  // STEP 2: Enforce coverage (INCOMPLETE on failure)
  const coverageEnforcement = enforceCoverage(executionRecords, {
    minCoverage,
    strict: strictCoverage,
  });

  const coverageExitCode = coverageEnforcement.passed ? EXIT_CODES.SUCCESS : EXIT_CODES.INCOMPLETE;
  
  summaryParts.push(coverageEnforcement.summary);

  // STEP 3: Determine judgment-based exit code
  const judgmentExitCode = determineExitCode(judgments);

  // STEP 4: Decide final exit code
  if (evidenceViolationDetected) {
    exitCode = EXIT_CODES.INVARIANT_VIOLATION;
  } else if (coverageExitCode === EXIT_CODES.INCOMPLETE) {
    // Coverage failure should override PASS or NEEDS_REVIEW, but merging rules differ
    const usedDefaultThreshold = options.minCoverage === undefined;
    if (usedDefaultThreshold) {
      // Default threshold → take worse of coverage and judgment
      exitCode = mergeCoverageAndJudgmentExitCode(judgmentExitCode, coverageExitCode);
    } else {
      // Explicit threshold → prefer FINDINGS when present, else INCOMPLETE
      exitCode = judgmentExitCode === EXIT_CODES.FINDINGS ? judgmentExitCode : EXIT_CODES.INCOMPLETE;
    }
  } else {
    // No coverage failure → use judgment exit code
    exitCode = judgmentExitCode;
  }

  // Determine status
  if (exitCode === EXIT_CODES.SUCCESS) {
    status = 'SUCCESS';
  } else if (exitCode === EXIT_CODES.FINDINGS) {
    status = 'FINDINGS';
  } else {
    status = 'INCOMPLETE';
  }

  // Add judgment summary
  const judgmentCounts = {};
  for (const judgment of judgments) {
    judgmentCounts[judgment.judgment] = (judgmentCounts[judgment.judgment] || 0) + 1;
  }
  
  const judgmentSummary = Object.entries(judgmentCounts)
    .map(([type, count]) => `  ${type}: ${count}`)
    .join('\n');
  
  summaryParts.push(`\nJudgments:\n${judgmentSummary}`);
  summaryParts.push(`\nExit code: ${exitCode} (${status})`);

  return {
    exitCode,
    status,
    judgments,
    executionRecords,
    coverageEnforcement,
    consistencyValidation,
    summary: summaryParts.join('\n'),
  };
}

/**
 * Create execution summary
 * 
 * @param {ExecutionRunResult} runResult - Run result
 * @returns {string} - Human-readable summary
 */
export function createExecutionSummary(runResult) {
  return runResult.summary;
}

/**
 * Check if run succeeded
 * 
 * @param {ExecutionRunResult} runResult - Run result
 * @returns {boolean}
 */
export function isRunSuccessful(runResult) {
  return runResult.exitCode === EXIT_CODES.SUCCESS;
}

/**
 * Get failure reason
 * 
 * @param {ExecutionRunResult} runResult - Run result
 * @returns {string|null}
 */
export function getFailureReason(runResult) {
  if (runResult.exitCode === EXIT_CODES.SUCCESS) {
    return null;
  }

  if (runResult.exitCode === EXIT_CODES.INVARIANT_VIOLATION) {
    return 'Invariant violation: Execution-judgment consistency failure';
  }

  if (!runResult.coverageEnforcement?.passed) {
    return runResult.coverageEnforcement.failureReason;
  }

  // Check for judgment failures
  const failureJudgments = runResult.judgments.filter(
    j => j.judgment === 'FAILURE_SILENT' || j.judgment === 'FAILURE_MISLEADING'
  );

  if (failureJudgments.length > 0) {
    return `${failureJudgments.length} failure judgment(s) detected`;
  }

  return 'Unknown failure reason';
}
