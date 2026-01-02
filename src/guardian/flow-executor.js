/**
 * Guardian Flow Execution Module
 * Executes predefined user interaction flows (click, type, submit, etc.)
 */

const fs = require('fs');
const path = require('path');
const { waitForOutcome } = require('./wait-for-outcome');

const MAX_ACTION_RETRIES = 1;
const RETRY_BACKOFF_MS = 150; // deterministic, small backoff

function validateFlowDefinition(flow) {
  if (!flow || !Array.isArray(flow.steps) || flow.steps.length === 0) {
    return { ok: false, reason: 'Flow misconfigured: no steps defined (add at least one step).' };
  }

  for (let i = 0; i < flow.steps.length; i++) {
    const step = flow.steps[i] || {};
    const needsTarget = ['click', 'type', 'submit', 'waitFor', 'navigate'];
    if (needsTarget.includes(step.type) && !step.target) {
      return { ok: false, reason: `Flow misconfigured: step ${i + 1} (${step.type}) missing target selector.` };
    }
  }

  return { ok: true };
}

class GuardianFlowExecutor {
  constructor(options = {}) {
    this.timeout = options.timeout || 30000; // 30 seconds per step
    this.screenshotOnStep = options.screenshotOnStep !== false; // Screenshot each step by default
    this.safety = options.safety || null; // Safety guard instance (optional)
    this.baseUrl = options.baseUrl || null; // For origin checks
    this.quiet = options.quiet === true;
    this.log = (...args) => {
      if (!this.quiet) console.log(...args);
    };
    this.warn = (...args) => {
      if (!this.quiet) console.warn(...args);
    };
  }

  async runActionWithRetry(step, actionLabel, attemptFn) {
    let attempt = 0;
    let lastErr = null;
    let lastResult = null;

    while (attempt <= MAX_ACTION_RETRIES) {
      try {
        lastResult = await attemptFn();
        if (lastResult && lastResult.success) {
          if (attempt > 0) {
            lastResult.retried = true;
            lastResult.retryCount = attempt;
            this.log(`   ✅ Retry succeeded for action ${actionLabel}`);
          }
          return lastResult;
        }

        if (lastResult && lastResult.retryable === false) {
          return lastResult;
        }

        if (lastResult && lastResult.error) {
          lastErr = lastResult.error instanceof Error ? lastResult.error : new Error(lastResult.error);
        }
      } catch (error) {
        lastErr = error;
      }

      if (attempt >= MAX_ACTION_RETRIES || !isRetryableActionError(lastErr)) {
        const errorMsg = lastErr ? lastErr.message : 'Action failed';
        const severity = classifyError(step, lastErr || new Error('Action failed'));
        if (attempt > 0) {
          this.log(`   ❌ Retry ${attempt}/${MAX_ACTION_RETRIES} failed for action ${actionLabel}: ${errorMsg}`);
        }
        return { success: false, error: errorMsg, severity, retryCount: attempt > 0 ? attempt : 0 };
      }

      attempt++;
      this.log(`   🔁 Retry ${attempt}/${MAX_ACTION_RETRIES} attempted for action ${actionLabel}${lastErr && lastErr.message ? ` (${lastErr.message})` : ''}`);
      await deterministicDelay(RETRY_BACKOFF_MS);
    }

    return lastResult || { success: false, error: 'Action failed', severity: 'hard' };
  }

  /**
   * Load flow definition from JSON file
   * @param {string} flowPath - Path to flow JSON file
   * @returns {object|null} Flow definition
   */
  loadFlow(flowPath) {
    try {
      const content = fs.readFileSync(flowPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`❌ Failed to load flow: ${error.message}`);
      return null;
    }
  }

  /**
   * Execute a single flow step
   * @param {Page} page - Playwright page
   * @param {object} step - Step definition
   * @param {number} stepIndex - Step index for logging
   * @returns {Promise<object>} { success: boolean, error: string|null }
   */
  async executeStep(page, step, stepIndex) {
    try {
      this.log(`   Step ${stepIndex + 1}: ${step.type} ${step.target || ''}`);

      // Safety check for destructive actions
      if (this.safety) {
        const safetyCheck = this.checkStepSafety(step);
        if (!safetyCheck.safe) {
          return {
            success: false,
            error: `Safety guard blocked step: ${safetyCheck.reason}`,
          };
        }
      }

      switch (step.type) {
        case 'navigate':
          return await this.stepNavigate(page, step);
        
        case 'click':
          return await this.stepClick(page, step);
        
        case 'type':
          return await this.stepType(page, step);
        
        case 'submit':
          return await this.stepSubmit(page, step);
        
        case 'waitFor':
          return await this.stepWaitFor(page, step);
        
        case 'wait':
          return await this.stepWait(page, step);
        
        default:
          return {
            success: false,
            error: `Unknown step type: ${step.type}`,
            severity: 'hard'
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        severity: classifyError(step, error)
      };
    }
  }

  /**
   * Navigate to URL
   * @param {Page} page - Playwright page
   * @param {object} step - Step definition
   * @returns {Promise<object>} Result
   */
  async stepNavigate(page, step) {
    try {
      await page.goto(step.target, {
        timeout: this.timeout,
        waitUntil: 'domcontentloaded',
      });
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error: error.message, severity: classifyError(step, error) };
    }
  }

  /**
   * Click element
   * @param {Page} page - Playwright page
   * @param {object} step - Step definition
   * @returns {Promise<object>} Result
   */
  async stepClick(page, step) {
    return this.runActionWithRetry(step, 'click', async () => {
      const initialUrl = page.url();
      const waitPromise = waitForOutcome(page, {
        actionType: 'click',
        baseOrigin: this.baseUrl ? new URL(this.baseUrl).origin : null,
        initialUrl,
        expectNavigation: !!step.waitForNavigation,
        maxWait: Math.min(this.timeout, 3500)
      });
      await page.click(step.target, { timeout: this.timeout });
      const waitResult = await waitPromise;
      this.log(`   ⏱️  wait resolved by ${waitResult.reason}`);
      return { success: true, error: null };
    });
  }

  /**
   * Type into input field
   * @param {Page} page - Playwright page
   * @param {object} step - Step definition
   * @returns {Promise<object>} Result
   */
  async stepType(page, step) {
    return this.runActionWithRetry(step, 'type', async () => {
      if (step.clear !== false) {
        await page.fill(step.target, '');
      }

      await page.type(step.target, step.value, {
        timeout: this.timeout,
        delay: step.delay || 50, // Simulate human typing
      });
      
      return { success: true, error: null };
    });
  }

  /**
   * Submit form
   * @param {Page} page - Playwright page
   * @param {object} step - Step definition
   * @returns {Promise<object>} Result
   */
  async stepSubmit(page, step) {
    return this.runActionWithRetry(step, 'submit', async () => {
      const { captureBeforeState, captureAfterState, evaluateSuccess } = require('./success-evaluator');

      const submitSelector = step.target || 'button[type="submit"]';
      const submitHandle = await page.$(submitSelector);
      const before = await captureBeforeState(page, submitHandle);

      const requests = [];
      const responses = [];
      const consoleErrors = [];
      const initialUrl = page.url();
      let navChanged = false;

      const onRequest = (req) => { requests.push(req); };
      const onResponse = (res) => {
        try {
          const req = res.request();
          if (!req || requests.includes(req)) {
            responses.push(res);
          }
        } catch {
          responses.push(res);
        }
      };
      const onConsole = (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push({ type: msg.type(), text: msg.text() });
        }
      };
      const onFrameNav = () => {
        try {
          const nowUrl = page.url();
          if (nowUrl && nowUrl !== initialUrl) navChanged = true;
        } catch (_err) {
          // Page may be detached/closed - this is expected during navigation
        }
      };

      page.on('request', onRequest);
      page.on('response', onResponse);
      page.on('console', onConsole);
      page.on('framenavigated', onFrameNav);

      try {
        if (submitHandle) {
          await submitHandle.click({ timeout: this.timeout });
        } else {
          await page.click(submitSelector, { timeout: this.timeout });
        }

        const baseOrigin = this.baseUrl ? new URL(this.baseUrl).origin : (new URL(initialUrl)).origin;
        const waitResult = await waitForOutcome(page, {
          actionType: 'submit',
          baseOrigin: baseOrigin,
          initialUrl,
          expectNavigation: true,
          includeUrlChange: false,
          maxWait: Math.min(4000, this.timeout)
        });
        this.log(`   ⏱️  wait resolved by ${waitResult.reason}`);

        const originalFormSelector = before.state.formSelector;
        const after = await captureAfterState(page, originalFormSelector);

        const evalResult = evaluateSuccess(before, after, {
          requests,
          responses,
          consoleErrors,
          navChanged,
          baseOrigin,
        });

        const topReasonsArr = (evalResult.reasons || []).slice(0, 3);
        const topReasons = topReasonsArr.join(' + ');
        this.log(`   SUBMIT: ${evalResult.status.toUpperCase()} (confidence: ${evalResult.confidence}) — ${topReasons || 'no signals'}`);
        if (topReasonsArr.length > 0) {
          this.log('     Reasons:');
          topReasonsArr.forEach(r => this.log(`       - ${r}`));
        }
        const ev = evalResult.evidence || {};
        const net = Array.isArray(ev.network) ? ev.network : [];
        const primary = net.find(n => (n.method === 'POST' || n.method === 'PUT') && n.status != null) || net[0];
        const reqLine = (() => {
          if (!primary) return null;
          try {
            const p = new URL(primary.url);
            return `request: ${primary.method} ${p.pathname} → ${primary.status}`;
          } catch { return `request: ${primary.method} ${primary.url} → ${primary.status}`; }
        })();
        const navLine = (ev.urlChanged || navChanged) ? (() => {
          try {
            const from = new URL(before.url).pathname;
            const to = new URL(after.url).pathname;
            return `navigation: ${from} → ${to}`;
          } catch { return `navigation: changed`; }
        })() : null;
        const formStates = [];
        if (ev.formCleared) formStates.push('cleared');
        if (ev.formDisabled) formStates.push('disabled');
        if (ev.formDisappeared) formStates.push('disappeared');
        const formLine = formStates.length ? `form: ${formStates.join(', ')}` : null;
        const errorLines = [];
        if ((ev.ariaInvalidDelta || 0) > 0) errorLines.push('aria-invalid increased');
        if ((ev.alertRegionDelta || 0) > 0) errorLines.push('role=alert updated');
        const consoleErr = (consoleErrors || [])[0];
        const consoleLine = consoleErr ? `console.error: "${String(consoleErr.text).slice(0, 120)}"` : null;
        const evidenceLines = [reqLine, navLine, formLine, ...errorLines.map(e => `error: ${e}`), consoleLine].filter(Boolean);
        if (evidenceLines.length > 0) {
          this.log('     Evidence:');
          evidenceLines.slice(0, 3).forEach(line => this.log(`       - ${line}`));
        }

        const ok = evalResult.status === 'success';
        const errMsg = ok ? null : `Outcome evaluation: ${evalResult.status}`;
        return {
          success: ok,
          error: errMsg,
          successEval: evalResult,
          severity: evalResult.status === 'failure' ? 'hard' : 'soft',
          retryable: ok ? undefined : false
        };
      } finally {
        page.off('request', onRequest);
        page.off('response', onResponse);
        page.off('console', onConsole);
        page.off('framenavigated', onFrameNav);
      }
    });
  }

  /**
   * Wait for element to appear
   * @param {Page} page - Playwright page
   * @param {object} step - Step definition
   * @returns {Promise<object>} Result
   */
  async stepWaitFor(page, step) {
    try {
      await page.waitForSelector(step.target, {
        timeout: step.timeout || this.timeout,
        state: step.state || 'visible',
      });
      
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error: error.message, severity: classifyError(step, error) };
    }
  }

  /**
   * Wait for specified time
   * @param {Page} page - Playwright page
   * @param {object} step - Step definition
   * @returns {Promise<object>} Result
   */
  async stepWait(page, step) {
    try {
      const duration = step.duration || 1000;
      await page.waitForTimeout(duration);
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error: error.message, severity: classifyError(step, error) };
    }
  }

  /**
   * Check if step is safe to execute
   * @param {object} step - Step definition
   * @returns {object} { safe: boolean, reason: string|null }
   */
  checkStepSafety(step) {
    if (!this.safety) {
      return { safe: true, reason: null };
    }

    // Check URL safety for navigate steps
    if (step.type === 'navigate') {
      return this.safety.isUrlSafe(step.target);
    }

    // Check selector safety for click/type steps
    if (step.type === 'click' || step.type === 'type') {
      return this.safety.isSelectorSafe(step.target);
    }

    // Check form submission safety
    if (step.type === 'submit') {
      return this.safety.isFormSubmitSafe(step.target);
    }

    return { safe: true, reason: null };
  }

  /**
   * Execute complete flow
   * @param {Page} page - Playwright page
   * @param {object} flow - Flow definition
   * @param {string} artifactsDir - Directory for screenshots
   * @returns {Promise<object>} Flow result
   */
  async executeFlow(page, flow, artifactsDir, baseUrl = null) {
    this.baseUrl = baseUrl || this.baseUrl;
    const result = {
      flowId: flow.id,
      flowName: flow.name,
      success: false,
      stepsExecuted: 0,
      stepsTotal: flow.steps.length,
      failedStep: null,
      error: null,
      screenshots: [],
      durationMs: 0,
      outcome: 'SUCCESS',
      failureReasons: []
    };
    let hadRetrySuccess = false;

    // Normalize steps with optional baseUrl substitution
    const steps = (flow.steps || []).map((step) => {
      if (baseUrl && typeof step.target === 'string' && step.target.includes('$BASEURL')) {
        return { ...step, target: step.target.replace('$BASEURL', baseUrl) };
      }
      return step;
    });

    // Ensure artifact subfolder exists for screenshots
    if (artifactsDir) {
      const pagesDir = path.join(artifactsDir, 'pages');
      fs.mkdirSync(pagesDir, { recursive: true });
    }

    const startedAt = Date.now();
    try {
      this.log(`\n🎬 Executing flow: ${flow.name}`);
      this.log(`📋 Steps: ${steps.length}`);

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        
        // Execute step
        const stepResult = await this.executeStep(page, step, i);
        
        // Capture screenshot after step
        if (this.screenshotOnStep && artifactsDir) {
          const screenshotPath = path.join(
            artifactsDir,
            'pages',
            `flow-step-${i + 1}.jpeg`
          );
          
          try {
            await page.screenshot({ path: screenshotPath, type: 'jpeg', quality: 80 });
            result.screenshots.push(`flow-step-${i + 1}.jpeg`);
          } catch (error) {
            console.error(`⚠️  Failed to capture screenshot: ${error.message}`);
          }
        }

        // If submit step returns evaluator details, attach them
        if (step.type === 'submit' && stepResult && stepResult.successEval) {
          result.successEval = stepResult.successEval;
        }

        if (stepResult.retried || (stepResult.retryCount && stepResult.retryCount > 0)) {
          if (stepResult.success) {
            hadRetrySuccess = true;
          }
          result.retryCount = (result.retryCount || 0) + (stepResult.retryCount || 0);
        }

        // Check if step failed
        if (!stepResult.success) {
          result.failedStep = i + 1;
          result.error = stepResult.error;
          const severity = stepResult.severity || 'hard';
          const reason = `${step.type} failed: ${stepResult.error}`;
          result.failureReasons.push(reason);
          if (severity === 'soft') {
            result.outcome = result.outcome === 'FAILURE' ? 'FAILURE' : 'FRICTION';
            this.log(`   ⚠️  Soft failure: ${stepResult.error}`);
            continue;
          } else {
            result.outcome = 'FAILURE';
            this.log(`   ❌ Step failed: ${stepResult.error}`);
            break;
          }
        }

        result.stepsExecuted++;
        this.log(`   ✅ Step ${i + 1} completed`);
      }

      // If we have an outcome evaluation from a submit, trust it for overall flow success
      if (result.successEval) {
        result.success = result.successEval.status === 'success';
        if (!result.success && result.outcome !== 'FAILURE') {
          result.outcome = result.successEval.status === 'friction' ? 'FRICTION' : 'FAILURE';
        }
      } else {
        result.success = result.outcome !== 'FAILURE';
      }
      if (hadRetrySuccess && result.outcome === 'SUCCESS') {
        result.outcome = 'FRICTION';
      }
      if (result.outcome === 'SUCCESS' && !result.success) {
        result.outcome = 'FAILURE';
      }
      result.durationMs = Date.now() - startedAt;
      if (result.outcome === 'SUCCESS') {
        this.log(`✅ Flow completed successfully`);
      } else if (result.outcome === 'FRICTION') {
        this.log(`⚠️  Flow completed with friction`);
      } else {
        this.log(`❌ Flow completed with failure`);
      }
      
      return result;
    } catch (error) {
      if (!result.durationMs) {
        result.durationMs = Date.now() - (startedAt || Date.now());
      }
      result.error = error.message;
      console.error(`❌ Flow execution failed: ${error.message}`);
      result.outcome = result.outcome === 'SUCCESS' ? 'FAILURE' : result.outcome;
      return result;
    }
  }

  /**
   * Validate flow definition
   * @param {object} flow - Flow definition
   * @returns {object} { valid: boolean, errors: string[] }
   */
  validateFlow(flow) {
    const errors = [];

    if (!flow.id) {
      errors.push('Flow missing required field: id');
    }

    if (!flow.name) {
      errors.push('Flow missing required field: name');
    }

    if (!flow.steps || !Array.isArray(flow.steps)) {
      errors.push('Flow missing required field: steps (must be array)');
    } else if (flow.steps.length === 0) {
      errors.push('Flow has no steps');
    } else {
      // Validate each step
      flow.steps.forEach((step, index) => {
        if (!step.type) {
          errors.push(`Step ${index + 1}: missing type`);
        }

        const validTypes = ['navigate', 'click', 'type', 'submit', 'waitFor', 'wait'];
        if (step.type && !validTypes.includes(step.type)) {
          errors.push(`Step ${index + 1}: invalid type "${step.type}"`);
        }

        if ((step.type === 'navigate' || step.type === 'click' || step.type === 'type' || step.type === 'waitFor') && !step.target) {
          errors.push(`Step ${index + 1}: missing target`);
        }

        if (step.type === 'type' && !step.value) {
          errors.push(`Step ${index + 1}: missing value for type step`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

function classifyError(step, error) {
  const msg = (error && error.message) ? error.message.toLowerCase() : '';
  const isTimeout = msg.includes('timeout');
  const isNavCrash = msg.includes('target closed') || msg.includes('page crashed') || msg.includes('net::');
  const missingSelector = msg.includes('not found') || msg.includes('waiting for selector');

  if (isNavCrash) return 'hard';
  if (missingSelector) return 'hard';
  if (step && step.type !== 'waitFor' && isTimeout) return 'hard';
  if (isTimeout) return 'soft';
  return 'hard';
}

function deterministicDelay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableActionError(error) {
  if (!error) return false;
  const msg = (error.message || String(error)).toLowerCase();
  if (!msg) return false;

  const isTargetClosed = msg.includes('target closed') || msg.includes('page crashed') || msg.includes('browser has disconnected');
  const isMissingSelector = msg.includes('not found') || msg.includes('waiting for selector') || msg.includes('failed to find element') || msg.includes('selector resolved to') && msg.includes('null');
  if (isTargetClosed) return false;
  if (isMissingSelector) return false;

  const isTimeout = msg.includes('timeout');
  const isDetached = msg.includes('detached') || msg.includes('not attached') || msg.includes('stale element');
  const isNavRace = msg.includes('execution context was destroyed') || (msg.includes('navigation') && msg.includes('race'));

  return isTimeout || isDetached || isNavRace;
}

module.exports = { GuardianFlowExecutor, validateFlowDefinition };
