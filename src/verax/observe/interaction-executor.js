/**
 * INTERACTION EXECUTION ENGINE
 * 
 * Handles execution of interactions on pages, evidence capture, and tracing.
 */

import { getTimeProvider } from '../../cli/util/support/time-provider.js';
import { runInteraction } from './interaction-runner.js';
import { deriveObservedExpectation, shouldAttemptRepeatObservedExpectation, evaluateObservedExpectation } from './observed-expectation.js';
import { isExternalUrl } from './domain-boundary.js';

/**
 * Execute a single interaction and capture results
 * 
 * @param {Object} page - Playwright page
 * @param {Object} interaction - Interaction to execute
 * @param {number} timestamp - Execution timestamp
 * @param {number} interactionIndex - Index in execution sequence
 * @param {string} screenshotsDir - Directory for screenshots
 * @param {string} baseOrigin - Base origin for URL checking
 * @param {number} startTime - Scan start time
 * @param {Object} routeBudget - Route-specific budget
 * @param {Object} expectationResults - Results from proven expectations
 * @param {Object} silenceTracker - Silence tracker
 * @returns {Promise<{trace: Object, totalExecuted: number, navigatedToNewPage: boolean, newPageUrl: string|null}>}
 */
export async function executeInteraction(
  page,
  interaction,
  timestamp,
  interactionIndex,
  screenshotsDir,
  baseOrigin,
  startTime,
  routeBudget,
  expectationResults,
  silenceTracker
) {
  const beforeUrl = page.url();

  const trace = await runInteraction(
    page,
    interaction,
    timestamp,
    interactionIndex,
    screenshotsDir,
    baseOrigin,
    startTime,
    routeBudget,
    null,
    silenceTracker
  );

  let totalExecuted = 1;

  if (trace) {
    // Check if this matched a proven expectation
    const matchingExpectation = expectationResults?.results?.find(
      r => r.trace?.interaction?.selector === trace.interaction.selector
    );
    
    if (matchingExpectation) {
      trace.expectationDriven = true;
      trace.expectationId = matchingExpectation.expectationId;
      trace.expectationOutcome = matchingExpectation.outcome;
    } else {
      // Derive observed expectation from trace
      const observedExpectation = deriveObservedExpectation(interaction, trace, baseOrigin);
      if (observedExpectation) {
        trace.observedExpectation = observedExpectation;
        trace.resultType = 'OBSERVED_EXPECTATION';

        // Attempt repeat if eligible and budget allows
        const timeProvider = getTimeProvider();
        const repeatEligible = shouldAttemptRepeatObservedExpectation(observedExpectation, trace);
        const budgetAllowsRepeat = repeatEligible &&
          (timeProvider.now() - startTime) < routeBudget.maxScanDurationMs;

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
            routeBudget
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

            totalExecuted = 2;
          }
        }
      } else {
        trace.unprovenResult = true;
        trace.resultType = 'UNPROVEN_RESULT';
      }
    }
  }

  // Check for same-origin navigation
  let navigatedToNewPage = false;
  let newPageUrl = null;

  if (trace) {
    const afterUrl = trace.after?.url || page.url();
    const navigatedSameOrigin = afterUrl && afterUrl !== beforeUrl && !isExternalUrl(afterUrl, baseOrigin);
    if (navigatedSameOrigin && interaction.type === 'link') {
      navigatedToNewPage = true;
      newPageUrl = afterUrl;
    }
  }

  return {
    trace,
    totalExecuted,
    navigatedToNewPage,
    newPageUrl
  };
}

/**
 * Repeat an observed interaction to verify consistency
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
    null // No silence tracker for repeat executions
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



