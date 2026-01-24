/**
 * Gate Enforcement (opt-in only via VERAX_ENFORCE_GATES=1)
 *
 * Minimal enforcement that:
 * - Is disabled by default
 * - Only runs when VERAX_ENFORCE_GATES=1
 * - Sets process.exitCode based on gate outcome and policy
 * - Does NOT modify verdicts, summaries, or behavior
 * - Does NOT throw exceptions
 *
 * Contract:
 * - gateOutcome FAIL + enforcement enabled → set process.exitCode = 1
 * - gateOutcome WARN/PASS or enforcement disabled → no action
 * - Policy can refine enforcement scope (optional)
 * - No side effects on confidence, metadata, or findings
 */

import { matchesPolicyScope } from './load-gate-policy.js';

/**
 * Check if gate enforcement is enabled.
 * @returns {boolean} true if VERAX_ENFORCE_GATES=1
 */
function isEnforcementEnabled() {
  return process.env.VERAX_ENFORCE_GATES === '1';
}

/**
 * Enforce gate outcome by setting process.exitCode if gate matches policy.
 * Only runs if explicitly enabled via environment variable.
 *
 * Backward compatible: if no policy provided, defaults to legacy FAIL-only enforcement.
 *
 * @param {string} gateOutcome - 'PASS' | 'WARN' | 'FAIL'
 * @param {Object} policy - Optional gate policy (if null, uses legacy FAIL-only behavior)
 * @param {string} truthStatus - Optional truth status for scope matching
 * @param {string} decisionUsefulness - Optional decision usefulness for scope matching
 * @returns {void} - No return value; side effect only on process.exitCode
 */
export function enforceGateOutcome(gateOutcome = 'PASS', policy = null, truthStatus = null, decisionUsefulness = null) {
  // Default: enforcement is disabled
  if (!isEnforcementEnabled()) {
    // Safety: exit codes stay unchanged unless user opts in
    return;
  }

  // Normalize gate outcome
  const outcome = String(gateOutcome).toUpperCase();

  // If no policy provided, use legacy FAIL-only behavior
  if (policy === null) {
    // Legacy: FAIL gate sets exit code
    if (outcome === 'FAIL') {
      process.exitCode = 1;
    }
    return;
  }

  // Use provided policy
  const p = policy;

  // Check if enforcement is enabled in policy
  if (!p?.enforcement?.enabled) {
    return;
  }

  // Check if this gate outcome is in the failOn list
  if (!p.enforcement.failOn?.includes(outcome)) {
    return;
  }

  // Check scope if defined
  const scope = p.enforcement.scope || {};
  if (!matchesPolicyScope(scope, truthStatus, decisionUsefulness)) {
    return;
  }

  // Enforce by setting exit code
  process.exitCode = 1;
}

/**
 * Enforce gate outcome for a finding.
 * Extracts gateOutcome and scope info.
 *
 * If policy not provided:
 * - Legacy behavior: FAIL gate sets exit code (backward compatible)
 * 
 * If policy provided:
 * - Consult policy for enforcement rules
 *
 * @param {Object} finding - Finding object with meta.gateOutcome
 * @param {Object} policy - Optional gate policy
 * @returns {void}
 */
export function enforceGateOutcomeForFinding(finding = {}, policy = null) {
  if (!finding || typeof finding !== 'object') {
    return;
  }

  const gateOutcome = finding?.meta?.gateOutcome;
  const truthStatus = finding?.status;
  const decisionUsefulness = finding?.meta?.decisionUsefulness;

  // If policy is null, use legacy behavior (pass null to enforceGateOutcome)
  // If policy is provided, pass it along with scope info for policy-based enforcement
  if (policy === null) {
    enforceGateOutcome(gateOutcome);
  } else {
    enforceGateOutcome(gateOutcome, policy, truthStatus, decisionUsefulness);
  }
}

/**
 * Batch enforce gate outcomes for multiple findings.
 *
 * If policy not provided:
 * - Legacy behavior: FAIL gates set exit code (backward compatible)
 *
 * If policy provided:
 * - Consult policy for enforcement rules and scope
 *
 * @param {Array} findings - Array of finding objects
 * @param {Object} policy - Optional gate policy
 * @returns {void}
 */
export function enforceGateOutcomesForFindings(findings = [], policy = null) {
  if (!Array.isArray(findings)) {
    return;
  }

  if (!isEnforcementEnabled()) {
    return;
  }

  // Legacy behavior: if no policy, enforce FAIL gates
  if (policy === null) {
    for (const finding of findings) {
      const gateOutcome = finding?.meta?.gateOutcome;
      if (String(gateOutcome).toUpperCase() === 'FAIL') {
        process.exitCode = 1;
        break;
      }
    }
    return;
  }

  // Policy-based behavior
  const p = policy;
  if (!p?.enforcement?.enabled) {
    return;
  }

  // Check each finding for enforcement match
  for (const finding of findings) {
    const gateOutcome = finding?.meta?.gateOutcome;
    const truthStatus = finding?.status;
    const decisionUsefulness = finding?.meta?.decisionUsefulness;

    // Use policy's failOn list
    const outcome = String(gateOutcome).toUpperCase();
    if (!p.enforcement.failOn?.includes(outcome)) {
      continue;
    }

    // Check scope
    const scope = p.enforcement.scope || {};
    if (!matchesPolicyScope(scope, truthStatus, decisionUsefulness)) {
      continue;
    }

    // Enforce and stop
    process.exitCode = 1;
    break;
  }
}

export { isEnforcementEnabled };
