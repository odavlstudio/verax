/**
 * PHASE 21.3 — Budget Observer
 * 
 * Responsibilities:
 * - Budget limit checking
 * - Truncation decision recording
 * - Budget-related silence tracking
 * 
 * NO file I/O
 * NO side effects outside its scope
 */

import { getTimeProvider } from '../../../cli/util/support/time-provider.js';

import { recordTruncation } from '../../core/determinism-model.js';

/**
 * Check if budget limits are exceeded
 * 
 * @param {Object} context - Observe context
 * @param {Object} runState - Current run state
 * @param {Object} options - Additional options
 * @param {number} options.remainingInteractions - Remaining interactions count
 * @param {number} options.currentTotalExecuted - Current total executed
 * @param {string} options.limitType - Type of limit to check ('time', 'per_page', 'total', 'pages')
 * @returns {Object} { exceeded: boolean, reason?: string, observation?: Object }
 */
export function checkBudget(context, runState, options) {
  const { scanBudget, startTime, routeBudget, decisionRecorder, silenceTracker, frontier, page } = context;
  const { remainingInteractions = 0, currentTotalExecuted = 0, limitType } = options;
  const timeProvider = getTimeProvider();
  const now = timeProvider.now();
  
  if (limitType === 'time' && now - startTime > scanBudget.maxScanDurationMs) {    recordTruncation(decisionRecorder, 'time', {
      limit: scanBudget.maxScanDurationMs,
      elapsed: now - startTime
    });
    
    // Mark remaining interactions as COVERAGE_GAP
    silenceTracker.record({
      scope: 'interaction',
      reason: 'scan_time_exceeded',
      description: `Scan time limit (${scanBudget.maxScanDurationMs}ms) exceeded`,
      context: { 
        elapsed: now - startTime,
        maxDuration: scanBudget.maxScanDurationMs,
        remainingInteractions
      },
      impact: 'blocks_nav',
      count: remainingInteractions
    });
    
    return {
      exceeded: true,
      reason: 'scan_time_exceeded',
      observation: {
        type: 'budget_exceeded',
        scope: 'scan',
        data: {
          limitType: 'time',
          limit: scanBudget.maxScanDurationMs,
          elapsed: now - startTime,
          remainingInteractions
        },
        timestamp: now,
        url: page.url()
      }
    };
  }
  
  if (limitType === 'per_page' && currentTotalExecuted >= routeBudget.maxInteractionsPerPage) {    recordTruncation(decisionRecorder, 'interactions', {
      limit: routeBudget.maxInteractionsPerPage,
      reached: currentTotalExecuted,
      scope: 'per_page'
    });
    
    // Route-specific budget exceeded
    silenceTracker.record({
      scope: 'interaction',
      reason: 'route_interaction_limit_exceeded',
      description: `Reached max ${routeBudget.maxInteractionsPerPage} interactions per page`,
      context: {
        currentPage: page.url(),
        executed: currentTotalExecuted,
        maxPerPage: routeBudget.maxInteractionsPerPage,
        remainingInteractions
      },
      impact: 'affects_expectations',
      count: remainingInteractions
    });
    
    return {
      exceeded: true,
      reason: 'route_interaction_limit_exceeded',
      observation: {
        type: 'budget_exceeded',
        scope: 'page',
        data: {
          limitType: 'per_page',
          limit: routeBudget.maxInteractionsPerPage,
          reached: currentTotalExecuted,
          remainingInteractions
        },
        timestamp: now,
        url: page.url()
      }
    };
  }
  
  if (limitType === 'total' && currentTotalExecuted >= scanBudget.maxTotalInteractions) {    recordTruncation(decisionRecorder, 'interactions', {
      limit: scanBudget.maxTotalInteractions,
      reached: currentTotalExecuted,
      scope: 'total'
    });
    
    // Mark remaining interactions as COVERAGE_GAP with reason 'budget_exceeded'
    silenceTracker.record({
      scope: 'interaction',
      reason: 'interaction_limit_exceeded',
      description: `Reached max ${scanBudget.maxTotalInteractions} total interactions`,
      context: {
        executed: currentTotalExecuted,
        maxTotal: scanBudget.maxTotalInteractions,
        remainingInteractions
      },
      impact: 'blocks_nav',
      count: remainingInteractions
    });
    
    return {
      exceeded: true,
      reason: 'interaction_limit_exceeded',
      observation: {
        type: 'budget_exceeded',
        scope: 'scan',
        data: {
          limitType: 'total',
          limit: scanBudget.maxTotalInteractions,
          reached: currentTotalExecuted,
          remainingInteractions
        },
        timestamp: now,
        url: page.url()
      }
    };
  }
  
  if (limitType === 'pages' && frontier.isPageLimitExceeded()) {    recordTruncation(decisionRecorder, 'pages', {
      limit: scanBudget.maxPages,
      reached: frontier.pagesVisited
    });
    
    silenceTracker.record({
      scope: 'page',
      reason: 'page_limit_exceeded',
      description: `Reached maximum of ${scanBudget.maxPages} pages visited`,
      context: { pagesVisited: frontier.pagesVisited, maxPages: scanBudget.maxPages },
      impact: 'blocks_nav'
    });
    
    return {
      exceeded: true,
      reason: 'page_limit_exceeded',
      observation: {
        type: 'budget_exceeded',
        scope: 'page',
        data: {
          limitType: 'pages',
          limit: scanBudget.maxPages,
          reached: frontier.pagesVisited
        },
        timestamp: now,
        url: page.url()
      }
    };
  }
  
  return { exceeded: false };
}




