/**
 * STAGE 4.1: Outcome → Judgment Mapping
 * 
 * Deterministic mapping from observation outcomes to judgment classifications.
 * 
 * NO confidence math, NO heuristics, NO guessing.
 * Same outcome MUST produce same judgment.
 * 
 * CANONICAL MAPPING:
 * - success → PASS
 * - partial_success → WEAK_PASS
 * - misleading → FAILURE_MISLEADING
 * - silent_failure → FAILURE_SILENT
 * - ambiguous → NEEDS_REVIEW
 */

import { OUTCOME_TYPES } from '../../cli/util/observation/outcome-truth-matrix.js';

/**
 * Judgment Types - Mutually Exclusive
 */
export const JUDGMENT_TYPES = {
  PASS: 'PASS',
  WEAK_PASS: 'WEAK_PASS',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  FAILURE_MISLEADING: 'FAILURE_MISLEADING',
  FAILURE_SILENT: 'FAILURE_SILENT',
};

/**
 * Map outcome to judgment
 * 
 * Deterministic, evidence-driven mapping.
 * 
 * @param {string} outcome - OUTCOME_TYPES value
 * @returns {string} JUDGMENT_TYPES value
 */
export function mapOutcomeToJudgment(outcome) {
  const mapping = {
    [OUTCOME_TYPES.SUCCESS]: JUDGMENT_TYPES.PASS,
    [OUTCOME_TYPES.PARTIAL_SUCCESS]: JUDGMENT_TYPES.WEAK_PASS,
    [OUTCOME_TYPES.MISLEADING]: JUDGMENT_TYPES.FAILURE_MISLEADING,
    [OUTCOME_TYPES.SILENT_FAILURE]: JUDGMENT_TYPES.FAILURE_SILENT,
    [OUTCOME_TYPES.AMBIGUOUS]: JUDGMENT_TYPES.NEEDS_REVIEW,
  };

  const judgment = mapping[outcome];
  
  if (!judgment) {
    throw new Error(`Unknown outcome type: ${outcome}. Cannot map to judgment.`);
  }

  return judgment;
}

/**
 * Check if judgment represents a failure
 * 
 * @param {string} judgment - JUDGMENT_TYPES value
 * @returns {boolean}
 */
export function isFailureJudgment(judgment) {
  return judgment === JUDGMENT_TYPES.FAILURE_SILENT || 
         judgment === JUDGMENT_TYPES.FAILURE_MISLEADING;
}

/**
 * Check if judgment represents a pass (strong or weak)
 * 
 * @param {string} judgment - JUDGMENT_TYPES value
 * @returns {boolean}
 */
export function isPassJudgment(judgment) {
  return judgment === JUDGMENT_TYPES.PASS || 
         judgment === JUDGMENT_TYPES.WEAK_PASS;
}

/**
 * Check if judgment is conclusive (not needing review)
 * 
 * @param {string} judgment - JUDGMENT_TYPES value
 * @returns {boolean}
 */
export function isConclusiveJudgment(judgment) {
  return judgment !== JUDGMENT_TYPES.NEEDS_REVIEW;
}

/**
 * Get judgment priority for sorting
 * Higher priority = more severe
 * 
 * @param {string} judgment - JUDGMENT_TYPES value
 * @returns {number}
 */
export function getJudgmentPriority(judgment) {
  const priorities = {
    [JUDGMENT_TYPES.FAILURE_MISLEADING]: 100,
    [JUDGMENT_TYPES.FAILURE_SILENT]: 90,
    [JUDGMENT_TYPES.NEEDS_REVIEW]: 50,
    [JUDGMENT_TYPES.WEAK_PASS]: 20,
    [JUDGMENT_TYPES.PASS]: 10,
  };

  return priorities[judgment] ?? 0;
}

/**
 * Get human-readable explanation of judgment
 * 
 * @param {string} judgment - JUDGMENT_TYPES value
 * @returns {string}
 */
export function explainJudgment(judgment) {
  const explanations = {
    [JUDGMENT_TYPES.PASS]: 'Promise fulfilled with strong acknowledgment',
    [JUDGMENT_TYPES.WEAK_PASS]: 'Promise partially fulfilled or weak acknowledgment',
    [JUDGMENT_TYPES.NEEDS_REVIEW]: 'Insufficient evidence for conclusive judgment',
    [JUDGMENT_TYPES.FAILURE_MISLEADING]: 'Contradictory signals: success UI with error indicators',
    [JUDGMENT_TYPES.FAILURE_SILENT]: 'Promise not fulfilled without user notification',
  };

  return explanations[judgment] || 'Unknown judgment type';
}
