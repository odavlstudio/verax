/**
 * PHASE 21.4 — Confidence Engine (Policy-Driven with Truth Locks)
 * 
 * Central confidence engine that computes confidence scores using policies.
 * Truth locks are enforced and cannot be configured away.
 */

import { computeConfidence as computeConfidenceLegacy } from '../detect/confidence-engine.js';
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

// === PHASE 26: CONFIDENCE ENGINE SIMPLIFICATION ===
// 7 Core Buckets for scoring (Damage Control)
export const CONFIDENCE_BUCKET = {
  CRITICAL_EVIDENCE: 'critical_evidence',
  MULTI_SOURCE: 'multi_source_corroboration',
  ASSET_CRITICAL: 'asset_criticality',
  ABUSE_KNOWN: 'known_abuse_indicators',
  EXPLOITABLE: 'exploitability_indicator',
  PRIV_ESCALATION: 'privilege_escalation_path',
  IMPACT_RADIUS: 'impact_radius',
};

const CORE_BUCKETS = new Set(Object.values(CONFIDENCE_BUCKET));

/**
 * Classify confidence reason codes into buckets.
 * Only CORE_BUCKETS contribute to score01.
 * All other reasons become ADVISORY (tracked, not scored).
 */
const CORE_BUCKET_CLASSIFICATION = {
  // === CRITICAL_EVIDENCE (Reason codes that prove the finding) ===
  [CONFIDENCE_REASON.PROMISE_PROVEN]: CONFIDENCE_BUCKET.CRITICAL_EVIDENCE,
  [CONFIDENCE_REASON.OBS_UI_FEEDBACK_CONFIRMED]: CONFIDENCE_BUCKET.CRITICAL_EVIDENCE,
  [CONFIDENCE_REASON.OBS_NETWORK_FAILURE]: CONFIDENCE_BUCKET.CRITICAL_EVIDENCE,
  
  // === MULTI_SOURCE (Multiple independent signals align) ===
  [CONFIDENCE_REASON.CORR_TIMING_ALIGNED]: CONFIDENCE_BUCKET.MULTI_SOURCE,
  [CONFIDENCE_REASON.CORR_ROUTE_MATCHED]: CONFIDENCE_BUCKET.MULTI_SOURCE,
  [CONFIDENCE_REASON.CORR_REQUEST_MATCHED]: CONFIDENCE_BUCKET.MULTI_SOURCE,
  
  // === ASSET_CRITICAL (Critical asset/flow) ===
  [CONFIDENCE_REASON.GUARD_SHALLOW_ROUTING]: CONFIDENCE_BUCKET.ASSET_CRITICAL,
  [CONFIDENCE_REASON.EVIDENCE_TRACES]: CONFIDENCE_BUCKET.ASSET_CRITICAL,
  
  // === ABUSE_KNOWN (Known abuse patterns) ===
  [CONFIDENCE_REASON.GUARD_ANALYTICS_FILTERED]: CONFIDENCE_BUCKET.ABUSE_KNOWN,
  [CONFIDENCE_REASON.OBS_NETWORK_SUCCESS]: CONFIDENCE_BUCKET.ABUSE_KNOWN,
  
  // === EXPLOITABLE (Finding is actionable) ===
  [CONFIDENCE_REASON.OBS_DOM_CHANGED]: CONFIDENCE_BUCKET.EXPLOITABLE,
  [CONFIDENCE_REASON.OBS_CONSOLE_ERRORS]: CONFIDENCE_BUCKET.EXPLOITABLE,
  
  // === PRIV_ESCALATION (Access/privilege changes) ===
  [CONFIDENCE_REASON.OBS_URL_CHANGED]: CONFIDENCE_BUCKET.PRIV_ESCALATION,
  [CONFIDENCE_REASON.CORR_TRACE_LINKED]: CONFIDENCE_BUCKET.PRIV_ESCALATION,
  
  // === IMPACT_RADIUS (Scope/impact evidence) ===
  [CONFIDENCE_REASON.EVIDENCE_SCREENSHOTS]: CONFIDENCE_BUCKET.IMPACT_RADIUS,
  [CONFIDENCE_REASON.EVIDENCE_SNIPPETS]: CONFIDENCE_BUCKET.IMPACT_RADIUS,
  
  // === ADVISORY (Non-core signals, tracked but not scored) ===
  [CONFIDENCE_REASON.PROMISE_OBSERVED]: null,
  [CONFIDENCE_REASON.PROMISE_WEAK]: null,
  [CONFIDENCE_REASON.PROMISE_UNKNOWN]: null,
  [CONFIDENCE_REASON.PROMISE_AST_BASED]: null,
  [CONFIDENCE_REASON.OBS_NO_SIGNALS]: null,
  [CONFIDENCE_REASON.CORR_WEAK_CORRELATION]: null,
  [CONFIDENCE_REASON.GUARD_UI_FEEDBACK_PRESENT]: null,
  [CONFIDENCE_REASON.GUARD_CONTRADICTION_DETECTED]: null,
  [CONFIDENCE_REASON.GUARD_NETWORK_SUCCESS_NO_UI]: null,
  [CONFIDENCE_REASON.EVIDENCE_SIGNALS]: null,
  [CONFIDENCE_REASON.EVIDENCE_INCOMPLETE]: null,
  [CONFIDENCE_REASON.SENSOR_NETWORK_PRESENT]: null,
  [CONFIDENCE_REASON.SENSOR_CONSOLE_PRESENT]: null,
  [CONFIDENCE_REASON.SENSOR_UI_PRESENT]: null,
  [CONFIDENCE_REASON.SENSOR_UI_FEEDBACK_PRESENT]: null,
  [CONFIDENCE_REASON.SENSOR_MISSING]: null,
};

/**
 * Get bucket for a confidence reason. Returns null if advisory.
 */
function getReasonBucket(reasonCode) {
  return CORE_BUCKET_CLASSIFICATION[reasonCode] || null;
}

/**
 * Filter reasons to only core bucket reasons.
 */
function filterCoreReasons(reasons) {
  return reasons.filter(reason => {
    const bucket = getReasonBucket(reason);
    return bucket !== null && CORE_BUCKETS.has(bucket);
  });
}

/**
 * Extract advisory reasons (non-core).
 */
function extractAdvisoryReasons(reasons) {
  return reasons.filter(reason => {
    const bucket = getReasonBucket(reason);
    return bucket === null;
  });
}

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
 * PHASE 26: Bucket-gated scoring (Confidence Simplification Contract v1)
 * 
 * Note: For backward compatibility, ALL reasons are returned in `reasons` array.
 * Use `advisoryReasons` to identify which ones didn't contribute to score01.
 * 
 * @param {Object} params - Confidence computation parameters
 * @param {string} params.findingType - Type of finding
 * @param {Object} params.expectation - Promise/expectation
 * @param {Object} params.sensors - Sensor data
 * @param {Object} params.comparisons - Comparison data
 * @param {Object} params.evidence - Evidence data (optional)
 * @param {Object} params.options - Options { policyPath, projectDir, determinismVerdict, evidencePackage }
 * @returns {Object} { score, level, reasons[], advisoryReasons[], policyReport }
 */
export function computeUnifiedConfidence({ findingType, expectation, sensors = {}, comparisons = {}, evidence = {}, options = {} }) {
  // Backward compatibility: options is optional
  const policy = getConfidencePolicy(options?.policyPath, options?.projectDir);
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
  
  // === PHASE 26: Identify core vs advisory reasons ===
  const coreReasons = filterCoreReasons(reasons);
  const advisoryReasons = extractAdvisoryReasons(reasons);
  
  // === COMPUTE BASE SCORE using policy weights ===
  const baseScore = (
    promiseStrength * policy.weights.promiseStrength +
    observationStrength * policy.weights.observationStrength +
    correlationQuality * policy.weights.correlationQuality +
    guardrails * policy.weights.guardrails +
    evidenceCompleteness * policy.weights.evidenceCompleteness
  );

  // === APPLY MISSING SENSORS PENALTY ===
  // Legacy rule: -15 penalty when any core sensor object is missing (network, console, uiSignals)
  const requiredSensors = ['network', 'console', 'uiSignals'];
  const missingSensors = requiredSensors.filter(key => sensors[key] === undefined);
  // Increase penalty so missing core sensors are clearly visible in score100
  const missingSensorsPenalty = missingSensors.length > 0 ? 0.25 : 0; // -25 in 0..1 scale
  if (missingSensorsPenalty > 0) {
    reasons.push(CONFIDENCE_REASON.SENSOR_MISSING);
  }

  // === APPLY CONTRADICTIONS using policy ===
  // Apply contradiction penalty only when guardrails are materially degraded
  const contradictionPenalty = guardrails < 0.5 ? policy.truthLocks.contradictionPenalty : 0;
  let finalScore = Math.max(0, Math.min(1, baseScore - contradictionPenalty - missingSensorsPenalty));
  
  // === TRUTH LOCKS: Apply determinism cap ===
  if (options?.determinismVerdict === 'NON_DETERMINISTIC') {
    const maxConfidence = policy.truthLocks.nonDeterministicMaxConfidence;
    if (finalScore > maxConfidence) {
      coreReasons.push('TRUTH_LOCK_NON_DETERMINISTIC_CAP');
      finalScore = Math.min(finalScore, maxConfidence);
    }
  }
  
  // === TRUTH LOCKS: Evidence Law cap ===
  const evidencePackage = options?.evidencePackage || evidence?.evidencePackage || {};
  if (evidencePackage?.severity === 'CONFIRMED' || evidencePackage?.status === 'CONFIRMED') {
    if (policy.truthLocks.evidenceCompleteRequired && !evidencePackage.isComplete) {
      coreReasons.push('TRUTH_LOCK_EVIDENCE_INCOMPLETE');
      // Force downgrade from CONFIRMED
      finalScore = Math.min(finalScore, 0.6); // Cap at MEDIUM
    }
  }
  
  // === DETERMINE LEVEL using Contract v1 thresholds ===
  const level = determineConfidenceLevel(finalScore, promiseStrength, evidenceCompleteness, policy);
  
  const policyReport = getPolicyReport(policy);
  
  // Contract v1: score01 is canonical, derive score100 and topReasons (core only)
  const topReasons = coreReasons.slice(0, 4);
  
  return {
    score: finalScore, // alias for score01 for backward compatibility
    score01: finalScore,
    score100: Math.round(finalScore * 100),
    level,
    reasons: reasons.slice(0, 10), // ALL reasons for backward compat (core + advisory)
    advisoryReasons: advisoryReasons.slice(0, 10), // Advisory reasons (for analyst/context)
    topReasons,
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
 * Determine confidence level using Contract v1 thresholds
 * HIGH: score01 >= 0.85
 * MEDIUM: 0.60 <= score01 < 0.85  
 * UNPROVEN: score01 < 0.60
 */
function determineConfidenceLevel(score, _promiseStrength, _evidenceCompleteness, _policy) {
  if (score >= 0.85) {
    return CONFIDENCE_LEVEL.HIGH;
  }
  
  if (score >= 0.60) {
    return CONFIDENCE_LEVEL.MEDIUM;
  }
  
  return CONFIDENCE_LEVEL.UNPROVEN;
}

/**
 * PHASE 21.4: Compute confidence for finding (wrapper with policy support)
 * 
 * @param {Object} params - Confidence computation parameters
 * @param {string} params.findingType - Type of finding
 * @param {Object} params.expectation - Promise/expectation
 * @param {Object} params.sensors - Sensor data
 * @param {Object} params.comparisons - Comparison data
 * @param {Object} params.evidence - Evidence data
 * @param {Object} params.options - Options { policyPath, projectDir, determinismVerdict, evidencePackage }
 * @returns {Object} { score, level, reasons[] }
 */
export function computeConfidenceForFinding(params) {
  // Backward compatibility: options may be in params.options or params directly
  const options = params.options || {};
  
  // Use legacy system for base computation
  const legacyParams = {
    findingType: params.findingType,
    expectation: params.expectation,
    sensors: params.sensors,
    comparisons: params.comparisons,
    attemptMeta: params['attemptMeta'] || {},
    executionModeCeiling: options.executionModeCeiling || 1.0
  };
  const legacyResult = computeConfidenceLegacy(legacyParams);
  
  // Legacy returns score in 0-100; normalize to 0-1 for unified engine
  let normalizedScore = (legacyResult.score || 0) / 100;
  normalizedScore = Math.max(0, Math.min(1, normalizedScore));
  
  // Extract reasons from legacy explain/factors
  const reasons = extractReasonsFromLegacy(legacyResult, params);
  
  // Load policy for truth locks
  const policy = getConfidencePolicy(options?.policyPath, options?.projectDir);
  
  // === TRUTH LOCKS: Apply determinism cap ===
  if (options?.determinismVerdict === 'NON_DETERMINISTIC') {
    const maxConfidence = policy.truthLocks.nonDeterministicMaxConfidence;
    if (normalizedScore > maxConfidence) {
      reasons.push('TRUTH_LOCK_NON_DETERMINISTIC_CAP');
      normalizedScore = Math.min(normalizedScore, maxConfidence);
    }
  }
  
  // === TRUTH LOCKS: Evidence Law cap ===
  const evidencePackage = options?.evidencePackage || (params.evidence && params.evidence.evidencePackage) || {};
  if (evidencePackage?.severity === 'CONFIRMED' || evidencePackage?.status === 'CONFIRMED') {
    if (policy.truthLocks.evidenceCompleteRequired && !evidencePackage.isComplete) {
      reasons.push('TRUTH_LOCK_EVIDENCE_INCOMPLETE');
      normalizedScore = Math.min(normalizedScore, 0.6);
    }
  }
  
  // Determine level using policy thresholds
  const level = determineConfidenceLevel(
    normalizedScore,
    assessPromiseStrength(params.expectation, [], policy),
    assessEvidenceCompleteness(params.evidence || {}, params.sensors || {}, [], policy),
    policy
  );
  
  // Contract v1: Return score01, score100, level, and topReasons
  const topReasons = reasons.slice(0, 4);
  
  return {
    score01: normalizedScore,
    score100: Math.round(normalizedScore * 100),
    score: normalizedScore, // Backward compat - should be 0..1
    level,
    reasons,
    topReasons,
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

