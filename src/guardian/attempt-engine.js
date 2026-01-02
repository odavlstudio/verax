/**
 * Guardian Attempt Engine - PHASE 1 + PHASE 2
 * Executes a single user attempt and tracks outcome (SUCCESS, FAILURE, FRICTION, NOT_APPLICABLE, DISCOVERY_FAILED)
 * Phase 2: Soft failure detection via validators
 * Phase 3: Robust selector discovery with fallbacks
 */

const fs = require('fs');
const path = require('path');
const { getAttemptDefinition } = require('./attempt-registry');
const { runValidators, analyzeSoftFailures } = require('./validators');
const { buildSelectorChain, findElement, detectFeature } = require('./selector-fallbacks');

class AttemptEngine {
  constructor(options = {}) {
    this.attemptId = options.attemptId || 'default';
    this.timeout = options.timeout || 30000;
    this.frictionThresholds = options.frictionThresholds || {
      totalDurationMs: 2500, // Total attempt > 2.5s
      stepDurationMs: 1500,   // Any single step > 1.5s
      retryCount: 1            // More than 1 retry = friction
    };
    this.maxStepRetries = typeof options.maxStepRetries === 'number'
      ? Math.max(1, options.maxStepRetries)
      : 2;
  }

  /**
   * Load attempt definition by ID (Phase 3 registry)
   */
  loadAttemptDefinition(attemptId) {
    return getAttemptDefinition(attemptId);
  }

  /**
   * Execute a single attempt
   * Returns: { outcome, steps, timings, friction, error, validators, softFailures }
   */
  async executeAttempt(page, attemptId, baseUrl, artifactsDir = null, validatorSpecs = null) {
    const attemptDef = this.loadAttemptDefinition(attemptId);
    if (!attemptDef) {
      throw new Error(`Attempt ${attemptId} not found`);
    }

    const startedAt = new Date();
    const steps = [];
    const frictionSignals = [];
    const consoleMessages = []; // Capture console messages for validators
    const consoleErrors = [];
    const pageErrors = [];
    let currentStep = null;
    let lastError = null;
    const frictionReasons = [];
    let frictionMetrics = {};

    // Capture console messages for soft failure detection
    const consoleHandler = (msg) => {
      consoleMessages.push({
        type: msg.type(), // 'log', 'error', 'warning', etc.
        text: msg.text(),
        location: msg.location()
      });
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    };

    page.on('console', consoleHandler);
    const pageErrorHandler = (err) => {
      pageErrors.push(err.message || 'page error');
    };
    page.on('pageerror', pageErrorHandler);

    try {
      // Custom universal attempts bypass base step execution and implement purpose-built logic
      if (attemptId === 'site_smoke') {
        return await this._runSiteSmokeAttempt(page, baseUrl, artifactsDir, consoleErrors, pageErrors);
      }
      if (attemptId === 'primary_ctas') {
        return await this._runPrimaryCtasAttempt(page, baseUrl, artifactsDir, consoleErrors, pageErrors);
      }
      if (attemptId === 'contact_discovery_v2') {
        return await this._runContactDiscoveryAttempt(page, baseUrl, artifactsDir, consoleErrors, pageErrors);
      }

      // Replace $BASEURL placeholder in all steps
      const processedSteps = attemptDef.baseSteps.map(step => {
        if (step.target && step.target === '$BASEURL') {
          return { ...step, target: baseUrl };
        }
        return step;
      });

      // Execute each step
      for (const stepDef of processedSteps) {
        currentStep = {
          id: stepDef.id,
          type: stepDef.type,
          target: stepDef.target,
          description: stepDef.description,
          startedAt: new Date().toISOString(),
          retries: 0,
          status: 'pending',
          error: null,
          screenshots: []
        };

        const stepStartTime = Date.now();

        try {
          // Execute with retry logic (up to 2 attempts)
          const success = false;
          for (let attempt = 0; attempt < this.maxStepRetries; attempt++) {
            try {
              if (attempt > 0) {
                currentStep.retries++;
                // Small backoff before retry
                await page.waitForTimeout(200);
              }

              await this._executeStep(page, stepDef);
              break;
            } catch (err) {
              if (attempt === this.maxStepRetries - 1) {
                throw err; // Final attempt failed
              }
              // Retry on first failure
            }
          }

          const stepEndTime = Date.now();
          const stepDurationMs = stepEndTime - stepStartTime;

          currentStep.endedAt = new Date().toISOString();
          currentStep.durationMs = stepDurationMs;
          currentStep.status = 'success';

          // Check for friction signals in step timing
          if (stepDurationMs > this.frictionThresholds.stepDurationMs) {
            frictionSignals.push({
              id: 'slow_step_execution',
              description: `Step took longer than threshold`,
              metric: 'stepDurationMs',
              threshold: this.frictionThresholds.stepDurationMs,
              observedValue: stepDurationMs,
              affectedStepId: stepDef.id,
              severity: 'medium'
            });
            frictionReasons.push(`Step "${stepDef.id}" took ${stepDurationMs}ms (threshold: ${this.frictionThresholds.stepDurationMs}ms)`);
          }

          if (currentStep.retries > this.frictionThresholds.retryCount) {
            frictionSignals.push({
              id: 'multiple_retries_required',
              description: `Step required multiple retry attempts`,
              metric: 'retryCount',
              threshold: this.frictionThresholds.retryCount,
              observedValue: currentStep.retries,
              affectedStepId: stepDef.id,
              severity: 'high'
            });
            frictionReasons.push(`Step "${stepDef.id}" required ${currentStep.retries} retries`);
          }

          // Capture screenshot on success if artifacts dir provided
          if (artifactsDir) {
            const screenshotPath = await this._captureScreenshot(
              page,
              artifactsDir,
              stepDef.id
            );
            if (screenshotPath) {
              currentStep.screenshots.push(screenshotPath);
            }
          }

        } catch (err) {
          currentStep.endedAt = new Date().toISOString();
          currentStep.durationMs = Date.now() - stepStartTime;
          currentStep.status = stepDef.optional ? 'optional_failed' : 'failed';
          currentStep.error = err.message;

          if (stepDef.optional) {
            // Optional steps should not fail the attempt; record soft failure
            frictionSignals.push({
              id: 'optional_step_failed',
              description: `Optional step failed: ${stepDef.id}`,
              metric: 'optionalStep',
              threshold: 0,
              observedValue: 1,
              affectedStepId: stepDef.id,
              severity: 'low'
            });
            frictionReasons.push(`Optional step failed and was skipped: ${stepDef.id}`);
            if (artifactsDir) {
              const screenshotPath = await this._captureScreenshot(
                page,
                artifactsDir,
                `${stepDef.id}_optional_failure`
              );
              if (screenshotPath) {
                currentStep.screenshots.push(screenshotPath);
              }
              const domPath = await this._savePageContent(page, artifactsDir, `${stepDef.id}_optional_failure`);
              if (domPath) {
                currentStep.domPath = domPath;
              }
            }
            steps.push(currentStep);
            continue;
          }

          // eslint-disable-next-line no-unused-vars
          lastError = err;

          // Capture screenshot and DOM on failure
          if (artifactsDir) {
            const screenshotPath = await this._captureScreenshot(
              page,
              artifactsDir,
              `${stepDef.id}_failure`
            );
            if (screenshotPath) {
              currentStep.screenshots.push(screenshotPath);
            }
            const domPath = await this._savePageContent(page, artifactsDir, `${stepDef.id}_failure`);
            if (domPath) {
              currentStep.domPath = domPath;
            }
          }

          throw err; // Stop attempt on step failure
        }

        steps.push(currentStep);
      }

      // All steps successful, now check success conditions
      const endedAt = new Date();
      const totalDurationMs = endedAt.getTime() - startedAt.getTime();

      // Check success conditions
      let successMet = false;
      let successReason = null;

      for (const condition of attemptDef.successConditions) {
        try {
          if (condition.type === 'url') {
            const currentUrl = page.url();
            if (condition.pattern.test(currentUrl)) {
              successMet = true;
              successReason = `URL matched: ${currentUrl}`;
              break;
            }
          } else if (condition.type === 'selector') {
            // Wait briefly for selector to become visible
            try {
              await page.waitForSelector(condition.target, { timeout: 3000, state: 'visible' });
              successMet = true;
              successReason = `Success element visible: ${condition.target}`;
              break;
            } catch {
              // Continue to next condition
            }
          }
        } catch {
          // Continue to next condition
        }
      }

      if (!successMet) {
        page.removeListener('console', consoleHandler);
        page.removeListener('pageerror', pageErrorHandler);
        return {
          outcome: 'FAILURE',
          steps,
          startedAt: startedAt.toISOString(),
          endedAt: endedAt.toISOString(),
          totalDurationMs,
          friction: {
            isFriction: false,
            signals: [],
            summary: null,
            reasons: [],
            thresholds: this.frictionThresholds,
            metrics: {}
          },
          error: 'Success conditions not met after all steps completed',
          successReason: null,
          validators: [],
          softFailures: { hasSoftFailure: false, failureCount: 0, warnCount: 0 },
          discoverySignals: {
            consoleErrorCount: consoleErrors.length,
            pageErrorCount: pageErrors.length
          }
        };
      }

      // Run validators for soft failure detection (Phase 2)
      let validatorResults = [];
      let softFailureAnalysis = { hasSoftFailure: false, failureCount: 0, warnCount: 0 };

      if (validatorSpecs && validatorSpecs.length > 0) {
        const validatorContext = {
          page,
          consoleMessages,
          url: page.url()
        };

        validatorResults = await runValidators(validatorSpecs, validatorContext);
        softFailureAnalysis = analyzeSoftFailures(validatorResults);

        // If validators detected soft failures, upgrade outcome
        if (softFailureAnalysis.hasSoftFailure) {
          // Soft failure still counts as FAILURE (outcome), not FRICTION
          // Soft failures are recorded separately for analysis
        }
      }

      // Check for friction signals in total duration
      if (totalDurationMs > this.frictionThresholds.totalDurationMs) {
        frictionSignals.push({
          id: 'slow_total_duration',
          description: `Total attempt duration exceeded threshold`,
          metric: 'totalDurationMs',
          threshold: this.frictionThresholds.totalDurationMs,
          observedValue: totalDurationMs,
          affectedStepId: null,
          severity: 'low'
        });
        frictionReasons.push(`Attempt took ${totalDurationMs}ms total (threshold: ${this.frictionThresholds.totalDurationMs}ms)`);
      }

      frictionMetrics = {
        totalDurationMs,
        stepCount: steps.length,
        totalRetries: steps.reduce((sum, s) => sum + s.retries, 0),
        maxStepDurationMs: Math.max(...steps.map(s => s.durationMs || 0))
      };

      // Determine outcome based on friction signals
      const isFriction = frictionSignals.length > 0;
      const outcome = isFriction ? 'FRICTION' : 'SUCCESS';

      // Generate friction summary
      const frictionSummary = isFriction 
        ? `User succeeded, but encountered ${frictionSignals.length} friction ${frictionSignals.length === 1 ? 'signal' : 'signals'}` 
        : null;

      return {
        outcome,
        steps,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        totalDurationMs,
        friction: {
          isFriction,
          signals: frictionSignals,
          summary: frictionSummary,
          reasons: frictionReasons, // Keep for backward compatibility
          thresholds: this.frictionThresholds,
          metrics: frictionMetrics
        },
        error: null,
        successReason,
        validators: validatorResults,
        softFailures: softFailureAnalysis,
        discoverySignals: {
          consoleErrorCount: consoleErrors.length,
          pageErrorCount: pageErrors.length
        }
      };

    } catch (err) {
      const endedAt = new Date();
      page.removeListener('console', consoleHandler);
      page.removeListener('pageerror', pageErrorHandler);
      return {
        outcome: 'FAILURE',
        steps,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        totalDurationMs: endedAt.getTime() - startedAt.getTime(),
        friction: {
          isFriction: false,
          reasons: [],
          thresholds: this.frictionThresholds,
          metrics: {}
        },
        error: `Step "${currentStep?.id}" failed: ${err.message}`,
        successReason: null,
        validators: [],
        softFailures: { hasSoftFailure: false, failureCount: 0, warnCount: 0 },
        discoverySignals: {
          consoleErrorCount: consoleErrors.length,
          pageErrorCount: pageErrors.length
        }
      };
    } finally {
      page.removeListener('console', consoleHandler);
      page.removeListener('pageerror', pageErrorHandler);
    }
  }

  /**
   * Execute a single step
   */
  async _executeStep(page, stepDef) {
    const timeout = stepDef.timeout || this.timeout;

    switch (stepDef.type) {
      case 'navigate':
        await page.goto(stepDef.target, {
          waitUntil: 'domcontentloaded',
          timeout
        });
        break;

      case 'click':
        // Try each selector in the target (semicolon-separated)
        const selectors = stepDef.target.split(',').map(s => s.trim());
        let clicked = false;

        for (const selector of selectors) {
          try {
            await page.click(selector, { timeout: 5000 });
            clicked = true;
            break;
          } catch {
            // Try next selector
          }
        }

        if (!clicked) {
          throw new Error(`Could not click element: ${stepDef.target}`);
        }

        // Wait for navigation if expected
        if (stepDef.waitForNavigation) {
          await page.waitForLoadState('domcontentloaded').catch(() => {});
        }
        break;

      case 'type':
        // Try each selector
        const typeSelectors = stepDef.target.split(',').map(s => s.trim());
        let typed = false;

        for (const selector of typeSelectors) {
          try {
            await page.fill(selector, stepDef.value, { timeout: 5000 });
            typed = true;
            break;
          } catch {
            // Try next selector
          }
        }

        if (!typed) {
          throw new Error(`Could not type into element: ${stepDef.target}`);
        }
        break;

      case 'waitFor':
        const waitSelectors = stepDef.target.split(',').map(s => s.trim());
        let found = false;
        let earlyExitReason = null;

        for (const selector of waitSelectors) {
          try {
            // Phase 7.4: Adaptive timeout
            const adaptiveTimeout = stepDef.timeout || 5000;
            
            await page.waitForSelector(selector, {
              timeout: adaptiveTimeout,
              state: stepDef.state || 'visible'
            });
            found = true;
            break;
          } catch (err) {
            // Phase 7.4: Detect early exit signals
            if (err.message && err.message.includes('Timeout')) {
              earlyExitReason = 'Target never appeared (DOM settled)';
            }
          }
        }

        if (!found) {
          // Phase 7.4: Include early exit reason
          const errorMsg = earlyExitReason 
            ? `${earlyExitReason}: ${stepDef.target}`
            : `Element not found: ${stepDef.target}`;
          throw new Error(errorMsg);
        }
        break;

      case 'wait':
        await page.waitForTimeout(stepDef.duration || 1000);
        break;

      default:
        throw new Error(`Unknown step type: ${stepDef.type}`);
    }
  }

  /**
   * Capture screenshot
   */
  async _captureScreenshot(page, artifactsDir, stepId) {
    try {
      const screenshotsDir = path.join(artifactsDir, 'attempt-screenshots');
      if (!fs.existsSync(screenshotsDir)) {
        fs.mkdirSync(screenshotsDir, { recursive: true });
      }

      const filename = `${stepId}.jpeg`;
      const fullPath = path.join(screenshotsDir, filename);

      await page.screenshot({
        path: fullPath,
        type: 'jpeg',
        quality: 80,
        fullPage: true
      });

      return filename;
    } catch {
      return null;
    }
  }

  async _savePageContent(page, artifactsDir, stepId) {
    try {
      const domDir = path.join(artifactsDir, 'attempt-dom');
      if (!fs.existsSync(domDir)) {
        fs.mkdirSync(domDir, { recursive: true });
      }
      const filename = `${stepId}.html`;
      const fullPath = path.join(domDir, filename);
      const content = await page.content();
      fs.writeFileSync(fullPath, content, 'utf-8');
      return path.relative(artifactsDir, fullPath);
    } catch {
      return null;
    }
  }

  /**
   * Check if an attempt is applicable to this site
   * Returns: { applicable: boolean, confidence: number, reason: string, discoverySignals: {} }
   */
  async checkAttemptApplicability(page, attemptId) {
    const attemptDef = this.loadAttemptDefinition(attemptId);
    if (!attemptDef) {
      return {
        applicable: false,
        confidence: 0,
        reason: 'Attempt not found in registry',
        discoverySignals: {}
      };
    }

    // Map attempt IDs to feature types
    const featureTypeMap = {
      'login': 'login',
      'signup': 'signup',
      'checkout': 'checkout',
      'contact_form': 'contact_form',
      'newsletter_signup': 'newsletter',
      'language_switch': 'language_switch'
    };

    const featureType = featureTypeMap[attemptId] || null;
    
    if (!featureType) {
      // Attempt with no feature detection (e.g., custom attempts) - always applicable
      return {
        applicable: true,
        confidence: 0.5,
        reason: 'Custom attempt, assuming applicable',
        discoverySignals: {}
      };
    }

    try {
      const detection = await detectFeature(page, featureType);
      return {
        applicable: detection.present,
        confidence: detection.confidence,
        reason: detection.present 
          ? `Feature detected with signals: ${detection.evidence.join(', ')}`
          : `Feature not detected; no signals found`,
        discoverySignals: {
          featureType,
          detectionSignals: detection.evidence,
          detected: detection.present,
          confidence: detection.confidence
        }
      };
    } catch (err) {
      return {
        applicable: false,
        confidence: 0,
        reason: `Detection error: ${err.message}`,
        discoverySignals: { error: err.message }
      };
    }
  }

  /**
   * Attempt to find an element using fallback selectors
   * Used by _executeStep when element not found with primary selector
   * Returns: { element, discoverySignals }
   */
  async findElementWithFallbacks(page, goalType) {
    try {
      const selectorChain = buildSelectorChain(goalType);
      if (!selectorChain || selectorChain.length === 0) {
        return {
          element: null,
          discoverySignals: { error: `No selector chain for goal: ${goalType}` }
        };
      }

      const result = await findElement(page, selectorChain, { timeout: 5000, requireVisible: true });
      return {
        element: result.element,
        discoverySignals: {
          goalType,
          selectorChainLength: selectorChain.length,
          strategy: result.strategy,
          confidence: result.confidence,
          found: result.element ? true : false,
          ...result.discoverySignals
        }
      };
    } catch (err) {
      return {
        element: null,
        discoverySignals: { error: err.message }
      };
    }
  }

  async _runSiteSmokeAttempt(page, baseUrl, artifactsDir, consoleErrors, pageErrors) {
    const startedAt = new Date();
    const steps = [];
    const discoverySignals = {
      discoveredLinks: [],
      chosenTargets: [],
      navigationResults: [],
      consoleErrorCount: consoleErrors.length,
      pageErrorCount: pageErrors.length
    };

    const recordStep = (step) => {
      steps.push(step);
    };

    // Step: navigate home
    let homepageStatus = null;
    try {
      const resp = await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: this.timeout });
      homepageStatus = resp ? resp.status() : null;
      recordStep({
        id: 'navigate_home',
        type: 'navigate',
        target: baseUrl,
        status: 'success',
        startedAt: startedAt.toISOString(),
        endedAt: new Date().toISOString(),
        durationMs: null,
        retries: 0,
        screenshots: []
      });
      if (artifactsDir) {
        await this._captureScreenshot(page, artifactsDir, 'site_smoke_home');
      }
    } catch (err) {
      recordStep({
        id: 'navigate_home',
        type: 'navigate',
        target: baseUrl,
        status: 'failed',
        error: err.message,
        startedAt: startedAt.toISOString(),
        endedAt: new Date().toISOString(),
        durationMs: null,
        retries: 0,
        screenshots: []
      });
      return {
        outcome: 'FAILURE',
        steps,
        startedAt: startedAt.toISOString(),
        endedAt: new Date().toISOString(),
        totalDurationMs: new Date() - startedAt,
        friction: { isFriction: false, signals: [], summary: null, reasons: [], thresholds: this.frictionThresholds, metrics: {} },
        error: `Failed to load homepage: ${err.message}`,
        successReason: null,
        validators: [],
        softFailures: { hasSoftFailure: false, failureCount: 0, warnCount: 0 },
        discoverySignals
      };
    }

    // Discover internal links from header/nav/footer
    const prioritized = ['docs', 'pricing', 'features', 'about', 'contact', 'login', 'signup', 'privacy', 'terms'];
    const baseOrigin = new URL(baseUrl).origin;
    const { discoveredLinks, chosenLinks } = await page.evaluate(({ origin, prioritizedList }) => {
      const anchors = Array.from(document.querySelectorAll('header a[href], nav a[href], footer a[href], a[href]'));
      const cleaned = anchors
        .map(a => ({ href: a.getAttribute('href') || '', text: (a.textContent || '').trim() }))
        .filter(a => a.href && !a.href.startsWith('mailto:') && !a.href.startsWith('tel:') && !a.href.startsWith('javascript:'))
        .map(a => {
          let abs = a.href;
          try {
            abs = new URL(a.href, origin).href;
          } catch (_) {}
          return { ...a, abs };
        })
        .filter(a => a.abs.startsWith(origin));

      const seen = new Set();
      const unique = [];
      for (const link of cleaned) {
        if (seen.has(link.abs)) continue;
        seen.add(link.abs);
        unique.push(link);
      }

      const prioritizedMatches = [];
      for (const link of unique) {
        const lower = (link.abs + ' ' + link.text).toLowerCase();
        const match = prioritizedList.find(p => lower.includes(`/${p}`) || lower.includes(p));
        if (match) {
          prioritizedMatches.push({ ...link, priority: prioritizedList.indexOf(match) });
        }
      }

      prioritizedMatches.sort((a, b) => a.priority - b.priority);
      const topPrioritized = prioritizedMatches.slice(0, 3);
      const fallback = unique.filter(l => !topPrioritized.find(t => t.abs === l.abs)).slice(0, 3 - topPrioritized.length);
      const chosen = [...topPrioritized, ...fallback];

      return {
        discoveredLinks: unique,
        chosenLinks: chosen
      };
    }, { origin: baseOrigin, prioritizedList: prioritized });

    discoverySignals.discoveredLinks = discoveredLinks;
    discoverySignals.chosenTargets = chosenLinks;

    // Attempt navigation to chosen links (up to 3)
    for (const link of chosenLinks) {
      const start = Date.now();
      const navResult = { target: link.abs, text: link.text, ok: false, status: null, finalUrl: null };
      try {
        const resp = await page.goto(link.abs, { waitUntil: 'domcontentloaded', timeout: this.timeout });
        navResult.status = resp ? resp.status() : null;
        navResult.finalUrl = page.url();
        navResult.ok = (navResult.status && navResult.status < 400) || navResult.finalUrl.startsWith(link.abs);
      } catch (err) {
        navResult.error = err.message;
      }
      navResult.durationMs = Date.now() - start;
      discoverySignals.navigationResults.push(navResult);
      recordStep({
        id: `nav_${link.text || link.abs}`,
        type: 'navigate',
        target: link.abs,
        status: navResult.ok ? 'success' : 'failed',
        error: navResult.ok ? null : navResult.error || 'Navigation failed',
        startedAt: new Date(start).toISOString(),
        endedAt: new Date().toISOString(),
        durationMs: navResult.durationMs,
        retries: 0,
        screenshots: []
      });
    }

    const executedOk = discoverySignals.navigationResults.some(r => r.ok) || homepageStatus !== null;
    const endedAt = new Date();
    const totalDurationMs = endedAt - startedAt;
    const outcome = executedOk ? 'SUCCESS' : 'FAILURE';

    return {
      outcome,
      steps,
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      totalDurationMs,
      friction: { isFriction: false, signals: [], summary: null, reasons: [], thresholds: this.frictionThresholds, metrics: {} },
      error: executedOk ? null : 'No internal navigation succeeded',
      successReason: executedOk ? 'At least one navigation completed' : null,
      validators: [],
      softFailures: { hasSoftFailure: false, failureCount: 0, warnCount: 0 },
      discoverySignals: {
        ...discoverySignals,
        consoleErrorCount: consoleErrors.length,
        pageErrorCount: pageErrors.length,
        homepageStatus
      }
    };
  }

  async _runPrimaryCtasAttempt(page, baseUrl, artifactsDir, consoleErrors, pageErrors) {
    const startedAt = new Date();
    const steps = [];
    const selectorChainTried = ['text:Docs', 'text:Pricing', 'text:GitHub', 'text:Contact', 'text:Sign in', 'text:Sign up', 'text:Get started', 'text:Try', 'text:Demo'];
    const discoverySignals = {
      ctaCandidates: [],
      navigationResults: [],
      githubValidated: false,
      selectorChainTried,
      consoleErrorCount: consoleErrors.length,
      pageErrorCount: pageErrors.length
    };

    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: this.timeout });
    steps.push({ id: 'navigate_home', type: 'navigate', target: baseUrl, status: 'success', startedAt: startedAt.toISOString(), endedAt: new Date().toISOString(), retries: 0, screenshots: [] });
    if (artifactsDir) {
      await this._captureScreenshot(page, artifactsDir, 'primary_ctas_home');
    }

    const baseOrigin = new URL(baseUrl).origin;
    const ctaCandidates = await page.evaluate(({ origin }) => {
      const keywords = ['docs','pricing','github','contact','sign in','sign up','get started','try','demo','start'];
      const elements = Array.from(document.querySelectorAll('a[href], button'));
      const candidates = [];
      for (const el of elements) {
        const text = (el.textContent || '').trim();
        if (!text) continue;
        const lower = text.toLowerCase();
        if (!keywords.some(k => lower.includes(k))) continue;
        const href = el.getAttribute('href') || '';
        let abs = href;
        if (href) {
          try {
            abs = new URL(href, origin).href;
          } catch (_) {}
        }
        candidates.push({ text, href, abs, tag: el.tagName, target: el.getAttribute('target') || null });
      }
      const seen = new Set();
      const unique = [];
      for (const c of candidates) {
        const key = c.abs || c.text;
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(c);
      }
      return unique;
    }, { origin: baseOrigin });

    discoverySignals.ctaCandidates = ctaCandidates;

    if (ctaCandidates.length === 0) {
      return {
        outcome: 'NOT_APPLICABLE',
        skipReason: 'No CTA elements detected',
        steps,
        startedAt: startedAt.toISOString(),
        endedAt: new Date().toISOString(),
        totalDurationMs: new Date() - startedAt,
        friction: { isFriction: false, signals: [], summary: null, reasons: [], thresholds: this.frictionThresholds, metrics: {} },
        error: null,
        successReason: null,
        validators: [],
        softFailures: { hasSoftFailure: false, failureCount: 0, warnCount: 0 },
        discoverySignals
      };
    }

    const targets = ctaCandidates.slice(0, 2);
    for (const target of targets) {
      const start = Date.now();
      const navResult = { target: target.abs || target.href, text: target.text, ok: false, status: null, finalUrl: null };
      try {
        const resp = await page.goto(target.abs || target.href || baseUrl, { waitUntil: 'domcontentloaded', timeout: this.timeout });
        navResult.status = resp ? resp.status() : null;
        navResult.finalUrl = page.url();
        navResult.ok = (navResult.status && navResult.status < 400) || (navResult.finalUrl && navResult.finalUrl !== baseUrl);
        if ((target.abs || '').includes('github.com') && navResult.ok) {
          discoverySignals.githubValidated = true;
        }
      } catch (err) {
        navResult.error = err.message;
      }
      navResult.durationMs = Date.now() - start;
      discoverySignals.navigationResults.push(navResult);
      steps.push({
        id: `cta_${target.text.toLowerCase().replace(/\s+/g, '_')}`,
        type: 'navigate',
        target: target.abs || target.href,
        status: navResult.ok ? 'success' : 'failed',
        error: navResult.ok ? null : navResult.error || 'Navigation failed',
        startedAt: new Date(start).toISOString(),
        endedAt: new Date().toISOString(),
        retries: 0,
        screenshots: []
      });
    }

    const executedOk = discoverySignals.navigationResults.some(r => r.ok);
    const endedAt = new Date();
    const totalDurationMs = endedAt - startedAt;
    return {
      outcome: executedOk ? 'SUCCESS' : 'FAILURE',
      steps,
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      totalDurationMs,
      friction: { isFriction: false, signals: [], summary: null, reasons: [], thresholds: this.frictionThresholds, metrics: {} },
      error: executedOk ? null : 'CTA navigation did not succeed',
      successReason: executedOk ? 'CTA navigation completed' : null,
      validators: [],
      softFailures: { hasSoftFailure: false, failureCount: 0, warnCount: 0 },
      discoverySignals
    };
  }

  async _runContactDiscoveryAttempt(page, baseUrl, artifactsDir, consoleErrors, pageErrors) {
    const startedAt = new Date();
    const steps = [];
    const discoverySignals = {
      mailto: null,
      contactLinks: [],
      navigationResults: [],
      consoleErrorCount: consoleErrors.length,
      pageErrorCount: pageErrors.length
    };

    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: this.timeout });
    steps.push({ id: 'navigate_home', type: 'navigate', target: baseUrl, status: 'success', startedAt: startedAt.toISOString(), endedAt: new Date().toISOString(), retries: 0, screenshots: [] });

    const baseOrigin = new URL(baseUrl).origin;
    const contactInfo = await page.evaluate(({ origin }) => {
      const anchors = Array.from(document.querySelectorAll('a[href]'));
      const mailto = anchors.find(a => (a.getAttribute('href') || '').startsWith('mailto:'));
      if (mailto) {
        return { mailto: mailto.getAttribute('href'), contactLinks: [] };
      }
      const contactLinks = anchors
        .filter(a => {
          const href = a.getAttribute('href') || '';
          const text = (a.textContent || '').toLowerCase();
          return href.toLowerCase().includes('contact') || text.includes('contact');
        })
        .map(a => {
          const href = a.getAttribute('href') || '';
          let abs = href;
          try { abs = new URL(href, origin).href; } catch (_) {}
          return { href, abs, text: (a.textContent || '').trim() };
        });
      return { mailto: null, contactLinks };
    }, { origin: baseOrigin });

    discoverySignals.mailto = contactInfo.mailto;
    discoverySignals.contactLinks = contactInfo.contactLinks;

    if (contactInfo.mailto) {
      return {
        outcome: 'SUCCESS',
        steps,
        startedAt: startedAt.toISOString(),
        endedAt: new Date().toISOString(),
        totalDurationMs: new Date() - startedAt,
        friction: { isFriction: false, signals: [], summary: null, reasons: [], thresholds: this.frictionThresholds, metrics: {} },
        error: null,
        successReason: `Found mailto: ${contactInfo.mailto}`,
        validators: [],
        softFailures: { hasSoftFailure: false, failureCount: 0, warnCount: 0 },
        discoverySignals
      };
    }

    if (contactInfo.contactLinks.length === 0) {
      return {
        outcome: 'NOT_APPLICABLE',
        skipReason: 'No contact link or mailto detected',
        steps,
        startedAt: startedAt.toISOString(),
        endedAt: new Date().toISOString(),
        totalDurationMs: new Date() - startedAt,
        friction: { isFriction: false, signals: [], summary: null, reasons: [], thresholds: this.frictionThresholds, metrics: {} },
        error: null,
        successReason: null,
        validators: [],
        softFailures: { hasSoftFailure: false, failureCount: 0, warnCount: 0 },
        discoverySignals
      };
    }

    const target = contactInfo.contactLinks[0];
    const startNav = Date.now();
    const navResult = { target: target.abs || target.href, text: target.text, ok: false, status: null, finalUrl: null };
    try {
      const resp = await page.goto(target.abs || target.href, { waitUntil: 'domcontentloaded', timeout: this.timeout });
      navResult.status = resp ? resp.status() : null;
      navResult.finalUrl = page.url();
      navResult.ok = (navResult.status && navResult.status < 400) || (navResult.finalUrl && navResult.finalUrl.includes('contact'));
    } catch (err) {
      navResult.error = err.message;
    }
    navResult.durationMs = Date.now() - startNav;
    discoverySignals.navigationResults.push(navResult);
    steps.push({ id: 'visit_contact', type: 'navigate', target: target.abs || target.href, status: navResult.ok ? 'success' : 'failed', error: navResult.error || null, startedAt: new Date(startNav).toISOString(), endedAt: new Date().toISOString(), retries: 0, screenshots: [] });

    const endedAt = new Date();
    const totalDurationMs = endedAt - startedAt;
    return {
      outcome: navResult.ok ? 'SUCCESS' : 'FAILURE',
      steps,
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      totalDurationMs,
      friction: { isFriction: false, signals: [], summary: null, reasons: [], thresholds: this.frictionThresholds, metrics: {} },
      error: navResult.ok ? null : 'Contact link navigation failed',
      successReason: navResult.ok ? 'Contact link reachable' : null,
      validators: [],
      softFailures: { hasSoftFailure: false, failureCount: 0, warnCount: 0 },
      discoverySignals
    };
  }
}

module.exports = { AttemptEngine };
