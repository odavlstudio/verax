/**
 * STAGE 5.2: Coverage Truth Model
 * STAGE 5.3: Skip Reason Law
 * 
 * Coverage calculation with legal skip enforcement.
 * 
 * COVERAGE FORMULA:
 * coverage = observed / (total - legallySkipped)
 * 
 * LEGAL SKIP REASONS:
 * - auth_required: Authentication or authorization required
 * - infra_failure: Infrastructure or tool failure
 * 
 * ALL OTHER SKIP REASONS ARE ILLEGAL and count against coverage.
 */

/**
 * Legal skip reasons (STAGE 5.3)
 */
export const LEGAL_SKIP_REASONS = {
  AUTH_REQUIRED: 'auth_required',
  INFRA_FAILURE: 'infra_failure',
};

/**
 * Check if skip reason is legal
 * 
 * @param {string} skipReason - Skip reason
 * @returns {boolean}
 */
export function isLegalSkipReason(skipReason) {
  if (!skipReason) return false;
  
  return Object.values(LEGAL_SKIP_REASONS).includes(skipReason);
}

/**
 * Calculate coverage truth
 * 
 * Formula: observed / (total - legallySkipped)
 * 
 * Rules:
 * - attempted but not observed counts AGAINST coverage
 * - unclassified skip counts AGAINST coverage
 * - only legal skips are excluded from denominator
 * 
 * @param {Array<Object>} executionRecords - Execution records
 * @returns {Object} - Coverage truth
 */
export function calculateCoverageTruth(executionRecords) {
  const total = executionRecords.length;
  let observed = 0;
  let attempted = 0;
  let skipped = 0;
  let legallySkipped = 0;
  let illegallySkipped = 0;
  let attemptedNotObserved = 0;

  const skipReasonCounts = {};
  const legalSkipReasons = [];
  const illegalSkipReasons = [];

  for (const record of executionRecords) {
    if (record.observed) {
      observed++;
    }

    if (record.attempted) {
      attempted++;
      
      if (!record.observed) {
        attemptedNotObserved++;
      }
    }

    if (record.skipped) {
      skipped++;
      
      const reason = record.skipReason || 'unknown';
      skipReasonCounts[reason] = (skipReasonCounts[reason] || 0) + 1;

      if (isLegalSkipReason(reason)) {
        legallySkipped++;
        legalSkipReasons.push({
          promiseId: record.promiseId,
          reason,
        });
      } else {
        illegallySkipped++;
        illegalSkipReasons.push({
          promiseId: record.promiseId,
          reason,
        });
      }
    }
  }

  // Calculate coverage ratio
  const denominator = total - legallySkipped;
  const coverageRatio = denominator > 0 ? observed / denominator : 0;

  return {
    total,
    observed,
    attempted,
    skipped,
    legallySkipped,
    illegallySkipped,
    attemptedNotObserved,
    coverageRatio,
    coveragePercent: Math.round(coverageRatio * 100),
    skipReasonCounts,
    legalSkipReasons,
    illegalSkipReasons,
    // Breakdown for clarity
    countsAgainstCoverage: attemptedNotObserved + illegallySkipped,
    countsForCoverage: observed,
    excludedFromCoverage: legallySkipped,
  };
}

/**
 * Check if coverage meets threshold
 * 
 * @param {Object} coverageTruth - Coverage truth object
 * @param {number} minCoverage - Minimum coverage threshold (0-1)
 * @returns {boolean}
 */
export function meetsCoverageThreshold(coverageTruth, minCoverage) {
  return coverageTruth.coverageRatio >= minCoverage;
}

/**
 * Get coverage status
 * 
 * @param {Object} coverageTruth - Coverage truth object
 * @param {number} minCoverage - Minimum coverage threshold (0-1)
 * @returns {string} - 'PASS', 'FAIL', or 'INCOMPLETE'
 */
export function getCoverageStatus(coverageTruth, minCoverage) {
  if (coverageTruth.total === 0) {
    return 'INCOMPLETE';
  }

  if (meetsCoverageThreshold(coverageTruth, minCoverage)) {
    return 'PASS';
  }

  return 'FAIL';
}

/**
 * Generate coverage report
 * 
 * @param {Object} coverageTruth - Coverage truth object
 * @param {number} minCoverage - Minimum coverage threshold (0-1)
 * @returns {Object} - Coverage report
 */
export function generateCoverageReport(coverageTruth, minCoverage) {
  const status = getCoverageStatus(coverageTruth, minCoverage);
  const meetsThreshold = meetsCoverageThreshold(coverageTruth, minCoverage);

  return {
    status,
    meetsThreshold,
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
}

/**
 * Format coverage summary for display
 * 
 * @param {Object} coverageTruth - Coverage truth object
 * @param {number} minCoverage - Minimum coverage threshold (0-1)
 * @returns {string} - Human-readable summary
 */
export function formatCoverageSummary(coverageTruth, minCoverage) {
  const lines = [];
  
  lines.push(`Coverage: ${coverageTruth.coveragePercent}% (${coverageTruth.observed}/${coverageTruth.total - coverageTruth.legallySkipped})`);
  lines.push(`Threshold: ${Math.round(minCoverage * 100)}%`);
  lines.push(`Status: ${getCoverageStatus(coverageTruth, minCoverage)}`);

  if (coverageTruth.legallySkipped > 0) {
    lines.push(`Legally skipped: ${coverageTruth.legallySkipped}`);
    const reasons = Object.entries(coverageTruth.skipReasonCounts)
      .filter(([reason]) => isLegalSkipReason(reason))
      .map(([reason, count]) => `  - ${reason}: ${count}`)
      .join('\n');
    if (reasons) lines.push(reasons);
  }

  if (coverageTruth.illegallySkipped > 0) {
    lines.push(`Illegally skipped (counts against coverage): ${coverageTruth.illegallySkipped}`);
    const reasons = Object.entries(coverageTruth.skipReasonCounts)
      .filter(([reason]) => !isLegalSkipReason(reason))
      .map(([reason, count]) => `  - ${reason}: ${count}`)
      .join('\n');
    if (reasons) lines.push(reasons);
  }

  if (coverageTruth.attemptedNotObserved > 0) {
    lines.push(`Attempted but not observed (counts against coverage): ${coverageTruth.attemptedNotObserved}`);
  }

  return lines.join('\n');
}
