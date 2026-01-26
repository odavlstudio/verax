// ⚠️ FROZEN FOR V1 — Not part of VERAX v1 product guarantee
// Dynamic routes (e.g., /user/${id}) intentionally excluded from v1 scope per VISION.
// Future expansion planned when guarantees can be preserved.

/**
 * PHASE 14 — DYNAMIC ROUTE INTELLIGENCE
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 * RESPONSIBILITY: RUNTIME & JS-DRIVEN ROUTE ANALYSIS
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * This module handles RUNTIME and PROGRAMMATIC routing patterns:
 * - JS-driven navigation (router.push(), navigate(), etc.)
 * - Dynamic parameter resolution at runtime
 * - Auth-gated route verification
 * - SSR-only route detection
 * - Observable signal correlation for route outcomes
 * 
 * EXPLICITLY HANDLES:
 * ✓ Dynamic route verifiability classification
 * ✓ Runtime navigation correlation with trace data
 * ✓ Auth-gated, SSR-only, runtime-only route detection
 * ✓ Observable signal verification (URL, DOM, UI feedback)
 * ✓ Route verdict determination (VERIFIED, SILENT_FAILURE, AMBIGUOUS)
 * 
 * EXPLICITLY DOES NOT HANDLE:
 * ✗ Static/declarative route extraction (file-system, JSX, config)
 * ✗ Basic route model construction
 * ✗ Simple static path correlation
 * 
 * FOR STATIC ROUTES: See route-intelligence.js
 * FOR SHARED UTILITIES: See shared/dynamic-route-normalizer.js
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { isDynamicPath, normalizeDynamicRoute, normalizeNavigationTarget } from '../shared/dynamic-route-normalizer.js';
import { correlateNavigationWithRoute, evaluateRouteNavigation } from './route-intelligence.js';
import { scoreUIFeedback, detectUIFeedbackSignals } from './ui-feedback-intelligence.js';

/**
 * PHASE 14: Dynamic Route Verifiability Classification
 */
export const DYNAMIC_ROUTE_VERIFIABILITY = {
  STATIC: 'STATIC',
  VERIFIED_DYNAMIC: 'VERIFIED_DYNAMIC',
  AMBIGUOUS_DYNAMIC: 'AMBIGUOUS_DYNAMIC',
  UNVERIFIABLE_DYNAMIC: 'UNVERIFIABLE_DYNAMIC',
};

/**
 * PHASE 14: Route Verdict
 */
export const ROUTE_VERDICT = {
  VERIFIED: 'VERIFIED',
  SILENT_FAILURE: 'SILENT_FAILURE',
  ROUTE_MISMATCH: 'ROUTE_MISMATCH',
  AMBIGUOUS: 'AMBIGUOUS',
};

/**
 * PHASE 14: Classify dynamic route by verifiability
 * 
 * RESPONSIBILITY: Runtime route classification (auth-gated, SSR-only, observable signals)
 * Only for JS-driven/programmatic routes, NOT static file-system routes
 * 
 * For static route models, see route-intelligence.js
 * 
 * @param {Object} routeModel - Route model from route intelligence
 * @param {Object} trace - Interaction trace (optional, for runtime analysis)
 * @returns {Object} Classification result
 */
export function classifyDynamicRoute(routeModel, trace = null) {
  const path = routeModel.path || '';
  const originalPattern = routeModel.originalPattern || path;
  
  // STATIC: No dynamic parameters
  if (!isDynamicPath(path) && !isDynamicPath(originalPattern)) {
    return {
      verifiability: DYNAMIC_ROUTE_VERIFIABILITY.STATIC,
      reason: 'Route contains no dynamic parameters',
      confidence: 1.0,
    };
  }
  
  // Check if route can be normalized
  const normalized = normalizeDynamicRoute(originalPattern);
  if (!normalized || !normalized.examplePath) {
    return {
      verifiability: DYNAMIC_ROUTE_VERIFIABILITY.UNVERIFIABLE_DYNAMIC,
      reason: 'Dynamic route pattern cannot be normalized to example path',
      confidence: 0.9,
    };
  }
  
  // Check route characteristics that affect verifiability
  const isAuthGated = isAuthGatedRoute(routeModel, trace);
  const isSSROnly = isSSROnlyRoute(routeModel, trace);
  const isRuntimeOnly = isRuntimeOnlyRoute(routeModel, trace);
  // @ts-expect-error - Function hoisting
  const hasObservableSignals = hasObservableSignals(routeModel, trace);
  
  // UNVERIFIABLE: Auth-gated, SSR-only, or runtime-only without observable signals
  if (isAuthGated || isSSROnly || (isRuntimeOnly && !hasObservableSignals)) {
    return {
      verifiability: DYNAMIC_ROUTE_VERIFIABILITY.UNVERIFIABLE_DYNAMIC,
      reason: buildUnverifiableReason(isAuthGated, isSSROnly, isRuntimeOnly, hasObservableSignals),
      confidence: 0.9,
    };
  }
  
  // Check if we can verify the outcome
  if (trace) {
    const canVerify = canVerifyRouteOutcome(routeModel, trace);
    
    if (canVerify.verifiable) {
      return {
        verifiability: DYNAMIC_ROUTE_VERIFIABILITY.VERIFIED_DYNAMIC,
        reason: canVerify.reason,
        confidence: canVerify.confidence,
      };
    } else {
      return {
        verifiability: DYNAMIC_ROUTE_VERIFIABILITY.AMBIGUOUS_DYNAMIC,
        reason: canVerify.reason || 'Route pattern known but outcome unclear',
        confidence: 0.6,
      };
    }
  }
  
  // Default: AMBIGUOUS if pattern is known but we can't verify yet
  return {
    verifiability: DYNAMIC_ROUTE_VERIFIABILITY.AMBIGUOUS_DYNAMIC,
    reason: 'Route pattern known but outcome cannot be verified without trace data',
    confidence: 0.6,
  };
}

/**
 * Check if route is auth-gated
 * 
 * NOTE: Auth detection is runtime-specific behavior.
 * Static routes should use route-intelligence.js for basic correlation.
 */
function isAuthGatedRoute(routeModel, _trace) {
  // Check route path patterns
  const path = routeModel.path || '';
  const authPatterns = ['/admin', '/dashboard', '/account', '/settings', '/profile', '/user'];
  
  if (authPatterns.some(pattern => path.includes(pattern))) {
    return true;
  }
  
  // Check trace for auth-related signals
  if (_trace) {
    const sensors = _trace.sensors || {};
    const navSensor = sensors.navigation || {};
    
    // If navigation was blocked or redirected to login
    if (navSensor.blockedNavigations?.length > 0) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if route is SSR-only
 */
function isSSROnlyRoute(routeModel, _trace) {
  // Next.js app router with dynamic segments might be SSR-only
  if (routeModel.framework === 'next-app' && routeModel.isDynamic) {
    // Check if route has getServerSideProps or similar indicators
    // For now, we'll be conservative and not mark as SSR-only without evidence
    return false;
  }
  
  return false;
}

/**
 * Check if route is runtime-only (no static analysis possible)
 */
function isRuntimeOnlyRoute(routeModel, _trace) {
  // Routes with complex template literals or runtime variables
  const originalPattern = routeModel.originalPattern || '';
  
  // Pure variable references like ${path} or ${id} without pattern
  if (originalPattern.includes('${') && !originalPattern.match(/\/[^$]+\$\{[^}]+\}/)) {
    return true;
  }
  
  return false;
}

/**
 * Check if route has observable signals
 */
function _hasObservableSignals(routeModel, trace) {
  if (!trace) return false;
  
  const sensors = trace.sensors || {};
  const navSensor = sensors.navigation || {};
  const uiSignals = sensors.uiSignals || {};
  const uiFeedback = sensors.uiFeedback || {};
  
  // Check for URL change
  if (navSensor.urlChanged === true) {
    return true;
  }
  
  // Check for UI feedback
  if (uiSignals.diff?.changed === true || uiFeedback.overallUiFeedbackScore > 0.3) {
    return true;
  }
  
  // Check for DOM change
  if (trace.dom?.beforeHash !== trace.dom?.afterHash) {
    return true;
  }
  
  return false;
}

/**
 * Check if route outcome can be verified
 */
function canVerifyRouteOutcome(routeModel, trace) {
  const sensors = trace.sensors || {};
  const navSensor = sensors.navigation || {};
  const beforeUrl = trace.before?.url || navSensor.beforeUrl || '';
  const afterUrl = trace.after?.url || navSensor.afterUrl || '';
  
  // Check URL change
  const urlChanged = navSensor.urlChanged === true || (beforeUrl && afterUrl && beforeUrl !== afterUrl);
  
  // Check if URL matches route pattern
  const afterPath = extractPathFromUrl(afterUrl);
  const routeMatched = matchDynamicPattern(afterPath, routeModel.originalPattern || routeModel.path);
  
  // Check UI feedback
  const uiSignals = detectUIFeedbackSignals(trace);
  const hasUIFeedback = uiSignals.length > 0;
  
  // Check DOM change
  const domChanged = trace.dom?.beforeHash !== trace.dom?.afterHash;
  
  if (urlChanged && routeMatched && (hasUIFeedback || domChanged)) {
    return {
      verifiable: true,
      reason: 'URL changed, route pattern matched, and UI feedback or DOM change observed',
      confidence: 0.9,
    };
  }
  
  if (urlChanged && routeMatched) {
    return {
      verifiable: true,
      reason: 'URL changed and route pattern matched',
      confidence: 0.8,
    };
  }
  
  if (urlChanged && !routeMatched) {
    return {
      verifiable: false,
      reason: 'URL changed but does not match route pattern',
      confidence: 0.7,
    };
  }
  
  return {
    verifiable: false,
    reason: 'No URL change or observable signals',
    confidence: 0.5,
  };
}

/**
 * Build reason for unverifiable route
 */
function buildUnverifiableReason(isAuthGated, isSSROnly, isRuntimeOnly, hasObservableSignals) {
  const reasons = [];
  
  if (isAuthGated) {
    reasons.push('auth-gated');
  }
  if (isSSROnly) {
    reasons.push('SSR-only');
  }
  if (isRuntimeOnly) {
    reasons.push('runtime-only');
  }
  if (!hasObservableSignals) {
    reasons.push('no observable signals');
  }
  
  return `Route is ${reasons.join(', ')}`;
}

/**
 * Match dynamic pattern against actual path
 */
function matchDynamicPattern(actualPath, pattern) {
  if (!actualPath || !pattern) return false;
  
  // Convert pattern to regex
  let regexPattern = pattern;
  
  // Replace :param with (\w+)
  regexPattern = regexPattern.replace(/:(\w+)/g, '(\\w+)');
  
  // Replace [param] with (\w+)
  regexPattern = regexPattern.replace(/\[(\w+)\]/g, '(\\w+)');
  
  // Escape other special characters
  regexPattern = regexPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // Restore the capture groups
  regexPattern = regexPattern.replace(/\\\(\\\\w\+\\\)/g, '(\\w+)');
  
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(actualPath);
}

/**
 * Extract path from URL
 */
function extractPathFromUrl(url) {
  if (!url || typeof url !== 'string') return '';
  
  try {
    const urlObj = new URL(url);
    return urlObj.pathname;
  } catch {
    // Relative URL
    const pathMatch = url.match(/^([^?#]+)/);
    return pathMatch ? pathMatch[1] : url;
  }
}

/**
 * PHASE 14: Correlate navigation promise with dynamic route and UI feedback
 * 
 * RESPONSIBILITY: Runtime correlation using observable signals (URL, DOM, UI feedback)
 * Verifies route outcomes with trace data, handles ambiguous cases
 * 
 * For basic static correlation, see route-intelligence.js correlateNavigationWithRoute
 * 
 * @param {Object} expectation - Navigation expectation
 * @param {Object} routeModel - Route model
 * @param {Object} trace - Interaction trace
 * @returns {Object} Correlation result with verdict
 */
export function correlateDynamicRouteNavigation(expectation, routeModel, trace) {
  const classification = classifyDynamicRoute(routeModel, trace);
  
  // If route is UNVERIFIABLE, return skip
  if (classification.verifiability === DYNAMIC_ROUTE_VERIFIABILITY.UNVERIFIABLE_DYNAMIC) {
    return {
      verdict: null,
      skip: true,
      skipReason: classification.reason,
      confidence: classification.confidence,
    };
  }
  
  // Normalize navigation target
  const navigationTarget = expectation.targetPath || expectation.expectedTarget || '';
  const normalized = normalizeNavigationTarget(navigationTarget);
  const targetToMatch = normalized.exampleTarget || navigationTarget;
  
  // Match route pattern
  const routeMatched = matchDynamicPattern(targetToMatch, routeModel.originalPattern || routeModel.path);
  
  // Get route evaluation from route intelligence
  const correlation = correlateNavigationWithRoute(navigationTarget, [routeModel]);
  const _routeEvaluation = correlation ? evaluateRouteNavigation(correlation, trace, trace.before?.url || '', trace.after?.url || '') : null;
  
  // Get UI feedback score
  const uiSignals = detectUIFeedbackSignals(trace);
  const feedbackScore = scoreUIFeedback(uiSignals, expectation, trace);
  
  // Determine verdict
  const sensors = trace.sensors || {};
  const navSensor = sensors.navigation || {};
  const urlChanged = navSensor.urlChanged === true;
  const afterPath = extractPathFromUrl(trace.after?.url || navSensor.afterUrl || '');
  
  // VERIFIED: URL changed, route matched, and UI feedback present
  if (urlChanged && routeMatched && feedbackScore.score === 'FEEDBACK_CONFIRMED') {
    return {
      verdict: ROUTE_VERDICT.VERIFIED,
      skip: false,
      confidence: 0.9,
      reason: 'Navigation successful: URL changed, route matched, and UI feedback confirmed',
      evidence: {
        urlChanged: true,
        routeMatched: true,
        uiFeedback: feedbackScore.score,
        afterPath,
      },
    };
  }
  
  // VERIFIED: URL changed and route matched (even without explicit UI feedback)
  if (urlChanged && routeMatched) {
    return {
      verdict: ROUTE_VERDICT.VERIFIED,
      skip: false,
      confidence: 0.85,
      reason: 'Navigation successful: URL changed and route matched',
      evidence: {
        urlChanged: true,
        routeMatched: true,
        afterPath,
      },
    };
  }
  
  // ROUTE_MISMATCH: URL changed but doesn't match route
  if (urlChanged && !routeMatched) {
    return {
      verdict: ROUTE_VERDICT.ROUTE_MISMATCH,
      skip: false,
      confidence: 0.8,
      reason: `Navigation occurred but target route does not match. Expected pattern: ${routeModel.originalPattern}, Actual: ${afterPath}`,
      evidence: {
        urlChanged: true,
        routeMatched: false,
        expectedPattern: routeModel.originalPattern,
        actualPath: afterPath,
      },
    };
  }
  
  // SILENT_FAILURE: No URL change, no route match, no UI feedback
  if (!urlChanged && !routeMatched && feedbackScore.score === 'FEEDBACK_MISSING') {
    return {
      verdict: ROUTE_VERDICT.SILENT_FAILURE,
      skip: false,
      confidence: 0.85,
      reason: 'Navigation promise not fulfilled: no URL change, route mismatch, and no UI feedback',
      evidence: {
        urlChanged: false,
        routeMatched: false,
        uiFeedback: feedbackScore.score,
      },
    };
  }
  
  // AMBIGUOUS: Unclear outcome
  if (classification.verifiability === DYNAMIC_ROUTE_VERIFIABILITY.AMBIGUOUS_DYNAMIC) {
    return {
      verdict: ROUTE_VERDICT.AMBIGUOUS,
      skip: false,
      confidence: 0.6,
      reason: classification.reason || 'Dynamic route outcome is ambiguous',
      evidence: {
        classification: classification.verifiability,
        urlChanged,
        routeMatched,
        uiFeedback: feedbackScore.score,
      },
    };
  }
  
  // Default: AMBIGUOUS
  return {
    verdict: ROUTE_VERDICT.AMBIGUOUS,
    skip: false,
    confidence: 0.5,
    reason: 'Route navigation outcome unclear',
    evidence: {
      urlChanged,
      routeMatched,
      uiFeedback: feedbackScore.score,
    },
  };
}

/**
 * PHASE 14: Build evidence for dynamic route finding
 * 
 * @param {Object} expectation - Navigation expectation
 * @param {Object} routeModel - Route model
 * @param {Object} correlation - Correlation result
 * @param {Object} trace - Interaction trace
 * @returns {Object} Evidence object
 */
export function buildDynamicRouteEvidence(expectation, routeModel, correlation, trace) {
  const classification = classifyDynamicRoute(routeModel, trace);
  const uiSignals = detectUIFeedbackSignals(trace);
  const feedbackScore = scoreUIFeedback(uiSignals, expectation, trace);
  
  const evidence = {
    routeDefinition: {
      path: routeModel.path,
      originalPattern: routeModel.originalPattern || routeModel.path,
      type: routeModel.type,
      stability: routeModel.stability,
      source: routeModel.source,
      sourceRef: routeModel.sourceRef,
      verifiability: classification.verifiability,
      verifiabilityReason: classification.reason,
    },
    navigationTrigger: {
      target: expectation.targetPath || expectation.expectedTarget || null,
      method: expectation.promise?.method || null,
      astSource: expectation.source?.astSource || null,
      context: expectation.source?.context || null,
    },
    beforeAfter: {
      beforeUrl: trace.before?.url || trace.sensors?.navigation?.beforeUrl || null,
      afterUrl: trace.after?.url || trace.sensors?.navigation?.afterUrl || null,
      beforeScreenshot: trace.before?.screenshot || null,
      afterScreenshot: trace.after?.screenshot || null,
      beforeDomHash: trace.dom?.beforeHash || null,
      afterDomHash: trace.dom?.afterHash || null,
    },
    signals: {
      urlChanged: correlation.evidence?.urlChanged || false,
      routeMatched: correlation.evidence?.routeMatched || false,
      uiFeedback: feedbackScore.score,
      uiFeedbackSignals: uiSignals.map(s => ({
        type: s.type,
        confidence: s.confidence,
      })),
      domChanged: trace.dom?.beforeHash !== trace.dom?.afterHash,
    },
    correlation: {
      verdict: correlation.verdict,
      confidence: correlation.confidence,
      reason: correlation.reason,
      skip: correlation.skip || false,
      skipReason: correlation.skipReason || null,
    },
  };
  
  return evidence;
}

/**
 * PHASE 14: Check if route should be skipped (unverifiable)
 * 
 * @param {Object} routeModel - Route model
 * @param {Object} trace - Interaction trace
 * @returns {Object} Skip decision
 */
export function shouldSkipDynamicRoute(routeModel, trace) {
  const classification = classifyDynamicRoute(routeModel, trace);
  
  if (classification.verifiability === DYNAMIC_ROUTE_VERIFIABILITY.UNVERIFIABLE_DYNAMIC) {
    return {
      skip: true,
      reason: classification.reason,
      confidence: classification.confidence,
    };
  }
  
  return {
    skip: false,
    reason: null,
    confidence: 0,
  };
}




