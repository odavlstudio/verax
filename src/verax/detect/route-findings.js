/**
 * PHASE 12 — Route Intelligence Findings Detector
 * 
 * Detects route-related silent failures by correlating navigation promises
 * with route definitions and evaluating outcomes.
 */

import {
  buildRouteModels,
  correlateNavigationWithRoute,
  evaluateRouteNavigation,
  buildRouteEvidence,
  isRouteChangeFalsePositive,
} from '../core/route-intelligence.js';
import { computeConfidenceForFinding } from '../core/confidence-engine.js';
import { buildAndEnforceEvidencePackage } from '../core/evidence-builder.js';
import { applyGuardrails } from '../core/guardrails-engine.js';

/**
 * PHASE 12: Detect route-related findings
 * 
 * @param {Array} traces - Interaction traces
 * @param {Object} manifest - Project manifest with routes and expectations
 * @param {Array} _findings - Findings array to append to
 * @ts-expect-error - JSDoc param documented but unused
 * @returns {Array} Route-related findings
 */
export function detectRouteFindings(traces, manifest, _findings) {
  const routeFindings = [];
  
  // Build route models from manifest routes
  const routeModels = buildRouteModels(manifest.routes || []);
  
  // Process each trace
  for (const trace of traces) {
    const interaction = trace.interaction || {};
    const beforeUrl = trace.before?.url || trace.sensors?.navigation?.beforeUrl || '';
    const afterUrl = trace.after?.url || trace.sensors?.navigation?.afterUrl || '';
    
    // Find navigation expectations for this interaction
    const navigationExpectations = findNavigationExpectations(manifest, interaction, beforeUrl);
    
    for (const expectation of navigationExpectations) {
      const navigationTarget = expectation.targetPath || expectation.expectedTarget || '';
      
      if (!navigationTarget) continue;
      
      // Correlate navigation promise with route
      const correlation = correlateNavigationWithRoute(navigationTarget, routeModels);
      
      // Check for false positives
      if (isRouteChangeFalsePositive(trace, correlation)) {
        continue;
      }
      
      // Evaluate route navigation outcome
      const evaluation = evaluateRouteNavigation(correlation, trace, beforeUrl, afterUrl);
      
      // Generate finding if needed
      if (evaluation.outcome === 'SILENT_FAILURE' || 
          evaluation.outcome === 'ROUTE_MISMATCH' ||
          (evaluation.outcome === 'SUSPECTED' && evaluation.confidence >= 0.6)) {
        
        // Build evidence
        const evidence = buildRouteEvidence(correlation, expectation, evaluation, trace);
        
        // Determine finding type
        let findingType = 'route_silent_failure';
        let reason = evaluation.reason || 'Route navigation promise not fulfilled';
        
        if (evaluation.outcome === 'ROUTE_MISMATCH') {
          findingType = 'route_mismatch';
          reason = `Navigation occurred but target route does not match. Expected: ${correlation?.route?.path}, Actual: ${evidence.beforeAfter.afterUrl}`;
        } else if (evaluation.outcome === 'SUSPECTED') {
          findingType = 'route_ambiguous';
          reason = 'Dynamic route cannot be deterministically validated';
        }
        
        // PHASE 15: Compute unified confidence
        const unifiedConfidence = computeConfidenceForFinding({
          findingType: findingType,
          expectation,
          sensors: trace.sensors || {},
          comparisons: {
            urlChanged: evidence.signals.urlChanged,
            domChanged: evidence.signals.domChanged,
          },
          evidence,
          options: {}
        });
        
        // PHASE 12: Evidence Law - require sufficient evidence for CONFIRMED
        const hasSufficientEvidence = evidence.beforeAfter.beforeUrl && 
                                      evidence.beforeAfter.afterUrl &&
                                      (evidence.signals.urlChanged || 
                                       evidence.signals.routerStateChanged || 
                                       evidence.signals.uiChanged || 
                                       evidence.signals.domChanged);
        
        const severity = hasSufficientEvidence && (unifiedConfidence.score01 || unifiedConfidence.score || 0) >= 0.8 ? 'CONFIRMED' : 'SUSPECTED';
        
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
          reason,
          evidence,
          source: {
            file: expectation.source?.file || null,
            line: expectation.source?.line || null,
            column: expectation.source?.column || null,
            context: expectation.source?.context || null,
            astSource: expectation.source?.astSource || expectation.metadata?.astSource || null,
          },
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
        
        routeFindings.push(findingWithGuardrails);
      }
    }
  }
  
  return routeFindings;
}

/**
 * Find navigation expectations matching the interaction
 */
function findNavigationExpectations(manifest, interaction, beforeUrl) {
  const expectations = [];
  
  // Check static expectations
  if (manifest.staticExpectations) {
    const beforePath = extractPathFromUrl(beforeUrl);
    if (beforePath) {
      const normalizedBefore = beforePath.replace(/\/$/, '') || '/';
      
      for (const expectation of manifest.staticExpectations) {
        if (expectation.type !== 'navigation' && expectation.type !== 'spa_navigation') {
          continue;
        }
        
        const normalizedFrom = (expectation.fromPath || '').replace(/\/$/, '') || '/';
        if (normalizedFrom === normalizedBefore) {
          // Check selector match
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
        // Match by selector or label
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

