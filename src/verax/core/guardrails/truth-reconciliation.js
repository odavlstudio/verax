/**
 * PHASE 23 — Guardrails Truth Reconciliation
 * 
 * Reconciles confidence with guardrails outcome to ensure consistency.
 * Guardrails outcome is the authoritative "final claim boundary".
 */

import { CONFIDENCE_LEVEL as _CONFIDENCE_LEVEL } from '../confidence-engine.js';

/**
 * Reconciliation reason codes
 */
export const RECONCILIATION_REASON = {
  GUARDRAILS_DOWNGRADE_CONFIRMED: 'RECON_GUARDRAILS_DOWNGRADE_CONFIRMED',
  GUARDRAILS_DOWNGRADE_SUSPECTED: 'RECON_GUARDRAILS_DOWNGRADE_SUSPECTED',
  GUARDRAILS_INFORMATIONAL: 'RECON_GUARDRAILS_INFORMATIONAL',
  GUARDRAILS_IGNORED: 'RECON_GUARDRAILS_IGNORED',
  CONFIDENCE_CAP_GUARDRAILS_DOWNGRADE: 'RECON_CONF_CAP_GUARDRAILS_DOWNGRADE',
  CONFIDENCE_CAP_INFORMATIONAL: 'RECON_CONF_CAP_INFORMATIONAL',
  CONFIDENCE_CAP_IGNORED: 'RECON_CONF_CAP_IGNORED',
  NO_RECONCILIATION_NEEDED: 'RECON_NO_RECONCILIATION_NEEDED',
};

/**
 * Finalize finding truth by reconciling confidence with guardrails outcome.
 * 
 * @param {Object} finding - Finding object (may have been modified by guardrails)
 * @param {Object} guardrailsResult - Result from applyGuardrails
 * @param {Object} context - Context { initialConfidence, initialConfidenceLevel }
 * @returns {Object} { finalFinding, truthDecision }
 */
export function finalizeFindingTruth(finding, guardrailsResult, context = {}) {
  const guardrails = guardrailsResult.guardrails || finding.guardrails || {};
  const finalDecision = guardrails.finalDecision || guardrails.recommendedStatus || finding.severity || 'SUSPECTED';
  
  // Capture initial confidence before guardrails
  const confidenceBefore = context.initialConfidence !== undefined 
    ? context.initialConfidence 
    : (finding.confidence || 0);
  const confidenceLevelBefore = context.initialConfidenceLevel 
    || finding.confidenceLevel 
    || (confidenceBefore >= 0.8 ? 'HIGH' : confidenceBefore >= 0.5 ? 'MEDIUM' : confidenceBefore >= 0.2 ? 'LOW' : 'UNPROVEN');
  
  // Start with guardrails-adjusted confidence
  let confidenceAfter = finding.confidence !== undefined ? finding.confidence : confidenceBefore;
  let confidenceLevelAfter = finding.confidenceLevel || confidenceLevelBefore;
  
  const reconciliationReasons = [];
  const contradictionsResolved = [];
  
  // Enforce truth boundaries based on final decision
  if (finalDecision === 'CONFIRMED') {
    // CONFIRMED must have guardrails finalDecision == CONFIRMED
    if (guardrails.finalDecision !== 'CONFIRMED' && guardrails.recommendedStatus !== 'CONFIRMED') {
      // This should not happen if guardrails are applied correctly, but enforce it
      contradictionsResolved.push({
        code: 'CONTRADICTION_CONFIRMED_WITHOUT_GUARDRAILS',
        message: 'Finding marked CONFIRMED but guardrails did not approve CONFIRMED status'
      });
    }
    // CONFIRMED can have any confidence level (no cap)
  } else if (finalDecision === 'SUSPECTED') {
    // SUSPECTED due to guardrails downgrade -> cap confidence at 0.69 (MEDIUM)
    const wasDowngraded = guardrails.contradictions && guardrails.contradictions.length > 0;
    const hasEvidenceIntentFailure = guardrails.appliedRules?.some(r => 
      r.code?.includes('EVIDENCE') || r.message?.includes('evidence')
    );
    
    if (wasDowngraded || hasEvidenceIntentFailure) {
      if (confidenceAfter > 0.69) {
        confidenceAfter = 0.69;
        confidenceLevelAfter = 'MEDIUM';
        reconciliationReasons.push(RECONCILIATION_REASON.CONFIDENCE_CAP_GUARDRAILS_DOWNGRADE);
      }
      reconciliationReasons.push(RECONCILIATION_REASON.GUARDRAILS_DOWNGRADE_SUSPECTED);
    }
  } else if (finalDecision === 'INFORMATIONAL') {
    // INFORMATIONAL -> confidence must be LOW or UNPROVEN
    if (confidenceAfter > 0.2) {
      confidenceAfter = 0.2;
      confidenceLevelAfter = 'LOW';
      reconciliationReasons.push(RECONCILIATION_REASON.CONFIDENCE_CAP_INFORMATIONAL);
    }
    reconciliationReasons.push(RECONCILIATION_REASON.GUARDRAILS_INFORMATIONAL);
  } else if (finalDecision === 'IGNORED') {
    // IGNORED -> confidence must be UNPROVEN
    confidenceAfter = 0;
    confidenceLevelAfter = 'UNPROVEN';
    reconciliationReasons.push(RECONCILIATION_REASON.CONFIDENCE_CAP_IGNORED);
    reconciliationReasons.push(RECONCILIATION_REASON.GUARDRAILS_IGNORED);
  }
  
  // If no reconciliation was needed, record it
  if (reconciliationReasons.length === 0) {
    reconciliationReasons.push(RECONCILIATION_REASON.NO_RECONCILIATION_NEEDED);
  }
  
  // Build final finding with reconciled confidence
  const finalFinding = {
    ...finding,
    severity: finalDecision,
    status: finalDecision,
    confidence: confidenceAfter,
    confidenceLevel: confidenceLevelAfter,
    guardrails: {
      ...guardrails,
      reconciliation: {
        confidenceBefore,
        confidenceAfter,
        confidenceLevelBefore,
        confidenceLevelAfter,
        reconciliationReasons,
        contradictionsResolved
      }
    }
  };
  
  // Build truth decision
  const truthDecision = {
    finalStatus: finalDecision,
    appliedGuardrails: guardrails.appliedRules?.map(r => r.code) || [],
    confidenceBefore,
    confidenceAfter,
    confidenceLevelBefore,
    confidenceLevelAfter,
    reconciliationReasons,
    contradictionsResolved,
    confidenceDelta: confidenceAfter - confidenceBefore
  };
  
  return {
    finalFinding,
    truthDecision
  };
}




