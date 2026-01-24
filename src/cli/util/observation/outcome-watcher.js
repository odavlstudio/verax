/**
 * PHASE 2B: Outcome Watcher
 * Adaptive, evidence-based waiting for post-action acknowledgments
 * Reduces false "silence" for slow/debounced flows
 */

import { getTimeProvider } from '../support/time-provider.js';

/**
 * Outcome Watcher Configuration
 */
const DEFAULT_CONFIG = {
  maxWaitMs: 10000,        // Maximum wait time
  earlyExitMs: 500,        // Min time before early exit
  pollIntervalMs: 250,     // How often to check for acknowledgment
  stabilityWindowMs: 300,  // How long acknowledgment must remain stable
};

/**
 * Watch for post-action acknowledgments with adaptive timeout
 * Returns: { acknowledged, latencyBucket, signals, duration }
 */
export async function watchForOutcome(page, config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const timeProvider = getTimeProvider();
  const startTime = timeProvider.now();
  const signals = {
    routeChanged: false,
    domChanged: false,
    feedbackAppeared: false,
    loadingResolved: false,
    networkSettled: false,
  };

  let lastSignalTime = null;
  let acknowledgedAt = null;

  try {
    while (timeProvider.now() - startTime < cfg.maxWaitMs) {
      const now = timeProvider.now();
      // Check for route change (via route sensor global)
      const routeChanged = await checkRouteChanged(page);
      if (routeChanged && !signals.routeChanged) {
        signals.routeChanged = true;
        lastSignalTime = now;
        acknowledgedAt = acknowledgedAt || lastSignalTime;
      }

      // Check for meaningful DOM change
      const domChanged = await checkDomChanged(page);
      if (domChanged && !signals.domChanged) {
        signals.domChanged = true;
        lastSignalTime = now;
        acknowledgedAt = acknowledgedAt || lastSignalTime;
      }

      // Check for feedback elements
      const feedbackAppeared = await checkFeedbackAppeared(page);
      if (feedbackAppeared && !signals.feedbackAppeared) {
        signals.feedbackAppeared = true;
        lastSignalTime = now;
        acknowledgedAt = acknowledgedAt || lastSignalTime;
      }

      // Check for loading indicator resolution
      const loadingResolved = await checkLoadingResolved(page);
      if (loadingResolved && !signals.loadingResolved) {
        signals.loadingResolved = true;
        lastSignalTime = now;
        acknowledgedAt = acknowledgedAt || lastSignalTime;
      }

      // Early exit if acknowledged and stable
      if (acknowledgedAt && now - lastSignalTime > cfg.stabilityWindowMs) {
        if (now - startTime >= cfg.earlyExitMs) {
          break;
        }
      }

      await sleep(cfg.pollIntervalMs);
    }

    const duration = timeProvider.now() - startTime;
    const acknowledged = acknowledgedAt !== null;
    const latency = acknowledgedAt ? acknowledgedAt - startTime : duration;
    const latencyBucket = getLatencyBucket(latency);

    return {
      acknowledged,
      latencyBucket,
      signals,
      duration,
      acknowledgedAt: acknowledged ? acknowledgedAt - startTime : null,
    };
  } catch (error) {
    // Never crash observation
    return {
      acknowledged: false,
      latencyBucket: 'unknown',
      signals,
      duration: timeProvider.now() - startTime,
      error: error.message,
    };
  }
}

/**
 * Check if route changed (via route sensor global)
 */
async function checkRouteChanged(page) {
  try {
    const result = await page.evaluate(() => {
      // @ts-ignore - Augmented window properties in browser context
      if (typeof window.__veraxRouteLastChanged === 'number') {
        // @ts-ignore - Augmented window properties in browser context
        const lastSeen = window.__veraxRouteLastSeen || 0;
        // @ts-ignore - Augmented window properties in browser context
        const changed = window.__veraxRouteLastChanged !== lastSeen;
        // @ts-ignore - Augmented window properties in browser context
        window.__veraxRouteLastSeen = window.__veraxRouteLastChanged;
        return changed;
      }
      return false;
    });
    return result;
  } catch {
    return false;
  }
}

/**
 * Check for meaningful DOM change (simple heuristic)
 */
async function checkDomChanged(page) {
  try {
    const result = await page.evaluate(() => {
      if (!window.__veraxDomSnapshot) {
        window.__veraxDomSnapshot = document.body?.innerHTML?.length || 0;
        return false;
      }

      const currentLength = document.body?.innerHTML?.length || 0;
      const changed = Math.abs(currentLength - window.__veraxDomSnapshot) > 100;
      
      if (changed) {
        window.__veraxDomSnapshot = currentLength;
        return true;
      }

      return false;
    });
    return result;
  } catch {
    return false;
  }
}

/**
 * Check for feedback elements appearance
 */
async function checkFeedbackAppeared(page) {
  try {
    const feedbackSelectors = [
      '[role="alert"]',
      '[role="status"]',
      '[aria-live="polite"]',
      '[aria-live="assertive"]',
      '.toast',
      '.notification',
      '.alert',
      '.message',
      '.feedback',
    ];

    for (const selector of feedbackSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Check if loading indicators resolved
 */
async function checkLoadingResolved(page) {
  try {
    const result = await page.evaluate(() => {
      // Check for loading indicators
      const loadingSelectors = [
        '[role="progressbar"]',
        '[aria-busy="true"]',
        '.spinner',
        '.loading',
        '[data-loading="true"]',
      ];

      for (const selector of loadingSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          // Still loading
          if (!window.__veraxLoadingDetected) {
            window.__veraxLoadingDetected = true;
            return false;
          }
          return false;
        }
      }

      // If we detected loading before and now it's gone, it resolved
      if (window.__veraxLoadingDetected) {
        window.__veraxLoadingDetected = false;
        return true;
      }

      return false;
    });
    return result;
  } catch {
    return false;
  }
}

/**
 * Categorize latency into buckets
 */
export function getLatencyBucket(latencyMs) {
  if (latencyMs < 0) return 'unknown';
  if (latencyMs < 3000) return '0-3s';
  if (latencyMs < 6000) return '3-6s';
  if (latencyMs < 10000) return '6-10s';
  return '>10s';
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
