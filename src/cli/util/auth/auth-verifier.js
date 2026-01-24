import { redactUrl } from '../evidence/redact.js';

/**
 * Auth Effectiveness Verification
 * Checks if authentication was successful based on page state
 */

/**
 * Check authentication effectiveness after page load
 * @param {import('playwright').Page} page - Playwright page instance
 * @param {string} url - Target URL
 * @param {{ initialStatus?: number|null, finalUrl?: string|null }} navSignals - Optional navigation metadata
 * @param {{ headersRedacted?: number, tokensRedacted?: number }} [redactionCounters] - Shared redaction counters
 * @returns {Promise<{effective: 'yes'|'no'|'unknown', signals: object, confidence: number}>}
 */
export async function verifyAuthEffectiveness(page, url, navSignals = {}, redactionCounters = { headersRedacted: 0, tokensRedacted: 0 }) {
  try {
    const signals = await page.evaluate(() => {
      const currentUrl = window.location.href;
      // @ts-expect-error - custom Verax instrumentation on window
      const status = window.__VERAX_HTTP_STATUS__ || null;
      const navEntries = window.performance?.getEntriesByType?.('navigation') || [];
      const navEntry = navEntries[0];
      const navStatus = typeof navEntry === 'object' && navEntry
        ? /** @type {any} */ (navEntry).responseStatus ?? null
        : null;
      return {
        httpStatus: status ?? navStatus ?? null,
        currentUrl,
        finalUrl: currentUrl,
        hasLoginForm: !!document.querySelector('form[action*="login"], form[action*="signin"], form[action*="auth"]'),
        hasPasswordInput: !!document.querySelector('input[type="password"]'),
        hasLoginText: /login|sign\s*in|authenticate/i.test(document.body?.textContent || ''),
        urlContainsLogin: /\/(login|signin|auth|authenticate)/i.test(currentUrl),
        title: document.title,
      };
    });

    // Refresh login text and title from Playwright context for determinism
    try {
      const text = await page.textContent('body').catch(() => '');
      signals.hasLoginText = /\b(sign in|log in|login|authenticate)\b/i.test(text);
    } catch {
      signals.hasLoginText = false;
    }

    try {
      signals.title = await page.title();
    } catch {
      signals.title = null;
    }

    const initialStatus = typeof navSignals.initialStatus === 'number' ? navSignals.initialStatus : signals.httpStatus;
    signals.httpStatus = typeof initialStatus === 'number' ? initialStatus : signals.httpStatus;
    const finalUrl = navSignals.finalUrl || signals.currentUrl || page.url?.() || url;
    const loginPath = /\/(login|signin|auth|authenticate)(\/|\?|#|$)/i.test(finalUrl || '');
    const urlLoginHint = loginPath || signals.urlContainsLogin === true;
    signals.urlContainsLogin = urlLoginHint;

    const safeRedaction = {
      headersRedacted: redactionCounters.headersRedacted ?? 0,
      tokensRedacted: redactionCounters.tokensRedacted ?? 0,
    };
    signals.currentUrl = typeof signals.currentUrl === 'string' ? redactUrl(signals.currentUrl, safeRedaction) : signals.currentUrl;
    signals.finalUrl = redactUrl(finalUrl, safeRedaction);

    /** @type {'yes'|'no'|'unknown'} */
    let effective = 'unknown';
    let confidence = 0.0;

    const strongStatus = initialStatus === 401 || initialStatus === 403;
    const strongLoginRedirect = urlLoginHint && (signals.hasPasswordInput || signals.hasLoginForm || signals.hasLoginText);
    const weakLoginHints = urlLoginHint || signals.hasPasswordInput || signals.hasLoginForm || signals.hasLoginText;

    if (strongStatus) {
      effective = 'no';
      confidence = 0.95;
    } else if (strongLoginRedirect) {
      effective = 'no';
      confidence = 0.9;
    } else if (weakLoginHints) {
      confidence = 0.5;
    }

    return { effective, signals: { ...signals, initialStatus, finalUrl: signals.finalUrl }, confidence };
  } catch (error) {
    return {
      effective: 'unknown',
      signals: {
        httpStatus: null,
        hasLoginForm: false,
        hasPasswordInput: false,
        hasLoginText: false,
        urlContainsLogin: false,
        title: null,
        error: error.message,
      },
      confidence: 0,
    };
  }
}
