/**
 * PHASE 3 — OBSERVATION ALIGNMENT GUARD
 * 
 * Pre-observe reality check: verifies that extracted expectations
 * are actually present on the target URL's DOM before attempting
 * interaction or full observation.
 * 
 * Purpose:
 * - Catch source/target mismatches before wasting time on observation
 * - Prevent 0/121 scenarios and misleading "action-failed" errors
 * - Fail fast and honestly when --src doesn't match --url
 */

import { chromium } from 'playwright';

/**
 * Check if extracted expectations are aligned with target URL's DOM
 * 
 * Returns: {
 *   domPresentCount: number,
 *   expectationsTotal: number,
 *   aligned: boolean,
 *   missingExpectations: string[] (ids of expectations not found)
 * }
 */
export async function checkExpectationAlignment(
  expectations,
  url,
  { timeout = 10000 } = {}
) {
  if (!expectations || expectations.length === 0) {
    return {
      domPresentCount: 0,
      expectationsTotal: 0,
      aligned: true, // Empty expectations are not a mismatch
      missingExpectations: [],
    };
  }

  const expectationsTotal = expectations.length;
  let domPresentCount = 0;
  const missingExpectations = [];

  let browser = null;
  let context = null;
  let page = null;

  try {
    // Create lightweight browser for alignment check only
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    });
    page = await context.newPage();

    // Navigate to target URL with reasonable timeout
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
    } catch (navError) {
      // Navigation failed: treat as complete misalignment
      return {
        domPresentCount: 0,
        expectationsTotal,
        aligned: false,
        missingExpectations: expectations.map(e => e.id || 'unknown'),
        error: `Failed to load target URL: ${navError.message}`,
      };
    }

    // For each expectation, check DOM presence
    for (const expectation of expectations) {
      const isPresent = await checkExpectationInDOM(page, expectation);
      if (isPresent) {
        domPresentCount += 1;
      } else {
        missingExpectations.push(expectation.id || `${expectation.promise?.kind || 'unknown'}:${expectation.promise?.value || 'unknown'}`);
      }
    }
  } catch (error) {
    // Unexpected errors during alignment check: treat as misalignment
    // (better to fail early than to proceed with uncertain state)
    return {
      domPresentCount: 0,
      expectationsTotal,
      aligned: false,
      missingExpectations: expectations.map(e => e.id || 'unknown'),
      error: error.message,
    };
  } finally {
    // Clean up browser resources (critical for resource safety)
    if (page) {
      try { await page.close(); } catch (_err) { /* ignore */ }
    }
    if (context) {
      try { await context.close(); } catch (_err) { /* ignore */ }
    }
    if (browser) {
      try { await browser.close(); } catch (_err) { /* ignore */ }
    }
  }

  const aligned = domPresentCount > 0;

  return {
    domPresentCount,
    expectationsTotal,
    aligned,
    missingExpectations,
  };
}
/**
 * Check if a single expectation is detectable in the page DOM
 * 
 * Conservative approach: check for basic presence indicators
 * without executing code or expecting full page interaction capability.
 */
async function checkExpectationInDOM(page, expectation) {
  try {
    const promise = expectation.promise || {};
    const kind = (promise.kind || '').toLowerCase();
    const value = promise.value || '';

    // Navigation expectations: check for href in page DOM
    if (kind === 'navigate') {
      if (!value) return false;
      // Check if any <a> element has this href
      try {
        const href = await page.locator(`a[href="${value}"]`).count();
        return href > 0;
      } catch {
        return false;
      }
    }

    // Form/Submit expectations: check for form or submit button
    if (kind === 'submit') {
      if (!value) return false;
      try {
        // Check for form, button, or submit input
        const form = await page.locator('form').count();
        const button = await page.locator('button').count();
        return (form > 0 || button > 0);
      } catch {
        return false;
      }
    }

    // Validation/Feedback expectations: harder to check without text parsing
    // Conservative: assume present if page has interactive elements
    if (kind === 'validation' || kind === 'ui-feedback') {
      try {
        const formElements = await page.locator('input, textarea, select, button, label').count();
        return formElements > 0;
      } catch {
        return false;
      }
    }

    // Generic interaction/click: check for interactive elements
    if (kind === 'click' || kind === 'interact' || kind === 'interaction') {
      try {
        const interactive = await page.locator('button, a, [onclick], [role="button"]').count();
        return interactive > 0;
      } catch {
        return false;
      }
    }

    // State/mutation expectations: conservative - assume possible if page loaded
    if (kind === 'state' || kind === 'mutation') {
      return true;
    }

    // Unknown expectation type: conservative assumption of presence
    return true;
  } catch (error) {
    // Errors checking presence: treat as not present (safer)
    return false;
  }
}

