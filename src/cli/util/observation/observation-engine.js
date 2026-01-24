import { getTimeProvider } from '../support/time-provider.js';
import { chromium } from 'playwright';
import { writeFileSync as _writeFileSync, mkdirSync as _mkdirSync } from 'fs';
import { resolve as _resolve } from 'path';
import { redactHeaders, redactUrl, redactBody, redactConsole, getRedactionCounters } from '../evidence/redact.js';
import { InteractionPlanner } from './interaction-planner.js';
import { computeDigest } from '../evidence/digest-engine.js';
import { createTestModeStub } from './test-mode-stub.js';
import { injectRouteSensor } from './route-sensor.js';
import { applyAuth, buildAuthContextOptions } from '../auth/auth-applier.js';
import { buildAuthArtifact } from '../auth/auth-utils.js';
import { verifyAuthEffectiveness } from '../auth/auth-verifier.js';
import { discoverRuntimeNavigation, createRuntimeNavExpectation } from './runtime-navigation-discovery.js';
import { hasAuthInput } from '../auth/auth-config.js';

/**
 * PHASE H3/M3 - Real Browser Observation Engine
 * Uses Interaction Planner to execute promises with evidence capture
 * H5: Added read-only safety mode by default
 * PHASE 1: Added universal route sensor for SPA navigation detection
 */

/**
 * Initialize browser and page with standard configuration
 */
async function setupBrowserAndPage(authConfig, redactionCounters, browserFactory = chromium.launch) {
  const browser = await browserFactory({ headless: true });
  const { contextOptions: rawContextOptions = {}, authResult } = buildAuthContextOptions(authConfig, redactionCounters);

  /** @type {import('playwright').BrowserContextOptions} */
  const contextOptions = rawContextOptions || {};
  const { extraHTTPHeaders, ...restContextOptions } = contextOptions;
  const ctxHeaders = extraHTTPHeaders && Object.keys(extraHTTPHeaders).length > 0
    ? extraHTTPHeaders
    : undefined;

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    ...(ctxHeaders ? { extraHTTPHeaders: ctxHeaders } : {}),
    ...restContextOptions,
  });

  const page = await context.newPage();
  const appliedAuth = await applyAuth(context, page, authConfig, authResult, redactionCounters);

  return { browser, context, page, authResult: appliedAuth };
}

/**
 * Set up network and console event monitoring with redaction
 */
function setupNetworkAndConsoleMonitoring(page, planner, redactionCounters, _onProgress) {
  const timeProvider = getTimeProvider();
  const networkRecordingStartTime = timeProvider.now();
  
  // H5: Route handler for blocking mutating requests (MUST be before page.on)
  page.route('**/*', async (route) => {
    const request = route.request();
    const method = request.method();
    
    if (planner.shouldBlockRequest(method)) {
      const redactedUrl = redactUrl(request.url(), redactionCounters);
      planner.blockedRequests.push({
        url: redactedUrl,
        method: method,
        reason: 'write-blocked-read-only-mode',
        timestamp: getTimeProvider().iso(),
      });
      await route.abort('blockedbyclient');
      return;
    }
    
    await route.continue();
  });
  
  page.on('request', (request) => {
    const redactedHeaders = redactHeaders(request.headers(), redactionCounters);
    const redactedUrl = redactUrl(request.url(), redactionCounters);
    let redactedBody = null;
    try {
      const body = request.postData();
      redactedBody = body ? redactBody(body, redactionCounters) : null;
    } catch {
      redactedBody = null;
    }

    const event = {
      url: redactedUrl,
      method: request.method(),
      headers: redactedHeaders,
      body: redactedBody,
      timestamp: getTimeProvider().iso(),
      relativeMs: timeProvider.now() - networkRecordingStartTime,
    };
    
    planner.recordNetworkEvent(event);
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      const redactedText = redactConsole(msg.text(), redactionCounters);
      planner.recordConsoleEvent({
        type: msg.type(),
        text: redactedText,
        timestamp: getTimeProvider().iso(),
      });
    }
  });
}

/**
 * Navigate to base URL and inject route sensor
 */
async function navigateToBaseUrl(page, url, onProgress) {
  let initialStatus = null;
  let finalUrl = null;
  try {
    const response = await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    initialStatus = response?.status?.() ?? null;
    finalUrl = response?.url?.() ?? null;
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    
    // PHASE 1: Inject route sensor after page load
    const routeSensorResult = await injectRouteSensor(page);
    if (!routeSensorResult.injected && onProgress) {
      onProgress({
        event: 'observe:warning',
        message: `Route sensor injection failed: ${routeSensorResult.error}`,
      });
    }
  } catch (error) {
    if (onProgress) {
      onProgress({
        event: 'observe:warning',
        message: `Failed to load base URL: ${error.message}`,
      });
    }
  }

  return { initialStatus, finalUrl: finalUrl || page.url?.() || url };
}

export async function observeExpectations(expectations, url, evidencePath, onProgress, _options = {}) {
  // TEST MODE FAST PATH: Skip browser work entirely for determinism and speed
  if (process.env.VERAX_TEST_MODE === '1') {
    return createTestModeStub(expectations, url);
  }

  // Forced timeout fast path: simulate an incomplete run without launching browser
  if (process.env.VERAX_TEST_FORCE_TIMEOUT === '1') {
    const stub = createTestModeStub(expectations, url);
    stub.status = 'INCOMPLETE';
    if (!stub.stability.incompleteReasons.includes('observe:timeout')) {
      stub.stability.incompleteReasons.push('observe:timeout');
    }
    return stub;
  }

  const observations = [];
  const redactionCounters = { headersRedacted: 0, tokensRedacted: 0 };
  let browser = null;
  let page = null;
  let _context = null;
  let planner = null;
  
  // Stability tracking
  const stability = {
    retries: {
      attempted: 0,
      succeeded: 0,
      exhausted: 0,
    },
    incompleteReasons: [],
    incompleteInteractions: 0,
    flakeSignals: {
      sensorMissing: 0,
    }
  };
  
  let status = 'COMPLETE';

  const runtimeNavConfig = _options.runtimeNavigation || {};
  const runtimeNavEnabled = runtimeNavConfig.enabled !== false;
  const runtimeNavMaxTargets = runtimeNavConfig.maxTargets || 25;
  const runtimeNavAllowCrossOrigin = runtimeNavConfig.allowCrossOrigin || false;

  try {
    // Check for forced timeout test pattern
    if (process.env.VERAX_TEST_FORCE_TIMEOUT === '1') {
      status = 'INCOMPLETE';
      stability.incompleteReasons.push('observe:timeout');
    }

    // Initialize browser and page with auth-aware context
    const browserFactory = _options.browserFactory || chromium.launch;
    const authConfig = _options.authConfig || {};
    const authMode = authConfig.authMode || 'auto';
    let authResult = null;
    let authVerification = null;
    let authArtifact = buildAuthArtifact(null, authMode, null, redactionCounters);
    const authVerifier = _options.authVerifier || verifyAuthEffectiveness;

    const browserSetup = await setupBrowserAndPage(authConfig, redactionCounters, browserFactory);
    browser = browserSetup.browser;
    _context = browserSetup.context;
    page = browserSetup.page;
    authResult = browserSetup.authResult;

    if (authResult?.errors?.length) {
      if (authMode === 'strict') {
        throw new Error(`[INFRA_AUTH_FAILURE] ${authResult.errors.join(', ')}`);
      }
      if (onProgress) {
        onProgress({
          event: 'observe:warning',
          message: `Auth warnings: ${authResult.errors.join(', ')}`,
        });
      }
    }

    // Create interaction planner (read-only mode enforced)
    planner = new InteractionPlanner(page, evidencePath, {});

    // Set up network monitoring (H5: with write-blocking)
    setupNetworkAndConsoleMonitoring(page, planner, redactionCounters, onProgress);

    // Navigate to base URL
    const navSignals = await navigateToBaseUrl(page, url, onProgress);

      if (authMode !== 'off' && hasAuthInput(authConfig) && authResult?.applied) {
      authVerification = await authVerifier(page, url, navSignals, redactionCounters);
      authArtifact = buildAuthArtifact(authResult, authMode, authVerification, redactionCounters);

        enforceStrictAuth(authMode, authArtifact, onProgress);

      if (authArtifact.verification?.effective === 'no' && onProgress) {
        onProgress({
          event: 'observe:warning',
          message: `Auth may be ineffective: ${JSON.stringify(authArtifact.verification?.signals || {})}`,
        });
      }
    } else {
      authArtifact = buildAuthArtifact(authResult, authMode, authVerification, redactionCounters);
    }

    // Discover runtime navigation expectations (post-load, runtime DOM only)
    let runtimeExpectations = [];
    let _shadowDiscovered = 0;
    let _iframeSameOriginDiscovered = 0;
    let _iframeCrossOriginSkipped = 0;
    if (runtimeNavEnabled) {
      try {
        // Main document discovery (includes shadow DOM)
        const mainTargets = await discoverRuntimeNavigation(page, {
          baseUrl: url,
          allowCrossOrigin: runtimeNavAllowCrossOrigin,
          maxTargets: runtimeNavMaxTargets
        });

        // Iframe discovery (same-origin only)
        const allTargets = [...mainTargets];
        try {
          const mainOrigin = new URL(url).origin;
          for (const f of page.frames()) {
            try {
              const fUrl = f.url();
              if (!fUrl) continue;
              const fOrigin = new URL(fUrl).origin;
              if (fOrigin !== mainOrigin) {
                _iframeCrossOriginSkipped++;
                continue;
              }
              // @ts-expect-error - Frame is compatible with Page for discoverRuntimeNavigation
              const fTargets = await discoverRuntimeNavigation(f, {
                baseUrl: fUrl,
                allowCrossOrigin: runtimeNavAllowCrossOrigin,
                maxTargets: runtimeNavMaxTargets
              });
              for (const t of fTargets) {
                allTargets.push({ ...t, sourceKind: 'iframe', frameUrl: fUrl });
              }
            } catch {
              _iframeCrossOriginSkipped++;
            }
          }
        } catch {
          // Ignore frame enumeration errors
        }

        runtimeExpectations = allTargets.map((target) => {
          if (target.sourceKind === 'shadow-dom') _shadowDiscovered++;
          if (target.sourceKind === 'iframe') _iframeSameOriginDiscovered++;

          const runtimeExp = createRuntimeNavExpectation(target, 'observe-phase');
          const selector = target.selectorPath || runtimeExp.source?.selectorPath || null;
          const rawHref = target.attributes?.href || target.href || target.normalizedHref;

          return {
            ...runtimeExp,
            type: 'navigation',
            category: 'navigation',
            selector,
            expectedOutcome: 'navigation',
            promise: {
              ...runtimeExp.promise,
              value: runtimeExp.promise?.value || target.normalizedHref,
              rawHref,
              selector
            },
            source: runtimeExp.source || { type: 'runtime-dom', selectorPath: selector },
            isRuntimeNav: true,
            runtimeNav: {
              href: target.href,
              normalizedHref: target.normalizedHref,
              selectorPath: target.selectorPath,
              targetId: runtimeExp.id,
              tagName: target.tagName,
              attributes: target.attributes,
              discoveredAt: 'observe-phase',
              context: target.sourceKind === 'iframe' ? { kind: 'iframe', frameUrl: target.frameUrl } : (target.sourceKind === 'shadow-dom' ? { kind: 'shadow-dom', hostTagName: target.hostTagName || null } : null)
            }
          };
        });
      } catch (error) {
        if (onProgress) {
          onProgress({
            event: 'observe:warning',
            message: `Runtime navigation discovery failed: ${error.message}`,
          });
        }
      }
    }

    const executionPlan = [...expectations, ...runtimeExpectations];

    const resetToBasePage = async () => {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
        await injectRouteSensor(page);
      } catch (error) {
        if (onProgress) {
          onProgress({
            event: 'observe:warning',
            message: `Runtime navigation reset failed: ${error.message}`,
          });
        }
      }
    };

    // Execute each promise via interaction planner (static + runtime)
    for (let i = 0; i < executionPlan.length; i++) {
      const exp = executionPlan[i];
      const expNum = i + 1;

      if (exp.isRuntimeNav) {
        await resetToBasePage();
      }

      if (onProgress) {
        onProgress({
          event: 'observe:attempt',
          index: expNum,
          total: executionPlan.length,
          type: exp.type,
          category: exp.category,
          promise: exp.promise,
        });
      }

      // Execute the promise
      const attempt = await planner.executeSinglePromise(exp, expNum);

      // Convert attempt to observation
      const observation = {
        id: exp.id,
        type: exp.type,
        category: exp.category,
        promise: exp.promise,
        source: exp.source,
        isRuntimeNav: Boolean(exp.isRuntimeNav),
        runtimeNav: exp.runtimeNav || null,
        attempted: attempt.attempted,
        observed: attempt.signals ? Object.values(attempt.signals).some(v => v === true) : false,
        action: attempt.action,
        reason: attempt.reason,
        observedAt: getTimeProvider().iso(),
        evidenceFiles: attempt.evidence?.files || [],
        evidence: attempt.evidence,
        signals: attempt.signals,
      };

      markAuthRequiredIfNeeded(observation, authArtifact);

      observations.push(observation);

      if (onProgress) {
        onProgress({
          event: 'observe:result',
          index: expNum,
          attempted: observation.attempted,
          observed: observation.observed,
          reason: observation.reason,
        });
      }

      if (exp.isRuntimeNav) {
        await resetToBasePage();
      }
    }

    // Count results
    const observed = observations.filter(o => o.observed).length;
    const attempted = observations.filter(o => o.attempted).length;
    const notObserved = attempted - observed;

    const runtimeExecuted = observations.filter(o => o.isRuntimeNav).length;
    const runtimeSummary = {
      discoveredCount: runtimeExpectations.length,
      executedCount: runtimeExecuted,
      excludedCount: Math.max(0, runtimeExpectations.length - runtimeExecuted),
      maxTargets: runtimeNavMaxTargets,
      allowCrossOrigin: runtimeNavAllowCrossOrigin,
      shadow: { discoveredCount: _shadowDiscovered, executedCount: observations.filter(o => o.isRuntimeNav && o.source?.kind === 'shadow-dom').length },
      iframes: { sameOriginDiscovered: _iframeSameOriginDiscovered, crossOriginSkipped: _iframeCrossOriginSkipped }
    };

    // H5: Compute deterministic digest for reproducibility proof
    const digest = computeDigest(executionPlan, observations, {
      framework: 'unknown', // Will be populated by caller
      url,
      version: '1.0',
    });

    // Collect skip reasons with structured codes
    const skippedReasons = {};
    for (const obs of observations) {
      if (!obs.attempted || !obs.observed) {
        const reason = obs.reason || 'unknown';
        skippedReasons[reason] = (skippedReasons[reason] || 0) + 1;
      }
    }

    return {
      observations,
      runtimeExpectations,
      runtime: runtimeSummary,
      stats: {
        totalExpectations: executionPlan.length,
        attempted,
        observed,
        completed: observed, // Alias for compatibility
        notObserved,
        skipped: notObserved,
        skippedReasons,
        blockedWrites: planner.getBlockedRequests().length, // H5: Include write-blocking stats
        coverageRatio: executionPlan.length > 0 ? (observed / executionPlan.length) : 1.0,
      },
      status,
      stability,
      blockedWrites: planner.getBlockedRequests(), // H5: Include details of blocked writes
      digest, // H5: Deterministic digest
      redaction: getRedactionCounters(redactionCounters),
      auth: authArtifact,
      observedAt: getTimeProvider().iso(),
    };
    
  } catch (error) {
    // Mark as incomplete on sensor failure
    if (error.message && error.message.includes('sensor')) {
      status = 'INCOMPLETE';
      stability.incompleteReasons.push('error:sensor-failure');
      stability.flakeSignals.sensorMissing = 1;
      stability.incompleteInteractions = observations.length;
    }
    
    // Re-throw if not a handled sensor failure
    throw error;
  } finally {
    // Cleanup
    if (page) {
      try {
        page.removeAllListeners();
        await page.close().catch(() => {});
      } catch (e) {
        if (onProgress) {
          onProgress({
            event: 'observe:warning',
            message: `Page cleanup warning: ${e.message}`,
          });
        }
      }
    }
    
    if (browser) {
      try {
        const contexts = browser.contexts();
        for (const context of contexts) {
          try {
            await context.close().catch(() => {});
          } catch (e) {
            // Ignore
          }
        }
        await browser.close().catch(() => {});
      } catch (e) {
        if (onProgress) {
          onProgress({
            event: 'observe:warning',
            message: `Browser cleanup warning: ${e.message}`,
          });
        }
      }
    }
  }
}

export function enforceStrictAuth(authMode, authArtifact, onProgress) {
  const ineffective = authArtifact?.verification?.effective === 'no';
  if (authMode === 'strict' && ineffective) {
    if (onProgress) {
      onProgress({
        event: 'observe:error',
        message: `Auth ineffective (strict mode): ${JSON.stringify(authArtifact?.verification?.signals || {})}`,
      });
    }
    throw new Error('[INFRA_AUTH_INEFFECTIVE] Authentication appears ineffective');
  }
}

export function markAuthRequiredIfNeeded(observation, authArtifact) {
  const strongAuthNo = authArtifact?.verification?.effective === 'no';
  if (strongAuthNo && observation.attempted && !observation.observed && (observation.reason === 'outcome-not-met' || observation.reason === null)) {
    observation.reason = 'auth_required';
  }
}




