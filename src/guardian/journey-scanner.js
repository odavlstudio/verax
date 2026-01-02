/**
 * Journey Scanner - MVP Human Journey Execution Engine
 * 
 * Executes deterministic, human-like journeys through a website
 * with clear evidence capture and failure classification.
 */

const { GuardianBrowser } = require('./browser');
const { buildStabilityReport, classifyErrorType } = require('./stability-scorer');
const fs = require('fs');
const path = require('path');

class JourneyScanner {
  constructor(options = {}) {
    this.options = {
      timeout: options.timeout || 20000,
      headless: options.headless !== false,
      maxRetries: options.maxRetries || 2,
      screenshotDir: options.screenshotDir,
      ...options
    };
    this.browser = null;
    this.evidence = [];
    this.executedSteps = [];
    this.failedSteps = [];
  }

  /**
   * Execute a journey against a URL
   */
  async scan(baseUrl, journeyDefinition) {
    try {
      this.browser = new GuardianBrowser();
      await this.browser.launch(this.options.timeout, {
        headless: this.options.headless
      });

      // Safety timeout for entire scan (non-throwing)
      let scanCompleted = false;
      this._scanTimeoutTriggered = false;
      const scanTimeout = setTimeout(() => {
        if (!scanCompleted) {
          this._scanTimeoutTriggered = true;
        }
      }, this.options.timeout * 5); // Allow multiple steps

      try {
        const result = {
          url: baseUrl,
          journey: journeyDefinition.name,
          startedAt: new Date().toISOString(),
          executedSteps: [],
          failedSteps: [],
          evidence: [],
          finalDecision: null,
          errorClassification: null,
          goal: { goalReached: false, goalDescription: '' }
        };

        // Execute journey steps
        for (const step of journeyDefinition.steps) {
          const stepResult = await this._executeStep(step, baseUrl);
          result.executedSteps.push(stepResult);
          
          if (!stepResult.success) {
            result.failedSteps.push(stepResult);
          }
        }

        // Evaluate human goal based on journey preset
        const goalEval = await this._evaluateHumanGoal(journeyDefinition?.preset || 'saas');
        result.goal = goalEval;

        // Mark timeout classification if triggered
        if (this._scanTimeoutTriggered) {
          result.errorClassification = { type: 'SITE_UNREACHABLE', reason: 'Scan timeout exceeded' };
        }

        result.endedAt = new Date().toISOString();
        result.evidence = this.evidence;

        // Classify and decide
        const classification = this._classifyErrors(result);
        result.errorClassification = classification;
        result.finalDecision = this._decideOutcome(result);

        // Add stability scoring
        const stabilityReport = buildStabilityReport(result);
        result.stability = stabilityReport;

        scanCompleted = true;
        clearTimeout(scanTimeout);
        return result;
      } catch (err) {
        scanCompleted = true;
        clearTimeout(scanTimeout);
        // Return structured failure instead of throwing
        return {
          url: baseUrl,
          journey: journeyDefinition.name,
          startedAt: new Date().toISOString(),
          endedAt: new Date().toISOString(),
          executedSteps: this.executedSteps,
          failedSteps: this.failedSteps,
          evidence: this.evidence,
          finalDecision: 'DO_NOT_LAUNCH',
          errorClassification: {
            type: 'SITE_UNREACHABLE',
            reason: err.message
          },
          fatalError: err.message
        };
      }
    } catch (err) {
      // Site unreachable or fatal error
      return {
        url: baseUrl,
        journey: journeyDefinition.name,
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        executedSteps: this.executedSteps,
        failedSteps: this.failedSteps,
        evidence: this.evidence,
        finalDecision: 'DO_NOT_LAUNCH',
        errorClassification: {
          type: 'SITE_UNREACHABLE',
          reason: err.message
        },
        fatalError: err.message
      };
    } finally {
      if (this.browser) {
        await this._cleanup();
      }
    }
  }

  /**
   * Execute a single journey step with smarter retry policy
   */
  async _executeStep(step, baseUrl) {
    let lastError = null;
    let isTransient = true;
    let failureCount = 0;
    
    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        const stepResult = await this._performAction(step, baseUrl);
        
        if (stepResult.success) {
          this.executedSteps.push(step.id);
          this._captureEvidence(stepResult);
          return {
            id: step.id,
            name: step.name,
            action: step.action,
            success: true,
            url: stepResult.url,
            pageTitle: stepResult.pageTitle,
            finalUrl: stepResult.finalUrl,
            evidence: stepResult.evidence,
            attemptNumber: attempt + 1,
            failureCount
          };
        }
        lastError = stepResult.error;
        failureCount++;
      } catch (err) {
        lastError = err.message;
        failureCount++;
      }

      // Check if error is transient before retrying
      if (attempt < this.options.maxRetries) {
        const errorClassification = classifyErrorType(lastError);
        isTransient = errorClassification.isTransient;

        // Only retry on transient errors
        if (!isTransient && attempt > 0) {
          break; // Stop retrying deterministic failures
        }

        // Wait before retry
        await new Promise(r => setTimeout(r, 500 + (attempt * 200)));
      }
    }

    // All retries exhausted
    this.failedSteps.push(step.id);
    return {
      id: step.id,
      name: step.name,
      action: step.action,
      success: false,
      error: lastError,
      attemptNumber: this.options.maxRetries + 1,
      failureCount,
      isTransientFailure: isTransient
    };
  }

  /**
   * Perform a single action (navigate, click, etc)
   */
  async _performAction(step, baseUrl) {
    const { action, target, expectedIndicator } = step;

    if (action === 'navigate') {
      const url = target.startsWith('http') ? target : new URL(target, baseUrl).href;
      try {
        // Wait for page ready: DOMContentLoaded + conservative network idle heuristic
        const response = await this.browser.page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: this.options.timeout
        });
        
        if (!response) {
          return {
            success: false,
            error: `Navigation to ${url} failed: no response`
          };
        }

        // Wait for page to settle (network idle heuristic)
        await this._waitForPageReady();

        // Verify we landed on expected page
        const currentUrl = this.browser.page.url();
        const pageTitle = await this.browser.page.title();
        const heading = await this._getMainHeading();

        // Take screenshot
        const screenshot = await this._takeScreenshot(`navigate-${step.id}`);

        return {
          success: true,
          url: currentUrl,
          finalUrl: currentUrl,
          pageTitle,
          mainHeadingText: heading,
          evidence: { screenshot }
        };
      } catch (err) {
        const screenshot = await this._takeScreenshot(`navigate-failed-${step.id}`);
        return {
          success: false,
          error: `Navigation to ${url} failed: ${err.message}`,
          evidence: { screenshot }
        };
      }
    }

    if (action === 'find_cta') {
      // Find a primary CTA element
      const cta = await this._findCTA();
      
      if (!cta) {
        return {
          success: false,
          error: 'No CTA found matching heuristics'
        };
      }

      return {
        success: true,
        url: this.browser.page.url(),
        cta: cta.text,
        evidence: { ctaFound: cta.text }
      };
    }

    if (action === 'click') {
      const selector = target;
      try {
        // Check if element is visible and clickable
        const element = this.browser.page.locator(selector);
        const count = await element.count();
        
        if (count === 0) {
          const screenshot = await this._takeScreenshot(`click-failed-${step.id}`);
          return {
            success: false,
            error: `Element not found: ${selector}`,
            evidence: { screenshot }
          };
        }

        const isVisible = await element.first().isVisible();
        if (!isVisible) {
          const screenshot = await this._takeScreenshot(`click-failed-${step.id}`);
          return {
            success: false,
            error: `Element not visible: ${selector}`,
            evidence: { screenshot }
          };
        }

        // Click and wait for navigation or content change
        const initialUrl = this.browser.page.url();
        await Promise.race([
          element.first().click(),
          new Promise(r => setTimeout(r, 1000))
        ]);

        // Wait for page to settle
        await this._waitForPageReady();

        const finalUrl = this.browser.page.url();
        const navigationOccurred = initialUrl !== finalUrl;
        const pageTitle = await this.browser.page.title();
        const heading = await this._getMainHeading();

        const screenshot = await this._takeScreenshot(`click-${step.id}`);

        return {
          success: true,
          url: finalUrl,
          finalUrl,
          pageTitle,
          mainHeadingText: heading,
          navigationOccurred,
          evidence: { screenshot, clicked: selector }
        };
      } catch (err) {
        const screenshot = await this._takeScreenshot(`click-failed-${step.id}`);
        return {
          success: false,
          error: `Click failed: ${err.message}`,
          evidence: { screenshot }
        };
      }
    }

    return {
      success: false,
      error: `Unknown action: ${action}`
    };
  }

  /**
   * Find a primary CTA using heuristics
   */
  async _findCTA() {
    try {
      const ctas = await this.browser.page.evaluate(() => {
        const keywords = [
          'sign up', 'signup', 'get started', 'start', 'register',
          'pricing', 'try', 'buy', 'demo', 'contact us', 'contact'
        ];

        const elements = Array.from(document.querySelectorAll('a, button'));
        
        for (const el of elements) {
          const text = el.innerText?.trim().toLowerCase() || '';
          if (!text) continue;
          
          if (keywords.some(kw => text.includes(kw))) {
            return {
              text: el.innerText.trim(),
              href: el.href || el.getAttribute('onclick') || null,
              isButton: el.tagName === 'BUTTON',
              isLink: el.tagName === 'A'
            };
          }
        }
        return null;
      });

      return ctas;
    } catch (_err) {
      return null;
    }
  }

  /**
   * Wait for page to be ready (DOMContentLoaded + network idle heuristic)
   */
  async _waitForPageReady() {
    try {
      // Wait for a conservative network idle: no new requests for 300ms
      await this.browser.page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {
        // If networkidle times out, that's okay; just continue
      });
    } catch (_err) {
      // Ignore timeout, just move on
    }
  }

  /**
   * Extract main heading text from page
   */
  async _getMainHeading() {
    try {
      const heading = await this.browser.page.evaluate(() => {
        const h1 = document.querySelector('h1');
        if (h1) return h1.innerText.trim();
        
        const h2 = document.querySelector('h2');
        if (h2) return h2.innerText.trim();
        
        return null;
      });
      return heading || null;
    } catch (_err) {
      return null;
    }
  }

  /**
   * Classify errors into buckets
   */
  _classifyErrors(result) {
    if (result.executedSteps.length === 0) {
      return {
        type: 'SITE_UNREACHABLE',
        reason: 'Could not load initial page'
      };
    }

    if (result.failedSteps.length === 0) {
      return {
        type: 'NO_ERRORS',
        reason: 'All steps completed successfully'
      };
    }

    // Analyze failures
    const hasNavigationFailure = result.failedSteps.some(fs => {
      const step = result.executedSteps.find(s => s.id === fs);
      return step && step.action === 'navigate';
    });

    const hasCTAFailure = result.failedSteps.some(fs => {
      const step = result.executedSteps.find(s => s.id === fs);
      return step && step.action === 'find_cta';
    });

    if (hasNavigationFailure) {
      return {
        type: 'NAVIGATION_BLOCKED',
        reason: 'User cannot navigate to critical pages'
      };
    }

    if (hasCTAFailure) {
      return {
        type: 'CTA_NOT_FOUND',
        reason: 'Cannot find key conversion elements'
      };
    }

    return {
      type: 'ELEMENT_NOT_FOUND',
      reason: 'Some interactive elements are broken'
    };
  }

  /**
   * Decide SAFE/RISK/DO_NOT_LAUNCH
   */
  _decideOutcome(result) {
    const executedCount = result.executedSteps.length;
    const failedCount = result.failedSteps.length;
    const goalKnown = result.goal && typeof result.goal.goalReached === 'boolean';
    const goalReached = goalKnown ? !!result.goal.goalReached : true;

    // Total failure
    if (executedCount > 0 && failedCount === executedCount) {
      return 'DO_NOT_LAUNCH';
    }

    // No errors at all → require goal reached for SAFE
    if (failedCount === 0 && executedCount > 0) {
      return goalReached ? 'SAFE' : 'RISK';
    }

    // Partial failure = RISK
    if (failedCount > 0 && executedCount > failedCount) {
      return 'RISK';
    }

    // Unclear state
    return 'DO_NOT_LAUNCH';
  }

  /**
   * Capture evidence from a step
   */
  _captureEvidence(stepResult) {
    this.evidence.push({
      timestamp: new Date().toISOString(),
      step: stepResult,
      screenshot: stepResult.evidence?.screenshot
    });
  }

  /**
   * Take a screenshot if directory configured
   */
  async _takeScreenshot(name) {
    if (!this.options.screenshotDir) return null;

    try {
      const screenshotPath = path.join(
        this.options.screenshotDir,
        `${name}-${Date.now()}.png`
      );

      if (!fs.existsSync(this.options.screenshotDir)) {
        fs.mkdirSync(this.options.screenshotDir, { recursive: true });
      }

      await this.browser.page.screenshot({ path: screenshotPath });
      return screenshotPath;
    } catch (_err) {
      // Screenshot failed but don't fail the whole journey
      return null;
    }
  }

  /**
   * Cleanup
   */
  async _cleanup() {
    try {
      if (this.browser?.context) {
        await this.browser.context.close();
      }
      if (this.browser?.browser) {
        await this.browser.browser.close();
      }
    } catch (_err) {
      // Ignore cleanup errors
    }
  }

  /**
   * Human goal validation
   */
  async _evaluateHumanGoal(preset) {
    try {
      const page = this.browser.page;
      const url = page.url().toLowerCase();
      const ctx = await page.evaluate(() => {
        const text = (document.body.innerText || '').toLowerCase();
        const hasEmail = !!document.querySelector('input[type="email"], input[name*="email" i]');
        const hasForm = !!document.querySelector('form');
        const hasContact = text.includes('contact');
        const hasCheckoutKW = /checkout|cart|add to cart|purchase|order/.test(text);
        const hasSignupKW = /sign up|signup|subscribe|get started|register/.test(text);
        return { text, hasEmail, hasForm, hasContact, hasCheckoutKW, hasSignupKW };
      });

      if (preset === 'saas') {
        const reached = url.includes('/signup') || url.includes('/account/signup') || url.includes('/pricing')
          || (ctx.hasForm && ctx.hasEmail) || ctx.hasSignupKW;
        return {
          goalReached: !!reached,
          goalDescription: 'Signup or pricing accessible with visible form or CTA'
        };
      }

      if (preset === 'shop') {
        const reached = url.includes('/cart') || url.includes('/checkout') || ctx.hasCheckoutKW;
        return {
          goalReached: !!reached,
          goalDescription: 'Cart or checkout reachable'
        };
      }

      // landing
      const reached = (ctx.hasForm && (ctx.hasEmail || /name|message/.test(ctx.text))) || ctx.hasContact;
      return {
        goalReached: !!reached,
        goalDescription: 'Contact form or section visible'
      };
    } catch (_e) {
      return { goalReached: false, goalDescription: 'Goal evaluation unavailable' };
    }
  }
}

module.exports = { JourneyScanner };
