/**
 * PHASE 21.3 — Observe Runner
 * 
 * Extracted main traversal/interaction loop from observe/index.js
 * Handles page traversal, interaction discovery, and execution
 * 
 * NO file I/O - all artifacts written by caller
 */

import { navigateToPage, discoverPageLinks, isAlreadyOnPage, markPageVisited } from './observers/navigation-observer.js';
import { discoverInteractions, checkAndSkipInteraction, executeInteraction } from './observers/interaction-observer.js';
import { checkBudget } from './observers/budget-observer.js';
import { createObserveContext } from './observe-context.js';

/**
 * Run main traversal/interaction loop
 * 
 * @param {Object} params - Parameters object
 * @param {import('playwright').Page} params.page - Playwright page instance
 * @param {string} params.url - Page URL
 * @param {string} params.baseOrigin - Base origin for relative URLs
 * @param {Object} params.scanBudget - Scan budget configuration
 * @param {number} params.startTime - Scan start time
 * @param {Object} params.frontier - Page frontier (URL queue)
 * @param {Object|null} params.manifest - Manifest file data
 * @param {Object|null} params.expectationResults - Expectation results
 * @param {boolean} params.incrementalMode - Incremental mode flag
 * @param {Object|null} params.oldSnapshot - Old snapshot data
 * @param {Object|null} params.snapshotDiff - Snapshot diff
 * @param {string} params.currentUrl - Current page URL
 * @param {string} params.screenshotsDir - Screenshots directory
 * @param {number} params.timestamp - Current timestamp
 * @param {Object} params.decisionRecorder - DecisionRecorder instance
 * @param {Object} params.silenceTracker - SilenceTracker instance
 * @param {Array} params.traces - Interaction traces array
 * @param {Array} params.skippedInteractions - Skipped interactions array
 * @param {Array} params.observedExpectations - Observed expectations array
 * @param {number} params.totalInteractionsDiscovered - Total discovered interactions
 * @param {number} params.totalInteractionsExecuted - Total executed interactions
 * @param {Array} params.remainingInteractionsGaps - Remaining interaction gaps
 * @param {boolean} [params.allowWrites=false] - Allow file writes
 * @param {boolean} [params.allowRiskyActions=false] - Allow risky actions
 * @returns {Promise<Object>} { traces, skippedInteractions, observedExpectations, totalInteractionsDiscovered, totalInteractionsExecuted, remainingInteractionsGaps }
 */
export async function runTraversalLoop(params) {
  const {
    page,
    url: _url,
    baseOrigin,
    scanBudget,
    startTime,
    frontier,
    manifest,
    expectationResults,
    incrementalMode,
    oldSnapshot,
    snapshotDiff,
    currentUrl: _initialCurrentUrl,
    screenshotsDir,
    timestamp,
    decisionRecorder,
    silenceTracker,
    traces,
    skippedInteractions,
    observedExpectations,
    totalInteractionsDiscovered: initialTotalInteractionsDiscovered,
    totalInteractionsExecuted: initialTotalInteractionsExecuted,
    remainingInteractionsGaps,
    allowWrites = false,
    allowRiskyActions = false
  } = params;
  
  let totalInteractionsDiscovered = initialTotalInteractionsDiscovered;
  let totalInteractionsExecuted = initialTotalInteractionsExecuted;
  let nextPageUrl = frontier.getNextUrl();
  
  // PHASE 21.3: Create observe context once (updated per page)
  const baseContext = {
    page,
    baseOrigin,
    scanBudget,
    startTime,
    frontier,
    manifest,
    expectationResults,
    incrementalMode,
    oldSnapshot,
    snapshotDiff,
    screenshotsDir,
    timestamp,
    decisionRecorder,
    silenceTracker,
    safetyFlags: { allowWrites, allowRiskyActions },
    routeBudget: scanBudget // Updated per page
  };
  
  const runState = {
    traces,
    skippedInteractions,
    observedExpectations,
    totalInteractionsDiscovered,
    totalInteractionsExecuted,
    remainingInteractionsGaps,
    navigatedToNewPage: false,
    navigatedPageUrl: null
  };

  while (nextPageUrl && Date.now() - startTime < scanBudget.maxScanDurationMs) {
    const currentUrl = page.url();
    const context = createObserveContext({ ...baseContext, currentUrl, routeBudget: baseContext.routeBudget });
    
    // PHASE 21.3: Check page limit using budget-observer
    const pageLimitCheck = checkBudget(context, runState, { 
      remainingInteractions: 0,
      currentTotalExecuted: 0,
      limitType: 'pages' 
    });
    if (pageLimitCheck.exceeded) break;

    // Check if we're already on the target page (from navigation via link click)
    const alreadyOnPageFlag = isAlreadyOnPage({ page, frontier }, nextPageUrl);

    if (!alreadyOnPageFlag) {
      // Navigate to next page
      const navigated = await navigateToPage({ page, scanBudget, frontier, silenceTracker }, nextPageUrl);
      if (!navigated) {
        nextPageUrl = frontier.getNextUrl();
        continue;
      }
    }

    // Mark as visited and increment counter
    markPageVisited({ frontier }, nextPageUrl, alreadyOnPageFlag);

    // Discover ALL links on this page and add to frontier BEFORE executing interactions
    await discoverPageLinks({ page, baseOrigin, frontier, silenceTracker });

    // PHASE 21.3: Discover interactions using interaction-observer
    const discoveryResult = await discoverInteractions({
      page,
      baseOrigin,
      scanBudget,
      manifest,
      currentUrl
    });
    const { interactions: sortedInteractions, routeBudget } = discoveryResult;
    runState.totalInteractionsDiscovered = totalInteractionsDiscovered += discoveryResult.totalDiscovered;
    baseContext.routeBudget = routeBudget;
    context.routeBudget = routeBudget;

    // Execute discovered interactions on this page (sorted for determinism)
    let navigatedToNewPage = false;
    let navigatedPageUrl = null;
    let remainingInteractionsStartIndex = 0;
    let currentTotalInteractionsExecuted = totalInteractionsExecuted;

    for (let i = 0; i < sortedInteractions.length; i++) {
      // PHASE 21.3: Check budget limits using budget-observer
      const remaining = sortedInteractions.length - i;
      const budgetChecks = ['time', 'per_page', 'total'].map(limitType => 
        checkBudget(context, runState, { limitType, remainingInteractions: remaining, currentTotalExecuted: currentTotalInteractionsExecuted })
      );
      if (budgetChecks.find(check => check.exceeded)) {
        remainingInteractionsStartIndex = i;
        break;
      }

      const interaction = sortedInteractions[i];
      
      // PHASE 21.3: Check if interaction should be skipped
      const skipResult = await checkAndSkipInteraction(
        { page }, interaction, currentUrl, traces, skippedInteractions, silenceTracker,
        frontier, incrementalMode, manifest, oldSnapshot, snapshotDiff, allowWrites, allowRiskyActions
      );
      if (skipResult.skip) continue;

      // PHASE 21.3: Execute interaction
      const executionResult = await executeInteraction(
        { page, timestamp, screenshotsDir, routeBudget, silenceTracker },
        interaction, currentTotalInteractionsExecuted, page.url(),
        traces, observedExpectations, remainingInteractionsGaps, frontier, baseOrigin,
        incrementalMode, expectationResults, startTime, scanBudget
      );
      
      // Update counters and handle navigation
      if (executionResult.trace) currentTotalInteractionsExecuted++;
      if (executionResult.repeatTrace) currentTotalInteractionsExecuted++;
      runState.totalInteractionsExecuted = currentTotalInteractionsExecuted;
      
      if (executionResult.navigated) {
        navigatedToNewPage = true;
        navigatedPageUrl = executionResult.navigatedUrl;
        runState.navigatedToNewPage = true;
        runState.navigatedPageUrl = executionResult.navigatedUrl;
        break;
      }
    }

    // Mark remaining interactions as COVERAGE_GAP if we stopped early
    if (remainingInteractionsStartIndex > 0 && remainingInteractionsStartIndex < sortedInteractions.length && !navigatedToNewPage) {
      const reason = currentTotalInteractionsExecuted >= scanBudget.maxTotalInteractions ? 'budget_exceeded' : 
                    (currentTotalInteractionsExecuted >= routeBudget.maxInteractionsPerPage ? 'route_budget_exceeded' : 'budget_exceeded');
      for (let j = remainingInteractionsStartIndex; j < sortedInteractions.length; j++) {
        remainingInteractionsGaps.push({
          interaction: { type: sortedInteractions[j].type, selector: sortedInteractions[j].selector, label: sortedInteractions[j].label },
          reason, url: currentUrl
        });
      }
    }

    // If we navigated to a new page, stay on it and continue
    if (navigatedToNewPage && navigatedPageUrl) {
      nextPageUrl = navigatedPageUrl;
      continue;
    }
    nextPageUrl = frontier.getNextUrl();
  }

  return {
    traces: runState.traces,
    skippedInteractions: runState.skippedInteractions,
    observedExpectations: runState.observedExpectations,
    totalInteractionsDiscovered: runState.totalInteractionsDiscovered,
    totalInteractionsExecuted: runState.totalInteractionsExecuted,
    remainingInteractionsGaps: runState.remainingInteractionsGaps
  };
}

// PHASE 21.3: repeatObservedInteraction moved to interaction-observer.js

