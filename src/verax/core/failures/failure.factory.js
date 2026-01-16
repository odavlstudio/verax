/**
 * PHASE 21.5 — Failure Factory
 * 
 * Creates properly classified failure objects.
 * No ad-hoc error creation allowed.
 */

import { FAILURE_CODE as _FAILURE_CODE, FAILURE_CATEGORY, FAILURE_SEVERITY, EXECUTION_PHASE, validateFailure } from './failure.types.js';

/**
 * Create a failure object
 * 
 * @param {Object} params
 * @param {string} params.code - Failure code
 * @param {string} params.category - Failure category
 * @param {string} params.severity - Failure severity
 * @param {string} params.phase - Execution phase
 * @param {boolean} params.isRecoverable - Whether recoverable
 * @param {string} params.message - Human-readable message
 * @param {string} params.component - Component name
 * @param {Object} [params.context] - Additional context
 * @param {string} [params.stack] - Stack trace
 * @param {string} [params.recoveryAction] - Recovery action
 * @param {string} [params.impact] - Impact description
 * @returns {Object} Validated failure object
 */
export function createFailure(params) {
  const {
    code,
    category,
    severity,
    phase,
    isRecoverable,
    message,
    component,
    context = {},
    stack = null,
    recoveryAction = null,
    impact = null
  } = params;
  
  const failure = {
    code,
    category,
    severity,
    phase,
    isRecoverable,
    message,
    component,
    timestamp: Date.now(),
    context,
    ...(stack && { stack }),
    ...(recoveryAction && { recoveryAction }),
    ...(impact && { impact })
  };
  
  validateFailure(failure);
  return failure;
}

/**
 * Create evidence law failure
 */
export function createEvidenceFailure(code, message, component, context = {}) {
  return createFailure({
    code,
    category: FAILURE_CATEGORY.EVIDENCE,
    severity: FAILURE_SEVERITY.BLOCKING,
    phase: EXECUTION_PHASE.DETECT,
    isRecoverable: false,
    message,
    component,
    context,
    impact: 'Cannot produce CONFIRMED findings without complete evidence'
  });
}

/**
 * Create determinism failure
 */
export function createDeterminismFailure(code, message, component, context = {}) {
  return createFailure({
    code,
    category: FAILURE_CATEGORY.DETERMINISM,
    severity: FAILURE_SEVERITY.DEGRADED,
    phase: EXECUTION_PHASE.OBSERVE,
    isRecoverable: false,
    message,
    component,
    context,
    impact: 'Determinism verdict downgraded to NON_DETERMINISTIC'
  });
}

/**
 * Create observation failure
 */
export function createObserveFailure(code, message, component, context = {}, isRecoverable = false) {
  return createFailure({
    code,
    category: FAILURE_CATEGORY.OBSERVE,
    severity: isRecoverable ? FAILURE_SEVERITY.DEGRADED : FAILURE_SEVERITY.BLOCKING,
    phase: EXECUTION_PHASE.OBSERVE,
    isRecoverable,
    message,
    component,
    context
  });
}

/**
 * Create detection failure
 */
export function createDetectFailure(code, message, component, context = {}, isRecoverable = false) {
  return createFailure({
    code,
    category: FAILURE_CATEGORY.DETECT,
    severity: isRecoverable ? FAILURE_SEVERITY.DEGRADED : FAILURE_SEVERITY.BLOCKING,
    phase: EXECUTION_PHASE.DETECT,
    isRecoverable,
    message,
    component,
    context
  });
}

/**
 * Create I/O failure
 */
export function createIOFailure(code, message, component, context = {}, isRecoverable = false) {
  return createFailure({
    code,
    category: FAILURE_CATEGORY.IO,
    severity: isRecoverable ? FAILURE_SEVERITY.WARNING : FAILURE_SEVERITY.BLOCKING,
    phase: EXECUTION_PHASE.REPORT,
    isRecoverable,
    message,
    component,
    context
  });
}

/**
 * Create policy failure
 */
export function createPolicyFailure(code, message, component, context = {}) {
  return createFailure({
    code,
    category: FAILURE_CATEGORY.POLICY,
    severity: FAILURE_SEVERITY.BLOCKING,
    phase: EXECUTION_PHASE.DETECT,
    isRecoverable: false,
    message,
    component,
    context,
    impact: 'Invalid policy prevents execution'
  });
}

/**
 * Create contract failure
 */
export function createContractFailure(code, message, component, context = {}, stack = null) {
  return createFailure({
    code,
    category: FAILURE_CATEGORY.CONTRACT,
    severity: FAILURE_SEVERITY.BLOCKING,
    phase: EXECUTION_PHASE.DETECT,
    isRecoverable: false,
    message,
    component,
    context,
    stack,
    impact: 'Invariant violation - system integrity compromised'
  });
}

/**
 * Create internal failure
 */
export function createInternalFailure(code, message, component, context = {}, stack = null) {
  return createFailure({
    code,
    category: FAILURE_CATEGORY.INTERNAL,
    severity: FAILURE_SEVERITY.BLOCKING,
    phase: EXECUTION_PHASE.DETECT,
    isRecoverable: false,
    message,
    component,
    context,
    stack,
    impact: 'Internal error - system state may be corrupted'
  });
}

/**
 * Convert error to failure
 * 
 * @param {Error} error - JavaScript error
 * @param {string} code - Failure code
 * @param {string} category - Failure category
 * @param {string} phase - Execution phase
 * @param {string} component - Component name
 * @param {Object} context - Additional context
 * @returns {Object} Failure object
 */
export function errorToFailure(error, code, category, phase, component, context = {}) {
  return createFailure({
    code,
    category,
    severity: FAILURE_SEVERITY.BLOCKING,
    phase,
    isRecoverable: false,
    message: error.message || 'Unexpected error',
    component,
    context: {
      ...context,
      errorName: error.name,
      errorType: error.constructor?.name
    },
    stack: error.stack || null,
    impact: 'Unexpected error - execution may be incomplete'
  });
}

