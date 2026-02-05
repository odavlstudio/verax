/**
 * Navigation Intent — deterministic, sensor-backed gating for navigation promises.
 *
 * Goal: Only emit broken_navigation_promise when intent is explicit AND
 * the intent-specific observable contract shows no effect.
 *
 * No selectors. No HTML blobs. Reasons are deterministic codes.
 */

export const NAVIGATION_INTENTS = Object.freeze({
  FULL_PAGE_NAV: 'FULL_PAGE_NAV',
  SPA_ROUTE_NAV: 'SPA_ROUTE_NAV',
  HASH_NAV: 'HASH_NAV',
  UNKNOWN_NAV_INTENT: 'UNKNOWN_NAV_INTENT',
});

function capReasonStrings(reasons) {
  if (!Array.isArray(reasons)) return [];
  return reasons
    .filter(r => typeof r === 'string' && r.length > 0)
    .slice(0, 8)
    .map(r => (r.length > 80 ? r.slice(0, 80) : r));
}

function safeUrlHash(urlString) {
  if (typeof urlString !== 'string' || urlString.length === 0) return null;
  try {
    const u = new URL(urlString);
    return u.hash || '';
  } catch {
    return null;
  }
}

/**
 * Infer navigation intent from the safest available inputs:
 * - runtimeNav metadata (DOM-discovered navigation targets)
 * - minimal element snapshot (href kind, click handler, form association)
 *
 * @param {Object} params
 * @param {Object|null} params.elementSnapshot
 * @param {Object|null} params.runtimeNav
 * @param {Object|null} params.expectation
 * @returns {{ intent: keyof typeof NAVIGATION_INTENTS, reasons: string[] }}
 */
export function inferNavigationIntent({ elementSnapshot, runtimeNav, expectation }) {
  /** @type {string[]} */
  const reasons = [];

  // Runtime navigation discovery implies explicit navigation intent.
  if (runtimeNav && typeof runtimeNav.href === 'string' && runtimeNav.href.length > 0) {
    if (runtimeNav.href.trim().startsWith('#')) {
      reasons.push('runtime_nav_hash_href');
      return { intent: NAVIGATION_INTENTS.HASH_NAV, reasons };
    }
    reasons.push('runtime_nav_href');
    return { intent: NAVIGATION_INTENTS.FULL_PAGE_NAV, reasons };
  }

  const href = elementSnapshot?.href;
  const hrefPresent = href?.present === true;
  const hrefKind = typeof href?.kind === 'string' ? href.kind : null;

  if (hrefPresent) {
    if (hrefKind === 'hash_only') {
      reasons.push('anchor_hash_href');
      return { intent: NAVIGATION_INTENTS.HASH_NAV, reasons };
    }
    reasons.push(`anchor_href_kind:${hrefKind || 'unknown'}`);
    return { intent: NAVIGATION_INTENTS.FULL_PAGE_NAV, reasons };
  }

  // Navigation expectation + explicit click handler implies SPA-style route navigation.
  if (expectation?.type === 'navigation' && elementSnapshot?.hasOnClick === true) {
    reasons.push('navigation_promise_click_handler');
    return { intent: NAVIGATION_INTENTS.SPA_ROUTE_NAV, reasons };
  }

  reasons.push('insufficient_navigation_semantics');
  return { intent: NAVIGATION_INTENTS.UNKNOWN_NAV_INTENT, reasons: capReasonStrings(reasons) };
}

/**
 * Evaluate intent-specific observable contract.
 *
 * @param {keyof typeof NAVIGATION_INTENTS} intent
 * @param {Object} signals
 * @param {Object|null} routeData
 * @returns {{ effectObserved: boolean, observablesAvailable: boolean, details: Object }}
 */
export function evaluateNavigationObservables(intent, signals, routeData) {
  const sig = signals || {};

  const navChanged = sig.navigationChanged === true;
  const routeChanged = sig.routeChanged === true;
  const rootDomChanged = sig.meaningfulDomChange === true || sig.meaningfulUIChange === true;

  const beforeUrl = routeData?.before?.url || null;
  const afterUrl = routeData?.after?.url || null;
  const beforeHash = safeUrlHash(beforeUrl);
  const afterHash = safeUrlHash(afterUrl);
  const hashComparable = beforeHash !== null && afterHash !== null;
  const hashChanged = hashComparable ? beforeHash !== afterHash : false;

  if (intent === NAVIGATION_INTENTS.FULL_PAGE_NAV) {
    // Contract: urlChanged OR documentReloaded.
    // We do not have a dedicated reload signal; require url change (navChanged).
    return {
      effectObserved: navChanged,
      observablesAvailable: true,
      details: { navChanged, routeChanged }
    };
  }

  if (intent === NAVIGATION_INTENTS.SPA_ROUTE_NAV) {
    // Contract: routeChanged OR historyChanged OR rootDomChanged.
    // Map historyChanged => routeChanged (route sensor), rootDomChanged => meaningful DOM/UI.
    return {
      effectObserved: routeChanged || navChanged || rootDomChanged,
      observablesAvailable: true,
      details: { routeChanged, navChanged, rootDomChanged }
    };
  }

  if (intent === NAVIGATION_INTENTS.HASH_NAV) {
    // Contract: hashChanged (requires before/after URLs to be comparable).
    return {
      effectObserved: hashChanged,
      observablesAvailable: hashComparable,
      details: { hashComparable, hashChanged }
    };
  }

  return {
    effectObserved: false,
    observablesAvailable: false,
    details: { unsupportedIntent: true }
  };
}

