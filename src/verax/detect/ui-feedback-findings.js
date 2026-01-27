/**
 * PHASE 13 — UI Feedback Findings Detector
 * 
 * Detects UI feedback-related silent failures by correlating promises
 * with feedback signals and evaluating outcomes.
 */

import {
  detectUIFeedbackSignals,
  scoreUIFeedback,
  correlatePromiseWithFeedback,
  buildUIFeedbackEvidence,
  FEEDBACK_SCORE,
} from '../core/ui-feedback-intelligence.js';
import { computeConfidence, computeConfidenceForFinding } from '../core/confidence/index.js';
import { buildAndEnforceEvidencePackage } from '../core/evidence-builder.js';
import { applyGuardrails } from '../core/guardrails-engine.js';

/**
 * PHASE 13: Detect UI feedback-related findings
 * 
 * @param {Array} traces - Interaction traces
 * @param {Object} manifest - Project manifest with expectations
 * @param {Array} _findings - Findings array to append to
 * @ts-expect-error - JSDoc param documented but unused
 * @returns {Array} UI feedback-related findings
 */
export function detectUIFeedbackFindings(traces, manifest, _findings) {
  const feedbackFindings = [];
  
  // Process each trace
  for (const trace of traces) {
    const interaction = trace.interaction || {};
    
    // Find expectations for this interaction
    const expectations = findExpectationsForInteraction(manifest, interaction, trace);
    
    for (const expectation of expectations) {
      // Detect UI feedback signals
      const signals = detectUIFeedbackSignals(trace);
      
      // Score feedback presence/absence
      const feedbackScore = scoreUIFeedback(signals, expectation, trace);
      
      // Correlate promise with feedback
      const correlation = correlatePromiseWithFeedback(expectation, feedbackScore, trace);
      
      // Generate finding if correlation indicates silent failure
      if (correlation.outcome === 'CONFIRMED' || correlation.outcome === 'SUSPECTED') {
        // Build evidence
        const evidence = buildUIFeedbackEvidence(feedbackScore, correlation, trace, expectation);        const hasSufficientEvidence = evidence.beforeAfter.beforeScreenshot &&
                                      evidence.beforeAfter.afterScreenshot &&
                                      (evidence.feedback.signals.length > 0 || 
                                       evidence.feedback.score === FEEDBACK_SCORE.MISSING);
        
        // Determine finding type early (before use in confidence call)
        let findingType = 'ui_feedback_silent_failure';
        if (expectation.type === 'network_action' || expectation.type === 'network') {
          findingType = 'network_feedback_missing';
        } else if (expectation.type === 'navigation' || expectation.type === 'spa_navigation') {
          findingType = 'navigation_feedback_missing';
        } else if (expectation.type === 'validation' || expectation.type === 'form_submission') {
          findingType = 'validation_feedback_missing';
        }        const unifiedConfidence = computeConfidenceForFinding({
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
          findingType: 'ui_feedback_silent_failure',
          expectation,
          sensors: trace.sensors || {},
          comparisons: {},
          attemptMeta: {},
          evidenceIntent: null,
          guardrailsOutcome: null,
          truthStatus: 'SUSPECTED',
          evidence: {},
          options: {},
        });
        
        // Determine severity based on evidence
        const severity = hasSufficientEvidence && correlation.outcome === 'CONFIRMED' && (unifiedConfidence.score01 || unifiedConfidence.score || 0) >= 0.8
          ? 'CONFIRMED'
          : 'SUSPECTED';
        
        const finding = {
          type: findingType,
          severity,
          confidence: unifiedConfidence.score01 || unifiedConfidence.score || 0, // Contract v1: score01 canonical
          confidenceLevel: unifiedConfidence.level,
          confidenceReasons: unifiedConfidence.topReasons || unifiedConfidence.reasons || [], // Contract v1: topReasons
          interaction: {
            type: interaction.type,
            selector: interaction.selector,
            label: interaction.label,
          },
          reason: correlation.reason || feedbackScore.explanation,
          evidence,
          source: {
            file: expectation.source?.file || null,
            line: expectation.source?.line || null,
            column: expectation.source?.column || null,
            context: expectation.source?.context || null,
            astSource: expectation.source?.astSource || null,
          },
        };        const findingWithEvidence = buildAndEnforceEvidencePackage(finding, {
          expectation,
          trace,
          evidence,
          confidence: unifiedConfidence,
        });        const context = {
          evidencePackage: findingWithEvidence.evidencePackage,
          signals: findingWithEvidence.evidencePackage?.signals || evidence.signals || {},
          confidenceReasons: unifiedConfidence.reasons || [],
          promiseType: expectation?.type || null,
        };
        const { finding: findingWithGuardrails } = applyGuardrails(findingWithEvidence, context);
        
        feedbackFindings.push(findingWithGuardrails);
      }
    }
  }
  
  return feedbackFindings;
}

/**
 * Find expectations matching the interaction
 */
function findExpectationsForInteraction(manifest, interaction, trace) {
  const expectations = [];
  
  // Check static expectations
  if (manifest.staticExpectations) {
    const beforeUrl = trace.before?.url || trace.sensors?.navigation?.beforeUrl || '';
    const beforePath = extractPathFromUrl(beforeUrl);
    
    if (beforePath) {
      const normalizedBefore = beforePath.replace(/\/$/, '') || '/';
      
      for (const expectation of manifest.staticExpectations) {
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




