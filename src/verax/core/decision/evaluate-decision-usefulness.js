// @ts-nocheck
/**
 * Decision Usefulness Evaluator (metadata-only)
 * Categories: IGNORE | INVESTIGATE | FIX | BLOCK
 *
 * Inputs are existing confidence outputs/metadata. This module MUST NOT
 * modify scores, levels, verdicts, or thresholds. It derives a deterministic
 * usefulness label purely from provided inputs.
 */

const USEFULNESS = {
  IGNORE: 'IGNORE',
  INVESTIGATE: 'INVESTIGATE',
  FIX: 'FIX',
  BLOCK: 'BLOCK'
};

/**
 * Normalize evidenceQuality input (string or object with { quality })
 */
function normalizeQuality(evidenceQuality) {
  if (!evidenceQuality) return 'NONE';
  if (typeof evidenceQuality === 'string') return evidenceQuality;
  if (typeof evidenceQuality === 'object' && evidenceQuality.quality) return evidenceQuality.quality;
  return 'NONE';
}

/**
 * Evaluate decision usefulness from explicit rule mapping only.
 *
 * Priority order (first match wins):
 * 1) IGNORED/INFORMATIONAL => IGNORE
 * 2) CONFIRMED + HIGH + STRONG => BLOCK
 * 3) CONFIRMED (otherwise) => FIX
 * 4) SUSPECTED + (MEDIUM|HIGH) => INVESTIGATE
 * 5) SUSPECTED + (LOW|UNKNOWN) and quality NONE => IGNORE
 * 6) Default fallbacks
 *    - MEDIUM/HIGH with PARTIAL/STRONG => INVESTIGATE
 *    - else => IGNORE
 *
 * @param {Object} params
 * @param {string} params.level - 'HIGH' | 'MEDIUM' | 'LOW' | 'UNPROVEN' | 'UNKNOWN'
 * @param {string|Object} params.evidenceQuality - string or { quality }
 * @param {string|null} params.truthStatus - 'CONFIRMED' | 'SUSPECTED' | 'INFORMATIONAL' | 'IGNORED' | null
 * @param {Object|null} params.guardrailsOutcome - optional guardrails outcome (unused for mapping v1)
 * @returns {string} One of USEFULNESS values
 */
export function evaluateDecisionUsefulness({ level, evidenceQuality, truthStatus, guardrailsOutcome: _guardrailsOutcome = null } = {}) {
  const l = (level || 'UNKNOWN').toUpperCase();
  const q = normalizeQuality(evidenceQuality).toUpperCase();
  const t = truthStatus ? truthStatus.toUpperCase() : null;

  // 1) Explicit ignores
  if (t === 'IGNORED' || t === 'INFORMATIONAL') {
    return USEFULNESS.IGNORE;
  }

  // 2) Strong confirmations -> BLOCK
  if (t === 'CONFIRMED' && l === 'HIGH' && q === 'STRONG') {
    return USEFULNESS.BLOCK;
  }

  // 3) All other confirmations -> FIX
  if (t === 'CONFIRMED') {
    return USEFULNESS.FIX;
  }

  // 4) Suspected with sufficient signal -> INVESTIGATE
  if (t === 'SUSPECTED' && (l === 'HIGH' || l === 'MEDIUM')) {
    return USEFULNESS.INVESTIGATE;
  }

  // 5) Low-signal suspected -> IGNORE
  if (t === 'SUSPECTED' && (l === 'LOW' || l === 'UNPROVEN' || l === 'UNKNOWN') && q === 'NONE') {
    return USEFULNESS.IGNORE;
  }

  // 6) Fallbacks by level/quality (no truthStatus)
  if ((l === 'HIGH' || l === 'MEDIUM') && (q === 'PARTIAL' || q === 'STRONG')) {
    return USEFULNESS.INVESTIGATE;
  }

  return USEFULNESS.IGNORE;
}

export { USEFULNESS as DECISION_USEFULNESS };
