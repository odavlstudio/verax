/**
 * PHASE 21.5 — Unified Failure Taxonomy
 * 
 * Every failure in VERAX must be classified using this taxonomy.
 * No ad-hoc errors, no string-based exceptions.
 */

/**
 * Failure Categories
 */
export const FAILURE_CATEGORY = {
  EVIDENCE: 'EVIDENCE',           // Evidence Law violations
  DETERMINISM: 'DETERMINISM',     // Determinism violations
  OBSERVE: 'OBSERVE',             // Observation phase failures
  DETECT: 'DETECT',               // Detection phase failures
  VERIFY: 'VERIFY',               // Verification failures
  REPORT: 'REPORT',               // Reporting failures
  CONTRACT: 'CONTRACT',           // Contract/invariant violations
  POLICY: 'POLICY',               // Policy validation failures
  IO: 'IO',                       // File I/O failures
  INTERNAL: 'INTERNAL'            // Internal system errors
};

/**
 * Failure Severity
 */
export const FAILURE_SEVERITY = {
  BLOCKING: 'BLOCKING',   // Execution must stop
  DEGRADED: 'DEGRADED',   // Execution continues, verdict downgraded
  WARNING: 'WARNING'      // Execution continues, recorded only
};

/**
 * Execution Phase
 */
export const EXECUTION_PHASE = {
  LEARN: 'LEARN',
  OBSERVE: 'OBSERVE',
  DETECT: 'DETECT',
  WRITE: 'WRITE',
  VERIFY: 'VERIFY',
  VERDICT: 'VERDICT',
  REPORT: 'REPORT'
};

/**
 * Stable Failure Codes
 * 
 * Each code is stable and machine-readable.
 * Used for deterministic failure classification.
 */
export const FAILURE_CODE = {
  // Evidence Law Failures
  EVIDENCE_INCOMPLETE: 'EVIDENCE_INCOMPLETE',
  EVIDENCE_MISSING_REQUIRED: 'EVIDENCE_MISSING_REQUIRED',
  EVIDENCE_CORRUPTED: 'EVIDENCE_CORRUPTED',
  EVIDENCE_LAW_VIOLATION: 'EVIDENCE_LAW_VIOLATION',
  
  // Determinism Failures
  DETERMINISM_ADAPTIVE_DETECTED: 'DETERMINISM_ADAPTIVE_DETECTED',
  DETERMINISM_NON_REPRODUCIBLE: 'DETERMINISM_NON_REPRODUCIBLE',
  DETERMINISM_TRUTH_VIOLATION: 'DETERMINISM_TRUTH_VIOLATION',
  
  // Observation Failures
  OBSERVE_NAVIGATION_FAILED: 'OBSERVE_NAVIGATION_FAILED',
  OBSERVE_INTERACTION_FAILED: 'OBSERVE_INTERACTION_FAILED',
  OBSERVE_SENSOR_FAILED: 'OBSERVE_SENSOR_FAILED',
  OBSERVE_TIMEOUT: 'OBSERVE_TIMEOUT',
  OBSERVE_BUDGET_EXCEEDED: 'OBSERVE_BUDGET_EXCEEDED',
  OBSERVE_BROWSER_CRASH: 'OBSERVE_BROWSER_CRASH',
  
  // Detection Failures
  DETECT_FINDING_PROCESSING_FAILED: 'DETECT_FINDING_PROCESSING_FAILED',
  DETECT_CONFIDENCE_COMPUTATION_FAILED: 'DETECT_CONFIDENCE_COMPUTATION_FAILED',
  DETECT_GUARDRAILS_FAILED: 'DETECT_GUARDRAILS_FAILED',
  DETECT_EVIDENCE_BUILD_FAILED: 'DETECT_EVIDENCE_BUILD_FAILED',
  
  // Verification Failures
  VERIFY_ARTIFACT_CORRUPTED: 'VERIFY_ARTIFACT_CORRUPTED',
  VERIFY_HASH_MISMATCH: 'VERIFY_HASH_MISMATCH',
  VERIFY_INTEGRITY_VIOLATION: 'VERIFY_INTEGRITY_VIOLATION',
  VERIFICATION_FAILED: 'VERIFICATION_FAILED',
  
  // Verdict Failures
  VERDICT_COMPUTATION_FAILED: 'VERDICT_COMPUTATION_FAILED',
  
  // Observation Execution Failures
  OBSERVE_EXECUTION_FAILED: 'OBSERVE_EXECUTION_FAILED',
  
  // Reporting Failures
  REPORT_WRITE_FAILED: 'REPORT_WRITE_FAILED',
  REPORT_SERIALIZATION_FAILED: 'REPORT_SERIALIZATION_FAILED',
  
  // Contract Failures
  CONTRACT_INVARIANT_VIOLATION: 'CONTRACT_INVARIANT_VIOLATION',
  CONTRACT_PRECONDITION_FAILED: 'CONTRACT_PRECONDITION_FAILED',
  CONTRACT_POSTCONDITION_FAILED: 'CONTRACT_POSTCONDITION_FAILED',
  
  // Policy Failures
  POLICY_INVALID: 'POLICY_INVALID',
  POLICY_LOAD_FAILED: 'POLICY_LOAD_FAILED',
  POLICY_VALIDATION_FAILED: 'POLICY_VALIDATION_FAILED',
  
  // I/O Failures
  IO_READ_FAILED: 'IO_READ_FAILED',
  IO_WRITE_FAILED: 'IO_WRITE_FAILED',
  IO_FILE_NOT_FOUND: 'IO_FILE_NOT_FOUND',
  IO_PERMISSION_DENIED: 'IO_PERMISSION_DENIED',
  
  // Internal Failures
  INTERNAL_UNEXPECTED_ERROR: 'INTERNAL_UNEXPECTED_ERROR',
  INTERNAL_STATE_CORRUPTION: 'INTERNAL_STATE_CORRUPTION',
  INTERNAL_ASSERTION_FAILED: 'INTERNAL_ASSERTION_FAILED',
  
  // Baseline Failures (PHASE 21.11)
  BASELINE_DRIFT: 'BASELINE_DRIFT'
};

/**
 * Failure Object Structure
 * 
 * @typedef {Object} Failure
 * @property {string} code - Stable failure code (from FAILURE_CODE)
 * @property {string} category - Failure category (from FAILURE_CATEGORY)
 * @property {string} severity - Failure severity (from FAILURE_SEVERITY)
 * @property {string} phase - Execution phase (from EXECUTION_PHASE)
 * @property {boolean} isRecoverable - Whether failure can be recovered
 * @property {string} message - Human-readable message
 * @property {string} component - Component where failure occurred
 * @property {number} timestamp - Timestamp of failure
 * @property {Object} context - Additional context
 * @property {string} [stack] - Stack trace (if internal error)
 * @property {string} [recoveryAction] - Recovery action taken (if any)
 * @property {string} [impact] - Impact on verdict/execution
 */

/**
 * Validate failure object
 * 
 * @param {Object} failure - Failure object to validate
 * @throws {Error} If failure is invalid
 */
export function validateFailure(failure) {
  if (!failure) {
    throw new Error('Failure object is required');
  }
  
  if (!failure.code || typeof failure.code !== 'string') {
    throw new Error('Failure must have a code string');
  }
  
  if (!Object.values(FAILURE_CODE).includes(failure.code)) {
    throw new Error(`Invalid failure code: ${failure.code}`);
  }
  
  if (!failure.category || typeof failure.category !== 'string') {
    throw new Error('Failure must have a category string');
  }
  
  if (!Object.values(FAILURE_CATEGORY).includes(failure.category)) {
    throw new Error(`Invalid failure category: ${failure.category}`);
  }
  
  if (!failure.severity || typeof failure.severity !== 'string') {
    throw new Error('Failure must have a severity string');
  }
  
  if (!Object.values(FAILURE_SEVERITY).includes(failure.severity)) {
    throw new Error(`Invalid failure severity: ${failure.severity}`);
  }
  
  if (!failure.phase || typeof failure.phase !== 'string') {
    throw new Error('Failure must have a phase string');
  }
  
  if (!Object.values(EXECUTION_PHASE).includes(failure.phase)) {
    throw new Error(`Invalid execution phase: ${failure.phase}`);
  }
  
  if (typeof failure.isRecoverable !== 'boolean') {
    throw new Error('Failure must have isRecoverable boolean');
  }
  
  if (!failure.message || typeof failure.message !== 'string') {
    throw new Error('Failure must have a message string');
  }
  
  if (!failure.component || typeof failure.component !== 'string') {
    throw new Error('Failure must have a component string');
  }
  
  if (typeof failure.timestamp !== 'number') {
    throw new Error('Failure must have a timestamp number');
  }
}




