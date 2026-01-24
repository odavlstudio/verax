/**
 * STAGE 5.5: Execution × Judgment Consistency
 * 
 * Validates consistency between execution records and judgments.
 * 
 * CONSISTENCY RULES:
 * 1. Judgment exists ⟺ Execution attempted
 *    - If judgment exists but execution not attempted → EVIDENCE LAW VIOLATION
 *    - If execution attempted but no judgment → EVIDENCE LAW VIOLATION
 * 2. Execution skipped → No judgment (skipped promises do not get judged)
 * 3. Execution attempted but not observed → Judgment must reflect this
 * 
 * VIOLATIONS trigger EvidenceLawViolation (exit code 50)
 */

/**
 * Consistency validation result
 * 
 * @typedef {Object} ConsistencyValidationResult
 * @property {boolean} valid - Whether consistency is valid
 * @property {Array<Object>} violations - Consistency violations
 * @property {string|null} summary - Summary of violations
 */

/**
 * Consistency violation types
 */
export const CONSISTENCY_VIOLATION_TYPES = {
  JUDGMENT_WITHOUT_EXECUTION: 'judgment_without_execution',
  EXECUTION_WITHOUT_JUDGMENT: 'execution_without_judgment',
  JUDGMENT_FOR_SKIPPED: 'judgment_for_skipped',
  MISSING_OBSERVATION_ACKNOWLEDGMENT: 'missing_observation_acknowledgment',
};

/**
 * Validate execution-judgment consistency
 * 
 * @param {Array<Object>} executionRecords - Execution records
 * @param {Array<Object>} judgments - Judgments
 * @returns {ConsistencyValidationResult}
 */
export function validateExecutionJudgmentConsistency(executionRecords, judgments) {
  const violations = [];

  // Build maps for fast lookup
  const executionMap = new Map();
  for (const record of executionRecords) {
    executionMap.set(record.promiseId, record);
  }

  const judgmentMap = new Map();
  for (const judgment of judgments) {
    judgmentMap.set(judgment.promiseId, judgment);
  }

  // Rule 1a: Judgment exists but execution not attempted
  for (const judgment of judgments) {
    const execution = executionMap.get(judgment.promiseId);
    
    if (!execution) {
      violations.push({
        type: CONSISTENCY_VIOLATION_TYPES.JUDGMENT_WITHOUT_EXECUTION,
        promiseId: judgment.promiseId,
        message: `Judgment exists for promise ${judgment.promiseId} but no execution record found`,
        judgment: judgment.judgment,
      });
      continue;
    }

    if (!execution.attempted) {
      violations.push({
        type: CONSISTENCY_VIOLATION_TYPES.JUDGMENT_WITHOUT_EXECUTION,
        promiseId: judgment.promiseId,
        message: `Judgment exists for promise ${judgment.promiseId} but execution was not attempted`,
        judgment: judgment.judgment,
        executionState: execution.state,
      });
    }
  }

  // Rule 1b: Execution attempted but no judgment
  for (const record of executionRecords) {
    if (!record.attempted) {
      continue; // Skip non-attempted executions
    }

    const judgment = judgmentMap.get(record.promiseId);
    
    if (!judgment) {
      violations.push({
        type: CONSISTENCY_VIOLATION_TYPES.EXECUTION_WITHOUT_JUDGMENT,
        promiseId: record.promiseId,
        message: `Execution attempted for promise ${record.promiseId} but no judgment found`,
        executionState: record.state,
        observed: record.observed,
      });
    }
  }

  // Rule 2: Judgment exists for skipped execution
  for (const record of executionRecords) {
    if (!record.skipped) {
      continue;
    }

    const judgment = judgmentMap.get(record.promiseId);
    
    if (judgment) {
      violations.push({
        type: CONSISTENCY_VIOLATION_TYPES.JUDGMENT_FOR_SKIPPED,
        promiseId: record.promiseId,
        message: `Judgment exists for skipped promise ${record.promiseId}`,
        judgment: judgment.judgment,
        skipReason: record.skipReason,
      });
    }
  }

  // Rule 3: Attempted but not observed must be reflected in judgment
  for (const record of executionRecords) {
    if (!record.attempted || record.observed) {
      continue;
    }

    const judgment = judgmentMap.get(record.promiseId);
    
    if (!judgment) {
      continue; // Already caught by Rule 1b
    }

    // Check if judgment acknowledges the lack of observation
    // (This should be reflected in the outcome type)
    if (judgment.outcome?.type === 'promise_fulfilled' && !record.observed) {
      violations.push({
        type: CONSISTENCY_VIOLATION_TYPES.MISSING_OBSERVATION_ACKNOWLEDGMENT,
        promiseId: record.promiseId,
        message: `Promise ${record.promiseId} was attempted but not observed, yet judgment shows promise_fulfilled`,
        judgment: judgment.judgment,
        outcomeType: judgment.outcome?.type,
      });
    }
  }

  const valid = violations.length === 0;
  const summary = valid
    ? null
    : `Found ${violations.length} consistency violation(s):\n` +
      violations.map(v => `  - ${v.message}`).join('\n');

  return {
    valid,
    violations,
    summary,
  };
}

/**
 * Throw if consistency validation fails
 * 
 * @param {Array<Object>} executionRecords - Execution records
 * @param {Array<Object>} judgments - Judgments
 * @throws {Error} If consistency violations found
 */
export function enforceExecutionJudgmentConsistency(executionRecords, judgments) {
  const result = validateExecutionJudgmentConsistency(executionRecords, judgments);
  
  if (!result.valid) {
    /** @type {any} */
    const error = new Error(`Execution-Judgment consistency violation:\n${result.summary}`);
    error.name = 'EvidenceLawViolation';
    error.violations = result.violations;
    error.exitCode = 50; // Evidence law violation
    throw error;
  }
}

/**
 * Get consistency statistics
 * 
 * @param {Array<Object>} executionRecords - Execution records
 * @param {Array<Object>} judgments - Judgments
 * @returns {Object} - Statistics
 */
export function getConsistencyStatistics(executionRecords, judgments) {
  const total = executionRecords.length;
  const attempted = executionRecords.filter(r => r.attempted).length;
  const observed = executionRecords.filter(r => r.observed).length;
  const skipped = executionRecords.filter(r => r.skipped).length;
  const judged = judgments.length;

  return {
    total,
    attempted,
    observed,
    skipped,
    judged,
    expectedJudgments: attempted, // Should equal attempted
    consistencyRatio: attempted > 0 ? judged / attempted : 1,
    isConsistent: judged === attempted,
  };
}

/**
 * Format consistency summary
 * 
 * @param {Array<Object>} executionRecords - Execution records
 * @param {Array<Object>} judgments - Judgments
 * @returns {string} - Human-readable summary
 */
export function formatConsistencySummary(executionRecords, judgments) {
  const stats = getConsistencyStatistics(executionRecords, judgments);
  const result = validateExecutionJudgmentConsistency(executionRecords, judgments);

  const lines = [];
  lines.push(`Execution-Judgment Consistency:`);
  lines.push(`  Total promises: ${stats.total}`);
  lines.push(`  Attempted: ${stats.attempted}`);
  lines.push(`  Observed: ${stats.observed}`);
  lines.push(`  Skipped: ${stats.skipped}`);
  lines.push(`  Judged: ${stats.judged}`);
  lines.push(`  Expected judgments: ${stats.expectedJudgments}`);
  lines.push(`  Status: ${result.valid ? 'CONSISTENT ✓' : 'INCONSISTENT ✗'}`);

  if (!result.valid) {
    lines.push('');
    lines.push('Violations:');
    for (const violation of result.violations) {
      lines.push(`  - ${violation.message}`);
    }
  }

  return lines.join('\n');
}
