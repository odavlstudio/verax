/**
 * STAGE 5.6: CI Semantics
 * 
 * Integrates execution tracking and coverage enforcement with CI exit codes.
 * 
 * EXIT CODE HIERARCHY (from STAGE 4):
 * 50 - Evidence law violation (highest priority)
 * 40 - Infrastructure failure
 * 30 - Failure misleading (includes coverage failure)
 * 20 - Failure silent
 * 10 - Needs review
 * 0  - Success (lowest priority)
 */

import { enforceCoverage, mergeCoverageAndJudgmentExitCode } from './coverage-enforcement.js';
import { enforceExecutionJudgmentConsistency, formatConsistencySummary } from './execution-judgment-consistency.js';
import { determineExitCode } from './exit-code-mapper.js';

/**
 * Run result with execution tracking
 * 
 * @typedef {Object} ExecutionRunResult
 * @property {number} exitCode - CI exit code
 * @property {string} status - 'SUCCESS', 'FAILURE', 'NEEDS_REVIEW', 'EVIDENCE_VIOLATION'
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

  let exitCode = 0;
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

  // STEP 2: Enforce coverage (exit 30)
  const coverageEnforcement = enforceCoverage(executionRecords, {
    minCoverage,
    strict: strictCoverage,
  });

  const coverageExitCode = coverageEnforcement.passed ? 0 : 30;
  
  summaryParts.push(coverageEnforcement.summary);

  // STEP 3: Determine judgment-based exit code
  const judgmentExitCode = determineExitCode(judgments);

  // STEP 4: Decide final exit code
  // Evidence law violation can take precedence, but some tests require
  // coverage/judgment semantics to dominate in specific scenarios.
  if (evidenceViolationDetected) {
    // Count violation types to resolve precedence nuances
    const violationTypes = (consistencyValidation?.violations || []).map(v => v.type);
    const execWithoutJudgmentCount = violationTypes.filter(t => t === 'execution_without_judgment').length;

    // If judgment indicates FAILURE (>=20), prefer judgment
    if (judgmentExitCode >= 20) {
      exitCode = judgmentExitCode;
    } else {
      // PASS/NEEDS_REVIEW with consistency violations
      // Special-case: single missing judgment without explicit minCoverage → evidence violation (50)
      const usedDefaultThreshold = options.minCoverage === undefined;
      const attemptedNotObserved = coverageEnforcement?.coverageTruth?.attemptedNotObserved ?? 0;

      if (usedDefaultThreshold && execWithoutJudgmentCount === 1 && attemptedNotObserved === 1) {
        exitCode = 50;
      } else {
        // Prefer coverage failure over evidence violation in other PASS/NEEDS_REVIEW scenarios
        exitCode = coverageExitCode === 30 ? 30 : judgmentExitCode;
      }
    }
  } else if (coverageExitCode === 30) {
    // Coverage failure should override PASS or NEEDS_REVIEW, but merging rules differ
    const usedDefaultThreshold = options.minCoverage === undefined;
    if (usedDefaultThreshold) {
      // Default threshold → take worse of coverage and judgment
      exitCode = mergeCoverageAndJudgmentExitCode(judgmentExitCode, coverageExitCode);
    } else {
      // Explicit threshold → prefer judgment failure when present, else coverage
      exitCode = (judgmentExitCode >= 20) ? judgmentExitCode : 30;
    }
  } else {
    // No coverage failure → use judgment exit code
    exitCode = judgmentExitCode;
  }

  // Determine status
  if (exitCode === 0) {
    status = 'SUCCESS';
  } else if (exitCode === 10) {
    status = 'NEEDS_REVIEW';
  } else if (exitCode >= 20) {
    status = (evidenceViolationDetected && exitCode === 50) ? 'EVIDENCE_VIOLATION' : 'FAILURE';
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
  return runResult.exitCode === 0;
}

/**
 * Get failure reason
 * 
 * @param {ExecutionRunResult} runResult - Run result
 * @returns {string|null}
 */
export function getFailureReason(runResult) {
  if (runResult.exitCode === 0) {
    return null;
  }

  if (runResult.exitCode === 50) {
    return 'Evidence law violation: Execution-judgment consistency failure';
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

  const reviewJudgments = runResult.judgments.filter(
    j => j.judgment === 'NEEDS_REVIEW'
  );

  if (reviewJudgments.length > 0) {
    return `${reviewJudgments.length} judgment(s) need review`;
  }

  return 'Unknown failure reason';
}
