import { getTimeProvider } from '../../../cli/util/support/time-provider.js';
/**
 * EVIDENCE CAPTURE RELIABILITY LAYER
 * 
 * Centralized evidence capture service with retries and failure tracking.
 * Ensures evidence capture is resilient and failures are never silent.
 */

import { captureScreenshot } from '../../shared/evidence-capture-bridge.js';
import { captureDomSignature } from '../../shared/evidence-capture-bridge.js';

/**
 * Evidence capture failure reason codes (stable)
 */
export const EVIDENCE_CAPTURE_FAILURE_CODES = {
  SCREENSHOT_FAILED: 'EVIDENCE_SCREENSHOT_FAILED',
  SCREENSHOT_TIMEOUT: 'EVIDENCE_SCREENSHOT_TIMEOUT',
  DOM_SIGNATURE_FAILED: 'EVIDENCE_DOM_SIGNATURE_FAILED',
  URL_CAPTURE_FAILED: 'EVIDENCE_URL_CAPTURE_FAILED',
  UISIGNALS_CAPTURE_FAILED: 'EVIDENCE_UISIGNALS_CAPTURE_FAILED',
  NETWORK_CAPTURE_FAILED: 'EVIDENCE_NETWORK_CAPTURE_FAILED',
  UNKNOWN_ERROR: 'EVIDENCE_UNKNOWN_ERROR'
};

/**
 * Evidence capture stage codes (stable)
 */
export const EVIDENCE_CAPTURE_STAGE = {
  BEFORE_SCREENSHOT: 'BEFORE_SCREENSHOT',
  AFTER_SCREENSHOT: 'AFTER_SCREENSHOT',
  DOM_SIGNATURE: 'DOM_SIGNATURE',
  URL: 'URL',
  UISIGNALS: 'UISIGNALS',
  NETWORK: 'NETWORK'
};

/**
 * EvidenceCaptureFailure object (structured failure record)
 */
export class EvidenceCaptureFailure {
  constructor(stage, reasonCode, reason, stackSummary = null, attemptCount = 1) {
    this.stage = stage;
    this.reasonCode = reasonCode;
    this.reason = reason;
    this.stackSummary = stackSummary || this._extractStackSummary(new Error().stack);
    this.attemptCount = attemptCount;
    this.timestamp = getTimeProvider().iso();
  }

  _extractStackSummary(stack) {
    if (!stack) return null;
    const lines = stack.split('\n').slice(0, 5);
    return lines.join('\n');
  }

  toJSON() {
    return {
      stage: this.stage,
      reasonCode: this.reasonCode,
      reason: this.reason,
      stackSummary: this.stackSummary,
      attemptCount: this.attemptCount,
      timestamp: this.timestamp
    };
  }
}

/**
 * Screenshot capture with retries
 * 
 * @param {Object} page - Playwright page object
 * @param {string} filepath - Path to save screenshot
 * @param {Object} options - Options { maxRetries: 2, retryDelayMs: 100 }
 * @returns {Promise<{ success: boolean, filepath: string | null, failure: EvidenceCaptureFailure | null }>}
 */
export async function captureScreenshotWithRetry(page, filepath, options = {}) {
  const maxRetries = options.maxRetries || 2;
  const retryDelayMs = options.retryDelayMs || 100;
  
  let lastError = null;
  let attemptCount = 0;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    attemptCount = attempt + 1;
    try {
      await captureScreenshot(page, filepath);
      // Verify file was created
      const { existsSync } = await import('fs');
      if (existsSync(filepath)) {
        return { success: true, filepath, failure: null };
      }
      throw new Error('Screenshot file was not created');
    } catch (error) {
      lastError = error;
      
      // If not last attempt, wait before retry
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      }
    }
  }
  
  // All retries failed
  const failure = new EvidenceCaptureFailure(
    filepath.includes('before') ? EVIDENCE_CAPTURE_STAGE.BEFORE_SCREENSHOT : EVIDENCE_CAPTURE_STAGE.AFTER_SCREENSHOT,
    lastError?.message?.includes('timeout') ? EVIDENCE_CAPTURE_FAILURE_CODES.SCREENSHOT_TIMEOUT : EVIDENCE_CAPTURE_FAILURE_CODES.SCREENSHOT_FAILED,
    lastError?.message || 'Screenshot capture failed after retries',
    lastError?.stack,
    attemptCount
  );
  
  return { success: false, filepath: null, failure };
}

/**
 * Capture DOM signature with error handling
 * 
 * @param {Object} page - Playwright page object
 * @returns {Promise<{ success: boolean, domSignature: string | null, failure: EvidenceCaptureFailure | null }>}
 */
export async function captureDomSignatureSafe(page) {
  try {
    const domSignature = await captureDomSignature(page);
    // Treat null/undefined as a capture failure (no silent degradation)
    if (domSignature === null || domSignature === undefined) {
      const failure = new EvidenceCaptureFailure(
        EVIDENCE_CAPTURE_STAGE.DOM_SIGNATURE,
        EVIDENCE_CAPTURE_FAILURE_CODES.DOM_SIGNATURE_FAILED,
        'DOM signature capture returned empty result'
      );
      return { success: false, domSignature: null, failure };
    }

    // @ts-expect-error - digest returns string
    return { success: true, domSignature, failure: null };
  } catch (error) {
    const failure = new EvidenceCaptureFailure(
      EVIDENCE_CAPTURE_STAGE.DOM_SIGNATURE,
      EVIDENCE_CAPTURE_FAILURE_CODES.DOM_SIGNATURE_FAILED,
      error.message || 'DOM signature capture failed',
      error.stack
    );
    return { success: false, domSignature: null, failure };
  }
}

/**
 * Capture URL with error handling
 * 
 * @param {Object} page - Playwright page object
 * @returns {Promise<{ success: boolean, url: string | null, failure: EvidenceCaptureFailure | null }>}
 */
export async function captureUrlSafe(page) {
  try {
    const url = page.url();
    return { success: true, url, failure: null };
  } catch (error) {
    const failure = new EvidenceCaptureFailure(
      EVIDENCE_CAPTURE_STAGE.URL,
      EVIDENCE_CAPTURE_FAILURE_CODES.URL_CAPTURE_FAILED,
      error.message || 'URL capture failed',
      error.stack
    );
    return { success: false, url: null, failure };
  }
}

/**
 * Capture UI signals snapshot with error handling
 * 
 * @param {Object} uiSignalSensor - UISignalSensor instance
 * @param {Object} page - Playwright page object
 * @param {number} interactionTime - Optional interaction timestamp
 * @param {Object} beforeSnapshot - Optional before snapshot
 * @returns {Promise<{ success: boolean, uiSignals: Object | null, failure: EvidenceCaptureFailure | null }>}
 */
export async function captureUiSignalsSafe(uiSignalSensor, page, interactionTime = null, beforeSnapshot = null) {
  try {
    const uiSignals = await uiSignalSensor.snapshot(page, interactionTime, beforeSnapshot);
    return { success: true, uiSignals, failure: null };
  } catch (error) {
    const failure = new EvidenceCaptureFailure(
      EVIDENCE_CAPTURE_STAGE.UISIGNALS,
      EVIDENCE_CAPTURE_FAILURE_CODES.UISIGNALS_CAPTURE_FAILED,
      error.message || 'UI signals capture failed',
      error.stack
    );
    return { success: false, uiSignals: null, failure };
  }
}

/**
 * Capture network snapshot with error handling
 * 
 * @param {Object} networkSensor - NetworkSensor instance
 * @param {string} windowId - Network window ID
 * @returns {Promise<{ success: boolean, networkSummary: Object | null, failure: EvidenceCaptureFailure | null }>}
 */
export async function captureNetworkSafe(networkSensor, windowId) {
  try {
    const networkSummary = networkSensor.stopWindow(windowId);
    return { success: true, networkSummary, failure: null };
  } catch (error) {
    const failure = new EvidenceCaptureFailure(
      EVIDENCE_CAPTURE_STAGE.NETWORK,
      EVIDENCE_CAPTURE_FAILURE_CODES.NETWORK_CAPTURE_FAILED,
      error.message || 'Network capture failed',
      error.stack
    );
    return { success: false, networkSummary: null, failure };
  }
}

/**
 * Comprehensive evidence capture for a finding
 * 
 * @param {Object} params - Capture parameters
 * @param {Object} params.page - Playwright page object
 * @param {string} params.beforeScreenshotPath - Before screenshot path
 * @param {string} params.afterScreenshotPath - After screenshot path
 * @param {Object} params.uiSignalSensor - UISignalSensor instance
 * @param {Object} params.networkSensor - NetworkSensor instance
 * @param {string} params.networkWindowId - Network window ID
 * @param {number} params.interactionTime - Interaction timestamp
 * @param {Object} params.beforeSnapshot - Before snapshot
 * @returns {Promise<{ evidence: Object, failures: Array<EvidenceCaptureFailure> }>}
 */
export async function captureEvidenceComprehensive(params) {
  const {
    page,
    beforeScreenshotPath,
    afterScreenshotPath,
    uiSignalSensor,
    networkSensor,
    networkWindowId,
    interactionTime,
    beforeSnapshot
  } = params;
  
  const failures = [];
  const evidence = {
    before: {},
    after: {},
    signals: {}
  };
  
  // Capture before screenshot
  if (beforeScreenshotPath) {
    const beforeScreenshot = await captureScreenshotWithRetry(page, beforeScreenshotPath);
    if (beforeScreenshot.success) {
      evidence.before.screenshot = beforeScreenshotPath;
    } else {
      failures.push(beforeScreenshot.failure);
    }
  }
  
  // Capture after screenshot
  if (afterScreenshotPath) {
    const afterScreenshot = await captureScreenshotWithRetry(page, afterScreenshotPath);
    if (afterScreenshot.success) {
      evidence.after.screenshot = afterScreenshotPath;
    } else {
      failures.push(afterScreenshot.failure);
    }
  }
  
  // Capture URLs
  const beforeUrl = await captureUrlSafe(page);
  if (beforeUrl.success) {
    evidence.before.url = beforeUrl.url;
  } else {
    failures.push(beforeUrl.failure);
  }
  
  const afterUrl = await captureUrlSafe(page);
  if (afterUrl.success) {
    evidence.after.url = afterUrl.url;
  } else {
    failures.push(afterUrl.failure);
  }
  
  // Capture DOM signatures
  const beforeDom = await captureDomSignatureSafe(page);
  if (beforeDom.success) {
    evidence.before.domSignature = beforeDom.domSignature;
  } else {
    failures.push(beforeDom.failure);
  }
  
  const afterDom = await captureDomSignatureSafe(page);
  if (afterDom.success) {
    evidence.after.domSignature = afterDom.domSignature;
  } else {
    failures.push(afterDom.failure);
  }
  
  // Capture UI signals
  if (uiSignalSensor) {
    const uiSignals = await captureUiSignalsSafe(uiSignalSensor, page, interactionTime, beforeSnapshot);
    if (uiSignals.success) {
      evidence.signals.uiSignals = uiSignals.uiSignals;
    } else {
      failures.push(uiSignals.failure);
    }
  }
  
  // Capture network
  if (networkSensor && networkWindowId) {
    const network = await captureNetworkSafe(networkSensor, networkWindowId);
    if (network.success) {
      evidence.signals.network = network.networkSummary;
    } else {
      failures.push(network.failure);
    }
  }
  
  return { evidence, failures };
}




