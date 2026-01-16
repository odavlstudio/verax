/**
 * PHASE 24 — Centralized Confidence Computation
 * 
 * Single entry point for all confidence calculations.
 * No capability may compute confidence independently.
 */

import { computeConfidenceForFinding } from '../confidence-engine.js';
import { CONFIDENCE_WEIGHTS as _CONFIDENCE_WEIGHTS } from './confidence-weights.js';
import { checkConfidenceInvariants, enforceConfidenceInvariants as _enforceConfidenceInvariants } from './confidence-invariants.js';

/**
 * Compute final confidence with full truth-aware reconciliation
 * 
 * @param {Object} params - Confidence computation parameters
 * @param {Object} params.rawSignals - Raw sensor signals
 * @param {Object} params.evidenceIntent - Evidence intent (from evidence.intent.json)
 * @param {Object} params.guardrailsOutcome - Guardrails outcome (from guardrails.report.json)
 * @param {string} params.truthStatus - Final truth status (CONFIRMED/SUSPECTED/INFORMATIONAL/IGNORED)
 * @param {Object} params.expectation - Expectation object
 * @param {Object} params.sensors - Sensor data
 * @param {Object} params.comparisons - Comparison data
 * @param {Object} params.evidence - Evidence data
 * @param {Object} params.options - Options { policyPath, projectDir, determinismVerdict, verificationStatus }
 * @returns {Object} { confidenceBefore, confidenceAfter, appliedInvariants, explanation, invariantViolations }
 */
export function computeFinalConfidence(params) {
  const {
    rawSignals = {},
    evidenceIntent = null,
    guardrailsOutcome = null,
    truthStatus = null,
    expectation = null,
    sensors = {},
    comparisons = {},
    evidence = {},
    options = {}
  } = params;
  
  // Step 1: Compute raw confidence using unified engine
  const rawConfidenceResult = computeConfidenceForFinding({
    // @ts-expect-error - Optional params structure
    findingType: params.findingType || 'unknown',
    expectation,
    sensors: rawSignals || sensors,
    comparisons,
    evidence,
    options
  });
  
  const confidenceBefore = rawConfidenceResult.score || 0;
  const explanation = [...(rawConfidenceResult.reasons || [])];
  
  // Step 2: Apply evidence intent adjustments
  let adjustedConfidence = confidenceBefore;
  if (evidenceIntent) {
    const captureFailures = Object.values(evidenceIntent.captureOutcomes || {})
      .filter(outcome => outcome.captured === false).length;
    if (captureFailures > 0) {
      const penalty = Math.min(0.2, captureFailures * 0.05);
      adjustedConfidence = Math.max(0, adjustedConfidence - penalty);
      explanation.push(`EVIDENCE_INTENT_FAILURES: ${captureFailures} capture failures, penalty: ${penalty}`);
    }
  }
  
  // Step 3: Apply guardrails outcome adjustments
  let guardrailsAdjustedConfidence = adjustedConfidence;
  if (guardrailsOutcome) {
    const guardrailsDelta = guardrailsOutcome.confidenceDelta || 0;
    guardrailsAdjustedConfidence = Math.max(0, Math.min(1, adjustedConfidence + guardrailsDelta));
    if (guardrailsDelta !== 0) {
      explanation.push(`GUARDRAILS_ADJUSTMENT: delta=${guardrailsDelta.toFixed(3)}`);
    }
  }
  
  // Step 4: Determine truth status (use guardrails outcome if available, otherwise use provided)
  const finalTruthStatus = truthStatus || 
    guardrailsOutcome?.finalDecision || 
    guardrailsOutcome?.recommendedStatus || 
    'SUSPECTED';
  
  // Step 5: Check and enforce invariants
  const expectationProof = expectation?.proof || null;
  const verificationStatus = options.verificationStatus || null;
  
  const invariantCheck = checkConfidenceInvariants(
    guardrailsAdjustedConfidence,
    finalTruthStatus,
    {
      expectationProof,
      verificationStatus,
      guardrailsOutcome
    }
  );
  
  const confidenceAfter = invariantCheck.correctedConfidence;
  const appliedInvariants = [];
  const invariantViolations = [];
  
  if (invariantCheck.violated) {
    for (const violation of invariantCheck.violations) {
      appliedInvariants.push(violation.code);
      invariantViolations.push({
        code: violation.code,
        message: violation.message,
        originalConfidence: guardrailsAdjustedConfidence,
        correctedConfidence: violation.corrected
      });
      explanation.push(`INVARIANT_ENFORCED: ${violation.message}`);
    }
  }
  
  // Step 6: Determine final confidence level
  const confidenceLevel = determineConfidenceLevel(confidenceAfter);
  
  // Extract top 2-4 reasons for contract compliance
  const topReasons = explanation.slice(0, 4).filter((r, idx) => idx < 2 || idx < 4);
  
  return {
    confidenceBefore,
    confidenceAfter,
    confidenceLevel,
    appliedInvariants,
    invariantViolations,
    explanation: explanation.slice(0, 20), // Limit to 20 for determinism
    topReasons, // Contract v1: 2-4 reasons
    truthStatus: finalTruthStatus,
    expectationProof,
    verificationStatus
  };
}

/**
 * Determine confidence level from score01 (Contract v1)
 * HIGH: score01 >= 0.85
 * MEDIUM: 0.60 <= score01 < 0.85
 * LOW: score01 < 0.60
 */
function determineConfidenceLevel(score) {
  if (score >= 0.85) return 'HIGH';
  if (score >= 0.60) return 'MEDIUM';
  return 'LOW';
}

