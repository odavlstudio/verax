/**
 * EXPECTATION-DRIVEN EXECUTION ENGINE
 * 
 * Executes every PROVEN expectation from the manifest.
 * Each expectation must result in: VERIFIED, SILENT_FAILURE, or COVERAGE_GAP.
 * @typedef {import('playwright').Page} Page
 */

import { isProvenExpectation } from '../shared/expectation-prover.js';
import { getUrlPath } from '../detect/evidence-validator.js';
import { hasMeaningfulUrlChange, hasVisibleChange, hasDomChange } from '../detect/comparison.js';
import { runInteraction } from './interaction-runner.js';
import { captureScreenshot } from './evidence-capture.js';
import { getBaseOrigin } from './domain-boundary.js';
import { resolve } from 'path';

/**
 * Execute a single PROVEN expectation.
 * @param {Page} page - Playwright page
 * @param {Object} expectation - PROVEN expectation from manifest
 * @param {string} baseUrl - Base URL of the site
 * @param {string} screenshotsDir - Directory for screenshots
 * @param {number} timestamp - Timestamp for file naming
 * @param {number} expectationIndex - Index of expectation in list
 * @param {Object} scanBudget - Scan budget
 * @param {number} startTime - Scan start time
 * @param {string} projectDir - Project directory for path resolution
 * @returns {Promise<Object>} Execution result: { outcome, reason?, evidence?, trace? }
 */
async function executeExpectation(page, expectation, baseUrl, screenshotsDir, timestamp, expectationIndex, scanBudget, startTime, projectDir) {
  const baseOrigin = getBaseOrigin(baseUrl);
  const result = {
    expectationId: expectation.id || `exp-${expectationIndex}`,
    fromPath: expectation.fromPath,
    type: expectation.type,
    outcome: null,
    reason: null,
    evidence: {},
    trace: null
  };

  // NOTE: Budget check is done at the loop level (executeProvenExpectations)
  // Once execution starts here, we must complete with a real outcome:
  // VERIFIED, SILENT_FAILURE, or COVERAGE_GAP (with real reason like element_not_found, etc.)
  // Never return budget_exceeded from inside executeExpectation.

  try {
    // Step 1: Navigate to fromPath
    let fromUrl;
    try {
      // Handle both absolute and relative paths
      if (expectation.fromPath.startsWith('http://') || expectation.fromPath.startsWith('https://')) {
        fromUrl = expectation.fromPath;
      } else {
        fromUrl = new URL(expectation.fromPath, baseUrl).href;
      }
    } catch (error) {
      result.outcome = 'COVERAGE_GAP';
      result.reason = 'invalid_from_path';
      result.evidence = {
        error: error.message,
        fromPath: expectation.fromPath
      };
      return result;
    }
    
    let navigationSuccess = false;
    
    try {
      await page.goto(fromUrl, { waitUntil: 'networkidle', timeout: scanBudget.initialNavigationTimeoutMs });
      await page.waitForTimeout(scanBudget.navigationStableWaitMs);
      const currentPath = getUrlPath(page.url());
      const normalizedFrom = expectation.fromPath.replace(/\/$/, '') || '/';
      const normalizedCurrent = currentPath ? currentPath.replace(/\/$/, '') || '/' : '';
      
      // Allow for SPA routing - if we're on a different path but same origin, continue
      // Also allow if we're on the same origin (SPA may not change pathname)
      // For file:// URLs, just check if we're on the same origin
      if (normalizedCurrent === normalizedFrom || page.url().startsWith(baseOrigin)) {
        navigationSuccess = true;
      } else if (baseUrl.startsWith('file://') && page.url().startsWith('file://')) {
        // For file:// URLs, navigation is considered successful if we're on file://
        navigationSuccess = true;
      }
    } catch (error) {
      result.outcome = 'COVERAGE_GAP';
      result.reason = 'page_unreachable';
      result.evidence = {
        error: error.message,
        attemptedUrl: fromUrl
      };
      return result;
    }

    if (!navigationSuccess) {
      result.outcome = 'COVERAGE_GAP';
      result.reason = 'page_unreachable';
      result.evidence = {
        attemptedUrl: fromUrl,
        actualUrl: page.url()
      };
      return result;
    }

    // Step 2: Find target element
    const selectorHint = expectation.evidence?.selectorHint || expectation.selectorHint || '';
    const targetPath = expectation.targetPath || expectation.expectedTarget || '';
    const interactionType = determineInteractionType(expectation.type);
    
    let element = null;
    let interaction = null;

    if (selectorHint) {
      // Try to find element by selector
      try {
        // Try exact selector first
        let locator = page.locator(selectorHint).first();
        let count = await locator.count();
        
        if (count === 0) {
          // Try without the tag prefix (e.g., if selectorHint is "a#id", try "#id")
          const idMatch = selectorHint.match(/#[\w-]+$/);
          if (idMatch) {
            const idSelector = idMatch[0];
            locator = page.locator(idSelector).first();
            count = await locator.count();
            if (count > 0) {
              element = locator;
              interaction = {
                type: interactionType,
                selector: idSelector,
                label: await extractLabel(page, idSelector).catch(() => ''),
                element: locator
              };
            }
          }
        } else {
          element = locator;
          interaction = {
            type: interactionType,
            selector: selectorHint,
            label: await extractLabel(page, selectorHint).catch(() => ''),
            element: locator
          };
        }
      } catch (error) {
        // Selector invalid or element not found
      }
    }

    // Fallback: Try to find by href/action/targetPath
    if (!element && targetPath) {
      if (expectation.type === 'navigation' || expectation.type === 'spa_navigation') {
        // Try to find link with matching href
        try {
          // Normalize targetPath for matching (remove leading slash if present, add .html if needed)
          const normalizedTarget = targetPath.replace(/^\//, '');
          const hrefSelectors = [
            `a[href="${targetPath}"]`,
            `a[href="/${normalizedTarget}"]`,
            `a[href="${targetPath}/"]`,
            `a[href*="${normalizedTarget}"]`,
            `a[href*="${targetPath}"]`
          ];
          
          for (const selector of hrefSelectors) {
            const locator = page.locator(selector).first();
            const count = await locator.count();
            if (count > 0) {
              element = locator;
              interaction = {
                type: 'link',
                selector: selector,
                label: await extractLabel(page, selector).catch(() => ''),
                element: locator
              };
              break;
            }
          }
        } catch (error) {
          // Fallback failed
        }
      } else if (expectation.type === 'form_submission') {
        // Try to find form with matching action
        try {
          const actionSelectors = [
            `form[action="${targetPath}"]`,
            `form[action="${targetPath}/"]`,
            `form[action*="${targetPath}"]`
          ];
          
          for (const selector of actionSelectors) {
            const submitButton = page.locator(`${selector} button[type="submit"], ${selector} input[type="submit"]`).first();
            const count = await submitButton.count();
            if (count > 0) {
              element = submitButton;
              interaction = {
                type: 'form',
                selector: selector,
                label: await extractLabel(page, selector).catch(() => ''),
                element: submitButton
              };
              break;
            }
          }
        } catch (error) {
          // Fallback failed
        }
      }
    }

    // If element still not found, this is a coverage gap
    if (!element || !interaction) {
      result.outcome = 'COVERAGE_GAP';
      result.reason = 'element_not_found';
      result.evidence = {
        selectorHint: selectorHint,
        targetPath: targetPath,
        fromPath: expectation.fromPath,
        currentUrl: page.url()
      };
      return result;
    }

    // Step 3: Execute interaction
    const beforeUrl = page.url();
    const beforeScreenshot = resolve(screenshotsDir, `exp-${expectationIndex}-before.png`);
    await captureScreenshot(page, beforeScreenshot);
    
    const trace = await runInteraction(
      page,
      interaction,
      timestamp,
      expectationIndex,
      screenshotsDir,
      baseOrigin,
      startTime,
      scanBudget,
      null // No flow context for expectation-driven execution
    );

    result.trace = trace;
    // Update trace with expectation metadata
    if (trace) {
      trace.expectationDriven = true;
      trace.expectationId = result.expectationId;
      trace.expectationOutcome = result.outcome;
      // Ensure before screenshot path is set correctly
      if (!trace.before.screenshot) {
        trace.before.screenshot = `screenshots/exp-${expectationIndex}-before.png`;
      }
    }
    result.evidence = {
      before: trace.before?.screenshot || `exp-${expectationIndex}-before.png`,
      after: trace.after?.screenshot || null,
      beforeUrl: beforeUrl,
      afterUrl: trace.after?.url || page.url()
    };

    // Step 4: Evaluate outcome
    const outcome = evaluateExpectationOutcome(expectation, trace, beforeUrl, projectDir);
    result.outcome = outcome.outcome;
    result.reason = outcome.reason;
    
    if (outcome.evidence) {
      result.evidence = { ...result.evidence, ...outcome.evidence };
    }

    return result;
  } catch (error) {
    result.outcome = 'COVERAGE_GAP';
    result.reason = 'execution_error';
    result.evidence = {
      error: error.message,
      errorStack: error.stack
    };
    return result;
  }
}

/**
 * Determine interaction type from expectation type.
 */
function determineInteractionType(expectationType) {
  if (expectationType === 'navigation' || expectationType === 'spa_navigation') {
    return 'link';
  }
  if (expectationType === 'form_submission' || expectationType === 'validation_block') {
    return 'form';
  }
  if (expectationType === 'network_action' || expectationType === 'state_action') {
    return 'button';
  }
  return 'button'; // Default
}

/**
 * Extract label from element.
 */
async function extractLabel(page, selector) {
  try {
    const locator = page.locator(selector).first();
    const text = await locator.textContent();
    if (text) return text.trim().substring(0, 100);
    
    const ariaLabel = await locator.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel.trim().substring(0, 100);
    
    return '';
  } catch (error) {
    return '';
  }
}

/**
 * Evaluate if expectation was VERIFIED or SILENT_FAILURE.
 */
function evaluateExpectationOutcome(expectation, trace, beforeUrl, projectDir) {
  const afterUrl = trace.after?.url || '';
  const sensors = trace.sensors || {};
  
  if (expectation.type === 'navigation' || expectation.type === 'spa_navigation') {
    const targetPath = expectation.targetPath || expectation.expectedTarget || '';
    const afterPath = getUrlPath(afterUrl);
    const normalizedTarget = targetPath.replace(/\/$/, '') || '/';
    const normalizedAfter = afterPath ? afterPath.replace(/\/$/, '') || '/' : '';
    
    if (normalizedAfter === normalizedTarget) {
      return { outcome: 'VERIFIED', reason: null };
    }
    
    // Check for UI feedback or DOM changes
    const hasVisibleChangeResult = trace.before?.screenshot && trace.after?.screenshot ?
      hasVisibleChange(trace.before.screenshot, trace.after.screenshot, projectDir) : false;
    const hasDomChangeResult = hasDomChange(trace);
    const hasUIFeedback = sensors.uiSignals?.diff?.changed === true;
    
    if (hasVisibleChangeResult || hasDomChangeResult || hasUIFeedback) {
      // Partial success - navigation didn't reach target but something changed
      return { outcome: 'SILENT_FAILURE', reason: 'target_not_reached' };
    }
    
    return { outcome: 'SILENT_FAILURE', reason: 'no_effect' };
  }
  
  if (expectation.type === 'network_action') {
    const networkData = sensors.network || {};
    const hasRequest = networkData.totalRequests > 0;
    const hasFailed = networkData.failedRequests > 0;
    const hasUIFeedback = sensors.uiSignals?.diff?.changed === true;
    
    if (!hasRequest) {
      return { outcome: 'SILENT_FAILURE', reason: 'network_request_missing' };
    }
    
    if (hasFailed && !hasUIFeedback) {
      return { outcome: 'SILENT_FAILURE', reason: 'network_failure_silent' };
    }
    
    if (hasRequest && !hasFailed) {
      return { outcome: 'VERIFIED', reason: null };
    }
    
    return { outcome: 'SILENT_FAILURE', reason: 'network_error' };
  }
  
  if (expectation.type === 'validation_block') {
    const networkData = sensors.network || {};
    const uiSignals = sensors.uiSignals || {};
    const validationFeedback = uiSignals.after?.validationFeedbackDetected === true;
    const urlChanged = getUrlPath(beforeUrl) !== getUrlPath(afterUrl);
    const hasNetworkRequest = networkData.totalRequests > 0;
    
    // Validation block should prevent submission
    if (!urlChanged && !hasNetworkRequest) {
      // Submission was blocked - check for feedback
      if (validationFeedback) {
        return { outcome: 'VERIFIED', reason: null };
      } else {
        return { outcome: 'SILENT_FAILURE', reason: 'validation_feedback_missing' };
      }
    }
    
    // If submission occurred, validation didn't block (might be a different issue)
    return { outcome: 'SILENT_FAILURE', reason: 'validation_did_not_block' };
  }
  
  if (expectation.type === 'state_action') {
    const stateDiff = sensors.state || {};
    const expectedKey = expectation.expectedTarget;
    const stateChanged = stateDiff.available && stateDiff.changed.length > 0;
    const expectedKeyChanged = stateChanged && stateDiff.changed.includes(expectedKey);
    const hasUIFeedback = sensors.uiSignals?.diff?.changed === true;
    
    if (expectedKeyChanged && hasUIFeedback) {
      return { outcome: 'VERIFIED', reason: null };
    }
    
    if (!stateChanged || !expectedKeyChanged) {
      return { outcome: 'SILENT_FAILURE', reason: 'state_not_updated' };
    }
    
    if (expectedKeyChanged && !hasUIFeedback) {
      return { outcome: 'SILENT_FAILURE', reason: 'state_updated_no_ui_feedback' };
    }
    
    return { outcome: 'SILENT_FAILURE', reason: 'state_update_failed' };
  }
  
  // Default: check for any visible effect
  const hasUIFeedback = sensors.uiSignals?.diff?.changed === true;
  const hasDomChangeResult = hasDomChange(trace);
  const urlChanged = hasMeaningfulUrlChange(beforeUrl, afterUrl);
  const hasVisibleChangeResult = trace.before?.screenshot && trace.after?.screenshot ?
    hasVisibleChange(trace.before.screenshot, trace.after.screenshot, projectDir) : false;
  
  if (hasUIFeedback || hasDomChangeResult || urlChanged || hasVisibleChangeResult) {
    return { outcome: 'VERIFIED', reason: null };
  }
  
  return { outcome: 'SILENT_FAILURE', reason: 'no_effect' };
}

/**
 * Execute all PROVEN expectations from manifest.
 * @param {Page} page - Playwright page
 * @param {Object} manifest - Manifest with staticExpectations
 * @param {string} baseUrl - Base URL
 * @param {string} screenshotsDir - Screenshots directory
 * @param {Object} scanBudget - Scan budget
 * @param {number} startTime - Scan start time
 * @param {string} projectDir - Project directory
 * @returns {Promise<Object>} { results: [], executedCount, coverageGaps: [] }
 */
export async function executeProvenExpectations(page, manifest, baseUrl, screenshotsDir, scanBudget, startTime, projectDir) {
  const provenExpectations = (manifest.staticExpectations || []).filter(exp => isProvenExpectation(exp));
  const results = [];
  const coverageGaps = [];
  
  const timestamp = Date.now();
  
  for (let i = 0; i < provenExpectations.length; i++) {
    const expectation = provenExpectations[i];
    
    // Check budget before each expectation
    if (Date.now() - startTime > scanBudget.maxScanDurationMs) {
      // Mark remaining expectations as coverage gaps
      for (let j = i; j < provenExpectations.length; j++) {
        coverageGaps.push({
          expectationId: provenExpectations[j].id || `exp-${j}`,
          type: provenExpectations[j].type,
          reason: 'budget_exceeded',
          fromPath: provenExpectations[j].fromPath,
          source: provenExpectations[j].sourceRef || provenExpectations[j].evidence?.source || null
        });
      }
      break;
    }
    
    const result = await executeExpectation(
      page,
      expectation,
      baseUrl,
      screenshotsDir,
      timestamp,
      i,
      scanBudget,
      startTime,
      projectDir
    );
    
    results.push(result);
    
    // If outcome is COVERAGE_GAP, add to coverageGaps array
    // NOTE: budget_exceeded is NEVER in results - only unattempted expectations get budget_exceeded
    // All results here are executed expectations with real outcomes
    if (result.outcome === 'COVERAGE_GAP') {
      coverageGaps.push({
        expectationId: result.expectationId,
        type: result.type,
        reason: result.reason,
        fromPath: result.fromPath,
        source: expectation.sourceRef || expectation.evidence?.source || null,
        evidence: result.evidence
      });
    }
  }
  
  // FINAL ASSERTION: Every PROVEN expectation must have been accounted for
  // Results array contains ALL expectations that were attempted (with real outcomes: VERIFIED/SILENT_FAILURE/COVERAGE_GAP)
  // Coverage gaps array contains:
  //   - COVERAGE_GAP outcomes from executed expectations (element_not_found, page_unreachable, etc.)
  //   - budget_exceeded outcomes from unattempted expectations (only from loop break)
  // Budget-exceeded expectations are NEVER in results - they are only in coverageGaps and were never attempted
  const budgetExceededCount = coverageGaps.filter(cg => cg.reason === 'budget_exceeded').length;
  const totalAccounted = results.length + budgetExceededCount;
  
  if (totalAccounted !== provenExpectations.length) {
    throw new Error(
      `CORRECTNESS VIOLATION: Expected ${provenExpectations.length} PROVEN expectations to be accounted for, ` +
      `but got ${results.length} executed + ${budgetExceededCount} budget-exceeded (not attempted) = ${totalAccounted} total. ` +
      `Missing ${provenExpectations.length - totalAccounted} expectations.`
    );
  }
  
  return {
    results,
    executedCount: results.length,
    coverageGaps,
    totalProvenExpectations: provenExpectations.length
  };
}

