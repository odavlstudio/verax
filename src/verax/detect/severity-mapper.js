/**
 * STAGE 4.4: Severity Law
 * 
 * Severity derived ONLY from judgment + promise kind.
 * NO numeric confidence.
 * 
 * SEVERITY LEVELS:
 * - CRITICAL: Core user flows broken (navigate, submit)
 * - HIGH: Important feedback missing (feedback, state)
 * - MEDIUM: Secondary issues (network, partial)
 * - LOW: Minor concerns (weak pass, needs review)
 * 
 * Deterministic mapping, no heuristics.
 */

import { JUDGMENT_TYPES } from './judgment-mapper.js';

/**
 * Severity Levels
 */
export const SEVERITY_LEVELS = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
};

/**
 * Map judgment + promise kind to severity
 * 
 * Deterministic, evidence-driven.
 * 
 * @param {string} judgment - JUDGMENT_TYPES value
 * @param {string} promiseKind - Kind of promise
 * @returns {string} - SEVERITY_LEVELS value
 */
export function deriveSeverity(judgment, promiseKind) {
  // FAILURE judgments
  if (judgment === JUDGMENT_TYPES.FAILURE_SILENT || 
      judgment === JUDGMENT_TYPES.FAILURE_MISLEADING) {
    
    // Critical promise kinds
    if (isCriticalPromiseKind(promiseKind)) {
      return SEVERITY_LEVELS.CRITICAL;
    }
    
    // Important promise kinds
    if (isImportantPromiseKind(promiseKind)) {
      return SEVERITY_LEVELS.HIGH;
    }
    
    // Other failures
    return SEVERITY_LEVELS.MEDIUM;
  }

  // NEEDS_REVIEW
  if (judgment === JUDGMENT_TYPES.NEEDS_REVIEW) {
    // High priority for critical flows
    if (isCriticalPromiseKind(promiseKind)) {
      return SEVERITY_LEVELS.MEDIUM;
    }
    
    return SEVERITY_LEVELS.LOW;
  }

  // WEAK_PASS
  if (judgment === JUDGMENT_TYPES.WEAK_PASS) {
    return SEVERITY_LEVELS.LOW;
  }

  // PASS
  if (judgment === JUDGMENT_TYPES.PASS) {
    // Even for PASS judgments, severity reflects the promise kind's importance
    // This helps prioritize which PASS judgments matter most
    if (isCriticalPromiseKind(promiseKind)) {
      return SEVERITY_LEVELS.CRITICAL;
    }
    
    if (isImportantPromiseKind(promiseKind)) {
      return SEVERITY_LEVELS.HIGH;
    }
    
    return SEVERITY_LEVELS.LOW;
  }

  // Default
  return SEVERITY_LEVELS.MEDIUM;
}

/**
 * Check if promise kind is critical
 * 
 * Critical = core user flows that must work
 * 
 * @param {string} promiseKind - Promise kind
 * @returns {boolean}
 */
function isCriticalPromiseKind(promiseKind) {
  const critical = [
    'navigate',
    'submit',
    'form_submission',
    'authentication',
    'payment',
  ];

  return critical.includes(promiseKind) || promiseKind?.includes('auth');
}

/**
 * Check if promise kind is important
 * 
 * Important = significant features that affect UX
 * 
 * @param {string} promiseKind - Promise kind
 * @returns {boolean}
 */
function isImportantPromiseKind(promiseKind) {
  const important = [
    'feedback.toast',
    'feedback.modal',
    'feedback.notification',
    'state',
    'state.redux',
    'state.zustand',
    'state.react',
  ];

  return important.includes(promiseKind) || promiseKind?.startsWith('feedback') || promiseKind?.startsWith('state');
}

/**
 * Get severity priority for sorting
 * Higher = more severe
 * 
 * @param {string} severity - SEVERITY_LEVELS value
 * @returns {number}
 */
export function getSeverityPriority(severity) {
  const priorities = {
    [SEVERITY_LEVELS.CRITICAL]: 100,
    [SEVERITY_LEVELS.HIGH]: 75,
    [SEVERITY_LEVELS.MEDIUM]: 50,
    [SEVERITY_LEVELS.LOW]: 25,
  };

  return priorities[severity] ?? 0;
}

/**
 * Get human-readable explanation of severity
 * 
 * @param {string} severity - SEVERITY_LEVELS value
 * @returns {string}
 */
export function explainSeverity(severity) {
  const explanations = {
    [SEVERITY_LEVELS.CRITICAL]: 'Core user flow broken - immediate attention required',
    [SEVERITY_LEVELS.HIGH]: 'Important feature affected - high priority fix needed',
    [SEVERITY_LEVELS.MEDIUM]: 'Secondary issue - should be addressed',
    [SEVERITY_LEVELS.LOW]: 'Minor concern - review when possible',
  };

  return explanations[severity] || 'Unknown severity';
}

/**
 * Check if severity represents a blocking issue
 * 
 * @param {string} severity - SEVERITY_LEVELS value
 * @returns {boolean}
 */
export function isBlockingSeverity(severity) {
  return severity === SEVERITY_LEVELS.CRITICAL || severity === SEVERITY_LEVELS.HIGH;
}

/**
 * Compare severities
 * 
 * @param {string} severity1 - First severity
 * @param {string} severity2 - Second severity
 * @returns {number} - -1 if severity1 < severity2, 0 if equal, 1 if severity1 > severity2
 */
export function compareSeverities(severity1, severity2) {
  const priority1 = getSeverityPriority(severity1);
  const priority2 = getSeverityPriority(severity2);
  
  if (priority1 < priority2) return -1;
  if (priority1 > priority2) return 1;
  return 0;
}
