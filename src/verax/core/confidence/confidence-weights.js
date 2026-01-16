/**
 * PHASE 24 — Confidence Weights (Canonical)
 * 
 * Canonical weights for evidence types.
 * All capabilities MUST use these weights.
 * No custom weighting allowed.
 */

/**
 * Canonical evidence weights (normalized, sum to 1.0)
 */
export const CONFIDENCE_WEIGHTS = {
  UI_EVIDENCE: 0.25,
  NETWORK_EVIDENCE: 0.25,
  STATE_EVIDENCE: 0.15,
  ROUTE_EVIDENCE: 0.15,
  CONSOLE_EVIDENCE: 0.10,
  EVIDENCE_COMPLETENESS: 0.10
};

/**
 * Validate that weights sum to 1.0
 */
export function validateWeights(weights = CONFIDENCE_WEIGHTS) {
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1.0) > 0.001) {
    throw new Error(`Confidence weights must sum to 1.0, got ${sum}`);
  }
  return true;
}

/**
 * Get weight for evidence type
 * 
 * @param {string} evidenceType - One of: UI_EVIDENCE, NETWORK_EVIDENCE, STATE_EVIDENCE, ROUTE_EVIDENCE, CONSOLE_EVIDENCE, EVIDENCE_COMPLETENESS
 * @returns {number} Weight (0..1)
 */
export function getEvidenceWeight(evidenceType) {
  return CONFIDENCE_WEIGHTS[evidenceType] || 0;
}

// Validate on module load
validateWeights();

