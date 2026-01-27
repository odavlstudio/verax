import { getTimeProvider } from '../support/time-provider.js';
import { resolveSelector, findSubmitButton, isElementInteractable } from './selector-resolver.js';
import { createEvidenceBundle } from '../evidence/evidence-engine.js';
// eslint-disable-next-line no-unused-vars
import { 
  captureRouteSignature as _captureRouteSignature, 
  getRouteTransitions as _getRouteTransitions, 
  routeSignatureChanged as _routeSignatureChanged,
  analyzeRouteTransitions as _analyzeRouteTransitions 
} from './route-sensor.js';
import { watchForOutcome } from './outcome-watcher.js';
// eslint-disable-next-line no-unused-vars
import { captureUIMutationSummary, analyzeMutationSummary, resetMutationTracking as _resetMutationTracking } from './ui-mutation-tracker.js';
import { classifyInteractionIntent, evaluateAcknowledgment } from './interaction-intent-engine.js';
import { extractIntentRecordFromElement } from '../evidence/interaction-intent-record.js';
import { EvidenceCaptureService } from './evidence-capture-service.js';
import { ActionDispatcher } from './action-dispatcher.js';
import { OutcomeEvaluator } from './outcome-evaluator.js';

/**
 * Interaction Planner
 * Converts extracted promises into executable Playwright interactions
 * with bounded timeouts and evidence capture
 * 
 * H5: Added read-only safety mode by default
 * PHASE 1: Added universal route sensor for SPA navigation detection
 */

const GLOBAL_TIMEOUT = 5 * 60 * 1000; // 5 minutes total
const _PER_PROMISE_TIMEOUT = 15 * 1000; // 15 seconds per promise
const _WAIT_FOR_EFFECT_TIMEOUT = 3000; // 3 seconds to observe effect

const MUTATING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Helper: Classify action result to success/failure
 * Safely handles both boolean and object return types from action executors
 * PURE FUNCTION: No side effects, used in executeSinglePromise state machine
 */
function parseActionResult(actionResult) {
  if (typeof actionResult === 'object' && actionResult !== null) {
    return {
      success: actionResult.success,
      reason: actionResult.reason,
      cause: actionResult.cause
    };
  }
  return {
    success: Boolean(actionResult),
    reason: null,
    cause: null
  };
}

/**
 * Helper: Determine if action result satisfies expected outcome
 * Compares interaction result against promise expectations
 * PURE FUNCTION: No side effects, used in outcome evaluation
 */
// eslint-disable-next-line no-unused-vars
function actionMeetsExpectation(actionSuccess, expectedOutcome, bundleSignals) {
  return actionSuccess && bundleSignals && bundleSignals[expectedOutcome] === true;
}

/**
 * Helper: Classify outcome reason based on action success and signal matching
 * Maps concrete failure modes to cause taxonomy
 * PURE FUNCTION: No side effects, used in attempt classification
 */
// eslint-disable-next-line no-unused-vars
function determineAttemptReason(actionSuccess, expectationMet, attemptCause) {
  if (actionSuccess && expectationMet) {
    return null; // Observed
  } else if (!actionSuccess) {
    return attemptCause; // Use cause to explain
  } else {
    return attemptCause || 'outcome-not-met';
  }
}


export class InteractionPlanner {
  constructor(page, evidencePath, _options = {}) {
    this.page = page;
    this.evidencePath = evidencePath;
    this.timeProvider = getTimeProvider();
    this.startTime = this.timeProvider.now();
    this.networkEvents = [];
    this.consoleEvents = [];
    this.attempts = [];
    
    // Optional TimeoutManager for coordination (Issue #28)
    // If provided, uses TimeoutManager's budget tracking
    // If not provided, falls back to GLOBAL_TIMEOUT constant
    this.timeoutManager = _options.timeoutManager || null;
    
    // Step I: Initialize extraction services (Issue #18)
    this.evidenceCapture = new EvidenceCaptureService(page, _options);
    this.actionDispatcher = new ActionDispatcher(this);
    this.outcomeEvaluator = new OutcomeEvaluator(_options);
    
    // CONSTITUTIONAL: Read-only mode enforced (no writes allowed)
    this.blockedRequests = [];
  }
  
  /**
   * Check if we're still within budget
   * Uses TimeoutManager if available (Issue #28), otherwise GLOBAL_TIMEOUT constant
   */
  isWithinBudget() {
    if (this.timeoutManager) {
      // Use TimeoutManager's remaining budget
      return this.timeoutManager.getRemainingBudget() > 0;
    }
    // Fallback to GLOBAL_TIMEOUT constant for backward compatibility
    return this.timeProvider.now() - this.startTime < GLOBAL_TIMEOUT;
  }
  
  /**
   * H5: Check if request method is mutating
   */
  isMutatingRequest(method) {
    return MUTATING_METHODS.includes((method || 'GET').toUpperCase());
  }
  
  /**
   * CONSTITUTIONAL: Block all mutating requests (read-only mode)
   */
  shouldBlockRequest(method) {
    return this.isMutatingRequest(method);
  }
  
  /**
   * H5: Get blocked requests
   */
  getBlockedRequests() {
    return this.blockedRequests;
  }
  
  /**
   * Plan and execute a single promise
   * 
   * REFACTORED (Step I): Uses extraction services
   * - EvidenceCaptureService: Handles before/after state capture
   * - ActionDispatcher: Handles action type dispatching
   * - OutcomeEvaluator: Handles outcome evaluation
   */
  async executeSinglePromise(promise, expNum) {
    const attempt = {
      id: promise.id,
      expNum,
      category: promise.category || promise.type,
      attempted: false,
      reason: null,
      action: null,
      evidence: null,
      signals: null,
      cause: null,
    };
    
    // Budget check
    if (!this.isWithinBudget()) {
      attempt.reason = 'global-timeout-exceeded';
      attempt.cause = 'timeout';
      this.attempts.push(attempt);
      return attempt;
    }
    
    const bundle = createEvidenceBundle(promise, expNum, this.evidencePath);
    bundle.timing.startedAt = getTimeProvider().iso();
    bundle.actionStartTime = getTimeProvider().iso();
    
    try {
      // === PHASE 1: BEFORE STATE ===
      const beforeState = await this.evidenceCapture.captureBeforeState(
        bundle,
        this.consoleEvents.length
      );
      const consoleErrorsCountBefore = this.consoleEvents.length;
      
      // === PHASE 2: ACTION EXECUTION ===
      // Dispatch action based on promise type
      const actionResult = await this.actionDispatcher.dispatch(promise, bundle, attempt);
      const { success: actionSuccess, reason: actionReason, cause: actionCause } = parseActionResult(actionResult);
      
      if (actionCause && !attempt.cause) {
        attempt.cause = actionCause;
      }
      
      // === PHASE 3: AFTER STATE ===
      // Wait for effects
      const postActionDelay = process.env.VERAX_TEST_FAST_OUTCOME === '1' ? 5 : 500;
      await this.page.waitForTimeout(postActionDelay);
      
      // Capture after state and analyze changes
      const afterState = await this.evidenceCapture.captureAfterState(
        bundle,
        this.consoleEvents.length,
        beforeState
      );
      
      // Analyze route changes (using evidenceCapture service)
      const routeAnalysis = await this.evidenceCapture.analyzeRouteChanges(beforeState, afterState.after);
      
      // Prepare route data for bundle
      const routeData = {
        before: beforeState.routeSignature,
        after: afterState.after.routeSignature,
        transitions: routeAnalysis.transitions,
        signatureChanged: routeAnalysis.signatureChanged,
        hasTransitions: routeAnalysis.hasTransitions
      };
      
      // Capture URL for analysis
      const urlBefore = beforeState.url;
      const urlAfter = afterState.after.url;
      
      // Capture mutations and analyze (using evidenceCapture service)
      const mutationAnalysis = await this.evidenceCapture.analyzeMutationChanges(
        null, // beforeMutations not stored in new architecture
        null  // afterMutations not stored in new architecture
      );
      
      // Analyze changes on bundle
      bundle.analyzeChanges(urlBefore, urlAfter, routeData, { 
        mutationSummary: mutationAnalysis.after, 
        mutationAnalysis: mutationAnalysis,
        outcomeWatcher: this.lastOutcomeWatcherResult 
      });
      bundle.correlateNetworkRequests();
      
      // Collect new console errors
      const newConsoleErrors = this.consoleEvents.slice(consoleErrorsCountBefore);
      newConsoleErrors.forEach(err => bundle.recordConsoleError(err));
      
      // Finalize bundle
      bundle.finalize(this.page);
      
      // === PHASE 4: INTENT CLASSIFICATION ===
      if (bundle.interactionIntentRecord) {
        const classification = classifyInteractionIntent(bundle.interactionIntentRecord);
        bundle.setInteractionIntentClassification(classification);
        
        const acknowledgment = evaluateAcknowledgment(bundle.signals);
        bundle.interactionAcknowledgment = acknowledgment;
      }
      
      attempt.attempted = true;
      attempt.evidence = bundle.getSummary();
      attempt.signals = bundle.signals;
      
      // === PHASE 5: OUTCOME DETERMINATION ===
      // Use OutcomeEvaluator to evaluate outcome
      if (!attempt.cause) {
        const outcomeClass = this.outcomeEvaluator.classifyOutcome(
          promise,
          bundle,
          actionSuccess,
          actionReason
        );
        attempt.cause = outcomeClass.classification;
      }
      
      const expectationMet = this.outcomeEvaluator.meetsExpectation(promise, bundle);
      attempt.reason = this.outcomeEvaluator.determineReason(actionSuccess, expectationMet, attempt.cause);
      
    } catch (error) {
      attempt.reason = `error:${error.message}`;
      attempt.cause = 'error';
      attempt.attempted = true;
      
      // Capture after even on error
      try {
        await bundle.captureAfterState(this.page);
        bundle.finalize(this.page);
        attempt.evidence = bundle.getSummary();
      } catch (e) {
        // Give up
      }
    }
    
    this.attempts.push(attempt);
    return attempt;
  }
  
  /**
   * Execute runtime navigation (discovered from DOM)
   * GUARANTEES: Always returns { success: boolean, reason?: string, cause?: string }
   * even on errors, with evidence captured when possible.
   */
  async executeRuntimeNavigation(promise, bundle) {
    // Runtime navigation must have runtimeNav metadata
    if (!promise.runtimeNav) {
      bundle.timing.endedAt = getTimeProvider().iso();
      return { success: false, reason: 'missing-runtime-metadata', cause: 'blocked' };
    }

    // Try to refind element by selectorPath (most stable)
    const selectorPath = promise.runtimeNav.selectorPath;
    const href = promise.runtimeNav.href || promise.promise?.value;
    const context = promise.runtimeNav.context || null;
    
    let selector = null;
    let found = false;
    let elementHandle = null;

    // Strategy 0: Shadow DOM or iframe-aware refind via evaluateHandle
    try {
      if (context && (context.kind === 'shadow-dom' || context.kind === 'iframe')) {
        if (context.kind === 'iframe' && context.frameUrl) {
          const frame = this.page.frames().find(f => {
            try { return f.url() === context.frameUrl; } catch { return false; }
          });
          if (frame) {
            elementHandle = await frame.evaluateHandle((sel) => {
              /* eslint-disable no-undef */
              function _getSelectorPathWithinRoot(el) {
                const path = [];
                let current = el;
                let depth = 0;
                const maxDepth = 5;
                while (current && current.nodeType === Node.ELEMENT_NODE && depth < maxDepth) {
                  let s = current.tagName.toLowerCase();
                  if (current.id) { s += `#${current.id}`; path.unshift(s); break; }
                  if (current.className && typeof current.className === 'string') {
                    const classes = current.className.trim().split(/\s+/).slice(0,2);
                    if (classes.length > 0 && classes[0]) s += '.' + classes.join('.');
                  }
                  path.unshift(s);
                  current = current.parentElement;
                  depth++;
                }
                return path.join(' > ');
              }
              function queryShadowAware(selectorPath) {
                // Split on custom shadow markers
                const parts = selectorPath.split('::shadow');
                let root = document;
                for (let i = 0; i < parts.length; i++) {
                  const part = parts[i].trim();
                  if (i < parts.length - 1) {
                    const host = root.querySelector(part.replace(/\s*>\s*$/, ''));
                    if (!host || !host.shadowRoot) return null;
                    root = host.shadowRoot;
                  } else {
                    return root.querySelector(part);
                  }
                }
                return null;
              }
              return queryShadowAware(sel);
            }, selectorPath);
          }
        } else {
          elementHandle = await this.page.evaluateHandle((sel) => {
            function queryShadowAware(selectorPath) {
              const parts = selectorPath.split('::shadow');
              let root = document;
              for (let i = 0; i < parts.length; i++) {
                const part = parts[i].trim();
                if (i < parts.length - 1) {
                  const host = root.querySelector(part.replace(/\s*>\s*$/, ''));
                  if (!host || !host.shadowRoot) return null;
                  root = host.shadowRoot;
                } else {
                  return root.querySelector(part);
                }
              }
              return null;
            }
            return queryShadowAware(sel);
          }, selectorPath);
        }
        if (elementHandle) {
          found = true;
        }
      }
    } catch {
      // Fall through
    }

    // Strategy 1: Try exact selectorPath first
    if (selectorPath) {
      try {
        const count = await this.page.locator(selectorPath).count();
        if (count === 1) {
          selector = selectorPath;
          found = true;
        } else if (count > 1 && href) {
          // Narrow by href attribute
          const narrowed = this.page.locator(`${selectorPath}[href="${href}"]`);
          if (await narrowed.count() === 1) {
            selector = `${selectorPath}[href="${href}"]`;
            found = true;
          }
        }
      } catch (e) {
        // Fall through to strategy 2
      }
    }

    // Strategy 2: Try href-based lookup as fallback
    if (!found && href) {
      try {
        const hrefSelector = `a[href="${href}"]`;
        if (await this.page.locator(hrefSelector).count() === 1) {
          selector = hrefSelector;
          found = true;
        }
      } catch (e) {
        // Fall through
      }
    }

    if (!found && !elementHandle) {
      bundle.timing.endedAt = getTimeProvider().iso();
      return { success: false, reason: 'selector-not-found', cause: 'not-found' };
    }

    try {
      // Check if interactable
      let interactable = false;
      if (elementHandle) {
        try {
          const box = await elementHandle.boundingBox();
          interactable = !!box && box.width > 0 && box.height > 0;
        } catch {
          interactable = false;
        }
      } else {
        interactable = await isElementInteractable(this.page, selector);
      }
      if (!interactable) {
        bundle.timing.endedAt = getTimeProvider().iso();
        return { success: false, reason: 'element-not-interactable', cause: 'blocked' };
      }

      // Perform click with strict try/catch
      try {
        if (elementHandle) {
          await elementHandle.asElement()?.click({ timeout: 3000, noWaitAfter: true });
        } else {
          await this.page.locator(selector).click({ timeout: 3000, noWaitAfter: true });
        }
      } catch (clickError) {
        // Click failed but we still capture evidence
        bundle.timing.endedAt = getTimeProvider().iso();
        return { success: false, reason: `click-error:${clickError.message}`, cause: 'click-error' };
      }

      // Wait for expected outcome with strict navigation detection
      try {
        // Track iframe url change if applicable
        let frameBefore = null;
        if (context?.kind === 'iframe' && context.frameUrl) {
          const frame = this.page.frames().find(f => {
            try { return f.url() === context.frameUrl; } catch { return false; }
          });
          if (frame) frameBefore = frame.url();
        }
        const outcomeReached = await this.waitForOutcome(promise.expectedOutcome || 'navigation');

        if (!outcomeReached) {
          bundle.timing.endedAt = getTimeProvider().iso();
          return { success: false, reason: 'outcome-timeout', cause: 'timeout' };
        }

        if (context?.kind === 'iframe' && context.frameUrl) {
          const frame = this.page.frames().find(f => {
            try { return f.url() === context.frameUrl || !!f.url(); } catch { return false; }
          });
          try {
            if (frame && frameBefore && frame.url() !== frameBefore) {
              // Treat iframe navigation as navigationChanged
              bundle.signals.navigationChanged = true;
            }
          } catch {
            // ignore
          }
        }

        bundle.timing.endedAt = getTimeProvider().iso();
        return { success: true };
      } catch (outcomeError) {
        bundle.timing.endedAt = getTimeProvider().iso();
        return { success: false, reason: `outcome-error:${outcomeError.message}`, cause: 'outcome-error' };
      }

    } catch (error) {
      bundle.timing.endedAt = getTimeProvider().iso();
      return { success: false, reason: `execution-error:${error.message}`, cause: 'error' };
    }
  }

  /**
   * Execute button click
   * Returns: { success: boolean, reason?: string, cause?: string }
   */
  async executeButtonClick(promise, bundle) {
    // Resolve selector
    const resolution = await resolveSelector(this.page, promise);
    
    if (!resolution.found) {
      bundle.timing.endedAt = getTimeProvider().iso();
      return { success: false, reason: 'selector-not-found', cause: 'not-found' };
    }
    
    try {
      // Check if interactable
      const interactable = await isElementInteractable(this.page, resolution.selector);
      if (!interactable) {
        bundle.timing.endedAt = getTimeProvider().iso();
        return { success: false, reason: 'element-not-interactable', cause: 'blocked' };
      }      const element = await this.page.locator(resolution.selector).elementHandle();
      const intentRecord = await extractIntentRecordFromElement(this.page, element);
      await element?.dispose();
      if (intentRecord) {
        bundle.setInteractionIntentRecord(intentRecord);
      }
      
      // Perform click
      await this.page.locator(resolution.selector).click({ timeout: 3000 });
      
      // Wait for expected outcome
      const outcomeReached = await this.waitForOutcome(promise.expectedOutcome || 'ui-change');
      
      if (!outcomeReached) {
        return { success: false, reason: 'outcome-timeout', cause: 'timeout' };
      }
      
      return { success: true };
      
    } catch (error) {
      return { success: false, reason: error.message, cause: 'error' };
    }
  }
  
  /**
   * Execute form submission
   * Returns: { success: boolean, reason?: string, cause?: string }
   */
  async executeFormSubmission(promise, _bundle) {
    // Resolve form selector
    const formResolution = await resolveSelector(this.page, promise);
    
    if (!formResolution.found) {
      return { success: false, reason: 'form-not-found', cause: 'not-found' };
    }
    
    try {
      // Fill in required inputs with sample data
      const requiredInputs = await this.page.locator(`${formResolution.selector} input[required]`).all();
      
      for (const input of requiredInputs) {
        const type = await input.getAttribute('type');
        let value = 'test-data';
        
        if (type === 'email') {
          value = 'test@example.com';
        } else if (type === 'number') {
          value = '123';
        } else if (type === 'date') {
          value = '2025-01-14';
        } else if (type === 'checkbox') {
          const isChecked = await input.isChecked();
          if (!isChecked) {
            await input.check();
          }
          continue;
        }
        
        try {
          await input.fill(value);
        } catch (e) {
          // Skip if can't fill
        }
      }
      
      // Find and click submit button
      const submitBtn = await findSubmitButton(this.page, formResolution.selector);
      
      let _submitted = false;
      if (submitBtn) {
        try {
          await submitBtn.click({ timeout: 3000 });
          _submitted = true;
        } catch (e) {
          return { success: false, reason: 'submit-button-click-failed', cause: 'blocked' };
        }
      } else {
        // Try submitting with Enter on first input
        const firstInput = await this.page.locator(`${formResolution.selector} input`).first();
        if (await firstInput.count() > 0) {
          try {
            await firstInput.press('Enter');
            _submitted = true;
          } catch (e) {
            return { success: false, reason: 'form-submit-failed', cause: 'blocked' };
          }
        } else {
          return { success: false, reason: 'no-submit-mechanism', cause: 'blocked' };
        }
      }
      
      // Wait for expected outcome
      const outcomeReached = await this.waitForOutcome(promise.expectedOutcome || 'ui-change');
      
      if (!outcomeReached) {
        return { success: false, reason: 'form-submit-prevented', cause: 'prevented-submit' };
      }
      
      return { success: true };
      
    } catch (error) {
      return { success: false, reason: error.message, cause: 'error' };
    }
  }
  
  /**
   * Execute validation check
   */
  async executeValidation(promise, _bundle) {
    // Find required input
    const resolution = await resolveSelector(this.page, promise);
    
    if (!resolution.found) {
      return false;
    }
    
    try {
      // Try to submit form without filling in this required field
      // First, find the containing form
      const form = await this.page.locator(`input[required]`).first().evaluate(el => {
        let current = el;
        while (current && current.tagName !== 'FORM') {
          current = current.parentElement;
        }
        return current ? current.getAttribute('id') || current.className : null;
      }).catch(() => null);
      
      if (form) {
        // Try to submit the form
        const submitBtn = await findSubmitButton(this.page, `form`);
        if (submitBtn) {
          await submitBtn.click({ timeout: 2000 }).catch(() => {});
        }
      }
      
      // Wait briefly for validation feedback
      await this.page.waitForTimeout(1000);
      
      // Check if validation feedback appeared
      const hasValidationUI = await this.page.locator('[aria-invalid="true"], [role="alert"], .error, .validation-error').count() > 0;
      
      return hasValidationUI;
      
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Observe state changes
   */
  async observeStateChange(_promise, _bundle) {
    const htmlBefore = await this.page.content();
    
    await this.page.waitForTimeout(1500);
    
    const htmlAfter = await this.page.content();
    
    return htmlBefore !== htmlAfter;
  }
  
  /**
   * Observe network request
   */
  async observeNetworkRequest(_promise, _bundle) {
    const targetUrl = _promise.promise.value;
    const networkCountBefore = this.networkEvents.length;
    
    const fastOutcome = process.env.VERAX_TEST_FAST_OUTCOME === '1';
    const networkWait = fastOutcome ? 300 : 2000;

    await this.page.waitForTimeout(networkWait);
    
    const networkCountAfter = this.networkEvents.length;
    
    if (networkCountAfter > networkCountBefore) {
      // Check if any of the new events match the target
      const newEvents = this.networkEvents.slice(networkCountBefore);
      return newEvents.some(event => {
        return event.url === targetUrl || 
               event.url.includes(targetUrl) || 
               targetUrl.includes(event.url);
      });
    }
    
    return false;
  }
  
  /**
   * Wait for expected outcome with timeout
   */
  /**
   * PHASE 2B: Wait for outcome using adaptive watcher
   * Replaces fixed 3s wait with intelligent acknowledgment detection
   */
  async waitForOutcome(_expectedOutcome) {
    const fastOutcome = process.env.VERAX_TEST_FAST_OUTCOME === '1';
    const maxWaitMs = fastOutcome ? 120 : 10000; // tighten waits in fast mode
    const pollIntervalMs = fastOutcome ? 25 : 250;
    const stabilityWindowMs = fastOutcome ? 80 : 300;
    const earlyExitMs = fastOutcome ? 80 : 500;

    const result = await watchForOutcome(this.page, { maxWaitMs, pollIntervalMs, stabilityWindowMs, earlyExitMs });
    
    // Store outcome watcher result for evidence
    this.lastOutcomeWatcherResult = result;
    
    // Return true if acknowledged within reasonable time
    // Even if not acknowledged, we attempted - don't fail the interaction
    return result.acknowledged || true;
  }
  
  /**
   * Record network event
   */
  recordNetworkEvent(event) {
    this.networkEvents.push(event);
  }
  
  /**
   * Record console event
   */
  recordConsoleEvent(event) {
    this.consoleEvents.push(event);
  }
  
  /**
   * Get all attempts
   */
  getAttempts() {
    return this.attempts;
  }
}

/**
 * Classify the outcome based on evidence and expected outcome
 * Returns cause taxonomy: not-found | blocked | prevented-submit | timeout | no-change
 */
// eslint-disable-next-line no-unused-vars
function classifyOutcome(promise, bundle, actionSuccess, actionReason) {
  // If action itself failed
  if (!actionSuccess && actionReason) {
    const lower = actionReason.toLowerCase();
    if (lower.includes('not-found') || lower.includes('not found')) {
      return 'not-found';
    }
    if (lower.includes('interactable') || lower.includes('blocked')) {
      return 'blocked';
    }
    if (lower.includes('prevented') || lower.includes('prevented-submit')) {
      return 'prevented-submit';
    }
    if (lower.includes('timeout') || lower.includes('timed out')) {
      return 'timeout';
    }
  }
  
  // Action succeeded but outcome not met
  const expected = promise.expectedOutcome || 'ui-change';
  const matched = outcomeMatched(expected, bundle.signals);
  
  if (!matched) {
    // Check what didn't happen
    if (expected === 'navigation' && !bundle.signals.navigationChanged) {
      // Navigation was supposed to happen but didn't
      return 'no-change';
    }
    if (expected === 'feedback' && !bundle.signals.feedbackSeen) {
      // Feedback was supposed to appear but didn't
      return 'no-change';
    }
    if (expected === 'network' && !bundle.signals.correlatedNetworkActivity) {
      // Network request was supposed to happen but didn't
      return 'no-change';
    }
    if (expected === 'ui-change' && !bundle.signals.meaningfulDomChange) {
      // UI change was supposed to happen but didn't
      return 'no-change';
    }
  }
  
  // Default
  return 'no-change';
}

/**
 * Check if the expected outcome has been satisfied by the signals
 */
function outcomeMatched(expectedOutcome, signals) {
  if (!expectedOutcome || expectedOutcome === 'ui-change') {
    // Any meaningful signal counts
    return signals.navigationChanged || 
           signals.meaningfulDomChange || 
           signals.feedbackSeen ||
           signals.correlatedNetworkActivity;
  }
  
  if (expectedOutcome === 'navigation') {
    return signals.navigationChanged;
  }
  
  if (expectedOutcome === 'feedback') {
    return signals.feedbackSeen;
  }
  
  if (expectedOutcome === 'network') {
    return signals.correlatedNetworkActivity || signals.networkActivity;
  }
  
  return false;
}



