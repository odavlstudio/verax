/**
 * PHASE 15 — Confidence Helper
 * 
 * Helper function to add unified confidence to findings
 */

import { computeConfidenceForFinding } from '../core/confidence-engine.js';

/**
 * PHASE 15: Add unified confidence to a finding
 * 
 * @param {Object} finding - Finding object
 * @param {Object} params - Confidence computation parameters
 * @returns {Object} Finding with unified confidence fields
 */
export function addUnifiedConfidence(finding, params) {
  // @ts-expect-error - Optional params structure
  const unifiedConfidence = computeConfidenceForFinding({
    findingType: finding.type || 'unknown',
    expectation: params.expectation || null,
    sensors: params.sensors || {},
    comparisons: params.comparisons || {},
    evidence: params.evidence || {},
  });
  
  // Add unified confidence fields (additive only)
  return {
    ...finding,
    confidence: unifiedConfidence.score, // PHASE 15: Normalized 0..1
    confidenceLevel: unifiedConfidence.level, // PHASE 15: HIGH/MEDIUM/LOW/UNPROVEN
    confidenceReasons: unifiedConfidence.reasons, // PHASE 15: Stable reason codes
  };
}

