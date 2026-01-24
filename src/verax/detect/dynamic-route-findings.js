/**
 * PHASE 14 — Dynamic Route Findings Detector
 * 
 * Detects dynamic route-related findings with proper verifiability classification
 * and intentional skips for unverifiable routes.
 */

import {
  classifyDynamicRoute,
  correlateDynamicRouteNavigation,
  buildDynamicRouteEvidence,
  shouldSkipDynamicRoute,
  DYNAMIC_ROUTE_VERIFIABILITY,
  ROUTE_VERDICT,
} from '../core/dynamic-route-intelligence.js';
import { buildRouteModels } from '../core/route-intelligence.js';
import { computeConfidence, computeConfidenceForFinding } from '../core/confidence/index.js';
import { buildAndEnforceEvidencePackage } from '../core/evidence-builder.js';
import { applyGuardrails } from '../core/guardrails-engine.js';

/**
 * PHASE 14: Detect dynamic route-related findings
 * 
 * @param {Array} traces - Interaction traces
 * @param {Object} manifest - Project manifest with routes and expectations
 * @param {Array} _findings - Findings array to append to
 * @ts-expect-error - JSDoc param documented but unused
 * @returns {Object} { findings: Array, skips: Array }
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
        const skipDecision = shouldSkipDynamicRoute(matchingRoute, trace);
        
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
          reason: skipDecision.reason,
          confidence: skipDecision.confidence,
          expectation: {
            target: navigationTarget,
            source: expectation.source,
          },
        });
        continue;
      }
      
      // Correlate navigation with dynamic route
      const correlation = correlateDynamicRouteNavigation(expectation, matchingRoute, trace);
      
      // If correlation indicates skip, add to skips
      if (correlation.skip) {
        skips.push({
          type: 'dynamic_route_skip',
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
          reason: correlation.skipReason,
          confidence: correlation.confidence,
          expectation: {
            target: navigationTarget,
            source: expectation.source,
          },
        });
        continue;
      }
      
      // Generate finding if verdict indicates failure
      if (correlation.verdict === ROUTE_VERDICT.SILENT_FAILURE ||
          correlation.verdict === ROUTE_VERDICT.ROUTE_MISMATCH ||
          (correlation.verdict === ROUTE_VERDICT.AMBIGUOUS && correlation.confidence >= 0.7)) {
        
        // Build evidence
        const evidence = buildDynamicRouteEvidence(expectation, matchingRoute, correlation, trace);
        const classificationReason = classification.reason || correlation.reason || null;
        
        // PHASE 14: Evidence Law - require sufficient evidence for CONFIRMED
        const hasSufficientEvidence = evidence.beforeAfter.beforeUrl &&
                                      evidence.beforeAfter.afterUrl &&
                                      (evidence.signals.urlChanged ||
                                       evidence.signals.routeMatched ||
                                       evidence.signals.uiFeedback !== 'FEEDBACK_MISSING' ||
                                       evidence.signals.domChanged);
        
        // Determine finding type early (before use in confidence call)
        let findingType = 'dynamic_route_silent_failure';
        if (correlation.verdict === ROUTE_VERDICT.ROUTE_MISMATCH) {
          findingType = 'dynamic_route_mismatch';
        } else if (correlation.verdict === ROUTE_VERDICT.AMBIGUOUS) {
          findingType = 'dynamic_route_ambiguous';
        }
        
        // PHASE 15: Compute unified confidence
        const unifiedConfidence = computeConfidenceForFinding({
          findingType: findingType,
          expectation,
          sensors: trace.sensors || {},
          comparisons: {},
          attemptMeta: {},
          evidenceIntent: null,
          guardrailsOutcome: null,
          truthStatus: 'SUSPECTED',
          evidence,
          options: {}
        });
        
        // Legacy confidence for backward compatibility
        const _confidence = computeConfidence({
          findingType: 'dynamic_route_silent_failure',
          expectation,
          sensors: trace.sensors || {},
          comparisons: {},
          attemptMeta: {},
          evidenceIntent: null,
          guardrailsOutcome: null,
          truthStatus: 'SUSPECTED',
          evidence: {},
          options: {}
        });
        
        // Determine severity based on evidence and verdict
        let severity = 'SUSPECTED';
        if (hasSufficientEvidence && correlation.verdict === ROUTE_VERDICT.SILENT_FAILURE && (unifiedConfidence.score01 || unifiedConfidence.score || 0) >= 0.8) {
          severity = 'CONFIRMED';
        } else if (correlation.verdict === ROUTE_VERDICT.ROUTE_MISMATCH && hasSufficientEvidence) {
          severity = 'CONFIRMED';
        }
        
        const finding = {
          type: findingType,
          severity,
          confidence: unifiedConfidence.score01 || unifiedConfidence.score || 0, // Contract v1: score01 canonical
          confidenceLevel: unifiedConfidence.level, // PHASE 15: Add confidence level
          confidenceReasons: unifiedConfidence.topReasons || unifiedConfidence.reasons || [], // Contract v1: topReasons
          interaction: {
            type: interaction.type,
            selector: interaction.selector,
            label: interaction.label,
          },
          reason: correlation.reason || 'Dynamic route navigation outcome unclear',
          evidence,
          source: {
            file: expectation.source?.file || null,
            line: expectation.source?.line || null,
            column: expectation.source?.column || null,
            context: expectation.source?.context || null,
            astSource: expectation.source?.astSource || null,
          },
          route: correlation.route,
          expectation,
          classification: classification,
          classificationReason: classificationReason,
        };
        
        // PHASE 16: Build and enforce evidence package
        const findingWithEvidence = buildAndEnforceEvidencePackage(finding, {
          expectation,
          trace,
          evidence,
          confidence: unifiedConfidence,
        });
        
        // PHASE 17: Apply guardrails (AFTER evidence builder)
        const context = {
          evidencePackage: findingWithEvidence.evidencePackage,
          signals: findingWithEvidence.evidencePackage?.signals || evidence.signals || {},
          confidenceReasons: unifiedConfidence.reasons || [],
          promiseType: expectation?.type || null,
        };
        const { finding: findingWithGuardrails } = applyGuardrails(findingWithEvidence, context);
        
        dynamicRouteFindings.push(findingWithGuardrails);
      }
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




