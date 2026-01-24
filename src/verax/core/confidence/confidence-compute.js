// @ts-nocheck
/**
 * PHASE 24 — Centralized Confidence Computation
 * 
 * Single entry point for all confidence calculations.
 * No capability may compute confidence independently.
 * 
 * PHASE 25: Activates policy and invariants as single authority.
 * 
 * NOTE: This module is internal to confidence/index.js.
 * External callers should import from core/confidence/index.js.
 */

import { computeConfidence as computeLegacyConfidence } from '../../shared/legacy-confidence-bridge.js';
import { CONFIDENCE_WEIGHTS as _CONFIDENCE_WEIGHTS } from './confidence-weights.js';
import { checkConfidenceInvariants, enforceConfidenceInvariants as _enforceConfidenceInvariants } from './confidence-invariants.js';
import { getConfidencePolicy } from './policy-cache.js';
import { generateReasonCodes } from './reason-codes.js';
import { generateTruthAwareExplanation, boundExplanationStrings } from './explanation-helpers.js';
import { evaluateEvidenceQuality } from '../evidence/evaluate-evidence-quality.js';
import { evaluateDecisionUsefulness } from '../decision/evaluate-decision-usefulness.js';
import { evaluateGateOutcome } from '../gates/evaluate-gate-outcome.js';
import { formatGatePreview } from '../gates/format-gate-preview.js';

function hasNetworkEvidence(networkSummary) {
  if (!networkSummary || typeof networkSummary !== 'object') return false;
  return (
    (networkSummary.totalRequests || 0) > 0 ||
    (networkSummary.failedRequests || 0) > 0 ||
    (networkSummary.successfulRequests || 0) > 0 ||
    networkSummary.hasNetworkActivity === true
  );
}

function hasConsoleEvidence(consoleSummary) {
  if (!consoleSummary || typeof consoleSummary !== 'object') return false;
  return (
    (consoleSummary.errorCount || 0) > 0 ||
    (consoleSummary.consoleErrorCount || 0) > 0 ||
    (consoleSummary.pageErrorCount || 0) > 0 ||
    (consoleSummary.unhandledRejectionCount || 0) > 0 ||
    (consoleSummary.lastErrors && consoleSummary.lastErrors.length > 0) ||
    consoleSummary.hasErrors === true
  );
}

function hasUiEvidence(uiSignals) {
  if (!uiSignals || typeof uiSignals !== 'object') return false;
  if (uiSignals.diff && typeof uiSignals.diff === 'object') {
    if (uiSignals.diff.changed === true) return true;
  }
  return (
    uiSignals.validationFeedbackDetected === true ||
    uiSignals.hasLoadingIndicator === true ||
    uiSignals.hasDialog === true ||
    uiSignals.hasErrorSignal === true ||
    uiSignals.hasStatusSignal === true ||
    uiSignals.hasLiveRegion === true ||
    (uiSignals.disabledElements && uiSignals.disabledElements.length > 0)
  );
}

function hasSubstantiveEvidence({ evidence = {}, sensors = {}, comparisons = {} }) {
  const evidenceSignals = evidence.signals || {};
  const networkSignals = sensors.network || evidenceSignals.network;
  const consoleSignals = sensors.console || evidenceSignals.console;
  const uiSignals = sensors.uiSignals || evidenceSignals.uiSignals;

  const urlChanged = comparisons.hasUrlChange === true || comparisons.urlChanged === true;
  const domChanged = comparisons.hasDomChange === true || comparisons.hasVisibleChange === true;
  const screenshotsPresent = Boolean(
    (evidence.before && evidence.before.screenshot) && (evidence.after && evidence.after.screenshot)
  );
  const evidenceComplete = evidence.isComplete === true || evidence?.evidencePackage?.isComplete === true;

  return (
    evidenceComplete ||
    urlChanged ||
    domChanged ||
    screenshotsPresent ||
    hasNetworkEvidence(networkSignals) ||
    hasConsoleEvidence(consoleSignals) ||
    hasUiEvidence(uiSignals)
  );
}

/**
 * Compute final confidence with full truth-aware reconciliation
 * 
 * @param {Object} params - Confidence computation parameters
 * @param {string} params.findingType - Type of finding
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
    findingType = 'unknown',
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
  
  // STEP 1: Load policy (deterministically cached)
  const policy = getConfidencePolicy(options.policyPath, options.projectDir);
  
  // STEP 2: Compute raw confidence using unified engine
  const rawConfidenceResult = computeLegacyConfidence({
    findingType,
    expectation,
    sensors: rawSignals || sensors,
    comparisons,
    evidence,
    options
  });
  
  const confidenceBefore = rawConfidenceResult.score || 0;
  const explanation = [...(rawConfidenceResult.reasons || [])];

  const evidencePresent = hasSubstantiveEvidence({
    evidence,
    sensors: rawSignals || sensors,
    comparisons
  });
  const appliedInvariants = [];
  const invariantViolations = [];
  
  // STEP 3: Apply evidence intent adjustments
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
  
  // STEP 4: Apply guardrails outcome adjustments
  let guardrailsAdjustedConfidence = adjustedConfidence;
  if (guardrailsOutcome) {
    const guardrailsDelta = guardrailsOutcome.confidenceDelta || 0;
    guardrailsAdjustedConfidence = Math.max(0, Math.min(1, adjustedConfidence + guardrailsDelta));
    if (guardrailsDelta !== 0) {
      explanation.push(`GUARDRAILS_ADJUSTMENT: delta=${guardrailsDelta.toFixed(3)}`);
    }
  }
  
  // STEP 5: Determine truth status (use guardrails outcome if available, otherwise use provided)
  let finalTruthStatus = truthStatus || 
    guardrailsOutcome?.finalDecision || 
    guardrailsOutcome?.recommendedStatus || 
    'SUSPECTED';

  // Evidence Law enforcement: CONFIRMED requires substantive evidence
  if (finalTruthStatus === 'CONFIRMED' && evidencePresent === false) {
    appliedInvariants.push('EVIDENCE_REQUIRED_FOR_CONFIRMED');
    invariantViolations.push({
      code: 'EVIDENCE_REQUIRED_FOR_CONFIRMED',
      message: 'CONFIRMED status requires substantive observable evidence; none detected',
      originalConfidence: guardrailsAdjustedConfidence,
      correctedConfidence: guardrailsAdjustedConfidence
    });
    explanation.push('EVIDENCE_INCOMPLETE: Downgraded to SUSPECTED due to missing substantive evidence.');
    finalTruthStatus = 'SUSPECTED';
  }
  
  // STEP 6: Check and enforce invariants (SINGLE PASS ONLY)
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
  
  let confidenceAfter = invariantCheck.correctedConfidence;
  
  // Collect invariant violations in deterministic order
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
  
  // STEP 7: Generate deterministic reason codes
  const reasonCodes = generateReasonCodes({
    expectation,
    sensors: rawSignals || sensors,
    comparisons,
    evidence,
    guardrailsOutcome,
    evidenceIntent,
    appliedInvariants,
    truthStatus: finalTruthStatus
  });
  
  // STEP 8: Generate truth-aware explanations
  const explanationObj = generateTruthAwareExplanation({
    confidenceScore: confidenceAfter,
    confidenceLevel: determineConfidenceLevel(confidenceAfter),
    truthStatus: finalTruthStatus,
    expectation,
    sensors: rawSignals || sensors,
    evidence,
    guardrailsOutcome,
    evidenceIntent,
    appliedInvariants,
    reasonCodes
  });

  const evidenceQuality = evaluateEvidenceQuality({
    sensors: rawSignals || sensors,
    evidence,
    comparisons,
    captureFailures: evidence?.captureFailures || [],
    findingType
  });

  const meta = {
    evidenceQuality,
    notes: []
  };

  if (finalTruthStatus === 'CONFIRMED' && evidenceQuality.quality !== 'STRONG') {
    meta.notes.push('CONFIRMED_WITHOUT_STRONG_EVIDENCE');
  }
  
  // Bound explanation strings (max 8)
  const boundedExplain = boundExplanationStrings(explanationObj);
  
  // STEP 9: Determine final confidence level
  const confidenceLevel = determineConfidenceLevel(confidenceAfter);
  
  // STEP 10: Return canonical result
  // Compute metadata-only signals
  const decisionUsefulness = evaluateDecisionUsefulness({
    level: confidenceLevel,
    evidenceQuality: evidenceQuality,
    truthStatus: finalTruthStatus,
    guardrailsOutcome
  });
  const gateOutcome = evaluateGateOutcome({
    decisionUsefulness,
    level: confidenceLevel,
    truthStatus: finalTruthStatus
  });

  const gatePreview = formatGatePreview({
    gateOutcome,
    decisionUsefulness,
    level: confidenceLevel,
    truthStatus: finalTruthStatus
  });

  return {
    confidenceBefore,
    confidenceAfter,
    confidenceLevel,
    appliedInvariants, // Ordered invariant codes
    invariantViolations, // Ordered violation records
    explanation: explanation.slice(0, 20), // Limit to 20 for determinism
    reasonCodes, // Canonical, deterministically ordered
    confidenceExplanation: explanationObj, // Truth-aware explanations
    topReasons: boundedExplain, // Contract v1: bounded reasons
    truthStatus: finalTruthStatus,
    expectationProof,
    verificationStatus,
    // Policy reference (for auditing)
    appliedPolicy: {
      version: policy.version,
      source: policy.source
    },
    meta: {
      ...meta,
      decisionUsefulness,
      gateOutcome,
      gatePreview
    }
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




