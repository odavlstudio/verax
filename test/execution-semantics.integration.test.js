/**
 * STAGE 5: Execution Semantics & Coverage Truth - Integration Tests
 * 
 * Tests all 6 substages:
 * 5.1 - Execution Record
 * 5.2 - Coverage Truth Model
 * 5.3 - Skip Reason Law
 * 5.4 - Coverage Enforcement Gate
 * 5.5 - Execution × Judgment Consistency
 * 5.6 - CI Semantics
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  EXECUTION_STATES,
  createExecutionRecord,
  validateExecutionRecord,
  isExecutionComplete,
  isExecutionIncomplete,
  createExecutionRecords,
} from '../src/verax/detect/execution-record.js';

import {
  LEGAL_SKIP_REASONS as _LEGAL_SKIP_REASONS,
  isLegalSkipReason,
  calculateCoverageTruth,
  meetsCoverageThreshold,
  getCoverageStatus,
  formatCoverageSummary,
} from '../src/verax/detect/coverage-truth.js';

import {
  DEFAULT_MIN_COVERAGE,
  enforceCoverage,
  shouldOverrideJudgments,
  getCoverageExitCode,
  mergeCoverageAndJudgmentExitCode,
  validateExecutionCompleteness,
} from '../src/verax/detect/coverage-enforcement.js';

import {
  CONSISTENCY_VIOLATION_TYPES,
  validateExecutionJudgmentConsistency,
  enforceExecutionJudgmentConsistency,
  getConsistencyStatistics,
  formatConsistencySummary,
} from '../src/verax/detect/execution-judgment-consistency.js';

import {
  determineRunOutcome,
  isRunSuccessful,
  getFailureReason,
} from '../src/verax/detect/ci-integration.js';

describe('STAGE 5.1: Execution Record', () => {
  it('should create execution record for attempted and observed promise', () => {
    const promise = { id: 'p1', kind: 'navigate', selector: 'a' };
    const observation = { observed: true };

    const record = createExecutionRecord(promise, observation);

    assert.equal(record.promiseId, 'p1');
    assert.equal(record.attempted, true);
    assert.equal(record.observed, true);
    assert.equal(record.skipped, false);
    assert.equal(record.skipReason, null);
    assert.equal(record.state, EXECUTION_STATES.ATTEMPTED_AND_OBSERVED);
  });

  it('should create execution record for attempted but not observed promise', () => {
    const promise = { id: 'p2', kind: 'navigate', selector: 'a' };
    const observation = { observed: false };

    const record = createExecutionRecord(promise, observation);

    assert.equal(record.promiseId, 'p2');
    assert.equal(record.attempted, true);
    assert.equal(record.observed, false);
    assert.equal(record.skipped, false);
    assert.equal(record.state, EXECUTION_STATES.ATTEMPTED_NOT_OBSERVED);
  });

  it('should create execution record for skipped promise', () => {
    const promise = { id: 'p3', kind: 'navigate', selector: 'a' };
    const observation = null;
    const skipReason = 'auth_required';

    const record = createExecutionRecord(promise, observation, skipReason);

    assert.equal(record.promiseId, 'p3');
    assert.equal(record.attempted, false);
    assert.equal(record.observed, false);
    assert.equal(record.skipped, true);
    assert.equal(record.skipReason, 'auth_required');
    assert.equal(record.state, EXECUTION_STATES.SKIPPED);
  });

  it('should validate execution record structure', () => {
    const record = {
      promiseId: 'p1',
      attempted: true,
      observed: true,
      skipped: false,
      skipReason: null,
      state: EXECUTION_STATES.ATTEMPTED_AND_OBSERVED,
      evidenceRefs: [],
    };

    const errors = validateExecutionRecord(record);
    assert.equal(errors.length, 0);
  });

  it('should detect invalid execution record', () => {
    const record = {
      // Missing promiseId
      attempted: true,
      observed: true,
    };

    const errors = validateExecutionRecord(record);
    assert.ok(errors.length > 0);
    assert.ok(errors.some(e => e.includes('promiseId')));
  });

  it('should check if execution is complete', () => {
    const complete = {
      promiseId: 'p1',
      attempted: true,
      observed: true,
      skipped: false,
      state: EXECUTION_STATES.ATTEMPTED_AND_OBSERVED,
    };

    const incomplete = {
      promiseId: 'p2',
      attempted: true,
      observed: false,
      skipped: false,
      state: EXECUTION_STATES.ATTEMPTED_NOT_OBSERVED,
    };

    assert.equal(isExecutionComplete(complete), true);
    assert.equal(isExecutionComplete(incomplete), false);
    assert.equal(isExecutionIncomplete(incomplete), true);
  });

  it('should create execution records in batch', () => {
    const promises = [
      { id: 'p1', kind: 'navigate' },
      { id: 'p2', kind: 'navigate' },
      { id: 'p3', kind: 'navigate' },
    ];

    const observations = [
      { promiseId: 'p1', observed: true },
      { promiseId: 'p2', observed: false },
    ];

    const skips = [
      { promiseId: 'p3', reason: 'auth_required' },
    ];

    const records = createExecutionRecords(promises, observations, skips);

    assert.equal(records.length, 3);
    assert.equal(records[0].observed, true);
    assert.equal(records[1].observed, false);
    assert.equal(records[2].skipped, true);
  });
});

describe('STAGE 5.2 & 5.3: Coverage Truth Model & Skip Reason Law', () => {
  it('should recognize legal skip reasons', () => {
    assert.equal(isLegalSkipReason('auth_required'), true);
    assert.equal(isLegalSkipReason('infra_failure'), true);
    assert.equal(isLegalSkipReason('unknown'), false);
    assert.equal(isLegalSkipReason('test_disabled'), false);
  });

  it('should calculate coverage with all observed', () => {
    const records = [
      { promiseId: 'p1', attempted: true, observed: true, skipped: false },
      { promiseId: 'p2', attempted: true, observed: true, skipped: false },
      { promiseId: 'p3', attempted: true, observed: true, skipped: false },
    ];

    const truth = calculateCoverageTruth(records);

    assert.equal(truth.total, 3);
    assert.equal(truth.observed, 3);
    assert.equal(truth.attempted, 3);
    assert.equal(truth.skipped, 0);
    assert.equal(truth.coverageRatio, 1.0);
    assert.equal(truth.coveragePercent, 100);
  });

  it('should calculate coverage with attempted but not observed', () => {
    const records = [
      { promiseId: 'p1', attempted: true, observed: true, skipped: false },
      { promiseId: 'p2', attempted: true, observed: false, skipped: false }, // Counts against
      { promiseId: 'p3', attempted: true, observed: true, skipped: false },
    ];

    const truth = calculateCoverageTruth(records);

    assert.equal(truth.total, 3);
    assert.equal(truth.observed, 2);
    assert.equal(truth.attempted, 3);
    assert.equal(truth.attemptedNotObserved, 1);
    assert.equal(truth.coverageRatio, 2 / 3);
    assert.equal(truth.coveragePercent, 67);
  });

  it('should exclude legal skips from coverage calculation', () => {
    const records = [
      { promiseId: 'p1', attempted: true, observed: true, skipped: false },
      { promiseId: 'p2', attempted: false, observed: false, skipped: true, skipReason: 'auth_required' },
      { promiseId: 'p3', attempted: true, observed: true, skipped: false },
    ];

    const truth = calculateCoverageTruth(records);

    assert.equal(truth.total, 3);
    assert.equal(truth.observed, 2);
    assert.equal(truth.legallySkipped, 1);
    assert.equal(truth.coverageRatio, 2 / 2); // 2 observed / (3 total - 1 legal skip)
    assert.equal(truth.coveragePercent, 100);
  });

  it('should count illegal skips against coverage', () => {
    const records = [
      { promiseId: 'p1', attempted: true, observed: true, skipped: false },
      { promiseId: 'p2', attempted: false, observed: false, skipped: true, skipReason: 'unknown' }, // Illegal
      { promiseId: 'p3', attempted: true, observed: true, skipped: false },
    ];

    const truth = calculateCoverageTruth(records);

    assert.equal(truth.total, 3);
    assert.equal(truth.observed, 2);
    assert.equal(truth.illegallySkipped, 1);
    assert.equal(truth.legallySkipped, 0);
    assert.equal(truth.coverageRatio, 2 / 3); // Illegal skip counts against
    assert.equal(truth.coveragePercent, 67);
  });

  it('should check if coverage meets threshold', () => {
    const goodCoverage = { coverageRatio: 0.95 };
    const badCoverage = { coverageRatio: 0.85 };

    assert.equal(meetsCoverageThreshold(goodCoverage, 0.9), true);
    assert.equal(meetsCoverageThreshold(badCoverage, 0.9), false);
  });

  it('should get coverage status', () => {
    const passCoverage = { total: 10, coverageRatio: 0.95 };
    const failCoverage = { total: 10, coverageRatio: 0.85 };
    const emptyCoverage = { total: 0, coverageRatio: 0 };

    assert.equal(getCoverageStatus(passCoverage, 0.9), 'PASS');
    assert.equal(getCoverageStatus(failCoverage, 0.9), 'FAIL');
    assert.equal(getCoverageStatus(emptyCoverage, 0.9), 'INCOMPLETE');
  });

  it('should format coverage summary', () => {
    const records = [
      { promiseId: 'p1', attempted: true, observed: true, skipped: false },
      { promiseId: 'p2', attempted: true, observed: false, skipped: false },
      { promiseId: 'p3', attempted: false, observed: false, skipped: true, skipReason: 'auth_required' },
    ];

    const truth = calculateCoverageTruth(records);
    const summary = formatCoverageSummary(truth, 0.9);

    assert.ok(summary.includes('Coverage:'));
    assert.ok(summary.includes('Threshold:'));
    assert.ok(summary.includes('Status:'));
  });
});

describe('STAGE 5.4: Coverage Enforcement Gate', () => {
  it('should pass enforcement with high coverage', () => {
    const records = [
      { promiseId: 'p1', attempted: true, observed: true, skipped: false },
      { promiseId: 'p2', attempted: true, observed: true, skipped: false },
      { promiseId: 'p3', attempted: true, observed: true, skipped: false },
    ];

    const result = enforceCoverage(records, { minCoverage: 0.9 });

    assert.equal(result.passed, true);
    assert.equal(result.status, 'PASS');
    assert.equal(result.overridesJudgment, false);
    assert.equal(result.failureReason, null);
  });

  it('should fail enforcement with low coverage', () => {
    const records = [
      { promiseId: 'p1', attempted: true, observed: true, skipped: false },
      { promiseId: 'p2', attempted: true, observed: false, skipped: false },
      { promiseId: 'p3', attempted: true, observed: false, skipped: false },
    ];

    const result = enforceCoverage(records, { minCoverage: 0.9 });

    assert.equal(result.passed, false);
    assert.equal(result.status, 'FAIL');
    assert.equal(result.overridesJudgment, true);
    assert.ok(result.failureReason.includes('below threshold'));
  });

  it('should use default minimum coverage of 0.9', () => {
    assert.equal(DEFAULT_MIN_COVERAGE, 0.9);
  });

  it('should override PASS judgments when coverage fails', () => {
    const enforcementResult = {
      passed: false,
      overridesJudgment: true,
      status: 'FAIL',
    };

    const passJudgments = [
      { judgment: 'PASS' },
      { judgment: 'PASS' },
    ];

    const mixedJudgments = [
      { judgment: 'PASS' },
      { judgment: 'FAILURE_SILENT' },
    ];

    assert.equal(shouldOverrideJudgments(enforcementResult, passJudgments), true);
    assert.equal(shouldOverrideJudgments(enforcementResult, mixedJudgments), false);
  });

  it('should map coverage failure to exit code 30', () => {
    const failResult = {
      passed: false,
      status: 'FAIL',
    };

    const passResult = {
      passed: true,
      status: 'PASS',
    };

    assert.equal(getCoverageExitCode(failResult), 30);
    assert.equal(getCoverageExitCode(passResult), 0);
  });

  it('should merge coverage and judgment exit codes', () => {
    assert.equal(mergeCoverageAndJudgmentExitCode(0, 0), 0);
    assert.equal(mergeCoverageAndJudgmentExitCode(0, 30), 30);
    assert.equal(mergeCoverageAndJudgmentExitCode(20, 30), 30);
    assert.equal(mergeCoverageAndJudgmentExitCode(40, 30), 40);
  });

  it('should validate execution completeness', () => {
    const promises = [
      { id: 'p1' },
      { id: 'p2' },
    ];

    const completeRecords = [
      { promiseId: 'p1' },
      { promiseId: 'p2' },
    ];

    const incompleteRecords = [
      { promiseId: 'p1' },
      // Missing p2
    ];

    // Should not throw for complete
    assert.doesNotThrow(() => {
      validateExecutionCompleteness(promises, completeRecords);
    });

    // Should throw for incomplete
    assert.throws(() => {
      validateExecutionCompleteness(promises, incompleteRecords);
    }, /Execution completeness violation/);
  });
});

describe('STAGE 5.5: Execution × Judgment Consistency', () => {
  it('should validate consistent execution and judgments', () => {
    const records = [
      { promiseId: 'p1', attempted: true, observed: true, skipped: false },
      { promiseId: 'p2', attempted: true, observed: false, skipped: false },
    ];

    const judgments = [
      { promiseId: 'p1', judgment: 'PASS' },
      { promiseId: 'p2', judgment: 'FAILURE_SILENT' },
    ];

    const result = validateExecutionJudgmentConsistency(records, judgments);

    assert.equal(result.valid, true);
    assert.equal(result.violations.length, 0);
  });

  it('should detect judgment without execution', () => {
    const records = [
      { promiseId: 'p1', attempted: false, observed: false, skipped: true, skipReason: 'auth_required' },
    ];

    const judgments = [
      { promiseId: 'p1', judgment: 'PASS' }, // Judgment for skipped promise
    ];

    const result = validateExecutionJudgmentConsistency(records, judgments);

    assert.equal(result.valid, false);
    assert.ok(result.violations.some(v => v.type === CONSISTENCY_VIOLATION_TYPES.JUDGMENT_FOR_SKIPPED));
  });

  it('should detect execution without judgment', () => {
    const records = [
      { promiseId: 'p1', attempted: true, observed: true, skipped: false },
      { promiseId: 'p2', attempted: true, observed: false, skipped: false },
    ];

    const judgments = [
      { promiseId: 'p1', judgment: 'PASS' },
      // Missing judgment for p2
    ];

    const result = validateExecutionJudgmentConsistency(records, judgments);

    assert.equal(result.valid, false);
    assert.ok(result.violations.some(v => v.type === CONSISTENCY_VIOLATION_TYPES.EXECUTION_WITHOUT_JUDGMENT));
  });

  it('should throw on consistency violation when enforcing', () => {
    const records = [
      { promiseId: 'p1', attempted: true, observed: true, skipped: false },
    ];

    const judgments = []; // No judgments

    assert.throws(() => {
      enforceExecutionJudgmentConsistency(records, judgments);
    }, /Execution-Judgment consistency violation/);
  });

  it('should calculate consistency statistics', () => {
    const records = [
      { promiseId: 'p1', attempted: true, observed: true, skipped: false },
      { promiseId: 'p2', attempted: true, observed: false, skipped: false },
      { promiseId: 'p3', attempted: false, observed: false, skipped: true, skipReason: 'auth_required' },
    ];

    const judgments = [
      { promiseId: 'p1', judgment: 'PASS' },
      { promiseId: 'p2', judgment: 'FAILURE_SILENT' },
    ];

    const stats = getConsistencyStatistics(records, judgments);

    assert.equal(stats.total, 3);
    assert.equal(stats.attempted, 2);
    assert.equal(stats.observed, 1);
    assert.equal(stats.skipped, 1);
    assert.equal(stats.judged, 2);
    assert.equal(stats.expectedJudgments, 2);
    assert.equal(stats.isConsistent, true);
  });

  it('should format consistency summary', () => {
    const records = [
      { promiseId: 'p1', attempted: true, observed: true, skipped: false },
    ];

    const judgments = [
      { promiseId: 'p1', judgment: 'PASS' },
    ];

    const summary = formatConsistencySummary(records, judgments);

    assert.ok(summary.includes('Execution-Judgment Consistency:'));
    assert.ok(summary.includes('CONSISTENT'));
  });
});

describe('STAGE 5.6: CI Semantics', () => {
  it('should determine successful run outcome', () => {
    const judgments = [
      { promiseId: 'p1', judgment: 'PASS' },
      { promiseId: 'p2', judgment: 'PASS' },
    ];

    const records = [
      { promiseId: 'p1', attempted: true, observed: true, skipped: false },
      { promiseId: 'p2', attempted: true, observed: true, skipped: false },
    ];

    const result = determineRunOutcome(judgments, records);

    assert.equal(result.exitCode, 0);
    assert.equal(result.status, 'SUCCESS');
    assert.equal(isRunSuccessful(result), true);
    assert.equal(getFailureReason(result), null);
  });

  it('should determine failed run outcome with low coverage', () => {
    const judgments = [
      { promiseId: 'p1', judgment: 'PASS' },
    ];

    const records = [
      { promiseId: 'p1', attempted: true, observed: true, skipped: false },
      { promiseId: 'p2', attempted: true, observed: false, skipped: false },
      { promiseId: 'p3', attempted: true, observed: false, skipped: false },
    ];

    const result = determineRunOutcome(judgments, records, { minCoverage: 0.9 });

    assert.equal(result.exitCode, 30);
    assert.equal(result.status, 'INCOMPLETE');
    assert.equal(isRunSuccessful(result), false);
    assert.ok(getFailureReason(result).includes('below threshold'));
  });

  it('should prioritize consistency violation over coverage failure', () => {
    const judgments = [
      { promiseId: 'p1', judgment: 'PASS' },
      // Missing judgment for p2
    ];

    const records = [
      { promiseId: 'p1', attempted: true, observed: true, skipped: false },
      { promiseId: 'p2', attempted: true, observed: false, skipped: false },
    ];

    const result = determineRunOutcome(judgments, records);

    assert.equal(result.exitCode, 50); // Evidence violation, not coverage failure
    assert.equal(result.status, 'INCOMPLETE');
  });

  it('should integrate with STAGE 4 judgment exit codes', () => {
    const judgments = [
      { promiseId: 'p1', judgment: 'FAILURE_SILENT' },
    ];

    const records = [
      { promiseId: 'p1', attempted: true, observed: false, skipped: false },
    ];

    const result = determineRunOutcome(judgments, records, { minCoverage: 0.5 });

    assert.equal(result.exitCode, 20); // FAILURE_SILENT from judgment
    assert.equal(result.status, 'FINDINGS');
  });

  it('should take higher exit code when both coverage and judgment fail', () => {
    const judgments = [
      { promiseId: 'p1', judgment: 'NEEDS_REVIEW' }, // Exit 30 (INCOMPLETE)
    ];

    const records = [
      { promiseId: 'p1', attempted: true, observed: true, skipped: false },
      { promiseId: 'p2', attempted: true, observed: false, skipped: false },
      { promiseId: 'p3', attempted: true, observed: false, skipped: false },
    ];

    const result = determineRunOutcome(judgments, records, { minCoverage: 0.9 });

    assert.equal(result.exitCode, 30); // Coverage exit 30 > judgment exit 30
  });
});

describe('STAGE 5: End-to-End Integration', () => {
  it('should handle complete successful run', () => {
    // Create promises
    const promises = [
      { id: 'p1', kind: 'navigate', selector: 'a' },
      { id: 'p2', kind: 'click', selector: 'button' },
      { id: 'p3', kind: 'navigate', selector: 'a' },
    ];

    // Create observations
    const observations = [
      { promiseId: 'p1', observed: true },
      { promiseId: 'p2', observed: true },
      { promiseId: 'p3', observed: true },
    ];

    // Create execution records
    const records = createExecutionRecords(promises, observations, []);

    // Create judgments
    const judgments = [
      { promiseId: 'p1', judgment: 'PASS' },
      { promiseId: 'p2', judgment: 'PASS' },
      { promiseId: 'p3', judgment: 'PASS' },
    ];

    // Determine outcome
    const result = determineRunOutcome(judgments, records);

    assert.equal(result.exitCode, 0);
    assert.equal(result.status, 'SUCCESS');
    assert.equal(result.coverageEnforcement.passed, true);
    assert.equal(result.consistencyValidation.valid, true);
  });

  it('should handle run with legal skips', () => {
    const promises = [
      { id: 'p1', kind: 'navigate', selector: 'a' },
      { id: 'p2', kind: 'auth', selector: 'button' },
      { id: 'p3', kind: 'navigate', selector: 'a' },
    ];

    const observations = [
      { promiseId: 'p1', observed: true },
      { promiseId: 'p3', observed: true },
    ];

    const skips = [
      { promiseId: 'p2', reason: 'auth_required' }, // Legal skip
    ];

    const records = createExecutionRecords(promises, observations, skips);

    const judgments = [
      { promiseId: 'p1', judgment: 'PASS' },
      { promiseId: 'p3', judgment: 'PASS' },
      // No judgment for p2 (skipped)
    ];

    const result = determineRunOutcome(judgments, records);

    assert.equal(result.exitCode, 0);
    assert.equal(result.status, 'SUCCESS');
    assert.equal(result.coverageEnforcement.report.legallySkipped, 1);
  });

  it('should handle run with coverage failure', () => {
    const promises = [
      { id: 'p1', kind: 'navigate', selector: 'a' },
      { id: 'p2', kind: 'click', selector: 'button' },
      { id: 'p3', kind: 'navigate', selector: 'a' },
      { id: 'p4', kind: 'click', selector: 'button' },
    ];

    const observations = [
      { promiseId: 'p1', observed: true },
      { promiseId: 'p2', observed: false },
      { promiseId: 'p3', observed: false },
      { promiseId: 'p4', observed: false },
    ];

    const records = createExecutionRecords(promises, observations, []);

    const judgments = [
      { promiseId: 'p1', judgment: 'PASS' },
      { promiseId: 'p2', judgment: 'FAILURE_SILENT' },
      { promiseId: 'p3', judgment: 'FAILURE_SILENT' },
      { promiseId: 'p4', judgment: 'FAILURE_SILENT' },
    ];

    const result = determineRunOutcome(judgments, records);

    // Coverage is 25% (1/4), below 90% threshold
    assert.equal(result.exitCode, 30); // Coverage or judgment failure
    assert.equal(result.status, 'FAILURE');
    assert.equal(result.coverageEnforcement.passed, false);
  });

  it('should handle run with consistency violation', () => {
    const promises = [
      { id: 'p1', kind: 'navigate', selector: 'a' },
      { id: 'p2', kind: 'click', selector: 'button' },
    ];

    const observations = [
      { promiseId: 'p1', observed: true },
      { promiseId: 'p2', observed: false },
    ];

    const records = createExecutionRecords(promises, observations, []);

    const judgments = [
      { promiseId: 'p1', judgment: 'PASS' },
      // Missing judgment for p2 - consistency violation
    ];

    const result = determineRunOutcome(judgments, records);

    assert.equal(result.exitCode, 50); // Evidence law violation
    assert.equal(result.status, 'EVIDENCE_VIOLATION');
    assert.equal(result.consistencyValidation.valid, false);
  });
});
