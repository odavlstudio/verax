/**
 * WAVE 2: Deterministic DOM settle logic
 * Waits for page to stabilize after navigation or interaction
 * @typedef {import('playwright').Page} Page
 */

import { getTimeProvider } from '../../cli/util/support/time-provider.js';
import { DEFAULT_SCAN_BUDGET } from '../shared/scan-budget.js';

/**
 * Wait for page to settle after navigation or interaction.
 * Combines multiple signals: load event, network idle, DOM mutation stabilization.
 * With adaptive stabilization, extends windows if DOM/network still changing.
 *
 * @param {Page} page - Playwright page object
 * @param {Object} scanBudget - ScanBudget with settle timing parameters
 * @returns {Promise<void>}
 */
export async function waitForSettle(page, scanBudget = DEFAULT_SCAN_BUDGET) {
  const baseTimeoutMs = scanBudget.settleTimeoutMs;
  const baseIdleMs = scanBudget.settleIdleMs;
  const baseDomStableMs = scanBudget.settleDomStableMs;
  const adaptiveStabilization = scanBudget.adaptiveStabilization || false;

  // With adaptive stabilization, allow up to 1.5x the base timeout for difficult pages
  const timeoutMs = adaptiveStabilization ? Math.round(baseTimeoutMs * 1.5) : baseTimeoutMs;
  const idleMs = baseIdleMs;
  const domStableMs = baseDomStableMs;

  const timeProvider = getTimeProvider();
  const startTime = timeProvider.now();

  try {
    // Signal 1: Wait for load event (DOMContentLoaded or load)
    await Promise.race([
      page.waitForLoadState('networkidle', { timeout: timeoutMs }).catch(() => {}),
      page.waitForLoadState('domcontentloaded', { timeout: timeoutMs }).catch(() => {})
    ]).catch(() => {});

    // Signal 2: Network idle detection using Playwright Request/Response events
    await waitForNetworkIdle(page, idleMs, timeoutMs - (timeProvider.now() - startTime), adaptiveStabilization);

    // Signal 3: DOM mutation stabilization
    await waitForDomStability(page, domStableMs, timeoutMs - (timeProvider.now() - startTime), adaptiveStabilization);
  } catch (err) {
    // Timeout is acceptable - page may have settled despite timeout
    if (!err.message?.includes('Timeout')) {
      throw err;
    }
  }
}

/**
 * Wait for network to become idle (no inflight requests for idleMs).
 * Uses Playwright's Request/Response event listening.
 * With adaptive stabilization, may extend the idle window if network restarts.
 */
async function waitForNetworkIdle(page, idleMs, timeoutMs, adaptiveStabilization = false) {
  if (timeoutMs <= 0) return;

  return new Promise((resolve) => {
    const timeProvider = getTimeProvider();
    let lastNetworkActivityTime = timeProvider.now();
    let hasFinished = false;
    let extensionCount = 0;
    const maxExtensions = adaptiveStabilization ? 2 : 0;

    const onRequest = () => {
      lastNetworkActivityTime = timeProvider.now();
      // With adaptive stabilization, if network restarts, we extend the idle window
      if (adaptiveStabilization && extensionCount < maxExtensions) {
        extensionCount++;
      }
    };

    const onResponse = () => {
      lastNetworkActivityTime = timeProvider.now();
    };

    const checkIdle = () => {
      if (timeProvider.now() - lastNetworkActivityTime >= idleMs) {
        cleanup();
        resolve();
      } else {
        idleCheckTimer = setTimeout(checkIdle, Math.min(100, idleMs / 2));
      }
    };

    const cleanup = () => {
      if (hasFinished) return;
      hasFinished = true;
      page.removeListener('request', onRequest);
      page.removeListener('response', onResponse);
      if (idleCheckTimer) clearTimeout(idleCheckTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
    };

    let idleCheckTimer;
    const timeoutTimer = setTimeout(() => {
      cleanup();
      resolve(); // Timeout resolved, not rejected
    }, timeoutMs);

    page.on('request', onRequest);
    page.on('response', onResponse);

    // Start checking after a brief initial wait
    idleCheckTimer = setTimeout(checkIdle, 100);
  });
}

/**
 * Wait for DOM mutations to stabilize (no mutations for domStableMs).
 * Uses MutationObserver to track DOM changes.
 * With adaptive stabilization, may extend if DOM changes restart.
 */
async function waitForDomStability(page, domStableMs, timeoutMs, adaptiveStabilization = false) {
  if (timeoutMs <= 0) return;

  try {
    await page.exposeFunction('__veraxNow', () => getTimeProvider().now());
  } catch (error) {
    // If already exposed, continue
    if (!String(error?.message || '').includes('has been already registered')) {
      throw error;
    }
  }

  await page.evaluate(
    async (domStableMs, timeoutMs, shouldAdapt) => {
      return new Promise((resolve) => {
        let lastMutationTime = 0;
        let hasFinished = false;
        let extensionCount = 0;
        let stabilityCheckTimer;
        let timeoutTimer;
        const maxExtensions = shouldAdapt ? 2 : 0;

        const cleanup = () => {
          if (hasFinished) return;
          hasFinished = true;
          observer.disconnect();
          if (stabilityCheckTimer) clearTimeout(stabilityCheckTimer);
          if (timeoutTimer) clearTimeout(timeoutTimer);
        };

        const scheduleCheck = () => {
          stabilityCheckTimer = setTimeout(checkStability, Math.min(100, domStableMs / 2));
        };

        const checkStability = () => {
          // @ts-ignore - Augmented window properties in browser context
          window.__veraxNow().then((now) => {
            if (hasFinished) return;
            if (now - lastMutationTime >= domStableMs) {
              cleanup();
              resolve();
            } else {
              scheduleCheck();
            }
          });
        };

        const recordMutation = () => {
          // @ts-ignore - Augmented window properties in browser context
          window.__veraxNow().then((now) => {
            if (shouldAdapt && now - lastMutationTime >= domStableMs && extensionCount < maxExtensions) {
              extensionCount++;
            }
            lastMutationTime = now;
          });
        };

        const observer = new MutationObserver(recordMutation);

        observer.observe(document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['class', 'style', 'data-', 'disabled', 'hidden'],
          characterData: false, // Ignore text changes to reduce noise
          characterDataOldValue: false
        });

        timeoutTimer = setTimeout(() => {
          cleanup();
          resolve(); // Timeout resolved
        }, timeoutMs);

        // @ts-ignore - Augmented window properties in browser context
        window.__veraxNow().then((now) => {
          lastMutationTime = now;
          // Start checking after a brief initial wait
          stabilityCheckTimer = setTimeout(checkStability, 100);
        });
      });
    },
    domStableMs,
    timeoutMs,
    adaptiveStabilization
  ).catch(() => {
    // Page may have navigated, ignore
  });
}



