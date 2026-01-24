/**
 * PHASE 21.9 — Performance Enforcer
 * 
 * Records performance violations in failure ledger and blocks GA/Release.
 */

import { loadPerformanceReport } from './perf.report.js';
import { createInternalFailure } from '../failures/failure.factory.js';
import { FAILURE_CODE, EXECUTION_PHASE } from '../failures/failure.types.js';

/**
 * Record performance violations in failure ledger
 * 
 * @param {string} projectDir - Project directory
 * @param {string} runId - Run ID
 * @param {Object} failureLedger - Failure ledger instance
 */
export function recordPerformanceViolations(projectDir, runId, failureLedger) {
  const report = loadPerformanceReport(projectDir, runId);
  
  if (!report) {
    return;
  }
  
  // Record BLOCKING violations
  for (const violation of report.violations) {
    const failure = createInternalFailure(
      FAILURE_CODE.INTERNAL_UNEXPECTED_ERROR,
      violation.message,
      'perf.enforcer',
      {
        type: violation.type,
        actual: violation.actual,
        budget: violation.budget,
        excess: violation.excess
      },
      EXECUTION_PHASE.RUNTIME
    );
    failureLedger.record(failure);
  }
  
  // Record DEGRADED warnings
  for (const warning of report.warnings) {
    const failure = createInternalFailure(
      FAILURE_CODE.INTERNAL_UNEXPECTED_ERROR,
      warning.message,
      'perf.enforcer',
      {
        type: warning.type,
        actual: warning.actual,
        budget: warning.budget,
        excess: warning.excess
      },
      EXECUTION_PHASE.RUNTIME
    );
    failure.severity = 'DEGRADED';
    failureLedger.record(failure);
  }
}

/**
 * Check performance status for GA/Release
 * 
 * @param {string} projectDir - Project directory
 * @param {string} runId - Run ID
 * @returns {Object} Performance status
 */
export function checkPerformanceStatus(projectDir, runId) {
  const report = loadPerformanceReport(projectDir, runId);
  
  if (!report) {
    return {
      exists: false,
      ok: false,
      verdict: 'UNKNOWN',
      blockers: ['Performance report not found']
    };
  }
  
  const hasBlocking = report.violations.length > 0;
  const hasDegraded = report.warnings.length > 0;
  
  return {
    exists: true,
    ok: !hasBlocking,
    verdict: report.verdict,
    blockers: hasBlocking ? report.violations.map(v => v.message) : [],
    warnings: hasDegraded ? report.warnings.map(w => w.message) : []
  };
}




