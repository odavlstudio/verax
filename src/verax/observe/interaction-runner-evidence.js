/**
 * interaction-runner-evidence.js
 * 
 * Evidence collection and trace assembly for interaction observation.
 * Extracted from interaction-runner.js to reduce file complexity.
 * 
 * CONSTITUTIONAL GUARANTEE:
 * - All functions preserve exact behavior from original implementation
 * - Timing semantics identical (waitForTimeout intervals preserved)
 * - Evidence collection order unchanged
 * - Sensor evidence aggregation logic preserved
 */

import { captureSuccess } from './capture-outcome.js';

/**
 * PHASE 5: Capture timing evidence snapshots
 * PERFORMANCE INTELLIGENCE: Capture periodic timing snapshots after interaction
 */
export async function captureTimingEvidence(page, sensors, uiBefore) {
  // Check for feedback signals at intervals
  if (sensors.timingSensor && sensors.timingSensor.t0) {
    // Capture snapshot immediately after interaction
    await sensors.timingSensor.captureTimingSnapshot(page);
    
    // Wait a bit and capture again to catch delayed feedback
    await page.waitForTimeout(300);
    await sensors.timingSensor.captureTimingSnapshot(page);
    
    // Wait longer for slow feedback
    await page.waitForTimeout(1200);
    await sensors.timingSensor.captureTimingSnapshot(page);
    
    // Record UI change if detected
    if (sensors.uiSignalSensor) {
      const currentUi = await sensors.uiSignalSensor.snapshot(page).catch(() => ({}));
      const currentDiff = sensors.uiSignalSensor.diff(uiBefore, currentUi);
      if (currentDiff.changed) {
        sensors.timingSensor.recordUiChange();
      }
    }
  }
}

/**
 * PHASE 6: Stop all sensors and collect evidence summaries
 * EVIDENCE: Network, console, navigation, loading, focus, ARIA, state, UI, timing data
 * MUTATES: sensor instances (stops listeners), returns evidence
 * @returns {Promise<Object>} Sensor evidence summaries
 */
export async function collectSensorEvidence(page, sensors, sensorState, uiBefore, _afterUrl, _scanBudget) {
  const { networkWindowId, consoleWindowId, navigationWindowId, stateSensorActive, loadingWindowData } = sensorState;
  const captureOutcomes = [];
  
  // EVIDENCE: Stop all sensor windows and collect summaries
  const networkSummary = sensors.networkSensor.stopWindow(networkWindowId);
  captureOutcomes.push(captureSuccess('network', networkSummary, 'NETWORK'));
  const consoleSummary = sensors.consoleSensor.stopWindow(consoleWindowId, page);
  captureOutcomes.push(captureSuccess('console', consoleSummary, 'CONSOLE'));
  const navigationSummary = await sensors.navigationSensor.stopWindow(navigationWindowId, page);
  captureOutcomes.push(captureSuccess('navigation', navigationSummary, 'URL'));
  const loadingSummary = await sensors.loadingSensor.stopWindow(loadingWindowData.windowId, loadingWindowData.state);
  captureOutcomes.push(captureSuccess('loading', loadingSummary, 'UISIGNALS'));
  
  // PERFORMANCE INTELLIGENCE: Analyze timing for feedback gaps
  if (networkSummary && networkSummary.totalRequests > 0) {
    sensors.timingSensor.analyzeNetworkSummary(networkSummary);
  }
  if (loadingSummary && loadingSummary.hasLoadingIndicators && loadingWindowData.state) {
    // Record loading start - use the timestamp when loading was detected
    if (loadingWindowData.state.loadingStartTime) {
      sensors.timingSensor.recordLoadingStart(loadingWindowData.state.loadingStartTime);
    } else {
      // Fallback: estimate based on interaction start
      sensors.timingSensor.recordLoadingStart();
    }
  }
  
  const timingAnalysis = sensors.timingSensor.getTimingAnalysis();
  
  // Capture UI after state
  const uiAfter = await sensors.uiSignalSensor.snapshot(page);
  const uiDiff = sensors.uiSignalSensor.diff(uiBefore, uiAfter);
  captureOutcomes.push(captureSuccess('uiSignals', { before: uiBefore, after: uiAfter, diff: uiDiff }, 'UISIGNALS'));
  
  // PERFORMANCE INTELLIGENCE: Record UI change in timing sensor if detected
  if (sensors.timingSensor && uiDiff.changed) {
    sensors.timingSensor.recordUiChange();
  }
  
  // A11Y INTELLIGENCE: Capture focus and ARIA state after interaction
  await sensors.focusSensor.captureAfter(page);
  await sensors.ariaSensor.captureAfter(page);
  const focusDiff = sensors.focusSensor.getFocusDiff();
  const ariaDiff = sensors.ariaSensor.getAriaDiff();
  
  // STATE INTELLIGENCE: Capture after state and compute diff
  let stateDiff = { changed: [], available: false };
  let storeType = null;
  if (stateSensorActive) {
    await sensors.stateSensor.captureAfter(page);
    stateDiff = sensors.stateSensor.getDiff();
    storeType = sensors.stateSensor.activeType;
    sensors.stateSensor.cleanup();
  }
  
  return {
    networkSummary,
    consoleSummary,
    navigationSummary,
    loadingSummary,
    timingAnalysis,
    uiAfter,
    uiDiff,
    focusDiff,
    ariaDiff,
    stateDiff,
    storeType,
    captureOutcomes
  };
}

/**
 * PHASE 7: Analyze HTTP status from network evidence
 * EVIDENCE: Derives HTTP status from network sensor data
 * @returns {number|null} HTTP status code if determinable
 */
export function deriveHttpStatus(networkSummary, navigationSummary, afterUrl) {
  // EVIDENCE: captured because HTTP status indicates success/failure
  if (!networkSummary) {
    return null;
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
      return failedMatch.status || 500;
    } else if (networkSummary.totalRequests > 0 && networkSummary.failedRequests === 0) {
      // No failures, navigation likely succeeded with 200
      return 200;
    }
  } else if (networkSummary.totalRequests > 0 && networkSummary.failedRequests === 0) {
    // No failed requests, navigation likely succeeded with 200
    return 200;
  } else if (navigationSummary && navigationSummary.urlChanged && !navigationSummary.blockedNavigations) {
    // Navigation completed successfully - assume HTTP 200
    // This is safe because Playwright's waitForNavigation only resolves on successful navigation
    return 200;
  }
  
  return null;
}

/**
 * PHASE 8: Assemble final trace object from all collected evidence
 * EVIDENCE: Combines all sensor evidence into trace structure
 * MUTATES: trace object (sets all properties)
 */
export function assembleFinalTrace(trace, beforeState, settleResult, afterUrl, afterTitle, sensorEvidence, executionResult, httpStatus) {
  // EVIDENCE: Populate trace with before-state evidence
  trace.before.url = beforeState.beforeUrl;
  trace.before.screenshot = beforeState.beforeScreenshot;
  if (beforeState.beforeDomHash) {
    trace.dom = { beforeHash: beforeState.beforeDomHash };
  }
  if (!trace.page) {
    trace.page = {};
  }
  trace.page.beforeTitle = beforeState.beforeTitle;
  
  // EVIDENCE: Populate trace with after-state evidence
  trace.after.url = afterUrl;
  trace.after.screenshot = `screenshots/after-${settleResult.timestamp}-${settleResult.index}.png`;
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
  trace.page.afterTitle = afterTitle;
  
  // EVIDENCE: Set HTTP status if determined
  if (httpStatus) {
    trace.page.httpStatus = httpStatus;
  }
  
  // EVIDENCE: Populate trace with execution result metadata
  Object.assign(trace, executionResult);
  
  // EVIDENCE: Populate trace with sensor evidence
  trace.sensors = {
    network: sensorEvidence.networkSummary,
    console: sensorEvidence.consoleSummary,
    navigation: sensorEvidence.navigationSummary,
    loading: sensorEvidence.loadingSummary,
    focus: sensorEvidence.focusDiff,
    aria: sensorEvidence.ariaDiff,
    timing: sensorEvidence.timingAnalysis,
    uiSignals: {
      before: beforeState.uiBefore,
      after: sensorEvidence.uiAfter,
      diff: sensorEvidence.uiDiff
    },
    state: {
      available: sensorEvidence.stateDiff.available,
      changed: sensorEvidence.stateDiff.changed,
      storeType: sensorEvidence.storeType
    }
  };
}
