import { resolveSelector, findSubmitButton, isElementInteractable } from './selector-resolver.js';
import { createEvidenceBundle } from './evidence-engine.js';

/**
 * Interaction Planner
 * Converts extracted promises into executable Playwright interactions
 * with bounded timeouts and evidence capture
 * 
 * H5: Added read-only safety mode by default
 */

const GLOBAL_TIMEOUT = 5 * 60 * 1000; // 5 minutes total
const _PER_PROMISE_TIMEOUT = 15 * 1000; // 15 seconds per promise
const WAIT_FOR_EFFECT_TIMEOUT = 3000; // 3 seconds to observe effect

const MUTATING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

export class InteractionPlanner {
  constructor(page, evidencePath, _options = {}) {
    this.page = page;
    this.evidencePath = evidencePath;
    this.startTime = Date.now();
    this.networkEvents = [];
    this.consoleEvents = [];
    this.attempts = [];
    
    // CONSTITUTIONAL: Read-only mode enforced (no writes allowed)
    this.blockedRequests = [];
  }
  
  /**
   * Check if we're still within budget
   */
  isWithinBudget() {
    return Date.now() - this.startTime < GLOBAL_TIMEOUT;
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
      cause: null, // NEW: precise cause taxonomy
    };
    
    if (!this.isWithinBudget()) {
      attempt.reason = 'global-timeout-exceeded';
      attempt.cause = 'timeout';
      this.attempts.push(attempt);
      return attempt;
    }
    
    const _startTime = Date.now();
    const bundle = createEvidenceBundle(promise, expNum, this.evidencePath);
    bundle.timing.startedAt = new Date().toISOString();
    bundle.actionStartTime = new Date().toISOString(); // For network correlation
    
    try {
      // Capture before state
      await bundle.captureBeforeState(this.page);
      const urlBefore = this.page.url();
      const consoleErrorsCountBefore = this.consoleEvents.length;
      
      // Execute interaction based on type
      let actionResult = null;
      
      if (promise.category === 'button' || promise.type === 'navigation') {
        actionResult = await this.executeButtonClick(promise, bundle);
        attempt.action = 'click';
      } else if (promise.category === 'form') {
        actionResult = await this.executeFormSubmission(promise, bundle);
        attempt.action = 'submit';
      } else if (promise.category === 'validation') {
        actionResult = await this.executeValidation(promise, bundle);
        attempt.action = 'observe';
      } else if (promise.type === 'state') {
        actionResult = await this.observeStateChange(promise, bundle);
        attempt.action = 'observe';
      } else if (promise.type === 'network') {
        actionResult = await this.observeNetworkRequest(promise, bundle);
        attempt.action = 'observe';
      } else {
        attempt.reason = 'unsupported-promise-type';
        attempt.cause = 'blocked'; // Mark as blocked due to unsupported type
      }
      
      // Handle action result - could be boolean or object with details
      let actionSuccess = false;
      let actionReason = null;
      
      if (typeof actionResult === 'object' && actionResult !== null) {
        actionSuccess = actionResult.success;
        actionReason = actionResult.reason;
        if (actionResult.cause) {
          attempt.cause = actionResult.cause;
        }
      } else {
        actionSuccess = Boolean(actionResult);
      }
      
      // Wait for effects
      await this.page.waitForTimeout(500);
      
      // Capture after state
      await bundle.captureAfterState(this.page);
      const urlAfter = this.page.url();
      
      // Analyze changes
      bundle.analyzeChanges(urlBefore, urlAfter);
      bundle.correlateNetworkRequests(); // NEW: correlate network to action
      
      // Collect new console errors
      const newConsoleErrors = this.consoleEvents.slice(consoleErrorsCountBefore);
      newConsoleErrors.forEach(err => bundle.recordConsoleError(err));
      
      // Finalize bundle
      bundle.finalize(this.page);
      
      attempt.attempted = true;
      attempt.evidence = bundle.getSummary();
      attempt.signals = bundle.signals;
      
      // Determine outcome based on strict binding rules
      if (!attempt.cause) {
        // Classify outcome based on expected behavior
        attempt.cause = classifyOutcome(promise, bundle, actionSuccess, actionReason);
      }
      
      // If action succeeded and outcome matched, reason is null (observed)
      if (actionSuccess && outcomeMatched(promise.expectedOutcome, bundle.signals)) {
        attempt.reason = null;
      } else if (!actionSuccess) {
        // Action failed - use cause to explain why
        attempt.reason = attempt.cause;
      } else if (!outcomeMatched(promise.expectedOutcome, bundle.signals)) {
        // Action succeeded but expected outcome not observed
        attempt.reason = attempt.cause || 'outcome-not-met';
      }
      
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
   * Execute button click
   * Returns: { success: boolean, reason?: string, cause?: string }
   */
  async executeButtonClick(promise, bundle) {
    // Resolve selector
    const resolution = await resolveSelector(this.page, promise);
    
    if (!resolution.found) {
      bundle.timing.endedAt = new Date().toISOString();
      return { success: false, reason: 'selector-not-found', cause: 'not-found' };
    }
    
    try {
      // Check if interactable
      const interactable = await isElementInteractable(this.page, resolution.selector);
      if (!interactable) {
        bundle.timing.endedAt = new Date().toISOString();
        return { success: false, reason: 'element-not-interactable', cause: 'blocked' };
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
    
    await this.page.waitForTimeout(2000);
    
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
  async waitForOutcome(expectedOutcome) {
    const _startTime = Date.now();
    
    try {
      if (expectedOutcome === 'navigation') {
        // Wait for navigation or DOM change
        await Promise.race([
          this.page.waitForNavigation({ timeout: WAIT_FOR_EFFECT_TIMEOUT }).catch(() => {}),
          this.page.waitForLoadState('domcontentloaded', { timeout: WAIT_FOR_EFFECT_TIMEOUT }).catch(() => {}),
          this.page.waitForTimeout(WAIT_FOR_EFFECT_TIMEOUT),
        ]);
        return true;
      }
      
      if (expectedOutcome === 'network') {
        // Network request should be detected via networkEvents
        await this.page.waitForTimeout(WAIT_FOR_EFFECT_TIMEOUT);
        return true;
      }
      
      if (expectedOutcome === 'feedback') {
        // Wait for feedback element to appear
        const found = await Promise.race([
          this.page.waitForSelector('[aria-live], [role="alert"], [role="status"], .toast', 
            { timeout: WAIT_FOR_EFFECT_TIMEOUT }).catch(() => null),
          new Promise(resolve => {
            setTimeout(() => resolve(false), WAIT_FOR_EFFECT_TIMEOUT);
          }),
        ]);
        return !!found;
      }
      
      // Default: ui-change
      await this.page.waitForTimeout(WAIT_FOR_EFFECT_TIMEOUT);
      return true;
      
    } catch (e) {
      // Timeout or error - still counts as attempted
      return false;
    }
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
