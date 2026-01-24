import { createHash } from 'crypto';
import { getTimeProvider } from '../support/time-provider.js';

/**
 * Route Sensor — Universal SPA Route Detection
 * 
 * Detects route transitions in SPAs by intercepting History API
 * and capturing route signatures before/after interactions.
 * 
 * Works across frameworks by observing browser reality:
 * - history.pushState / replaceState
 * - popstate events
 * - URL changes
 * - Document title changes
 * - Root container content changes
 */

/**
 * Inject route sensor into page context
 * Patches History API to capture route transitions
 */
export async function injectRouteSensor(page) {
  try {
    await page.evaluate(() => {
      /* eslint-disable no-undef */
      if (window.__VERAX_ROUTE_SENSOR_INJECTED__) return;
      window.__VERAX_ROUTE_SENSOR_INJECTED__ = true;
      
      window.__VERAX_ROUTE_TRANSITIONS__ = [];
      // @ts-ignore - Augmented window properties in browser context
      window.__VERAX_ROUTE_COUNTER__ = window.__VERAX_ROUTE_COUNTER__ || 0;
      // @ts-ignore - Augmented window properties in browser context
      window.__veraxRouteLastChanged = window.__veraxRouteLastChanged || 0;

      const nextTimestamp = () => {
        // @ts-ignore - Augmented window properties in browser context
        window.__VERAX_ROUTE_COUNTER__ += 1;
        // @ts-ignore - Augmented window properties in browser context
        return window.__VERAX_ROUTE_COUNTER__;
      };
      
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;
      
      history.pushState = function(...args) {
        const timestamp = nextTimestamp();
        window.__veraxRouteLastChanged = timestamp;
        window.__VERAX_ROUTE_TRANSITIONS__.push({
          type: 'pushState',
          timestamp,
          url: location.href,
          state: args[0]
        });
        return originalPushState.apply(this, args);
      };
      
      history.replaceState = function(...args) {
        const timestamp = nextTimestamp();
        window.__veraxRouteLastChanged = timestamp;
        window.__VERAX_ROUTE_TRANSITIONS__.push({
          type: 'replaceState',
          timestamp,
          url: location.href,
          state: args[0]
        });
        return originalReplaceState.apply(this, args);
      };
      
      window.addEventListener('popstate', (event) => {
        const timestamp = nextTimestamp();
        window.__veraxRouteLastChanged = timestamp;
        window.__VERAX_ROUTE_TRANSITIONS__.push({
          type: 'popstate',
          timestamp,
          url: location.href,
          state: event.state
        });
      });
      /* eslint-enable no-undef */
    });
    
    return { injected: true, error: null };
  } catch (error) {
    // Never crash observation on injection failure
    return { injected: false, error: error.message };
  }
}

/**
 * Capture route signature at current moment
 * Returns a stable-ish signature that can detect SPA transitions
 */
export async function captureRouteSignature(page) {
  try {
    const signature = await page.evaluate(() => {
      /* eslint-disable no-undef */
      const url = location.href;
      const path = location.pathname + location.search;
      const title = document.title || '';
      // @ts-ignore - Augmented window properties in browser context
      window.__VERAX_ROUTE_COUNTER__ = window.__VERAX_ROUTE_COUNTER__ || 0;
      const nextTimestamp = () => {
        // @ts-ignore - Augmented window properties in browser context
        window.__VERAX_ROUTE_COUNTER__ += 1;
        // @ts-ignore - Augmented window properties in browser context
        return window.__VERAX_ROUTE_COUNTER__;
      };
      
      // Canonical link (if present)
      const canonicalLink = document.querySelector('link[rel="canonical"]');
      const canonical = canonicalLink ? /** @type {HTMLLinkElement} */ (canonicalLink).href : null;
      
      // Root container fingerprint (bounded)
      let containerFingerprint = null;
      const rootSelectors = [
        '#root',
        '#app',
        '#__next',
        'main',
        '[role="main"]',
        'body > div:first-child'
      ];
      
      for (const selector of rootSelectors) {
        const container = document.querySelector(selector);
        if (container) {
          // Bounded fingerprint: first 200 chars of text + element count
          const textContent = (/** @type {HTMLElement} */ (container).innerText || '').substring(0, 200);
          const elementCount = container.querySelectorAll('*').length;
          containerFingerprint = `${textContent.length}:${elementCount}:${textContent.substring(0, 50)}`;
          break;
        }
      }
      
      return {
        url,
        path,
        title,
        canonical,
        containerFingerprint,
        timestamp: nextTimestamp()
      };
      /* eslint-enable no-undef */
    });
    
    return signature;
  } catch (error) {
    // Return minimal signature on error
    return {
      url: null,
      path: null,
      title: null,
      canonical: null,
      containerFingerprint: null,
      error: error.message,
      timestamp: getTimeProvider().now()
    };
  }
}

/**
 * Get route transitions since last reset
 */
export async function getRouteTransitions(page) {
  try {
    const transitions = await page.evaluate(() => {
      const transitions = window.__VERAX_ROUTE_TRANSITIONS__ || [];
      window.__VERAX_ROUTE_TRANSITIONS__ = []; // Reset for next interaction
      return transitions;
    });
    
    return transitions;
  } catch (error) {
    return [];
  }
}

/**
 * Compare two route signatures to detect meaningful changes
 */
export function routeSignatureChanged(before, after) {
  if (!before || !after) return false;
  
  // URL changed (most obvious signal)
  if (before.url !== after.url) return true;
  
  // Path changed (SPA navigation without origin change)
  if (before.path !== after.path) return true;
  
  // Title changed (often indicates route change)
  if (before.title !== after.title && after.title) return true;
  
  // Canonical changed
  if (before.canonical !== after.canonical && after.canonical) return true;
  
  // Container fingerprint changed meaningfully
  if (before.containerFingerprint !== after.containerFingerprint) {
    // Only count as route change if fingerprint is substantially different
    // (not just minor text changes)
    if (before.containerFingerprint && after.containerFingerprint) {
      const beforeParts = before.containerFingerprint.split(':');
      const afterParts = after.containerFingerprint.split(':');
      
      if (beforeParts.length >= 2 && afterParts.length >= 2) {
        const beforeElements = parseInt(beforeParts[1], 10);
        const afterElements = parseInt(afterParts[1], 10);
        
        // If element count changed by >20%, consider it a route change
        const elementChange = Math.abs(afterElements - beforeElements);
        if (elementChange > Math.max(beforeElements, afterElements) * 0.2) {
          return true;
        }
      }
    }
  }
  
  return false;
}

/**
 * Compute a deterministic hash of route signature (for comparison)
 * Excludes timestamp to maintain determinism
 */
export function hashRouteSignature(signature) {
  if (!signature) return null;
  
  const normalized = {
    url: signature.url || '',
    path: signature.path || '',
    title: signature.title || '',
    canonical: signature.canonical || '',
    containerFingerprint: signature.containerFingerprint || ''
  };
  
  const hash = /** @type {string} */ (createHash('sha256')
    .update(JSON.stringify(normalized))
    .digest('hex'));
  
  return hash.substring(0, 12);
}

/**
 * Analyze route transition events to detect navigation
 */
export function analyzeRouteTransitions(transitions) {
  if (!Array.isArray(transitions) || transitions.length === 0) {
    return {
      hasTransitions: false,
      pushStateCount: 0,
      replaceStateCount: 0,
      popstateCount: 0
    };
  }
  
  const pushStateCount = transitions.filter(t => t.type === 'pushState').length;
  const replaceStateCount = transitions.filter(t => t.type === 'replaceState').length;
  const popstateCount = transitions.filter(t => t.type === 'popstate').length;
  
  return {
    hasTransitions: true,
    pushStateCount,
    replaceStateCount,
    popstateCount,
    transitions
  };
}
