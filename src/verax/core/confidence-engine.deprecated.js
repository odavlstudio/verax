/**
 * ⚠️ DEPRECATED FACADE — Maintained for backward compatibility only
 * 
 * This file exists ONLY for backward compatibility.
 * ALL code should import from the canonical entry point:
 *   src/verax/core/confidence/index.js
 * 
 * This facade will be removed in a future version.
 * 
 * ARCHITECTURAL NOTE:
 * The "refactor" vs "legacy" dual-system has been consolidated.
 * core/confidence/index.js is now the single authority for confidence scoring.
 * This resolves STAGE 2 Issue #14 and STAGE 3 Issue #24.
 * 
 * Resolution:
 * - Canonical entry: core/confidence/index.js
 * - Legacy implementation: detect/confidence-engine.legacy.js (internal use only)
 * - This file: deprecated facade (still contains old implementation for compatibility)
 */

import { computeConfidence as computeConfidenceLegacy } from '../shared/legacy-confidence-bridge.js';
import { loadConfidencePolicy, getPolicyReport } from './confidence/confidence.loader.js';

// Re-export constants for backward compatibility
export const CONFIDENCE_LEVEL = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
  UNPROVEN: 'UNPROVEN',
};

export const CONFIDENCE_REASON = {
  // Promise Strength (A)
  PROMISE_AST_BASED: 'PROMISE_AST_BASED',
  PROMISE_PROVEN: 'PROMISE_PROVEN',
  PROMISE_OBSERVED: 'PROMISE_OBSERVED',
  PROMISE_WEAK: 'PROMISE_WEAK',
  PROMISE_UNKNOWN: 'PROMISE_UNKNOWN',
  
  // Observation Strength (B)
  OBS_URL_CHANGED: 'OBS_URL_CHANGED',
  OBS_DOM_CHANGED: 'OBS_DOM_CHANGED',
  OBS_UI_FEEDBACK_CONFIRMED: 'OBS_UI_FEEDBACK_CONFIRMED',
  OBS_CONSOLE_ERRORS: 'OBS_CONSOLE_ERRORS',
  OBS_NETWORK_FAILURE: 'OBS_NETWORK_FAILURE',
  OBS_NETWORK_SUCCESS: 'OBS_NETWORK_SUCCESS',
  OBS_NO_SIGNALS: 'OBS_NO_SIGNALS',
  
  // Correlation Quality (C)
  CORR_TIMING_ALIGNED: 'CORR_TIMING_ALIGNED',
  CORR_ROUTE_MATCHED: 'CORR_ROUTE_MATCHED',
  CORR_REQUEST_MATCHED: 'CORR_REQUEST_MATCHED',
  CORR_TRACE_LINKED: 'CORR_TRACE_LINKED',
  CORR_WEAK_CORRELATION: 'CORR_WEAK_CORRELATION',
  
  // Guardrails & Contradictions (D)
  GUARD_ANALYTICS_FILTERED: 'GUARD_ANALYTICS_FILTERED',
  GUARD_SHALLOW_ROUTING: 'GUARD_SHALLOW_ROUTING',
  GUARD_NETWORK_SUCCESS_NO_UI: 'GUARD_NETWORK_SUCCESS_NO_UI',
  GUARD_UI_FEEDBACK_PRESENT: 'GUARD_UI_FEEDBACK_PRESENT',
  GUARD_CONTRADICTION_DETECTED: 'GUARD_CONTRADICTION_DETECTED',
  
  // Evidence Completeness (E)
  EVIDENCE_SCREENSHOTS: 'EVIDENCE_SCREENSHOTS',
  EVIDENCE_TRACES: 'EVIDENCE_TRACES',
  EVIDENCE_SIGNALS: 'EVIDENCE_SIGNALS',
  EVIDENCE_SNIPPETS: 'EVIDENCE_SNIPPETS',
  EVIDENCE_INCOMPLETE: 'EVIDENCE_INCOMPLETE',
  
  // Sensor Presence
  SENSOR_NETWORK_PRESENT: 'SENSOR_NETWORK_PRESENT',
  SENSOR_CONSOLE_PRESENT: 'SENSOR_CONSOLE_PRESENT',
  SENSOR_UI_PRESENT: 'SENSOR_UI_PRESENT',
  SENSOR_UI_FEEDBACK_PRESENT: 'SENSOR_UI_FEEDBACK_PRESENT',
  SENSOR_MISSING: 'SENSOR_MISSING',
};

// Global policy cache
let cachedPolicy = null;

/**
 * Get confidence policy (cached)
 */
function getConfidencePolicy(policyPath = null, projectDir = null) {
  if (!cachedPolicy) {
    cachedPolicy = loadConfidencePolicy(policyPath, projectDir);
  }
  return cachedPolicy;
}

/**
 * PHASE 21.4: Compute unified confidence using policy
 * 
 * @param {Object} params - Confidence computation parameters
 * @param {string} params.findingType - Type of finding
 * @param {Object} params.expectation - Promise/expectation
 * @param {Object} params.sensors - Sensor data
 * @param {Object} params.comparisons - Comparison data
 * @param {Object} params.evidence - Evidence data (optional)
 * @param {Object} params.options - Options { policyPath, projectDir, determinismVerdict, evidencePackage }
 * @returns {Object} { score, level, reasons[], policyReport }
 */
export function computeUnifiedConfidence({ findingType, expectation, sensors = {}, comparisons = {}, evidence = {}, options = {} }) {
  const policy = getConfidencePolicy(options.policyPath, options.projectDir);
  const reasons = [];
  
  // === PILLAR A: Promise Strength ===
  const promiseStrength = assessPromiseStrength(expectation, reasons, policy);
  
  // === PILLAR B: Observation Strength ===
  const observationStrength = assessObservationStrength(sensors, comparisons, reasons, policy);
  
  // === PILLAR C: Correlation Quality ===
  const correlationQuality = assessCorrelationQuality(expectation, sensors, comparisons, evidence, reasons, policy);
  
  // === PILLAR D: Guardrails & Contradictions ===
  const guardrails = assessGuardrails(sensors, comparisons, findingType, reasons, policy);
  
  // === PILLAR E: Evidence Completeness ===
  const evidenceCompleteness = assessEvidenceCompleteness(evidence, sensors, reasons, policy);
  
  // === COMPUTE BASE SCORE using policy weights ===
  const baseScore = (
    promiseStrength * policy.weights.promiseStrength +
    observationStrength * policy.weights.observationStrength +
    correlationQuality * policy.weights.correlationQuality +
    guardrails * policy.weights.guardrails +
    evidenceCompleteness * policy.weights.evidenceCompleteness
  );
  
  // === APPLY CONTRADICTIONS using policy ===
  const contradictionPenalty = guardrails < 0.5 ? policy.truthLocks.contradictionPenalty : 0;
  let finalScore = Math.max(0, Math.min(1, baseScore - contradictionPenalty));
  
  // === TRUTH LOCKS: Apply determinism cap ===
  if (options.determinismVerdict === 'NON_DETERMINISTIC') {
    const maxConfidence = policy.truthLocks.nonDeterministicMaxConfidence;
    if (finalScore > maxConfidence) {
      reasons.push('TRUTH_LOCK_NON_DETERMINISTIC_CAP');
      finalScore = Math.min(finalScore, maxConfidence);
    }
  }
  
  // === TRUTH LOCKS: Evidence Law cap ===
  const evidencePackage = options.evidencePackage || evidence.evidencePackage || {};
  if (evidencePackage.severity === 'CONFIRMED' || evidencePackage.status === 'CONFIRMED') {
    if (policy.truthLocks.evidenceCompleteRequired && !evidencePackage.isComplete) {
      reasons.push('TRUTH_LOCK_EVIDENCE_INCOMPLETE');
      // Force downgrade from CONFIRMED
      finalScore = Math.min(finalScore, 0.6); // Cap at MEDIUM
    }
  }
  
  // === DETERMINE LEVEL using policy thresholds ===
  const level = determineConfidenceLevel(finalScore, promiseStrength, evidenceCompleteness, policy);
  
  const policyReport = getPolicyReport(policy);
  
  return {
    score: finalScore,
    level,
    reasons: reasons.slice(0, 10),
    policyReport: {
      version: policyReport.version,
      source: policyReport.source,
      thresholds: policyReport.thresholds
    }
  };
}

/**
 * Assess promise strength (Pillar A) using policy
 */
function assessPromiseStrength(expectation, reasons, policy) {
  if (!expectation) {
    reasons.push(CONFIDENCE_REASON.PROMISE_UNKNOWN);
    return 0.0;
  }
  
  const isASTBased = expectation.source?.astSource || expectation.metadata?.astSource;
  if (isASTBased) {
    reasons.push(CONFIDENCE_REASON.PROMISE_AST_BASED);
  }
  
  const proof = expectation.proof || 'UNKNOWN';
  if (proof === 'PROVEN_EXPECTATION' || proof === 'PROVEN') {
    reasons.push(CONFIDENCE_REASON.PROMISE_PROVEN);
    return policy.baseScores.promiseProven;
  }
  
  if (proof === 'OBSERVED' || expectation.confidence >= 0.8) {
    reasons.push(CONFIDENCE_REASON.PROMISE_OBSERVED);
    return policy.baseScores.promiseObserved;
  }
  
  if (expectation.confidence >= 0.5) {
    reasons.push(CONFIDENCE_REASON.PROMISE_WEAK);
    return policy.baseScores.promiseWeak;
  }
  
  reasons.push(CONFIDENCE_REASON.PROMISE_UNKNOWN);
  return policy.baseScores.promiseUnknown;
}

/**
 * Assess observation strength (Pillar B) using policy
 */
function assessObservationStrength(sensors, comparisons, reasons, policy) {
  let strength = 0.0;
  let signals = 0;
  
  const urlChanged = sensors.navigation?.urlChanged === true || comparisons.urlChanged === true;
  if (urlChanged) {
    reasons.push(CONFIDENCE_REASON.OBS_URL_CHANGED);
    strength += policy.baseScores.urlChanged;
    signals++;
  }
  
  const domChanged = sensors.dom?.changed === true || comparisons.domChanged === true;
  if (domChanged) {
    reasons.push(CONFIDENCE_REASON.OBS_DOM_CHANGED);
    strength += policy.baseScores.domChanged;
    signals++;
  }
  
  const uiFeedback = sensors.uiFeedback || {};
  const uiFeedbackScore = uiFeedback.overallUiFeedbackScore || 0;
  if (uiFeedbackScore > 0.5) {
    reasons.push(CONFIDENCE_REASON.OBS_UI_FEEDBACK_CONFIRMED);
    strength += policy.baseScores.uiFeedbackConfirmed;
    signals++;
  }
  
  const consoleErrors = sensors.console?.errors > 0 || sensors.console?.errorCount > 0;
  if (consoleErrors) {
    reasons.push(CONFIDENCE_REASON.OBS_CONSOLE_ERRORS);
    strength += policy.baseScores.consoleErrors;
    signals++;
  }
  
  const networkFailure = sensors.network?.failedRequests > 0 || sensors.network?.topFailedUrls?.length > 0;
  if (networkFailure) {
    reasons.push(CONFIDENCE_REASON.OBS_NETWORK_FAILURE);
    strength += policy.baseScores.networkFailure;
    signals++;
  }
  
  const networkSuccess = sensors.network?.successfulRequests > 0 && !networkFailure;
  if (networkSuccess) {
    reasons.push(CONFIDENCE_REASON.OBS_NETWORK_SUCCESS);
    strength += policy.baseScores.networkSuccess;
    signals++;
  }
  
  if (signals === 0) {
    reasons.push(CONFIDENCE_REASON.OBS_NO_SIGNALS);
    return 0.0;
  }
  
  return Math.min(1.0, strength);
}

/**
 * Assess correlation quality (Pillar C) using policy
 */
function assessCorrelationQuality(expectation, sensors, comparisons, evidence, reasons, policy) {
  let quality = 0.5;
  
  if (evidence.timing || sensors.timing) {
    reasons.push(CONFIDENCE_REASON.CORR_TIMING_ALIGNED);
    quality += policy.baseScores.timingAligned;
  }
  
  if (evidence.correlation?.routeMatched === true || evidence.routeDefinition?.path) {
    reasons.push(CONFIDENCE_REASON.CORR_ROUTE_MATCHED);
    quality += policy.baseScores.routeMatched;
  }
  
  if (evidence.networkRequest?.matched === true || evidence.correlation?.requestMatched === true) {
    reasons.push(CONFIDENCE_REASON.CORR_REQUEST_MATCHED);
    quality += policy.baseScores.requestMatched;
  }
  
  if (evidence.traceId || evidence.source?.file) {
    reasons.push(CONFIDENCE_REASON.CORR_TRACE_LINKED);
    quality += policy.baseScores.traceLinked;
  }
  
  if (quality < 0.6) {
    reasons.push(CONFIDENCE_REASON.CORR_WEAK_CORRELATION);
  }
  
  return Math.min(1.0, quality);
}

/**
 * Assess guardrails & contradictions (Pillar D) using policy
 */
function assessGuardrails(sensors, comparisons, findingType, reasons, _policy) {
  let guardrailScore = 1.0;
  
  const networkSensor = sensors.network || {};
  const hasAnalytics = networkSensor.observedRequestUrls?.some(url =>
    url && typeof url === 'string' && url.includes('/api/analytics')
  );
  if (hasAnalytics && !sensors.navigation?.urlChanged && !sensors.uiSignals?.diff?.changed) {
    reasons.push(CONFIDENCE_REASON.GUARD_ANALYTICS_FILTERED);
    guardrailScore -= 0.2;
  }
  
  if (sensors.navigation?.shallowRouting === true && !sensors.navigation?.urlChanged) {
    reasons.push(CONFIDENCE_REASON.GUARD_SHALLOW_ROUTING);
    guardrailScore -= 0.3;
  }
  
  const networkSuccess = networkSensor.successfulRequests > 0;
  const noUIChange = !sensors.uiSignals?.diff?.changed && !sensors.uiFeedback?.overallUiFeedbackScore;
  if (networkSuccess && noUIChange && findingType?.includes('silent_failure')) {
    reasons.push(CONFIDENCE_REASON.GUARD_NETWORK_SUCCESS_NO_UI);
    guardrailScore -= 0.2;
  }
  
  const uiFeedbackScore = sensors.uiFeedback?.overallUiFeedbackScore || 0;
  if (uiFeedbackScore > 0.5 && findingType?.includes('silent_failure')) {
    reasons.push(CONFIDENCE_REASON.GUARD_UI_FEEDBACK_PRESENT);
    guardrailScore -= 0.4;
  }
  
  if (guardrailScore < 0.6) {
    reasons.push(CONFIDENCE_REASON.GUARD_CONTRADICTION_DETECTED);
  }
  
  return Math.max(0.0, guardrailScore);
}

/**
 * Assess evidence completeness (Pillar E) using policy
 */
function assessEvidenceCompleteness(evidence, sensors, reasons, policy) {
  let completeness = 0.0;
  
  if (evidence.beforeAfter?.beforeScreenshot && evidence.beforeAfter?.afterScreenshot) {
    reasons.push(CONFIDENCE_REASON.EVIDENCE_SCREENSHOTS);
    completeness += policy.baseScores.screenshots;
  }
  
  if (evidence.traceId || sensors.traceId) {
    reasons.push(CONFIDENCE_REASON.EVIDENCE_TRACES);
    completeness += policy.baseScores.traces;
  }
  
  if (evidence.signals && Object.keys(evidence.signals).length > 0) {
    reasons.push(CONFIDENCE_REASON.EVIDENCE_SIGNALS);
    completeness += policy.baseScores.signals;
  }
  
  if (evidence.source?.astSource || evidence.navigationTrigger?.astSource) {
    reasons.push(CONFIDENCE_REASON.EVIDENCE_SNIPPETS);
    completeness += policy.baseScores.snippets;
  }
  
  if (completeness < 0.5) {
    reasons.push(CONFIDENCE_REASON.EVIDENCE_INCOMPLETE);
  }
  
  return completeness;
}

/**
 * Determine confidence level using policy thresholds
 */
function determineConfidenceLevel(score, promiseStrength, evidenceCompleteness, policy) {
  const thresholds = policy.thresholds;
  
  if (score >= thresholds.high && promiseStrength >= 0.9 && evidenceCompleteness >= 0.7) {
    return CONFIDENCE_LEVEL.HIGH;
  }
  
  if (score >= thresholds.medium || (score >= 0.5 && promiseStrength >= 0.7)) {
    return CONFIDENCE_LEVEL.MEDIUM;
  }
  
  if (score >= thresholds.low) {
    return CONFIDENCE_LEVEL.LOW;
  }
  
  return CONFIDENCE_LEVEL.UNPROVEN;
}

/**
 * PHASE 21.4: Compute confidence for finding (wrapper with policy support)
 * 
 * @param {Object} params - Confidence computation parameters
 * @param {Object} params.options - Options { policyPath, projectDir, determinismVerdict, evidencePackage }
 * @returns {Object} { score, level, reasons[] }
 */
export function computeConfidenceForFinding(params) {
  const options = params.options || {};
  
  // Use legacy system for base computation
  const legacyResult = computeConfidenceLegacy(params);
  
  // Normalize score from 0-100 to 0-1
  let normalizedScore = (legacyResult.score || 0) / 100;
  
  // Extract reasons from legacy explain/factors
  const reasons = extractReasonsFromLegacy(legacyResult, params);
  
  // Load policy for truth locks
  const policy = getConfidencePolicy(options.policyPath, options.projectDir);
  
  // === TRUTH LOCKS: Apply determinism cap ===
  if (options.determinismVerdict === 'NON_DETERMINISTIC') {
    const maxConfidence = policy.truthLocks.nonDeterministicMaxConfidence;
    if (normalizedScore > maxConfidence) {
      reasons.push('TRUTH_LOCK_NON_DETERMINISTIC_CAP');
      normalizedScore = Math.min(normalizedScore, maxConfidence);
    }
  }
  
  // === TRUTH LOCKS: Evidence Law cap ===
  // @ts-expect-error - Optional params structure
  const evidencePackage = options.evidencePackage || params.evidence?.evidencePackage || {};
  if (evidencePackage.severity === 'CONFIRMED' || evidencePackage.status === 'CONFIRMED') {
    if (policy.truthLocks.evidenceCompleteRequired && !evidencePackage.isComplete) {
      reasons.push('TRUTH_LOCK_EVIDENCE_INCOMPLETE');
      normalizedScore = Math.min(normalizedScore, 0.6);
    }
  }
  
  // Determine level using policy thresholds
  // @ts-expect-error - params has expectation property
  const promiseStrength = assessPromiseStrength(params.expectation, [], policy);
  // @ts-expect-error - params has evidence and sensors properties
  const evidenceComplete = assessEvidenceCompleteness(params.evidence || {}, params.sensors || {}, [], policy);
  const level = determineConfidenceLevel(
    normalizedScore,
    promiseStrength,
    evidenceComplete,
    policy
  );
  
  return {
    score: normalizedScore,
    level,
    reasons,
  };
}

/**
 * Extract stable reason codes from legacy confidence result
 */
function extractReasonsFromLegacy(legacyResult, params) {
  const reasons = [];
  
  if (legacyResult.explain && Array.isArray(legacyResult.explain)) {
    for (const explanation of legacyResult.explain) {
      if (typeof explanation === 'string') {
        if (explanation.includes('AST') || explanation.includes('proven')) {
          reasons.push(CONFIDENCE_REASON.PROMISE_PROVEN);
        }
        if (explanation.includes('network') && explanation.includes('failed')) {
          reasons.push(CONFIDENCE_REASON.OBS_NETWORK_FAILURE);
        }
        if (explanation.includes('UI feedback')) {
          reasons.push(CONFIDENCE_REASON.OBS_UI_FEEDBACK_CONFIRMED);
        }
        if (explanation.includes('contradiction')) {
          reasons.push(CONFIDENCE_REASON.GUARD_CONTRADICTION_DETECTED);
        }
      }
    }
  }
  
  if (legacyResult.factors && Array.isArray(legacyResult.factors)) {
    for (const factor of legacyResult.factors) {
      if (factor.key === 'promise_strength' && factor.value === 'PROVEN') {
        reasons.push(CONFIDENCE_REASON.PROMISE_PROVEN);
      }
      if (factor.key === 'ui_feedback_score' && parseFloat(factor.value) > 0.5) {
        reasons.push(CONFIDENCE_REASON.OBS_UI_FEEDBACK_CONFIRMED);
      }
    }
  }
  
  const sensors = params.sensors || {};
  if (sensors.network && Object.keys(sensors.network).length > 0) {
    reasons.push(CONFIDENCE_REASON.SENSOR_NETWORK_PRESENT);
  }
  if (sensors.console && Object.keys(sensors.console).length > 0) {
    reasons.push(CONFIDENCE_REASON.SENSOR_CONSOLE_PRESENT);
  }
  if (sensors.uiSignals && Object.keys(sensors.uiSignals).length > 0) {
    reasons.push(CONFIDENCE_REASON.SENSOR_UI_PRESENT);
  }
  if (sensors.uiFeedback && Object.keys(sensors.uiFeedback).length > 0) {
    reasons.push(CONFIDENCE_REASON.SENSOR_UI_FEEDBACK_PRESENT);
  }
  
  return [...new Set(reasons)];
}




