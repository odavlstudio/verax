/**
 * CI / Policy Gate Outcome (metadata-only)
 * PASS | WARN | FAIL
 *
 * Inputs: decisionUsefulness, confidence.level, truthStatus
 * Explicit mapping only. No side effects. No enforcement.
 */

const GATE = {
  PASS: 'PASS',
  WARN: 'WARN',
  FAIL: 'FAIL'
};

function n(v) {
  return v ? String(v).toUpperCase() : null;
}

/**
 * Evaluate gate outcome from existing signals.
 * Priority (first match wins):
 * - truthStatus INFORMATIONAL/IGNORED => PASS
 * - decisionUsefulness BLOCK => FAIL
 * - decisionUsefulness FIX => FAIL
 * - decisionUsefulness INVESTIGATE => WARN
 * - decisionUsefulness IGNORE => PASS
 * - Fallbacks (no decisionUsefulness provided):
 *   - truthStatus CONFIRMED and level in {HIGH, MEDIUM} => FAIL
 *   - truthStatus SUSPECTED and level in {HIGH, MEDIUM} => WARN
 *   - otherwise => PASS
 */
export function evaluateGateOutcome({ decisionUsefulness = null, level = 'UNKNOWN', truthStatus = null } = {}) {
  const du = n(decisionUsefulness);
  const l = n(level) || 'UNKNOWN';
  const t = n(truthStatus);

  if (t === 'INFORMATIONAL' || t === 'IGNORED') return GATE.PASS;

  if (du === 'BLOCK') return GATE.FAIL;
  if (du === 'FIX') return GATE.FAIL;
  if (du === 'INVESTIGATE') return GATE.WARN;
  if (du === 'IGNORE') return GATE.PASS;

  if (t === 'CONFIRMED' && (l === 'HIGH' || l === 'MEDIUM')) return GATE.FAIL;
  if (t === 'SUSPECTED' && (l === 'HIGH' || l === 'MEDIUM')) return GATE.WARN;

  return GATE.PASS;
}

export { GATE as GATE_OUTCOME };
