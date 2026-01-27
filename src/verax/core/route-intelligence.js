/**
 * PHASE 12 — STATIC ROUTE INTELLIGENCE
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 * RESPONSIBILITY: DECLARATIVE & STATIC ROUTE ANALYSIS
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * This module handles STATIC and DECLARATIVE routing patterns:
 * - File-system routes (Next.js pages/app router)
 * - JSX-declared routes (React Router <Route> components)
 * - Config-based routes (Vue Router configuration)
 * - Basic route taxonomy and correlation
 * 
 * EXPLICITLY HANDLES:
 * ✓ Route model construction from static declarations
 * ✓ Basic navigation promise correlation (exact path matching)
 * ✓ Route evaluation for static paths
 * ✓ Evidence building for declarative routes
 * 
 * EXPLICITLY DOES NOT HANDLE:
 * ✗ Runtime/JS-driven navigation (programmatic routing)
 * ✗ Dynamic route parameter resolution at runtime
 * ✗ Auth-gated or SSR-only route verification
 * ✗ Complex pattern matching for dynamic segments
 * 
 * FOR RUNTIME-DRIVEN ROUTES: See dynamic-route-intelligence.js
 * FOR DYNAMIC PARAMETERS: See shared/dynamic-route-normalizer.js
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { normalizeDynamicRoute as _normalizeDynamicRoute, isDynamicPath, normalizeNavigationTarget } from '../shared/dynamic-route-normalizer.js';
import { extractParameters, matchDynamicPattern, extractPathFromUrl } from './route-intelligence/pattern-utils.js';

/**
 * Route Taxonomy
 */
export const ROUTE_TYPE = {
  STATIC: 'static',
  DYNAMIC: 'dynamic',
  AMBIGUOUS: 'ambiguous',
  PROGRAMMATIC: 'programmatic'
};

export const ROUTE_STABILITY = {
  STATIC: 'static',      // Fully static route
  DYNAMIC: 'dynamic',    // Dynamic but can be normalized
  AMBIGUOUS: 'ambiguous' // Cannot be deterministically validated
};

export const ROUTE_SOURCE = {
  FILE_SYSTEM: 'file_system',  // Next.js pages/app router
  JSX: 'jsx',                  // React Router <Route>
  CONFIG: 'config',            // Vue Router config
  PROGRAMMATIC: 'programmatic' // navigate(), router.push()
};

/**
 * PHASE 12: Unified Route Model
 * 
 * @typedef {Object} RouteModel
 * @property {string} path - Normalized route path
 * @property {string} type - ROUTE_TYPE (static, dynamic, ambiguous, programmatic)
 * @property {string} stability - ROUTE_STABILITY (static, dynamic, ambiguous)
 * @property {string} source - ROUTE_SOURCE (file_system, jsx, config, programmatic)
 * @property {string} framework - Framework identifier
 * @property {string} sourceRef - Source reference (file:line:col)
 * @property {string} file - Source file path
 * @property {number} line - Source line number
 * @property {string} [originalPattern] - Original dynamic pattern (if dynamic)
 * @property {string[]} [parameters] - Dynamic parameters (if dynamic)
 * @property {boolean} [isDynamic] - Whether route is dynamic
 * @property {boolean} [exampleExecution] - Whether example path was generated
 */

/**
 * Build unified route model from extracted routes
 * 
 * RESPONSIBILITY: Construct route models from STATIC/DECLARATIVE sources only
 * (file-system, JSX components, config files)
 * 
 * For runtime-driven routes, see dynamic-route-intelligence.js
 * 
 * @param {Array} extractedRoutes - Routes from route extractors
 * @returns {Array<RouteModel>} Unified route models
 */
export function buildRouteModels(extractedRoutes) {
  const routeModels = [];
  
  for (const route of extractedRoutes) {
    const path = route.path || '';
    const isDynamicRoute = route.isDynamic || isDynamicPath(path);
    
    // Determine route type
    let type = ROUTE_TYPE.STATIC;
    let stability = ROUTE_STABILITY.STATIC;
    
    if (isDynamicRoute) {
      type = ROUTE_TYPE.DYNAMIC;
      
      // Check if dynamic route can be normalized
      if (route.originalPattern || route.exampleExecution) {
        stability = ROUTE_STABILITY.DYNAMIC; // Can be normalized
      } else {
        stability = ROUTE_STABILITY.AMBIGUOUS; // Cannot be deterministically validated
      }
    }
    
    // Determine source
    let source = ROUTE_SOURCE.PROGRAMMATIC;
    if (route.framework === 'next-pages' || route.framework === 'next-app') {
      source = ROUTE_SOURCE.FILE_SYSTEM;
    } else if (route.framework === 'react-router') {
      source = ROUTE_SOURCE.JSX;
    } else if (route.framework === 'vue-router') {
      source = ROUTE_SOURCE.CONFIG;
    }
    
    const routeModel = {
      path,
      type,
      stability,
      source,
      framework: route.framework || 'unknown',
      sourceRef: route.sourceRef || `${route.file || 'unknown'}:${route.line || 1}`,
      file: route.file || null,
      line: route.line || null,
    };
    
    // Add dynamic route metadata
    if (isDynamicRoute) {
      routeModel.originalPattern = route.originalPattern || path;
      routeModel.isDynamic = true;
      routeModel.exampleExecution = route.exampleExecution || false;
      routeModel.parameters = route.parameters || extractParameters(path);
    }
    
    routeModels.push(routeModel);
  }
  
  return routeModels;
}

/**
 * PHASE 12: Correlate navigation promise with route
 * 
 * RESPONSIBILITY: Basic navigation-to-route correlation (exact/pattern matching)
 * Does NOT handle runtime signal verification or auth-gated routes
 * 
 * For runtime verification with trace data, see dynamic-route-intelligence.js
 * 
 * @param {string} navigationTarget - Navigation target from promise
 * @param {Array<RouteModel>} routeModels - Available route models
 * @returns {Object|null} Correlation result or null
 */
export function correlateNavigationWithRoute(navigationTarget, routeModels) {
  if (!navigationTarget || typeof navigationTarget !== 'string') {
    return null;
  }
  
  // Normalize navigation target (handle dynamic targets)
  const normalized = normalizeNavigationTarget(navigationTarget);
  const targetToMatch = normalized.exampleTarget || navigationTarget;
  
  // Try exact match first
  let matchedRoute = routeModels.find(r => r.path === targetToMatch);
  
  if (matchedRoute) {
    return {
      route: matchedRoute,
      matchType: 'exact',
      confidence: 1.0,
      normalizedTarget: targetToMatch,
      originalTarget: navigationTarget,
      isDynamic: normalized.isDynamic,
    };
  }
  
  // Try prefix match for dynamic routes
  for (const route of routeModels) {
    if (route.isDynamic && route.originalPattern) {
      // Check if target matches dynamic pattern
      const patternMatch = matchDynamicPattern(targetToMatch, route.originalPattern);
      if (patternMatch) {
        return {
          route: route,
          matchType: 'pattern',
          confidence: 0.9,
          normalizedTarget: targetToMatch,
          originalTarget: navigationTarget,
          isDynamic: true,
          patternMatch: patternMatch,
        };
      }
    }
  }
  
  // No match found
  return null;
}

/**
 * PHASE 12: Evaluate route navigation outcome
 *  * RESPONSIBILITY: Basic navigation evaluation for static routes
 * Does NOT handle auth gates, SSR-only routes, or complex runtime patterns
 * 
 * For dynamic route verdict determination, see dynamic-route-intelligence.js
 *  * @param {Object} correlation - Route correlation result
 * @param {Object} trace - Interaction trace
 * @param {string} beforeUrl - URL before interaction
 * @param {string} afterUrl - URL after interaction
 * @returns {Object} Evaluation result
 */
export function evaluateRouteNavigation(correlation, trace, beforeUrl, afterUrl) {
  if (!correlation) {
    return {
      outcome: 'NO_ROUTE_MATCH',
      confidence: 0.0,
      reason: 'Navigation target does not match any known route',
    };
  }
  
  const { route, normalizedTarget } = correlation;
  const sensors = trace.sensors || {};
  const navSensor = sensors.navigation || {};
  
  // Check URL change
  const urlChanged = navSensor.urlChanged === true || 
                     (beforeUrl && afterUrl && beforeUrl !== afterUrl);
  
  // Check if URL matches route
  const afterPath = extractPathFromUrl(afterUrl);
  const routeMatched = afterPath === route.path || 
                       afterPath === normalizedTarget ||
                       (route.isDynamic && matchDynamicPattern(afterPath, route.originalPattern));
  
  // Check router state change (for SPAs)
  const routerStateChanged = navSensor.routerStateChanged === true ||
                            navSensor.routeChanged === true ||
                            (navSensor.routerEvents && navSensor.routerEvents.length > 0);
  
  // Check UI change
  const uiChanged = sensors.uiSignals?.diff?.changed === true;
  const domChanged = trace.after?.dom !== trace.before?.dom;  const hasEvidence = (beforeUrl && afterUrl) && 
                      (urlChanged || routerStateChanged || uiChanged || domChanged);
  
  if (routeMatched && hasEvidence) {
    return {
      outcome: 'VERIFIED',
      confidence: route.stability === ROUTE_STABILITY.STATIC ? 1.0 : 0.9,
      reason: null,
      evidence: {
        urlChanged,
        routerStateChanged,
        uiChanged,
        domChanged,
        routeMatched: true,
      },
    };
  }
  
  if (!routeMatched && urlChanged) {
    return {
      outcome: 'ROUTE_MISMATCH',
      confidence: 0.8,
      reason: 'Navigation occurred but target route does not match',
      evidence: {
        urlChanged: true,
        expectedRoute: route.path,
        actualPath: afterPath,
      },
    };
  }
  
  if (!hasEvidence) {
    return {
      outcome: 'SILENT_FAILURE',
      confidence: correlation.confidence,
      reason: 'Navigation promise not fulfilled - no URL change, router state change, or UI change',
      evidence: {
        urlChanged: false,
        routerStateChanged: false,
        uiChanged: false,
        domChanged: false,
      },
    };
  }
  
  // Ambiguous case
  if (route.stability === ROUTE_STABILITY.AMBIGUOUS) {
    return {
      outcome: 'SUSPECTED',
      confidence: 0.6,
      reason: 'Dynamic route cannot be deterministically validated',
      evidence: {
        routeStability: 'ambiguous',
        urlChanged,
        routerStateChanged,
        uiChanged,
      },
    };
  }
  
  return {
    outcome: 'UNKNOWN',
    confidence: 0.5,
    reason: 'Route navigation outcome unclear',
  };
}

/**
 * PHASE 12: Build evidence for route-related finding
 * 
 * @param {Object} correlation - Route correlation
 * @param {Object} navigationPromise - Navigation promise from expectation
 * @param {Object} evaluation - Route evaluation result
 * @param {Object} trace - Interaction trace
 * @returns {Object} Evidence object
 */
export function buildRouteEvidence(correlation, navigationPromise, evaluation, trace) {
  const evidence = {
    routeDefinition: {
      path: correlation?.route?.path || null,
      type: correlation?.route?.type || null,
      stability: correlation?.route?.stability || null,
      source: correlation?.route?.source || null,
      sourceRef: correlation?.route?.sourceRef || null,
    },
    navigationTrigger: {
      target: navigationPromise?.target || null,
      method: navigationPromise?.method || null,
      astSource: navigationPromise?.astSource || null,
      context: navigationPromise?.context || null,
    },
    beforeAfter: {
      beforeUrl: trace.before?.url || null,
      afterUrl: trace.after?.url || null,
      beforeScreenshot: trace.before?.screenshot || null,
      afterScreenshot: trace.after?.screenshot || null,
    },
    signals: {
      urlChanged: evaluation.evidence?.urlChanged || false,
      routerStateChanged: evaluation.evidence?.routerStateChanged || false,
      uiChanged: evaluation.evidence?.uiChanged || false,
      domChanged: evaluation.evidence?.domChanged || false,
      routeMatched: evaluation.evidence?.routeMatched || false,
    },
    evaluation: {
      outcome: evaluation.outcome,
      confidence: evaluation.confidence,
      reason: evaluation.reason,
    },
  };
  
  return evidence;
}

/**
 * PHASE 12: Check if route change is false positive
 * 
 * @param {Object} trace - Interaction trace
 * @param {Object} _correlation - Route correlation
 * @ts-expect-error - JSDoc param documented but unused
 * @returns {boolean} True if should be ignored (false positive)
 */
export function isRouteChangeFalsePositive(trace, _correlation) {
  const sensors = trace.sensors || {};
  const navSensor = sensors.navigation || {};
  
  // Internal state-only route changes (shallow routing)
  if (navSensor.shallowRouting === true && !navSensor.urlChanged) {
    return true;
  }
  
  // Analytics-only navigation
  const networkSensor = sensors.network || {};
  const hasAnalyticsRequest = networkSensor.observedRequestUrls?.some(url => 
    url && typeof url === 'string' && url.includes('/api/analytics')
  );
  
  if (hasAnalyticsRequest && !navSensor.urlChanged && !sensors.uiSignals?.diff?.changed) {
    return true;
  }
  
  return false;
}




