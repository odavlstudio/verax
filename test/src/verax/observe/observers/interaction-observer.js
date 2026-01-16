/**
 * PHASE 21.3 — Interaction Observer
 * 
 * Extracted interaction-related logic from observe-runner.js
 * Handles interaction discovery, execution, and processing
 * 
 * NO file I/O - all artifacts written by caller
 * NO loop control - caller controls iteration
 */

import { discoverAllInteractions } from '../interaction-discovery.js';
import { runInteraction } from '../interaction-runner.js';
import { isExternalUrl } from '../domain-boundary.js';
import { computeRouteBudget } from '../../core/budget-engine.js';
import { shouldSkipInteractionIncremental } from '../../core/incremental-store.js';
import { deriveObservedExpectation, shouldAttemptRepeatObservedExpectation, evaluateObservedExpectation } from '../observed-expectation.js';
import { discoverPageLinks } from './navigation-observer.js';

/**
 * Discover interactions on current page
 * 
 * @param {Object} context
 * @param {import('playwright').Page} context.page
 * @param {string} context.baseOrigin
 * @param {Object} context.scanBudget
 * @param {Object|null} context.manifest
 * @param {string} context.currentUrl
 * @returns {Promise<Object>} { interactions, routeBudget, totalDiscovered }
 */
export async function discoverInteractions(context) {
  const { page, baseOrigin, scanBudget, manifest, currentUrl } = context;
  
  // SCALE INTELLIGENCE: Compute adaptive budget for this route
  const routeBudget = manifest ? computeRouteBudget(manifest, currentUrl, scanBudget) : scanBudget;
  
  // Discover ALL interactions on this page
  // Note: discoverAllInteractions already returns sorted interactions deterministically
  const { interactions } = await discoverAllInteractions(page, baseOrigin, routeBudget);
  
  // SCALE INTELLIGENCE: Apply adaptive budget cap (interactions are already sorted deterministically)
  // Stable sorting ensures determinism: same interactions → same order
  const sortedInteractions = interactions.slice(0, routeBudget.maxInteractionsPerPage);
  
  return {
    interactions: sortedInteractions,
    routeBudget,
    totalDiscovered: interactions.length
  };
}

/**
 * Check if interaction should be skipped and handle skip logic
 * 
 * @param {Object} context
 * @param {Object} interaction
 * @param {string} currentUrl
 * @param {Array} traces - Mutable array to push skipped traces
 * @param {Array} skippedInteractions - Mutable array to push skipped interactions
 * @param {Object} silenceTracker - Silence tracker instance
 * @param {Object} frontier - Page frontier instance
 * @param {boolean} incrementalMode
 * @param {Object|null} manifest
 * @param {Object|null} oldSnapshot
 * @param {Object|null} snapshotDiff
 * @param {boolean} allowWrites
 * @param {boolean} allowRiskyActions
 * @returns {Promise<Object>} { skip: boolean, reason?: string, trace?: Object }
 */
export async function checkAndSkipInteraction(
  context,
  interaction,
  currentUrl,
  traces,
  skippedInteractions,
  silenceTracker,
  frontier,
  incrementalMode,
  manifest,
  oldSnapshot,
  snapshotDiff,
  allowWrites,
  allowRiskyActions
) {
  // SCALE INTELLIGENCE: Check if interaction should be skipped in incremental mode
  if (incrementalMode && manifest && oldSnapshot && snapshotDiff) {
    const shouldSkip = shouldSkipInteractionIncremental(interaction, currentUrl, oldSnapshot, snapshotDiff);
    if (shouldSkip) {
      // Create a trace for skipped interaction (marked as incremental - will not produce findings)
      const skippedTrace = {
        interaction: {
          type: interaction.type,
          selector: interaction.selector,
          label: interaction.label
        },
        before: { url: currentUrl },
        after: { url: currentUrl },
        incremental: true, // Mark as skipped in incremental mode - detect phase will skip this
        resultType: 'INCREMENTAL_SKIP'
      };
      traces.push(skippedTrace);
      
      // Track incremental skip as silence
      silenceTracker.record({
        scope: 'interaction',
        reason: 'incremental_unchanged',
        description: `Skipped re-observation (unchanged in incremental mode): ${interaction.label}`,
        context: {
          currentPage: currentUrl,
          selector: interaction.selector,
          interactionLabel: interaction.label,
          type: interaction.type
        },
        impact: 'affects_expectations'
      });
      
      skippedInteractions.push({
        interaction: {
          type: interaction.type,
          selector: interaction.selector,
          label: interaction.label,
          text: interaction.text
        },
        outcome: 'SKIPPED',
        reason: 'incremental_unchanged',
        url: currentUrl,
        evidence: {
          selector: interaction.selector,
          label: interaction.label,
          incremental: true
        }
      });
      return { skip: true, reason: 'incremental_unchanged' };
    }
  }

  // Skip dangerous interactions (logout, delete, etc.) with explicit reason
  const skipCheck = frontier.shouldSkipInteraction(interaction);
  if (skipCheck.skip) {
    // Track safety skip as silence
    silenceTracker.record({
      scope: 'interaction',
      reason: skipCheck.reason === 'destructive' ? 'destructive_text' : 'unsafe_pattern',
      description: `Skipped potentially dangerous interaction: ${interaction.label}`,
      context: {
        currentPage: context.page.url(),
        selector: interaction.selector,
        interactionLabel: interaction.label,
        text: interaction.text,
        skipReason: skipCheck.reason,
        skipMessage: skipCheck.message
      },
      impact: 'unknown_behavior'
    });
    
    skippedInteractions.push({
      interaction: {
        type: interaction.type,
        selector: interaction.selector,
        label: interaction.label,
        text: interaction.text
      },
      outcome: 'SKIPPED',
      reason: skipCheck.reason || 'safety_policy',
      url: context.page.url(),
      evidence: {
        selector: interaction.selector,
        label: interaction.label,
        text: interaction.text,
        sourcePage: context.page.url()
      }
    });
    return { skip: true, reason: skipCheck.reason || 'safety_policy' };
  }

  // Phase 4: Check action classification and safety mode
  const { shouldBlockAction } = await import('../../core/action-classifier.js');
  const blockCheck = shouldBlockAction(interaction, { allowWrites, allowRiskyActions });
  
  if (blockCheck.shouldBlock) {
    // Track blocked action as silence
    silenceTracker.record({
      scope: 'safety',
      reason: 'blocked_action',
      description: `Action blocked by safety mode: ${interaction.label} (${blockCheck.classification})`,
      context: {
        currentPage: context.page.url(),
        selector: interaction.selector,
        interactionLabel: interaction.label,
        text: interaction.text,
        classification: blockCheck.classification,
        blockReason: blockCheck.reason
      },
      impact: 'action_blocked'
    });
    
    skippedInteractions.push({
      interaction: {
        type: interaction.type,
        selector: interaction.selector,
        label: interaction.label,
        text: interaction.text
      },
      outcome: 'BLOCKED',
      reason: 'safety_mode',
      classification: blockCheck.classification,
      url: context.page.url(),
      evidence: {
        selector: interaction.selector,
        label: interaction.label,
        text: interaction.text,
        classification: blockCheck.classification,
        sourcePage: context.page.url()
      }
    });
    
    // Create a minimal trace for blocked interactions so they appear in output
    const blockedTrace = {
      interaction: {
        type: interaction.type,
        selector: interaction.selector,
        label: interaction.label,
        text: interaction.text
      },
      before: {
        url: context.page.url(),
        screenshot: null
      },
      after: {
        url: context.page.url(),
        screenshot: null
      },
      policy: {
        actionBlocked: true,
        classification: blockCheck.classification,
        reason: blockCheck.reason
      },
      outcome: 'BLOCKED_BY_SAFETY_MODE',
      timestamp: Date.now()
    };
    traces.push(blockedTrace);
    
    return { skip: true, reason: 'safety_mode', trace: blockedTrace };
  }

  return { skip: false };
}

/**
 * Execute interaction and process results
 * 
 * @param {Object} context
 * @param {Object} interaction
 * @param {number} interactionIndex
 * @param {string} beforeUrl
 * @param {Array} traces - Mutable array to push traces
 * @param {Array} observedExpectations - Mutable array to push observed expectations
 * @param {Array} remainingInteractionsGaps - Mutable array to push gaps
 * @param {Object} frontier - Page frontier instance
 * @param {string} baseOrigin
 * @param {boolean} incrementalMode
 * @param {Object|null} expectationResults
 * @param {number} startTime
 * @param {Object} scanBudget
 * @returns {Promise<Object>} { trace, repeatTrace, navigated, navigatedUrl, frontierCapped }
 */
export async function executeInteraction(
  context,
  interaction,
  interactionIndex,
  beforeUrl,
  traces,
  observedExpectations,
  remainingInteractionsGaps,
  frontier,
  baseOrigin,
  incrementalMode,
  expectationResults,
  startTime,
  scanBudget
) {
  const {
    page,
    timestamp,
    screenshotsDir,
    routeBudget,
    silenceTracker
  } = context;

  const trace = await runInteraction(
    page,
    interaction,
    timestamp,
    interactionIndex,
    screenshotsDir,
    baseOrigin,
    startTime,
    routeBudget, // Use route-specific budget
    null,
    silenceTracker // Pass silence tracker
  );
  
  // Mark trace with incremental flag if applicable
  if (incrementalMode && trace) {
    trace.incremental = false; // This interaction was executed, not skipped
  }

  let repeatTrace = null;

  if (trace) {
    const matchingExpectation = expectationResults?.results?.find(r => r.trace?.interaction?.selector === trace.interaction.selector);
    if (matchingExpectation) {
      trace.expectationDriven = true;
      trace.expectationId = matchingExpectation.expectationId;
      trace.expectationOutcome = matchingExpectation.outcome;
    } else {
      const observedExpectation = deriveObservedExpectation(interaction, trace, baseOrigin);
      if (observedExpectation) {
        trace.observedExpectation = observedExpectation;
        trace.resultType = 'OBSERVED_EXPECTATION';
        observedExpectations.push(observedExpectation);

        const repeatEligible = shouldAttemptRepeatObservedExpectation(observedExpectation, trace);
        const budgetAllowsRepeat = repeatEligible &&
          (Date.now() - startTime) < scanBudget.maxScanDurationMs &&
          (interactionIndex + 1) < scanBudget.maxTotalInteractions;

        if (budgetAllowsRepeat) {
          const repeatIndex = interactionIndex + 1;
          const repeatResult = await repeatObservedInteraction(
            page,
            interaction,
            observedExpectation,
            timestamp,
            repeatIndex,
            screenshotsDir,
            baseOrigin,
            startTime,
            scanBudget
          );

          if (repeatResult) {
            const repeatEvaluation = repeatResult.repeatEvaluation;
            trace.observedExpectation.repeatAttempted = true;
            trace.observedExpectation.repeated = repeatEvaluation.outcome === 'VERIFIED';
            trace.observedExpectation.repeatOutcome = repeatEvaluation.outcome;
            trace.observedExpectation.repeatReason = repeatEvaluation.reason;

            if (repeatEvaluation.outcome === 'OBSERVED_BREAK') {
              trace.observedExpectation.outcome = 'OBSERVED_BREAK';
              trace.observedExpectation.reason = 'inconsistent_on_repeat';
              trace.observedExpectation.confidenceLevel = 'LOW';
            } else if (trace.observedExpectation.repeated && trace.observedExpectation.outcome === 'VERIFIED') {
              trace.observedExpectation.confidenceLevel = 'MEDIUM';
            }

            repeatTrace = repeatResult.repeatTrace;
          }
        }
      } else {
        trace.unprovenResult = true;
        trace.resultType = 'UNPROVEN_RESULT';
      }
    }

    traces.push(trace);

    if (repeatTrace) {
      traces.push(repeatTrace);
    }

    const afterUrl = trace.after?.url || page.url();
    const navigatedSameOrigin = afterUrl && afterUrl !== beforeUrl && !isExternalUrl(afterUrl, baseOrigin);
    if (navigatedSameOrigin && interaction.type === 'link') {
      // Link navigation - add new page to frontier (if not already visited)
      const normalizedAfter = frontier.normalizeUrl(afterUrl);
      const wasAlreadyVisited = frontier.visited.has(normalizedAfter);
      let frontierCapped = false;
      
      if (!wasAlreadyVisited) {
        const added = frontier.addUrl(afterUrl);
        // If frontier was capped, record coverage gap
        if (!added && frontier.frontierCapped) {
          remainingInteractionsGaps.push({
            interaction: {
              type: 'link',
              selector: interaction.selector,
              label: interaction.label
            },
            reason: 'frontier_capped',
            url: afterUrl
          });
          frontierCapped = true;
        }
      }
      
      // Discover links on the new page immediately
      await discoverPageLinks({ page, baseOrigin: baseOrigin, frontier, silenceTracker });
      
      return {
        trace,
        repeatTrace,
        navigated: true,
        navigatedUrl: afterUrl,
        frontierCapped
      };
    }
  }

  return {
    trace,
    repeatTrace,
    navigated: false
  };
}

/**
 * Repeat observed interaction (helper function)
 */
async function repeatObservedInteraction(
  page,
  interaction,
  observedExpectation,
  timestamp,
  interactionIndex,
  screenshotsDir,
  baseOrigin,
  startTime,
  scanBudget
) {
  const selector = observedExpectation.evidence?.selector || interaction.selector;
  if (!selector) return null;

  const locator = page.locator(selector).first();
  const count = await locator.count();
  if (count === 0) {
    return null;
  }

  const repeatInteraction = {
    ...interaction,
    element: locator
  };

  const repeatTrace = await runInteraction(
    page,
    repeatInteraction,
    timestamp,
    interactionIndex,
    screenshotsDir,
    baseOrigin,
    startTime,
    scanBudget,
    null,
    null // No silence tracker for repeat executions (not counted as new silence)
  );

  if (!repeatTrace) {
    return null;
  }

  repeatTrace.repeatExecution = true;
  repeatTrace.repeatOfObservedExpectationId = observedExpectation.id;
  repeatTrace.resultType = 'OBSERVED_EXPECTATION_REPEAT';

  const repeatEvaluation = evaluateObservedExpectation(observedExpectation, repeatTrace);

  return {
    repeatTrace,
    repeatEvaluation
  };
}
