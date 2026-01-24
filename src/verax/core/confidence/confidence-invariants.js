/**
 * PHASE 24 — Confidence Invariants (Immutable Rules)
 * 
 * Formal confidence invariants that MUST be enforced.
 * Violations trigger automatic downgrades and are recorded.
 */

/**
 * Confidence invariant violation reason codes
 */
export const INVARIANT_VIOLATION = {
  CONFIRMED_BELOW_MIN: 'INV_CONFIRMED_BELOW_MIN',
  SUSPECTED_ABOVE_MAX: 'INV_SUSPECTED_ABOVE_MAX',
  SUSPECTED_BELOW_MIN: 'INV_SUSPECTED_BELOW_MIN',
  INFORMATIONAL_ABOVE_MAX: 'INV_INFORMATIONAL_ABOVE_MAX',
  INFORMATIONAL_BELOW_MIN: 'INV_INFORMATIONAL_BELOW_MIN',
  IGNORED_NON_ZERO: 'INV_IGNORED_NON_ZERO',
  UNPROVEN_EXPECTATION_ABOVE_MAX: 'INV_UNPROVEN_EXPECTATION_ABOVE_MAX',
  VERIFIED_WITH_ERRORS_ABOVE_MAX: 'INV_VERIFIED_WITH_ERRORS_ABOVE_MAX',
  GUARDRAILS_DOWNGRADE_OVERRIDE: 'INV_GUARDRAILS_DOWNGRADE_OVERRIDE'
};

/**
 * Confidence ranges by status (immutable)
 */
export const CONFIDENCE_RANGES = {
  CONFIRMED: { min: 0.70, max: 1.00 },
  SUSPECTED: { min: 0.30, max: 0.69 },
  INFORMATIONAL: { min: 0.01, max: 0.29 },
  IGNORED: { min: 0.00, max: 0.00 }
};

/**
 * Special caps
 */
export const CONFIDENCE_CAPS = {
  UNPROVEN_EXPECTATION: 0.39,
  VERIFIED_WITH_ERRORS: 0.49
};

/**
 * Check if confidence violates invariants for a given status
 * 
 * @param {number} confidence - Confidence score (0..1)
 * @param {string} status - Finding status (CONFIRMED, SUSPECTED, etc.)
 * @param {Object} context - Context { expectationProof, verificationStatus, guardrailsOutcome }
 * @returns {Object} { violated: boolean, violations: [], correctedConfidence: number }
 */
export function checkConfidenceInvariants(confidence, status, context = {}) {
  const violations = [];
  let correctedConfidence = confidence;
  
  // Rule 1: CONFIRMED ⇒ confidence ∈ [0.70 – 1.00]
  if (status === 'CONFIRMED') {
    if (confidence < CONFIDENCE_RANGES.CONFIRMED.min) {
      violations.push({
        code: INVARIANT_VIOLATION.CONFIRMED_BELOW_MIN,
        message: `CONFIRMED status requires confidence >= ${CONFIDENCE_RANGES.CONFIRMED.min}, got ${confidence}`,
        corrected: CONFIDENCE_RANGES.CONFIRMED.min
      });
      correctedConfidence = CONFIDENCE_RANGES.CONFIRMED.min;
    }
    if (confidence > CONFIDENCE_RANGES.CONFIRMED.max) {
      correctedConfidence = CONFIDENCE_RANGES.CONFIRMED.max;
    }
  }
  
  // Rule 2: SUSPECTED ⇒ confidence ∈ [0.30 – 0.69]
  if (status === 'SUSPECTED') {
    if (confidence > CONFIDENCE_RANGES.SUSPECTED.max) {
      violations.push({
        code: INVARIANT_VIOLATION.SUSPECTED_ABOVE_MAX,
        message: `SUSPECTED status requires confidence <= ${CONFIDENCE_RANGES.SUSPECTED.max}, got ${confidence}`,
        corrected: CONFIDENCE_RANGES.SUSPECTED.max
      });
      correctedConfidence = CONFIDENCE_RANGES.SUSPECTED.max;
    }
    if (confidence < CONFIDENCE_RANGES.SUSPECTED.min) {
      violations.push({
        code: INVARIANT_VIOLATION.SUSPECTED_BELOW_MIN,
        message: `SUSPECTED status requires confidence >= ${CONFIDENCE_RANGES.SUSPECTED.min}, got ${confidence}`,
        corrected: CONFIDENCE_RANGES.SUSPECTED.min
      });
      correctedConfidence = CONFIDENCE_RANGES.SUSPECTED.min;
    }
  }
  
  // Rule 3: INFORMATIONAL ⇒ confidence ∈ [0.01 – 0.29]
  if (status === 'INFORMATIONAL') {
    if (confidence > CONFIDENCE_RANGES.INFORMATIONAL.max) {
      violations.push({
        code: INVARIANT_VIOLATION.INFORMATIONAL_ABOVE_MAX,
        message: `INFORMATIONAL status requires confidence <= ${CONFIDENCE_RANGES.INFORMATIONAL.max}, got ${confidence}`,
        corrected: CONFIDENCE_RANGES.INFORMATIONAL.max
      });
      correctedConfidence = CONFIDENCE_RANGES.INFORMATIONAL.max;
    }
    if (confidence < CONFIDENCE_RANGES.INFORMATIONAL.min) {
      violations.push({
        code: INVARIANT_VIOLATION.INFORMATIONAL_BELOW_MIN,
        message: `INFORMATIONAL status requires confidence >= ${CONFIDENCE_RANGES.INFORMATIONAL.min}, got ${confidence}`,
        corrected: CONFIDENCE_RANGES.INFORMATIONAL.min
      });
      correctedConfidence = CONFIDENCE_RANGES.INFORMATIONAL.min;
    }
  }
  
  // Rule 4: IGNORED ⇒ confidence === 0
  if (status === 'IGNORED') {
    if (confidence !== 0) {
      violations.push({
        code: INVARIANT_VIOLATION.IGNORED_NON_ZERO,
        message: `IGNORED status requires confidence === 0, got ${confidence}`,
        corrected: 0
      });
      correctedConfidence = 0;
    }
  }
  
  // Rule 5: UNPROVEN_EXPECTATION ⇒ confidence ≤ 0.39
  if (context.expectationProof === 'UNPROVEN_EXPECTATION') {
    if (correctedConfidence > CONFIDENCE_CAPS.UNPROVEN_EXPECTATION) {
      violations.push({
        code: INVARIANT_VIOLATION.UNPROVEN_EXPECTATION_ABOVE_MAX,
        message: `UNPROVEN_EXPECTATION requires confidence <= ${CONFIDENCE_CAPS.UNPROVEN_EXPECTATION}, got ${correctedConfidence}`,
        corrected: CONFIDENCE_CAPS.UNPROVEN_EXPECTATION
      });
      correctedConfidence = CONFIDENCE_CAPS.UNPROVEN_EXPECTATION;
    }
  }
  
  // Rule 6: VERIFIED_WITH_ERRORS ⇒ confidence capped at 0.49
  if (context.verificationStatus === 'VERIFIED_WITH_ERRORS') {
    if (correctedConfidence > CONFIDENCE_CAPS.VERIFIED_WITH_ERRORS) {
      violations.push({
        code: INVARIANT_VIOLATION.VERIFIED_WITH_ERRORS_ABOVE_MAX,
        message: `VERIFIED_WITH_ERRORS requires confidence <= ${CONFIDENCE_CAPS.VERIFIED_WITH_ERRORS}, got ${correctedConfidence}`,
        corrected: CONFIDENCE_CAPS.VERIFIED_WITH_ERRORS
      });
      correctedConfidence = CONFIDENCE_CAPS.VERIFIED_WITH_ERRORS;
    }
  }
  
  // Rule 7: Guardrails downgrade ALWAYS overrides raw confidence
  if (context.guardrailsOutcome && context.guardrailsOutcome.downgraded) {
    const guardrailsFinalDecision = context.guardrailsOutcome.finalDecision || context.guardrailsOutcome.recommendedStatus;
    if (guardrailsFinalDecision && guardrailsFinalDecision !== status) {
      // Guardrails changed the status, confidence must match the new status
      const range = CONFIDENCE_RANGES[guardrailsFinalDecision];
      if (range) {
        if (correctedConfidence > range.max) {
          violations.push({
            code: INVARIANT_VIOLATION.GUARDRAILS_DOWNGRADE_OVERRIDE,
            message: `Guardrails downgrade to ${guardrailsFinalDecision} requires confidence <= ${range.max}, got ${correctedConfidence}`,
            corrected: range.max
          });
          correctedConfidence = range.max;
        }
        if (correctedConfidence < range.min && guardrailsFinalDecision !== 'IGNORED') {
          violations.push({
            code: INVARIANT_VIOLATION.GUARDRAILS_DOWNGRADE_OVERRIDE,
            message: `Guardrails downgrade to ${guardrailsFinalDecision} requires confidence >= ${range.min}, got ${correctedConfidence}`,
            corrected: range.min
          });
          correctedConfidence = range.min;
        }
      }
    }
  }
  
  return {
    violated: violations.length > 0,
    violations,
    correctedConfidence
  };
}

/**
 * Enforce confidence invariants (mutates finding if needed)
 * 
 * @param {Object} finding - Finding object
 * @param {Object} context - Context for invariant checking
 * @returns {Object} { finding: correctedFinding, violations: [] }
 */
export function enforceConfidenceInvariants(finding, context = {}) {
  const status = finding.severity || finding.status || 'SUSPECTED';
  const confidence = finding.confidence !== undefined ? finding.confidence : 0;
  
  const expectationProof = finding.expectation?.proof || context.expectationProof;
  const verificationStatus = context.verificationStatus;
  const guardrailsOutcome = finding.guardrails || context.guardrailsOutcome;
  
  const invariantCheck = checkConfidenceInvariants(confidence, status, {
    expectationProof,
    verificationStatus,
    guardrailsOutcome
  });
  
  if (invariantCheck.violated) {
    // Apply corrections
    const correctedFinding = {
      ...finding,
      confidence: invariantCheck.correctedConfidence,
      confidenceLevel: determineConfidenceLevel(invariantCheck.correctedConfidence),
      invariantViolations: invariantCheck.violations.map(v => ({
        code: v.code,
        message: v.message,
        originalConfidence: confidence,
        correctedConfidence: v.corrected
      }))
    };
    
    return {
      finding: correctedFinding,
      violations: invariantCheck.violations
    };
  }
  
  return {
    finding,
    violations: []
  };
}

/**
 * Determine confidence level from score
 */
function determineConfidenceLevel(score) {
  if (score >= 0.80) return 'HIGH';
  if (score >= 0.50) return 'MEDIUM';
  if (score >= 0.20) return 'LOW';
  return 'UNPROVEN';
}




