/**
 * interaction-runner-capture.js
 * 
 * State capture and DOM stabilization helpers for interaction observation.
 * Extracted from interaction-runner.js to reduce file complexity.
 * 
 * CONSTITUTIONAL GUARANTEE:
 * - All functions preserve exact behavior from original implementation
 * - Timing semantics identical (waitForTimeout intervals preserved)
 * - DOM sampling logic unchanged
 * - Screenshot capture behavior preserved
 */

import { resolve } from 'path';
import { captureScreenshot } from './evidence-capture.js';
import { captureDomSignature } from './dom-signature.js';
import { captureSuccess, captureFailure } from './capture-outcome.js';

/**
 * Compute if DOM changed during settle period by comparing samples
 */
export function computeDomChangedDuringSettle(samples) {
  if (!samples || samples.length < 3) {
    return false;
  }
  return samples[0] !== samples[1] || samples[1] !== samples[2];
}

/**
 * Capture DOM state after interaction with stabilization period
 * Takes 3 samples with delays to detect if DOM is still changing
 */
export async function captureSettledDom(page, scanBudget) {
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

/**
 * Capture after-state with DOM stabilization
 */
export async function captureAfterState(page, screenshotsDir, timestamp, interactionIndex, trace, scanBudget, markTimeoutPolicy) {
  let settleResult = {
    samples: [],
    domChangedDuringSettle: false,
    afterHash: null
  };
  const captureOutcomes = [];

  try {
    settleResult = await captureSettledDom(page, scanBudget);
  } catch (error) {
    if (error.message === 'timeout' || error.name === 'TimeoutError') {
      markTimeoutPolicy(trace, 'settle');
    }
  }

  if (settleResult.afterHash) {
    captureOutcomes.push(captureSuccess('dom', settleResult.afterHash, 'DOM_SIGNATURE'));
  } else {
    captureOutcomes.push(captureFailure('dom', 'DOM signature capture returned null after settle', 'DOM_SIGNATURE'));
  }

  const afterUrl = page.url();
  const afterScreenshot = resolve(screenshotsDir, `after-${timestamp}-${interactionIndex}.png`);
  await captureScreenshot(page, afterScreenshot);
  captureOutcomes.push(captureSuccess('screenshot', `screenshots/after-${timestamp}-${interactionIndex}.png`, 'AFTER_SCREENSHOT'));

  return { settleResult, afterUrl, captureOutcomes };
}

/**
 * Capture after-state only (for timeout/error scenarios without full settle)
 */
export async function captureAfterOnly(page, screenshotsDir, timestamp, interactionIndex, trace) {
  const afterUrl = page.url();
  const afterScreenshot = resolve(screenshotsDir, `after-${timestamp}-${interactionIndex}.png`);
  const captureOutcomes = [];
  try {
    await captureScreenshot(page, afterScreenshot);
    captureOutcomes.push(captureSuccess('screenshot', `screenshots/after-${timestamp}-${interactionIndex}.png`, 'AFTER_SCREENSHOT'));
    const afterDomHash = await captureDomSignature(page);
    trace.after.url = afterUrl;
    trace.after.screenshot = `screenshots/after-${timestamp}-${interactionIndex}.png`;
    if (afterDomHash) {
      if (!trace.dom) {
        trace.dom = {};
      }
      trace.dom.afterHash = afterDomHash;
      captureOutcomes.push(captureSuccess('dom', afterDomHash, 'DOM_SIGNATURE'));
    } else {
      captureOutcomes.push(captureFailure('dom', 'DOM signature capture returned null after settle', 'DOM_SIGNATURE'));
    }
  } catch (e) {
    // Ignore screenshot errors on timeout
    captureOutcomes.push(captureFailure('screenshot', e?.message || 'Screenshot capture failed after timeout', 'AFTER_SCREENSHOT'));
  }

  if (captureOutcomes.length > 0) {
    trace.captureOutcomes = [...(trace.captureOutcomes || []), ...captureOutcomes];
  }
}
