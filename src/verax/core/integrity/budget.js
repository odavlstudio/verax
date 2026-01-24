/**
 * PHASE 6A: Hard Budget Enforcement
 * 
 * Enforces performance budgets as HARD limits with immediate termination.
 * No warnings, no soft limits - budget exceeded = ANALYSIS_INCOMPLETE.
 */

import { SKIP_REASON } from '../../../cli/util/support/types.js';

/**
 * Check if budget is exceeded and enforce hard limit
 * 
 * @param {Object} budget - Budget configuration
 * @param {Object} metrics - Current metrics
 * @param {Function} recordSkip - Function to record skip
 * @param {Function} markIncomplete - Function to mark analysis incomplete
 * @returns {{ exceeded: boolean, phase?: string, limit?: number, actual?: number }} Result
 */
export function enforceBudget(budget, metrics, recordSkip, markIncomplete) {
  // Check observe budget
  if (budget.observeMaxMs && metrics.observeMs >= budget.observeMaxMs) {
    recordSkip(SKIP_REASON.TIMEOUT_OBSERVE, 1);
    markIncomplete('observe', budget.observeMaxMs, metrics.observeMs);
    return {
      exceeded: true,
      phase: 'observe',
      limit: budget.observeMaxMs,
      actual: metrics.observeMs,
    };
  }
  
  // Check detect budget
  if (budget.detectMaxMs && metrics.detectMs >= budget.detectMaxMs) {
    recordSkip(SKIP_REASON.TIMEOUT_DETECT, 1);
    markIncomplete('detect', budget.detectMaxMs, metrics.detectMs);
    return {
      exceeded: true,
      phase: 'detect',
      limit: budget.detectMaxMs,
      actual: metrics.detectMs,
    };
  }
  
  // Check total budget
  if (budget.totalMaxMs && metrics.totalMs >= budget.totalMaxMs) {
    recordSkip(SKIP_REASON.TIMEOUT_TOTAL, 1);
    markIncomplete('total', budget.totalMaxMs, metrics.totalMs);
    return {
      exceeded: true,
      phase: 'total',
      limit: budget.totalMaxMs,
      actual: metrics.totalMs,
    };
  }
  
  // Check expectations budget
  if (budget.maxExpectations && metrics.expectationsAnalyzed >= budget.maxExpectations) {
    const skippedCount = metrics.expectationsDiscovered - budget.maxExpectations;
    if (skippedCount > 0) {
      recordSkip(SKIP_REASON.BUDGET_EXCEEDED, skippedCount);
      markIncomplete('expectations', budget.maxExpectations, metrics.expectationsAnalyzed);
      return {
        exceeded: true,
        phase: 'expectations',
        limit: budget.maxExpectations,
        actual: metrics.expectationsAnalyzed,
      };
    }
  }
  
  return { exceeded: false };
}

/**
 * Create budget guard that throws on budget exceeded
 * 
 * @param {Object} budget - Budget configuration
 * @param {Object} metrics - Metrics object (will be updated)
 * @returns {Function} Guard function to check budget
 */
export function createBudgetGuard(budget, metrics) {
  return (phase) => {
    const check = enforceBudget(
      budget,
      metrics,
      () => {}, // Skip recording handled elsewhere
      () => {} // Marking handled elsewhere
    );
    
    if (check.exceeded) {
      const error = new Error(
        `Budget exceeded: ${phase} phase (limit: ${check.limit}ms, actual: ${check.actual}ms)`
      );
      error.name = 'BudgetExceededError';
      // @ts-expect-error - Dynamic error properties
      error.code = 'BUDGET_EXCEEDED';
      // @ts-expect-error - Dynamic error properties
      error.phase = phase;
      // @ts-expect-error - Dynamic error properties
      error.limit = check.limit;
      // @ts-expect-error - Dynamic error properties
      error.actual = check.actual;
      throw error;
    }
  };
}

/**
 * Wrap async operation with budget enforcement
 * 
 * @param {Promise} operation - Async operation
 * @param {Function} budgetGuard - Budget guard function
 * @param {string} phase - Phase name
 * @param {Function} onCheck - Called periodically to check budget
 * @returns {Promise} Operation result or throws on budget exceeded
 */
export async function withBudgetEnforcement(operation, budgetGuard, phase, onCheck) {
  const checkInterval = setInterval(() => {
    try {
      budgetGuard(phase);
      if (onCheck) {
        onCheck();
      }
    } catch (error) {
      clearInterval(checkInterval);
      throw error;
    }
  }, 1000); // Check every second
  
  try {
    const result = await operation;
    clearInterval(checkInterval);
    return result;
  } catch (error) {
    clearInterval(checkInterval);
    throw error;
  }
}



