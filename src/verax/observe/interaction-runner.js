import { resolve } from 'path';
import { captureScreenshot } from './evidence-capture.js';
import { isExternalUrl } from './domain-boundary.js';
import { captureDomSignature } from './dom-signature.js';
import { NetworkSensor } from './network-sensor.js';
import { ConsoleSensor } from './console-sensor.js';
import { UISignalSensor } from './ui-signal-sensor.js';
import { StateSensor } from './state-sensor.js';
import { NavigationSensor } from './navigation-sensor.js';
import { LoadingSensor } from './loading-sensor.js';
import { FocusSensor } from './focus-sensor.js';
import { AriaSensor } from './aria-sensor.js';
import { TimingSensor } from './timing-sensor.js';
import { HumanBehaviorDriver } from './human-driver.js';

// Import CLICK_TIMEOUT_MS from human-driver (re-export needed)
const CLICK_TIMEOUT_MS = 2000;

/**
 * SILENCE TRACKING: Mark timeout and record to silence tracker.
 * Timeouts are a form of silence - interaction attempted but outcome unknown.
 */
function markTimeoutPolicy(trace, phase, silenceTracker = null) {
  trace.policy = {
    ...(trace.policy || {}),
    timeout: true,
    reason: 'interaction_timeout',
    phase
  };
  
  // Track timeout as silence if tracker provided
  if (silenceTracker) {
    silenceTracker.record({
      scope: 'interaction',
      reason: phase === 'navigation' ? 'navigation_timeout' : 'interaction_timeout',
      description: `Timeout during ${phase} - outcome unknown`,
      context: {
        interaction: trace.interaction,
        phase,
        url: trace.before?.url
      },
      impact: 'unknown_behavior'
    });
  }
}

function computeDomChangedDuringSettle(samples) {
  if (!samples || samples.length < 3) {
    return false;
  }
  return samples[0] !== samples[1] || samples[1] !== samples[2];
}

async function captureSettledDom(page, scanBudget) {
  const samples = [];

  const sampleDom = async () => {
    const hash = await captureDomSignature(page);
    samples.push(hash);
  };

  // Use shorter stabilization for file:// fixtures but preserve async capture (700ms)
  const isFile = (() => {
    try { return (page.url() || '').startsWith('file:'); } catch { return false; }
  })();
  const midDelay = isFile ? 200 : Math.min(300, scanBudget.stabilizationSampleMidMs);
  const endDelay = isFile ? 800 : Math.min(900, scanBudget.stabilizationSampleEndMs);
  const networkDelay = isFile ? 100 : Math.min(400, scanBudget.networkWaitMs);

  await sampleDom();
  await page.waitForTimeout(midDelay);
  await sampleDom();
  await page.waitForTimeout(Math.max(0, endDelay - midDelay));
  await sampleDom();
  
  // NETWORK INTELLIGENCE: Wait a bit longer to ensure slow requests complete
  await page.waitForTimeout(networkDelay);

  const domChangedDuringSettle = computeDomChangedDuringSettle(samples);

  return {
    samples,
    domChangedDuringSettle,
    afterHash: samples[samples.length - 1]
  };
}

export async function runInteraction(page, interaction, timestamp, i, screenshotsDir, baseOrigin, startTime, scanBudget, flowContext = null, silenceTracker = null) {
  const trace = {
    interaction: {
      type: interaction.type,
      selector: interaction.selector,
      label: interaction.label,
      href: interaction.href || null,
      dataHref: interaction.dataHref || null,
      text: interaction.text || null,
      formAction: interaction.formAction || null
    },
    before: {
      url: '',
      screenshot: ''
    },
    after: {
      url: '',
      screenshot: ''
    },
    sensors: {},
    humanDriver: true // Flag indicating human driver was used
  };
  
  // Add flow context if provided
  if (flowContext) {
    trace.flow = {
      flowId: flowContext.flowId,
      stepIndex: flowContext.stepIndex,
      startedAtInteraction: flowContext.startedAtInteraction,
      startedAt: flowContext.startedAt,
      interactionId: i
    };
  }
  const networkSensor = new NetworkSensor();
  const consoleSensor = new ConsoleSensor();
  const uiSignalSensor = new UISignalSensor();
  const stateSensor = new StateSensor();
  const navigationSensor = new NavigationSensor();
  const loadingSensor = new LoadingSensor({ loadingTimeout: 5000 });
  const focusSensor = new FocusSensor();
  const ariaSensor = new AriaSensor();
  const timingSensor = new TimingSensor({
    feedbackGapThresholdMs: 1500,
    freezeLikeThresholdMs: 3000
  });
  const humanDriver = new HumanBehaviorDriver({}, scanBudget);
  
  let networkWindowId = null;
  let consoleWindowId = null;
  let stateSensorActive = false;
  let loadingWindowData = null;
  
  let uiBefore = {};
  
  try {
    // Capture session state before interaction for auth-aware interactions
    if (interaction.type === 'login' || interaction.type === 'logout') {
      await humanDriver.captureSessionState(page);
    }
    
    if (Date.now() - startTime > scanBudget.maxScanDurationMs) {
      trace.policy = { timeout: true, reason: 'max_scan_duration_exceeded' };
      trace.sensors = {
        network: networkSensor.getEmptySummary(),
        console: consoleSensor.getEmptySummary(),
        uiSignals: {
          before: {},
          after: {},
          diff: { changed: false, explanation: '', summary: {} }
        }
      };
      return trace;
    }
    
    const beforeUrl = page.url();
    const beforeScreenshot = resolve(screenshotsDir, `before-${timestamp}-${i}.png`);
    await captureScreenshot(page, beforeScreenshot);
    const beforeDomHash = await captureDomSignature(page);
    const beforeTitle = typeof page.title === 'function' ? await page.title().catch(() => null) : (page.title || null);
    
    trace.before.url = beforeUrl;
    trace.before.screenshot = `screenshots/before-${timestamp}-${i}.png`;
    if (beforeDomHash) {
      trace.dom = { beforeHash: beforeDomHash };
    }
    if (!trace.page) {
      trace.page = {};
    }
    trace.page.beforeTitle = beforeTitle;
    
    uiBefore = await uiSignalSensor.snapshot(page).catch(() => ({}));
    
    // A11Y INTELLIGENCE: Capture focus and ARIA state before interaction
    await focusSensor.captureBefore(page);
    await ariaSensor.captureBefore(page);
    
    // PERFORMANCE INTELLIGENCE: Start timing sensor
    timingSensor.startTiming();
    
    // NAVIGATION INTELLIGENCE v2: Inject tracking script and start navigation sensor
    await navigationSensor.injectTrackingScript(page);
    const navigationWindowId = navigationSensor.startWindow(page);
    
    // STATE INTELLIGENCE: Detect and activate state sensor if supported stores found
    const stateDetection = await stateSensor.detect(page);
    stateSensorActive = stateDetection.detected;
    if (stateSensorActive) {
      await stateSensor.captureBefore(page);
    }
    
    networkWindowId = networkSensor.startWindow(page);
    consoleWindowId = consoleSensor.startWindow(page);
    
    // ASYNC INTELLIGENCE: Start loading sensor for async detection
    loadingWindowData = loadingSensor.startWindow(page);
    const loadingWindowId = loadingWindowData.windowId;
    const loadingState = loadingWindowData.state;
    
    if (interaction.isExternal && interaction.type === 'link') {
      const href = await interaction.element.getAttribute('href');
      const resolvedUrl = href.startsWith('http') ? href : new URL(href, beforeUrl).href;
      
      trace.policy = {
        externalNavigationBlocked: true,
        blockedUrl: resolvedUrl
      };
      
      const { settleResult, afterUrl } = await captureAfterState(page, screenshotsDir, timestamp, i, trace, scanBudget);
      trace.after.url = afterUrl;
      trace.after.screenshot = `screenshots/after-${timestamp}-${i}.png`;
      if (!trace.dom) {
        trace.dom = {};
      }
      if (settleResult.afterHash) {
        trace.dom.afterHash = settleResult.afterHash;
      }
      trace.dom.settle = {
        samples: settleResult.samples,
        domChangedDuringSettle: settleResult.domChangedDuringSettle
      };
      
      const networkSummary = networkSensor.stopWindow(networkWindowId);
      const consoleSummary = consoleSensor.stopWindow(consoleWindowId, page);
      const uiAfter = await uiSignalSensor.snapshot(page);
      const uiDiff = uiSignalSensor.diff(uiBefore, uiAfter);
      
      // STATE INTELLIGENCE: Capture after state and compute diff
      let stateDiff = { changed: [], available: false };
      let storeType = null;
      if (stateSensorActive) {
        await stateSensor.captureAfter(page);
        stateDiff = stateSensor.getDiff();
        storeType = stateSensor.activeType; // Store before cleanup
        stateSensor.cleanup();
      }
      
      trace.sensors = {
        network: networkSummary,
        console: consoleSummary,
        uiSignals: {
          before: uiBefore,
          after: uiAfter,
          diff: uiDiff
        },
        state: {
          available: stateDiff.available,
          changed: stateDiff.changed,
          storeType: storeType
        }
      };
      
      return trace;
    }

    // REAL USER SIMULATION: Use human driver for all interactions
    const locator = interaction.element;
    // On file:// origins, avoid long navigation waits for simple link clicks
    const isFileOrigin = baseOrigin && baseOrigin.startsWith('file:');
    let shouldWaitForNavigation = (interaction.type === 'link' || interaction.type === 'form') && !isFileOrigin;
    let navigationResult = null;
    
    try {
      if (shouldWaitForNavigation) {
        navigationResult = page.waitForNavigation({ timeout: scanBudget.navigationTimeoutMs, waitUntil: 'domcontentloaded' })
          .catch((error) => {
            if (error && error.name === 'TimeoutError') {
              markTimeoutPolicy(trace, 'navigation', silenceTracker);
            }
            return null;
          });
      }

      if (interaction.type === 'login') {
        // Login form submission: fill with deterministic credentials and submit
        const loginResult = await humanDriver.executeLogin(page, locator);
        const sessionStateAfter = await humanDriver.captureSessionState(page);
        trace.login = {
          submitted: loginResult.submitted,
          found: loginResult.found !== false,
          redirected: loginResult.redirected,
          url: loginResult.url,
          storageChanged: loginResult.storageChanged,
          cookiesChanged: loginResult.cookiesChanged,
          beforeStorage: loginResult.beforeStorage || [],
          afterStorage: loginResult.afterStorage || []
        };
        trace.session = sessionStateAfter;
        trace.interactionType = 'login';
        shouldWaitForNavigation = loginResult.redirected && !isFileOrigin;
        if (shouldWaitForNavigation && !navigationResult) {
          navigationResult = page.waitForNavigation({ timeout: scanBudget.navigationTimeoutMs, waitUntil: 'domcontentloaded' })
            .catch(() => null);
        }
      } else if (interaction.type === 'logout') {
        // Logout action: click logout and observe session changes
        const logoutResult = await humanDriver.performLogout(page);
        const sessionStateAfter = await humanDriver.captureSessionState(page);
        trace.logout = {
          clicked: logoutResult.clicked,
          found: logoutResult.found !== false,
          redirected: logoutResult.redirected,
          url: logoutResult.url,
          storageChanged: logoutResult.storageChanged,
          cookiesChanged: logoutResult.cookiesChanged,
          beforeStorage: logoutResult.beforeStorage || [],
          afterStorage: logoutResult.afterStorage || []
        };
        trace.session = sessionStateAfter;
        trace.interactionType = 'logout';
        shouldWaitForNavigation = logoutResult.redirected && !isFileOrigin;
        if (shouldWaitForNavigation && !navigationResult) {
          navigationResult = page.waitForNavigation({ timeout: scanBudget.navigationTimeoutMs, waitUntil: 'domcontentloaded' })
            .catch(() => null);
        }
      } else if (interaction.type === 'form') {
        // Form submission: fill fields first, then submit
        const fillResult = await humanDriver.fillFormFields(page, locator);
        if (fillResult.filled && fillResult.filled.length > 0) {
          trace.humanDriverFilled = fillResult.filled;
        }
        if (fillResult.reason) {
          trace.humanDriverSkipReason = fillResult.reason;
        }
        
        // Submit form using human driver
        const submitResult = await humanDriver.submitForm(page, locator);
        trace.humanDriverSubmitted = submitResult.submitted;
        trace.humanDriverAttempts = submitResult.attempts;
      } else if (interaction.type === 'keyboard') {
        // Keyboard navigation: perform full keyboard sweep
        const keyboardResult = await humanDriver.performKeyboardNavigation(page, 12);
        trace.keyboard = {
          focusOrder: keyboardResult.focusOrder,
          actions: keyboardResult.actions,
          attemptedTabs: keyboardResult.attemptedTabs
        };
        trace.interactionType = 'keyboard';
      } else if (interaction.type === 'hover') {
        // Hover interaction: hover and observe DOM changes
        const hoverResult = await humanDriver.hoverAndObserve(page, locator);
        
        // Capture DOM before/after for hover
        const beforeDom = await page.evaluate(() => document.body ? document.body.innerHTML.length : 0);
        await page.waitForTimeout(200);
        const afterDom = await page.evaluate(() => document.body ? document.body.innerHTML.length : 0);
        
        const visiblePopups = await page.evaluate(() => {
          const popups = Array.from(document.querySelectorAll('[role="menu"], [role="dialog"], .dropdown, .popup, [aria-haspopup]'));
          return popups.filter(el => {
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden';
          }).length;
        }).catch(() => 0);
        
        trace.hover = {
          selector: hoverResult.selector,
          revealed: hoverResult.revealed,
          domChanged: beforeDom !== afterDom,
          popupsRevealed: visiblePopups
        };
        trace.interactionType = 'hover';
      } else if (interaction.type === 'file_upload') {
        // File upload: attach test file using ensureUploadFixture
        const uploadResult = await humanDriver.uploadFile(page, locator);
        trace.fileUpload = uploadResult;
        trace.interactionType = 'file_upload';
      } else if (interaction.type === 'auth_guard') {
        // Auth guard: check protected route access
        const href = interaction.href || (await locator.getAttribute('href').catch(() => null));
        if (href) {
          const currentUrl = page.url();
          const fullUrl = href.startsWith('http') ? href : new URL(href, currentUrl).href;
          const guardResult = await humanDriver.checkProtectedRoute(page, fullUrl);
          const sessionStateAfter = await humanDriver.captureSessionState(page);
          trace.authGuard = {
            url: guardResult.url,
            isProtected: guardResult.isProtected,
            redirectedToLogin: guardResult.redirectedToLogin,
            hasAccessDenied: guardResult.hasAccessDenied,
            httpStatus: guardResult.httpStatus,
            beforeUrl: guardResult.beforeUrl,
            afterUrl: guardResult.afterUrl
          };
          trace.session = sessionStateAfter;
          trace.interactionType = 'auth_guard';
          // Navigate back to original page if redirected
          if (guardResult.afterUrl !== guardResult.beforeUrl) {
            await page.goto(beforeUrl, { waitUntil: 'domcontentloaded', timeout: CLICK_TIMEOUT_MS }).catch(() => null);
          }
        }
      } else {
        // Click/link: use human driver click
        const clickResult = await humanDriver.clickElement(page, locator);
        trace.humanDriverClicked = clickResult.clicked;
      }

      // PERFORMANCE INTELLIGENCE: Capture periodic timing snapshots after interaction
      // Check for feedback signals at intervals
      if (timingSensor && timingSensor.t0) {
        // Capture snapshot immediately after interaction
        await timingSensor.captureTimingSnapshot(page);
        
        // Wait a bit and capture again to catch delayed feedback
        await page.waitForTimeout(300);
        await timingSensor.captureTimingSnapshot(page);
        
        // Wait longer for slow feedback
        await page.waitForTimeout(1200);
        await timingSensor.captureTimingSnapshot(page);
        
        // Record UI change if detected
        if (uiSignalSensor) {
          const currentUi = await uiSignalSensor.snapshot(page).catch(() => ({}));
          const currentDiff = uiSignalSensor.diff(uiBefore, currentUi);
          if (currentDiff.changed) {
            timingSensor.recordUiChange();
          }
        }
      }

      if (navigationResult) {
        navigationResult = await navigationResult;
      }
    } catch (error) {
      if (error.message === 'timeout' || error.name === 'TimeoutError') {
        markTimeoutPolicy(trace, 'click', silenceTracker);
        await captureAfterOnly(page, screenshotsDir, timestamp, i, trace);
        
        if (networkWindowId !== null) {
          const networkSummary = networkSensor.stopWindow(networkWindowId);
          trace.sensors.network = networkSummary;
        } else {
          trace.sensors.network = networkSensor.getEmptySummary();
          // Track sensor silence when empty summary is used
          if (silenceTracker) {
            silenceTracker.record({
              scope: 'sensor',
              reason: 'sensor_unavailable',
              description: 'Network sensor data unavailable (window not started)',
              context: {
                interaction: trace.interaction,
                sensor: 'network'
              },
              impact: 'incomplete_check'
            });
          }
        }
        
        if (consoleWindowId !== null) {
          const consoleSummary = consoleSensor.stopWindow(consoleWindowId, page);
          trace.sensors.console = consoleSummary;
        } else {
          trace.sensors.console = consoleSensor.getEmptySummary();
          // Track sensor silence when empty summary is used
          if (silenceTracker) {
            silenceTracker.record({
              scope: 'sensor',
              reason: 'sensor_unavailable',
              description: 'Console sensor data unavailable (window not started)',
              context: {
                interaction: trace.interaction,
                sensor: 'console'
              },
              impact: 'incomplete_check'
            });
          }
        }
        
        const uiAfter = await uiSignalSensor.snapshot(page).catch(() => ({}));
        const uiDiff = uiSignalSensor.diff(uiBefore, uiAfter);
        
        // STATE INTELLIGENCE: Capture after state and compute diff
        let stateDiff = { changed: [], available: false };
        let storeType = null;
        if (stateSensorActive) {
          await stateSensor.captureAfter(page);
          stateDiff = stateSensor.getDiff();
          storeType = stateSensor.activeType;
          stateSensor.cleanup();
        }
        
        trace.sensors.uiSignals = {
          before: uiBefore,
          after: uiAfter,
          diff: uiDiff
        };
        trace.sensors.state = {
          available: stateDiff.available,
          changed: stateDiff.changed,
          storeType: storeType
        };
        
        return trace;
      }
      throw error;
    }

    if (navigationResult) {
      const afterUrl = page.url();
      if (isExternalUrl(afterUrl, baseOrigin)) {
        await page.goBack({ timeout: scanBudget.navigationTimeoutMs }).catch(() => {});
        trace.policy = {
          ...(trace.policy || {}),
          externalNavigationBlocked: true,
          blockedUrl: afterUrl
        };
      }
    }

    const { settleResult, afterUrl } = await captureAfterState(page, screenshotsDir, timestamp, i, trace, scanBudget);
    trace.after.url = afterUrl;
    trace.after.screenshot = `screenshots/after-${timestamp}-${i}.png`;
    if (!trace.dom) {
      trace.dom = {};
    }
    if (settleResult.afterHash) {
      trace.dom.afterHash = settleResult.afterHash;
    }
    trace.dom.settle = {
      samples: settleResult.samples,
      domChangedDuringSettle: settleResult.domChangedDuringSettle
    };
    
    // Capture after page title
    const afterTitle = typeof page.title === 'function' ? await page.title().catch(() => null) : (page.title || null);
    if (!trace.page) {
      trace.page = {};
    }
    trace.page.afterTitle = afterTitle;

    const networkSummary = networkSensor.stopWindow(networkWindowId);
    const consoleSummary = consoleSensor.stopWindow(consoleWindowId, page);
    const navigationSummary = await navigationSensor.stopWindow(navigationWindowId, page);
    const loadingSummary = await loadingSensor.stopWindow(loadingWindowId, loadingState);
    
    // PERFORMANCE INTELLIGENCE: Analyze timing for feedback gaps
    if (networkSummary && networkSummary.totalRequests > 0) {
      timingSensor.analyzeNetworkSummary(networkSummary);
    }
    if (loadingSummary && loadingSummary.hasLoadingIndicators && loadingState) {
      // Record loading start - use the timestamp when loading was detected
      // loadingState.loadingStartTime is set when loading indicators first appear
      if (loadingState.loadingStartTime) {
        timingSensor.recordLoadingStart(loadingState.loadingStartTime);
      } else {
        // Fallback: estimate based on interaction start
        timingSensor.recordLoadingStart();
      }
    }
    
    const timingAnalysis = timingSensor.getTimingAnalysis();
    
    // Capture HTTP status from network summary
    // Network sensor summary doesn't include full requests Map, but provides:
    // - failedRequests count
    // - topFailedUrls array
    // - totalRequests count
    if (networkSummary) {
      if (!trace.page) {
        trace.page = {};
      }
      
      // If navigation completed and we have network activity, check for errors
      if (networkSummary.topFailedUrls && networkSummary.topFailedUrls.length > 0) {
        // Check if the failed URL matches our destination
        const failedMatch = networkSummary.topFailedUrls.find(failed => {
          try {
            const failedUrl = new URL(failed.url);
            const pageUrl = new URL(afterUrl);
            return failedUrl.pathname === pageUrl.pathname && failedUrl.origin === pageUrl.origin;
          } catch {
            return false;
          }
        });
        
        if (failedMatch) {
          // Navigation target failed with HTTP error
          trace.page.httpStatus = failedMatch.status || 500;
        } else if (networkSummary.totalRequests > 0 && networkSummary.failedRequests === 0) {
          // No failures, navigation likely succeeded with 200
          trace.page.httpStatus = 200;
        }
      } else if (networkSummary.totalRequests > 0 && networkSummary.failedRequests === 0) {
        // No failed requests, navigation likely succeeded with 200
        trace.page.httpStatus = 200;
      } else if (navigationSummary && navigationSummary.urlChanged && !navigationSummary.blockedNavigations) {
        // Navigation completed successfully - assume HTTP 200
        // This is safe because Playwright's waitForNavigation only resolves on successful navigation
        trace.page.httpStatus = 200;
      }
    }
    
    const uiAfter = await uiSignalSensor.snapshot(page);
    const uiDiff = uiSignalSensor.diff(uiBefore, uiAfter);
    
    // PERFORMANCE INTELLIGENCE: Record UI change in timing sensor if detected
    if (timingSensor && uiDiff.changed) {
      timingSensor.recordUiChange();
    }
    
    // A11Y INTELLIGENCE: Capture focus and ARIA state after interaction
    await focusSensor.captureAfter(page);
    await ariaSensor.captureAfter(page);
    const focusDiff = focusSensor.getFocusDiff();
    const ariaDiff = ariaSensor.getAriaDiff();
    
    // STATE INTELLIGENCE: Capture after state and compute diff
    let stateDiff = { changed: [], available: false };
    let storeType = null;
    if (stateSensorActive) {
      await stateSensor.captureAfter(page);
      stateDiff = stateSensor.getDiff();
      storeType = stateSensor.activeType;
      stateSensor.cleanup();
    }
    
    trace.sensors = {
      network: networkSummary,
      console: consoleSummary,
      navigation: navigationSummary, // NAVIGATION INTELLIGENCE v2: Add navigation sensor data
      loading: loadingSummary, // ASYNC INTELLIGENCE: Add loading sensor data
      focus: focusDiff, // A11Y INTELLIGENCE: Add focus sensor data
      aria: ariaDiff, // A11Y INTELLIGENCE: Add ARIA sensor data
      timing: timingAnalysis, // PERFORMANCE INTELLIGENCE: Add timing analysis
      uiSignals: {
        before: uiBefore,
        after: uiAfter,
        diff: uiDiff
      },
      state: {
        available: stateDiff.available,
        changed: stateDiff.changed,
        storeType: storeType
      }
    };

    return trace;
  } catch (error) {
    if (error.message === 'timeout' || error.name === 'TimeoutError') {
      markTimeoutPolicy(trace, 'click');
      await captureAfterOnly(page, screenshotsDir, timestamp, i, trace);
      
      if (networkWindowId !== null) {
        const networkSummary = networkSensor.stopWindow(networkWindowId);
        trace.sensors.network = networkSummary;
      } else {
        trace.sensors.network = networkSensor.getEmptySummary();
      }
      
      if (consoleWindowId !== null) {
        const consoleSummary = consoleSensor.stopWindow(consoleWindowId, page);
        trace.sensors.console = consoleSummary;
      } else {
        trace.sensors.console = consoleSensor.getEmptySummary();
      }
      
      const uiAfter = await uiSignalSensor.snapshot(page).catch(() => ({}));
      const uiDiff = uiSignalSensor.diff(uiBefore || {}, uiAfter);
      
      // STATE INTELLIGENCE: Capture after state and compute diff
      let stateDiff = { changed: [], available: false };
      let storeType = null;
      if (stateSensorActive) {
        await stateSensor.captureAfter(page);
        stateDiff = stateSensor.getDiff();
        storeType = stateSensor.activeType;
        stateSensor.cleanup();
      }
      
      trace.sensors.uiSignals = {
        before: uiBefore || {},
        after: uiAfter,
        diff: uiDiff
      };
      trace.sensors.state = {
        available: stateDiff.available,
        changed: stateDiff.changed,
        storeType: storeType
      };
      
      return trace;
    }

    // For non-timeout errors, capture as execution error trace instead of returning null
    trace.policy = {
      ...(trace.policy || {}),
      executionError: true,
      reason: error.message
    };

    if (networkWindowId !== null) {
      trace.sensors.network = networkSensor.stopWindow(networkWindowId);
    } else {
      trace.sensors.network = networkSensor.getEmptySummary();
    }
    if (consoleWindowId !== null) {
      trace.sensors.console = consoleSensor.stopWindow(consoleWindowId, page);
    } else {
      trace.sensors.console = consoleSensor.getEmptySummary();
    }
    if (stateSensorActive) {
      stateSensor.cleanup();
      const stateDiff = stateSensor.getDiff();
      trace.sensors.state = {
        available: stateDiff.available,
        changed: stateDiff.changed,
        storeType: stateSensor.activeType
      };
    } else {
      trace.sensors.state = { available: false, changed: [], storeType: null };
    }

    const uiAfter = await uiSignalSensor.snapshot(page).catch(() => ({}));
    const uiDiff = uiSignalSensor.diff(uiBefore || {}, uiAfter || {});
    trace.sensors.uiSignals = {
      before: uiBefore || {},
      after: uiAfter || {},
      diff: uiDiff
    };

    // Best-effort after state
    await captureAfterOnly(page, screenshotsDir, timestamp, i, trace).catch(() => {});

    return trace;
  }
}

async function captureAfterState(page, screenshotsDir, timestamp, interactionIndex, trace, scanBudget) {
  let settleResult = {
    samples: [],
    domChangedDuringSettle: false,
    afterHash: null
  };

  try {
    settleResult = await captureSettledDom(page, scanBudget);
  } catch (error) {
    if (error.message === 'timeout' || error.name === 'TimeoutError') {
      markTimeoutPolicy(trace, 'settle');
    }
  }

  const afterUrl = page.url();
  const afterScreenshot = resolve(screenshotsDir, `after-${timestamp}-${interactionIndex}.png`);
  await captureScreenshot(page, afterScreenshot);

  return { settleResult, afterUrl };
}

async function captureAfterOnly(page, screenshotsDir, timestamp, interactionIndex, trace) {
  const afterUrl = page.url();
  const afterScreenshot = resolve(screenshotsDir, `after-${timestamp}-${interactionIndex}.png`);
  try {
    await captureScreenshot(page, afterScreenshot);
    const afterDomHash = await captureDomSignature(page);
    trace.after.url = afterUrl;
    trace.after.screenshot = `screenshots/after-${timestamp}-${interactionIndex}.png`;
    if (afterDomHash) {
      if (!trace.dom) {
        trace.dom = {};
      }
      trace.dom.afterHash = afterDomHash;
    }
  } catch (e) {
    // Ignore screenshot errors on timeout
  }
}

