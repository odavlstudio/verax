/**
 * PHASE 21.4 — Confidence Policy Defaults
 * 
 * Default confidence policy matching current hardcoded behavior.
 * Truth locks are enforced and cannot be configured away.
 */

/**
 * Default confidence policy
 * 
 * This policy matches the current hardcoded behavior exactly.
 */
export const DEFAULT_CONFIDENCE_POLICY = {
  version: '21.4.0',
  source: 'default',
  baseScores: {
    promiseProven: 1.0,
    promiseObserved: 0.7,
    promiseWeak: 0.5,
    promiseUnknown: 0.2,
    urlChanged: 0.3,
    domChanged: 0.2,
    uiFeedbackConfirmed: 0.3,
    consoleErrors: 0.2,
    networkFailure: 0.3,
    networkSuccess: 0.1,
    timingAligned: 0.2,
    routeMatched: 0.2,
    requestMatched: 0.2,
    traceLinked: 0.1,
    screenshots: 0.3,
    traces: 0.2,
    signals: 0.2,
    snippets: 0.3
  },
  thresholds: {
    high: 0.8,
    medium: 0.6,
    low: 0.3
  },
  weights: {
    promiseStrength: 0.25,
    observationStrength: 0.30,
    correlationQuality: 0.20,
    guardrails: 0.15,
    evidenceCompleteness: 0.10
  },
  truthLocks: {
    // HARD LOCK: CONFIRMED requires evidencePackage.isComplete === true
    evidenceCompleteRequired: true,
    
    // HARD LOCK: NON_DETERMINISTIC verdict caps confidence ≤ 0.6
    nonDeterministicMaxConfidence: 0.6,
    
    // HARD LOCK: Guardrails confidence deltas are max-negative only (enforced in guardrails policy)
    guardrailsMaxNegative: true,
    
    // HARD LOCK: Cannot upgrade SUSPECTED → CONFIRMED via policy
    cannotUpgradeToConfirmed: true,
    
    // HARD LOCK: Contradiction penalty
    contradictionPenalty: 0.3
  }
};

