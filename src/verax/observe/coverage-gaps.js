/**
 * Coverage Gap Accumulation & Warning Generation Module
 * Extracted from observe/index.js (STAGE D2.2)
 * 
 * Responsibility: Manage coverage gap collection from multiple sources
 * and generate corresponding warning messages about incomplete coverage.
 * 
 * This module encapsulates the logic for:
 * 1. Accumulating coverage gaps from remaining unexecuted interactions
 * 2. Detecting and recording frontier capping events
 * 3. Building the coverage metrics object
 * 4. Generating appropriate warning messages
 */

/**
 * Accumulate coverage gaps from remaining interactions and frontier capping.
 * 
 * When the interaction execution loop exits early (due to budget constraints),
 * any unexecuted interactions are collected as coverage gaps with metadata
 * about why they couldn't be executed.
 * 
 * @param {Array} remainingInteractionsGaps - Array of unexecuted interactions with reasons
 * @param {Object} frontier - Frontier object with tracking metadata (frontierCapped, pagesVisited, pagesDiscovered)
 * @param {string} pageUrl - Current page URL from page.url() for gap location context
 * @param {Object} scanBudget - Scan budget configuration (maxUniqueUrls, maxTotalInteractions)
 * @returns {Array} Array of coverage gap objects in expectationCoverageGaps format
 */
export function accumulateCoverageGaps(remainingInteractionsGaps, frontier, pageUrl, scanBudget) {
  const gaps = [];

  // Add remaining interactions as coverage gaps
  // These are interactions that existed but couldn't be executed due to budget constraints
  if (remainingInteractionsGaps.length > 0) {
    gaps.push(...remainingInteractionsGaps.map(gap => ({
      expectationId: null,
      type: gap.interaction.type,
      reason: gap.reason,
      fromPath: gap.url,
      source: null,
      evidence: {
        interaction: gap.interaction
      }
    })));
  }

  // Record frontier capping as coverage gap if it occurred
  // This indicates that the scan encountered the URL discovery limit
  if (frontier.frontierCapped) {
    gaps.push({
      expectationId: null,
      type: 'navigation',
      reason: 'frontier_capped',
      fromPath: pageUrl,
      source: null,
      evidence: {
        message: `Frontier capped at ${scanBudget.maxUniqueUrls || 'unlimited'} unique URLs`
      }
    });
  }

  return gaps;
}

/**
 * Build the coverage metrics object.
 * 
 * The coverage object captures quantitative metrics about what was discovered
 * versus what was actually executed, enabling downstream analysis of coverage
 * completeness and bottlenecks.
 * 
 * @param {number} totalInteractionsDiscovered - Total interactions found across all pages
 * @param {number} totalInteractionsExecuted - Interactions actually executed
 * @param {Object} scanBudget - Scan budget configuration
 * @param {Object} frontier - Frontier object with pagesVisited and pagesDiscovered
 * @param {Array} skippedInteractions - Array of interactions that were skipped for safety
 * @param {Array} remainingInteractionsGaps - Array of unexecuted interactions
 * @returns {Object} Coverage metrics object
 */
export function buildCoverageObject(
  totalInteractionsDiscovered,
  totalInteractionsExecuted,
  scanBudget,
  frontier,
  skippedInteractions,
  remainingInteractionsGaps
) {
  return {
    candidatesDiscovered: totalInteractionsDiscovered,
    candidatesSelected: totalInteractionsExecuted,
    cap: scanBudget.maxTotalInteractions,
    capped: totalInteractionsExecuted >= scanBudget.maxTotalInteractions || remainingInteractionsGaps.length > 0,
    pagesVisited: frontier.pagesVisited,
    pagesDiscovered: frontier.pagesDiscovered,
    skippedInteractions: skippedInteractions.length,
    interactionsDiscovered: totalInteractionsDiscovered,
    interactionsExecuted: totalInteractionsExecuted
  };
}

/**
 * Generate warning messages based on coverage metrics.
 * 
 * Warnings communicate to the user what limitations were encountered during
 * observation, allowing them to understand coverage completeness and any
 * safety-related interaction filtering.
 * 
 * @param {Object} coverage - Coverage metrics object from buildCoverageObject()
 * @param {Array} skippedInteractions - Array of interactions that were skipped for safety
 * @returns {Array} Array of warning objects with code and message properties
 */
export function generateCoverageWarnings(coverage, skippedInteractions) {
  const warnings = [];

  // Warn if coverage was incomplete due to capping
  if (coverage.capped) {
    warnings.push({
      code: 'INTERACTIONS_CAPPED',
      message: `Interaction execution capped. Visited ${coverage.pagesVisited} pages, discovered ${coverage.pagesDiscovered}, executed ${coverage.candidatesSelected} of ${coverage.candidatesDiscovered} interactions. Coverage incomplete.`
    });
  }

  // Warn if interactions were skipped for safety
  if (skippedInteractions.length > 0) {
    warnings.push({
      code: 'INTERACTIONS_SKIPPED',
      message: `Skipped ${skippedInteractions.length} dangerous interactions`,
      details: skippedInteractions
    });
  }

  return warnings;
}



