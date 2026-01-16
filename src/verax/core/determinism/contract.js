/**
 * PHASE 21.2 — Determinism Truth Lock: Strict Contract
 * 
 * DETERMINISM CONTRACT:
 * 
 * DETERMINISTIC means:
 * - Same inputs (source code, URL, config)
 * - Same environment (browser, OS, Node version)
 * - Same config (budget, timeouts, flags)
 * → identical normalized artifacts (findings, traces, evidence)
 * 
 * NON_DETERMINISTIC means:
 * - Any adaptive behavior occurred (adaptive stabilization, retries, dynamic timeouts)
 * - Any timing variance that affects results
 * - Any environment-dependent behavior
 * - Tracking adaptive decisions is NOT determinism
 * 
 * HARD RULE: If adaptiveEvents.length > 0 → verdict MUST be NON_DETERMINISTIC
 */

/**
 * PHASE 21.2: Determinism verdict (binary)
 * PHASE 25: Extended with expected/unexpected distinction
 */
export const DETERMINISM_VERDICT = {
  DETERMINISTIC: 'DETERMINISTIC',
  NON_DETERMINISTIC_EXPECTED: 'NON_DETERMINISTIC_EXPECTED',
  NON_DETERMINISTIC_UNEXPECTED: 'NON_DETERMINISTIC_UNEXPECTED',
  NON_DETERMINISTIC: 'NON_DETERMINISTIC' // Backward compatibility
};

/**
 * PHASE 21.2: Determinism reason codes (stable)
 * PHASE 25: Extended with new reason codes
 */
export const DETERMINISM_REASON = {
  ADAPTIVE_STABILIZATION_USED: 'ADAPTIVE_STABILIZATION_USED',
  RETRY_TRIGGERED: 'RETRY_TRIGGERED',
  TIMING_VARIANCE: 'TIMING_VARIANCE',
  TRUNCATION_OCCURRED: 'TRUNCATION_OCCURRED',
  ENVIRONMENT_VARIANCE: 'ENVIRONMENT_VARIANCE',
  NO_ADAPTIVE_EVENTS: 'NO_ADAPTIVE_EVENTS',
  RUN_FINGERPRINT_MISMATCH: 'RUN_FINGERPRINT_MISMATCH',
  ARTIFACT_DIFF_DETECTED: 'ARTIFACT_DIFF_DETECTED',
  VERIFIER_ERRORS_DETECTED: 'VERIFIER_ERRORS_DETECTED',
  EXPECTED_ADAPTIVE_BEHAVIOR: 'EXPECTED_ADAPTIVE_BEHAVIOR',
  UNEXPECTED_DIFF_WITHOUT_ADAPTIVE: 'UNEXPECTED_DIFF_WITHOUT_ADAPTIVE'
};

/**
 * PHASE 21.2: Adaptive event categories that break determinism
 */
export const ADAPTIVE_EVENT_CATEGORIES = [
  'ADAPTIVE_STABILIZATION',
  'RETRY',
  'TRUNCATION'
];

/**
 * PHASE 21.2: Check if a decision category breaks determinism
 * 
 * @param {string} category - Decision category
 * @returns {boolean} True if this category breaks determinism
 */
export function isAdaptiveEventCategory(category) {
  return ADAPTIVE_EVENT_CATEGORIES.includes(category);
}

/**
 * PHASE 21.2: Compute determinism verdict from DecisionRecorder
 * 
 * HARD RULE: If any adaptive event occurred → NON_DETERMINISTIC
 * 
 * @param {Object} decisionRecorder - Decision recorder instance
 * @returns {Object} { verdict, reasons, adaptiveEvents }
 */
export function computeDeterminismVerdict(decisionRecorder) {
  if (!decisionRecorder) {
    return {
      verdict: DETERMINISM_VERDICT.NON_DETERMINISTIC,
      reasons: [DETERMINISM_REASON.ENVIRONMENT_VARIANCE],
      adaptiveEvents: [],
      message: 'DecisionRecorder not available - cannot verify determinism'
    };
  }
  
  const adaptiveEvents = [];
  const reasons = [];
  
  // Check for adaptive stabilization
  const adaptiveStabilization = decisionRecorder.getByCategory('ADAPTIVE_STABILIZATION');
  const adaptiveExtensions = adaptiveStabilization.filter(d => 
    d.decision_id === 'ADAPTIVE_STABILIZATION_extended'
  );
  
  if (adaptiveExtensions.length > 0) {
    adaptiveEvents.push(...adaptiveExtensions);
    reasons.push(DETERMINISM_REASON.ADAPTIVE_STABILIZATION_USED);
  }
  
  // Check for retries
  const retries = decisionRecorder.getByCategory('RETRY');
  if (retries.length > 0) {
    adaptiveEvents.push(...retries);
    reasons.push(DETERMINISM_REASON.RETRY_TRIGGERED);
  }
  
  // Check for truncations
  const truncations = decisionRecorder.getByCategory('TRUNCATION');
  if (truncations.length > 0) {
    adaptiveEvents.push(...truncations);
    reasons.push(DETERMINISM_REASON.TRUNCATION_OCCURRED);
  }
  
  // HARD RULE: If any adaptive events → NON_DETERMINISTIC
  if (adaptiveEvents.length > 0) {
    return {
      verdict: DETERMINISM_VERDICT.NON_DETERMINISTIC,
      reasons,
      adaptiveEvents: adaptiveEvents.map(e => ({
        decision_id: e.decision_id,
        category: e.category,
        timestamp: e.timestamp,
        reason: e.reason,
        context: e.context || null
      })),
      message: `Non-deterministic: ${adaptiveEvents.length} adaptive event(s) detected`
    };
  }
  
  // No adaptive events → DETERMINISTIC
  return {
    verdict: DETERMINISM_VERDICT.DETERMINISTIC,
    reasons: [DETERMINISM_REASON.NO_ADAPTIVE_EVENTS],
    adaptiveEvents: [],
    message: 'Deterministic: No adaptive events detected'
  };
}

