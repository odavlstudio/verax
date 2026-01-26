/**
 * PHASE 14 — Dynamic Route Findings Detector (Vision 1.0 Scope Lock)
 * 
 * VISION 1.0: Dynamic routes are OUT OF SCOPE.
 * Produces SKIP entries for all dynamic routes (regardless of verifiability).
 * Never produces CONFIRMED findings or FAILURE judgments for dynamic routes.
 */

import {
  classifyDynamicRoute,
  DYNAMIC_ROUTE_VERIFIABILITY,
} from '../core/dynamic-route-intelligence.js';
import { buildRouteModels } from '../core/route-intelligence.js';

/**
 * PHASE 14: Detect dynamic route-related findings
 * 
 * VISION 1.0 SCOPE LOCK: All dynamic routes are OUT OF SCOPE.
 * This function now skips ALL dynamic route expectations and produces
 * no CONFIRMED findings or FAILURE judgments for dynamic routes.
 * 
 * Dynamic routes include:
 * - Parametrized routes (e.g., /user/:id, /post/[slug])
 * - Routes with dynamic segments that require runtime data
 * - Routes that cannot be fully verified without user context
 * 
 * Rationale: Dynamic routes in pre-auth flows depend on runtime entity data
 * (user IDs, slugs, etc.) that cannot be deterministically verified in v1.
 * Scope focuses on pure pre-auth public flows (signup, pricing, landing pages).
 * 
 * @param {Array} traces - Interaction traces
 * @param {Object} manifest - Project manifest with routes and expectations
 * @param {Array} _findings - Findings array (unused in Vision 1.0 dynamic route handling)
 * @ts-expect-error - JSDoc param documented but unused
 * @returns {Object} { findings: Array (empty for dynamic routes), skips: Array }
 */
export function detectDynamicRouteFindings(traces, manifest, _findings) {
  const dynamicRouteFindings = [];
  const skips = [];
  
  // Build route models from manifest routes
  const routeModels = buildRouteModels(manifest.routes || []);
  
  // Process each trace
  for (const trace of traces) {
    const interaction = trace.interaction || {};
    
    // Find navigation expectations for this interaction
    const navigationExpectations = findNavigationExpectations(manifest, interaction, trace);
    
    for (const expectation of navigationExpectations) {
      const navigationTarget = expectation.targetPath || expectation.expectedTarget || '';
      
      if (!navigationTarget) continue;
      
      // Find matching route model
      const matchingRoute = findMatchingRoute(navigationTarget, routeModels);
      
      if (!matchingRoute) {
        // No route match - handled by regular route findings
        continue;
      }
      
      // Check if route is dynamic
      const classification = classifyDynamicRoute(matchingRoute, trace);
      
      // If route is unverifiable, add to skips
      if (classification.verifiability === DYNAMIC_ROUTE_VERIFIABILITY.UNVERIFIABLE_DYNAMIC) {
        skips.push({
          type: 'dynamic_route_unverifiable',
          interaction: {
            type: interaction.type,
            selector: interaction.selector,
            label: interaction.label,
          },
          route: {
            path: matchingRoute.path,
            originalPattern: matchingRoute.originalPattern,
            sourceRef: matchingRoute.sourceRef,
          },
          reason: 'out_of_scope_dynamic_route',
          confidence: 1.0,
          expectation: {
            target: navigationTarget,
            source: expectation.source,
          },
        });
        continue;
      }
      
      // VISION 1.0 SCOPE LOCK: Dynamic routes are OUT OF SCOPE
      // Skip ALL dynamic routes (static/verified/ambiguous/unverifiable)
      // Never produce CONFIRMED findings or FAILURE judgments for dynamic routes
      skips.push({
        type: 'out_of_scope_dynamic_route',
        interaction: {
          type: interaction.type,
          selector: interaction.selector,
          label: interaction.label,
        },
        route: {
          path: matchingRoute.path,
          originalPattern: matchingRoute.originalPattern,
          sourceRef: matchingRoute.sourceRef,
          isDynamic: matchingRoute.isDynamic,
          examplePath: matchingRoute.examplePath || null,
        },
        reason: 'out_of_scope_dynamic_route',
        details: {
          classification: classification.verifiability,
          classificationReason: classification.reason,
          guidance: 'Dynamic entity routes are outside Vision 1.0 scope; focused on pre-auth public flows.',
        },
        confidence: 1.0,
        expectation: {
          target: navigationTarget,
          source: expectation.source,
        },
      });
    }
  }
  
  return {
    findings: dynamicRouteFindings,
    skips: skips,
  };
}

/**
 * Find navigation expectations matching the interaction
 */
function findNavigationExpectations(manifest, interaction, trace) {
  const expectations = [];
  
  // Check static expectations
  if (manifest.staticExpectations) {
    const beforeUrl = trace.before?.url || trace.sensors?.navigation?.beforeUrl || '';
    const beforePath = extractPathFromUrl(beforeUrl);
    
    if (beforePath) {
      const normalizedBefore = beforePath.replace(/\/$/, '') || '/';
      
      for (const expectation of manifest.staticExpectations) {
        if (expectation.type !== 'navigation' && expectation.type !== 'spa_navigation') {
          continue;
        }
        
        const normalizedFrom = (expectation.fromPath || '').replace(/\/$/, '') || '/';
        if (normalizedFrom === normalizedBefore) {
          const selectorHint = expectation.selectorHint || '';
          const interactionSelector = interaction.selector || '';
          
          if (!selectorHint || !interactionSelector ||
              selectorHint === interactionSelector ||
              selectorHint.includes(interactionSelector) ||
              interactionSelector.includes(selectorHint)) {
            expectations.push(expectation);
          }
        }
      }
    }
  }
  
  // Check expectations from intel (AST-based)
  if (manifest.expectations) {
    for (const expectation of manifest.expectations) {
      if (expectation.type === 'navigation' || expectation.type === 'spa_navigation') {
        const selectorHint = expectation.selectorHint || '';
        const interactionSelector = interaction.selector || '';
        const interactionLabel = (interaction.label || '').toLowerCase();
        const expectationLabel = (expectation.promise?.value || '').toLowerCase();
        
        if (selectorHint === interactionSelector ||
            (expectationLabel && interactionLabel && expectationLabel.includes(interactionLabel))) {
          expectations.push(expectation);
        }
      }
    }
  }
  
  return expectations;
}

/**
 * Find matching route model for navigation target
 */
function findMatchingRoute(navigationTarget, routeModels) {
  // Try exact match first
  let matchedRoute = routeModels.find(r => r.path === navigationTarget);
  
  if (matchedRoute) {
    return matchedRoute;
  }
  
  // Try pattern match for dynamic routes
  for (const route of routeModels) {
    if (route.isDynamic && route.originalPattern) {
      if (matchDynamicPattern(navigationTarget, route.originalPattern)) {
        return route;
      }
    }
  }
  
  return null;
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




