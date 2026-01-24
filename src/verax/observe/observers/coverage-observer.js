/**
 * PHASE 21.3 — Coverage Observer
 * 
 * Responsibilities:
 * - Track coverage gaps
 * - Build coverage summary
 * - Track skipped interactions
 * - NO file I/O
 * - NO side effects outside its scope
 */

import { recordTruncation as _recordTruncation } from '../../core/determinism-model.js';

/**
 * Create coverage gap for remaining interactions
 * 
 * @param {Object} context - Observe context
 * @param {Array} remainingInteractions - Remaining interactions
 * @param {number} startIndex - Start index of remaining interactions
 * @param {string} reason - Reason for gap
 * @returns {Array} Coverage gaps
 */
export function createCoverageGaps(context, remainingInteractions, startIndex, reason) {
  const { currentUrl } = context;
  const gaps = [];
  
  for (let j = startIndex; j < remainingInteractions.length; j++) {
    gaps.push({
      interaction: {
        type: remainingInteractions[j].type,
        selector: remainingInteractions[j].selector,
        label: remainingInteractions[j].label
      },
      reason: reason,
      url: currentUrl
    });
  }
  
  return gaps;
}

/**
 * Build coverage summary
 * 
 * @param {Object} context - Observe context
 * @param {number} totalDiscovered - Total interactions discovered
 * @param {number} totalExecuted - Total interactions executed
 * @param {number} skippedCount - Number of skipped interactions
 * @param {Array} remainingGaps - Remaining interaction gaps
 * @returns {Object} Coverage summary
 */
export function buildCoverageSummary(context, totalDiscovered, totalExecuted, skippedCount, remainingGaps) {
  const { scanBudget, frontier } = context;
  
  return {
    candidatesDiscovered: totalDiscovered,
    candidatesSelected: totalExecuted,
    cap: scanBudget.maxTotalInteractions,
    capped: totalExecuted >= scanBudget.maxTotalInteractions || remainingGaps.length > 0,
    pagesVisited: frontier.pagesVisited,
    pagesDiscovered: frontier.pagesDiscovered,
    skippedInteractions: skippedCount,
    interactionsDiscovered: totalDiscovered,
    interactionsExecuted: totalExecuted
  };
}

/**
 * Create coverage gap for frontier capping
 * 
 * @param {Object} context - Observe context
 * @returns {Object} Coverage gap
 */
export function createFrontierCappedGap(context) {
  const { page, scanBudget } = context;
  
  return {
    expectationId: null,
    type: 'navigation',
    reason: 'frontier_capped',
    fromPath: page.url(),
    source: null,
    evidence: {
      message: `Frontier capped at ${scanBudget.maxUniqueUrls || 'unlimited'} unique URLs`
    }
  };
}

/**
 * Convert remaining interaction gaps to expectation coverage gaps
 * 
 * @param {Array} remainingGaps - Remaining interaction gaps
 * @returns {Array} Expectation coverage gaps
 */
export function convertToExpectationCoverageGaps(remainingGaps) {
  return remainingGaps.map(gap => ({
    expectationId: null,
    type: gap.interaction.type,
    reason: gap.reason,
    fromPath: gap.url,
    source: null,
    evidence: {
      interaction: gap.interaction
    }
  }));
}




