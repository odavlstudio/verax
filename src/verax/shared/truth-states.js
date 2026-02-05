/**
 * VERAX Truth Vocabulary (Official Contract)
 *
 * These are the ONLY user-facing truth states.
 * They may appear in CLI output and artifacts (e.g., summary.json, run.status.json).
 */
export const TRUTH_STATES = Object.freeze({
  SUCCESS: 'SUCCESS',
  FINDINGS: 'FINDINGS',
  INCOMPLETE: 'INCOMPLETE',
});

export const OFFICIAL_TRUTH_STATE_SET = Object.freeze(new Set(Object.values(TRUTH_STATES)));

export function normalizeTruthState(value, fallback = TRUTH_STATES.INCOMPLETE) {
  return OFFICIAL_TRUTH_STATE_SET.has(value) ? value : fallback;
}
