/**
 * STAGE 5.4: Coverage Enforcement Gate
 * 
 * Enforces coverage requirements and determines run outcome.
 * 
 * ENFORCEMENT RULES:
 * - Default minCoverage: 0.9 (90%)
 * - Coverage < minCoverage → INCOMPLETE state overrides PASS
 * - Coverage failure maps to exit code 30 (INCOMPLETE)
 * - Legal skips (auth_required, infra_failure) do not count against coverage
 */

import { calculateCoverageTruth, getCoverageStatus, formatCoverageSummary } from './coverage-truth.js';
import { EXIT_CODES } from '../shared/exit-codes.js';

/**
 * Default minimum coverage threshold
 */
export const DEFAULT_MIN_COVERAGE = 0.9;

/**
 * Coverage enforcement result
 * 
 * @typedef {Object} CoverageEnforcementResult
 * @property {boolean} passed - Whether coverage enforcement passed
 * @property {string} status - 'PASS', 'FAIL', or 'INCOMPLETE'
 * @property {Object} coverageTruth - Coverage truth object
 * @property {Object} report - Coverage report
 * @property {string} summary - Human-readable summary
 * @property {boolean} overridesJudgment - Whether coverage failure overrides PASS judgments
 * @property {string|null} failureReason - Failure reason if not passed
 */

/**
 * Enforce coverage requirements
 * 
 * @param {Array<Object>} executionRecords - Execution records
 * @param {Object} options - Options
 * @param {number} [options.minCoverage] - Minimum coverage threshold (0-1)
 * @param {boolean} [options.strict] - Strict mode (treat INCOMPLETE as failure)
 * @returns {CoverageEnforcementResult}
 */
export function enforceCoverage(executionRecords, options = {}) {
  const minCoverage = options.minCoverage ?? DEFAULT_MIN_COVERAGE;
  const strict = options.strict ?? false;

  // Calculate coverage truth
  const coverageTruth = calculateCoverageTruth(executionRecords);
  const status = getCoverageStatus(coverageTruth, minCoverage);
  const summary = formatCoverageSummary(coverageTruth, minCoverage);

  // Determine pass/fail
  let passed = status === 'PASS';
  let failureReason = null;
  let overridesJudgment = false;

  if (status === 'FAIL') {
    passed = false;
    failureReason = `Coverage ${coverageTruth.coveragePercent}% below threshold ${Math.round(minCoverage * 100)}%`;
    overridesJudgment = true; // Coverage failure overrides PASS judgments
  } else if (status === 'INCOMPLETE' && strict) {
    passed = false;
    failureReason = 'No promises found (incomplete run)';
    overridesJudgment = true;
  }

  // Generate report
  const report = {
    status,
    passed,
    meetsThreshold: coverageTruth.coverageRatio >= minCoverage,
    threshold: minCoverage,
    ratio: coverageTruth.coverageRatio,
    percent: coverageTruth.coveragePercent,
    total: coverageTruth.total,
    observed: coverageTruth.observed,
    attempted: coverageTruth.attempted,
    skipped: coverageTruth.skipped,
    legallySkipped: coverageTruth.legallySkipped,
    illegallySkipped: coverageTruth.illegallySkipped,
    attemptedNotObserved: coverageTruth.attemptedNotObserved,
    skipReasonCounts: coverageTruth.skipReasonCounts,
    illegalSkipReasons: coverageTruth.illegalSkipReasons,
  };

  return {
    passed,
    status,
    coverageTruth,
    report,
    summary,
    overridesJudgment,
    failureReason,
  };
}

/**
 * Check if coverage enforcement should override judgments
 * 
 * @param {CoverageEnforcementResult} enforcementResult - Enforcement result
 * @param {Array<Object>} judgments - Judgments
 * @returns {boolean}
 */
export function shouldOverrideJudgments(enforcementResult, judgments) {
  if (!enforcementResult.overridesJudgment) {
    return false;
  }

  // Only override if all judgments are PASS
  const allPass = judgments.every(j => j.judgment === 'PASS');
  return allPass;
}

/**
 * Get exit code for coverage enforcement
 * 
 * Maps coverage failure to FAILURE_MISLEADING (exit 30) because
 * insufficient coverage means we cannot trust the run results.
 * 
 * @param {CoverageEnforcementResult} enforcementResult - Enforcement result
 * @returns {number} - Exit code (0 or 30)
 */
export function getCoverageExitCode(enforcementResult) {
  if (enforcementResult.passed) {
    return EXIT_CODES.SUCCESS; // No coverage issues
  }

  if (enforcementResult.status === 'FAIL') {
    return EXIT_CODES.INCOMPLETE; // coverage too low to trust results
  }

  if (enforcementResult.status === 'INCOMPLETE') {
    return EXIT_CODES.INCOMPLETE; // no promises found / incomplete
  }

  return EXIT_CODES.SUCCESS;
}

/**
 * Merge coverage enforcement with judgment exit code
 * 
 * Takes the higher exit code (worse outcome).
 * 
 * @param {number} judgmentExitCode - Exit code from judgment engine
 * @param {number} coverageExitCode - Exit code from coverage enforcement
 * @returns {number} - Final exit code
 */
export function mergeCoverageAndJudgmentExitCode(judgmentExitCode, coverageExitCode) {
  return Math.max(judgmentExitCode, coverageExitCode);
}

/**
 * Validate execution completeness
 * 
 * Ensures all promises have execution records.
 * 
 * @param {Array<Object>} promises - Promise captures
 * @param {Array<Object>} executionRecords - Execution records
 * @throws {Error} If mismatch detected
 */
export function validateExecutionCompleteness(promises, executionRecords) {
  const promiseIds = new Set(promises.map(p => p.id));
  const recordIds = new Set(executionRecords.map(r => r.promiseId));

  const missingRecords = [...promiseIds].filter(id => !recordIds.has(id));
  const extraRecords = [...recordIds].filter(id => !promiseIds.has(id));

  if (missingRecords.length > 0 || extraRecords.length > 0) {
    throw new Error(
      `Execution completeness violation:\n` +
      `Missing records: ${missingRecords.length}\n` +
      `Extra records: ${extraRecords.length}\n` +
      `Every promise must have exactly one execution record.`
    );
  }
}
