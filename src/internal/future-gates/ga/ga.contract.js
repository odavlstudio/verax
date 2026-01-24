/**
 * GA Readiness Contract (Future Feature)
 *
 * Moved to internal/future-gates to isolate non-core release gating.
 */

import { getTimeProvider } from '../../../cli/util/support/time-provider.js';
import { CAPABILITY_MATURITY as _CAPABILITY_MATURITY } from '../../../verax/core/capabilities/gates.js';
import { checkSecurityStatus } from '../security/security.enforcer.js';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { isBaselineFrozen as _isBaselineFrozen, enforceBaseline as _enforceBaseline } from '../../../verax/core/baseline/baseline.enforcer.js';

export const GA_BLOCKER_CODE = {
  NO_RUNS_FOUND: 'GA_NO_RUNS_FOUND',
  CAPABILITY_GATES_FAILED: 'GA_CAPABILITY_GATES_FAILED',
  FRAMEWORK_WAVES_UNSTABLE: 'GA_FRAMEWORK_WAVES_UNSTABLE',
  EVIDENCE_LAW_VIOLATION: 'GA_EVIDENCE_LAW_VIOLATION',
  DETERMINISM_NOT_ACCEPTED: 'GA_DETERMINISM_NOT_ACCEPTED',
  BLOCKING_FAILURES: 'GA_BLOCKING_FAILURES',
  DEGRADED_FAILURES: 'GA_DEGRADED_FAILURES',
  INTERNAL_FAILURES: 'GA_INTERNAL_FAILURES',
  CONTRACT_FAILURES: 'GA_CONTRACT_FAILURES',
  POLICY_INVALID: 'GA_POLICY_INVALID',
  ARTIFACT_VERIFIER_FAILED: 'GA_ARTIFACT_VERIFIER_FAILED',
  SECURITY_NOT_CHECKED: 'GA_SECURITY_NOT_CHECKED',
  SECURITY_BLOCKED: 'GA_SECURITY_BLOCKED',
  PERFORMANCE_BLOCKED: 'GA_PERFORMANCE_BLOCKED',
  BASELINE_DRIFT: 'GA_BASELINE_DRIFT'
};

export const GA_WARNING_CODE = {
  WARNINGS_IN_LEDGER: 'GA_WARNINGS_IN_LEDGER',
  NON_DETERMINISTIC_ACCEPTED: 'GA_NON_DETERMINISTIC_ACCEPTED',
  SECURITY_NOT_CHECKED: 'GA_SECURITY_NOT_CHECKED'
};

function loadDeterminismAcceptancePolicy(projectDir) {
  const policyPath = resolve(projectDir, 'determinism.acceptance.json');
  if (!existsSync(policyPath)) return null;
  try {
    const content = /** @type {string} */ (readFileSync(policyPath, 'utf-8'));
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export async function evaluateGAReadiness(context) {
  const { projectDir } = context || {};
  const acceptancePolicy = loadDeterminismAcceptancePolicy(projectDir);
  const inputs = { acceptancePolicy };
  const blockers = [];
  const warnings = [];

  // Security status (experimental)
  try {
    const securityCheck = checkSecurityStatus(projectDir);
    if (!securityCheck.exists) {
      warnings.push({ code: GA_WARNING_CODE.SECURITY_NOT_CHECKED, message: 'Security reports not found.', context: {} });
    } else if (!securityCheck.ok) {
      blockers.push({ code: GA_BLOCKER_CODE.SECURITY_BLOCKED, message: `SECURITY-BLOCKED: ${securityCheck.blockers.join('; ')}`, context: { blockers: securityCheck.blockers } });
    }
  } catch (error) {
    warnings.push({ code: GA_WARNING_CODE.SECURITY_NOT_CHECKED, message: `Security check failed: ${error.message}`, context: {} });
  }

  const pass = blockers.length === 0;
  const summary = {
    pass,
    blockersCount: blockers.length,
    warningsCount: warnings.length,
    checkedAt: getTimeProvider().iso()
  };

  return { pass, blockers, warnings, summary, inputs };
}
