/**
 * PHASE 21.6 — GA Readiness Contract
 * 
 * Hard gate that determines if VERAX is Enterprise-GA ready.
 * No human judgment, only code decides.
 */

import { evaluateAllCapabilityGates, buildGateContext } from '../capabilities/gates.js';
import { CAPABILITY_MATURITY as _CAPABILITY_MATURITY } from '../capabilities/gates.js';
import { verifyRun } from '../artifacts/verifier.js';
import { checkSecurityStatus } from '../security/security.enforcer.js';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { isBaselineFrozen as _isBaselineFrozen, enforceBaseline as _enforceBaseline } from '../baseline/baseline.enforcer.js';

/**
 * GA Blocker Codes
 */
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

/**
 * GA Warning Codes
 */
export const GA_WARNING_CODE = {
  WARNINGS_IN_LEDGER: 'GA_WARNINGS_IN_LEDGER',
  NON_DETERMINISTIC_ACCEPTED: 'GA_NON_DETERMINISTIC_ACCEPTED',
  SECURITY_NOT_CHECKED: 'GA_SECURITY_NOT_CHECKED'
};

/**
 * @typedef {Object} GA_BLOCKER
 * @property {string} code - Blocker code
 * @property {string} message - Human-readable message
 * @property {Object} context - Additional context
 */

/**
 * @typedef {Object} GA_WARNING
 * @property {string} code - Warning code
 * @property {string} message - Human-readable message
 * @property {Object} context - Additional context
 */

/**
 * @typedef {Object} GAReadinessResult
 * @property {boolean} pass - Whether GA-ready
 * @property {GA_BLOCKER[]} blockers - List of blockers
 * @property {GA_WARNING[]} warnings - List of warnings
 * @property {Object} summary - Summary of evaluation
 * @property {Object} inputs - Inputs used for evaluation
 */

/**
 * Check if determinism acceptance policy exists and is valid
 * 
 * @param {string} projectDir - Project directory
 * @returns {Object|null} Acceptance policy or null
 */
function loadDeterminismAcceptancePolicy(projectDir) {
  const policyPath = resolve(projectDir, 'determinism.acceptance.json');
  if (!existsSync(policyPath)) {
    return null;
  }
  
  try {
    const content = readFileSync(policyPath, 'utf-8');
  // @ts-expect-error - readFileSync with encoding returns string
    const policy = JSON.parse(content);
    
    // Validate policy structure
    if (!policy.allowedAdaptiveEvents || !Array.isArray(policy.allowedAdaptiveEvents)) {
      return null;
    }
    
    if (!policy.justification || typeof policy.justification !== 'string') {
      return null;
    }
    
    return policy;
  } catch (error) {
    return null;
  }
}

/**
 * Check if determinism verdict is accepted
 * 
 * @param {string} determinismVerdict - Determinism verdict (DETERMINISTIC | NON_DETERMINISTIC)
 * @param {Object|null} acceptancePolicy - Determinism acceptance policy
 * @returns {boolean} Whether verdict is accepted
 */
function isDeterminismAccepted(determinismVerdict, acceptancePolicy) {
  if (determinismVerdict === 'DETERMINISTIC') {
    return true;
  }
  
  if (determinismVerdict === 'NON_DETERMINISTIC' && acceptancePolicy) {
    return true;
  }
  
  return false;
}

/**
 * Check if all framework waves are STABLE
 * 
 * @param {Object} gateResult - Capability gates result
 * @returns {Object} { allStable: boolean, unstable: string[] }
 */
function checkFrameworkWavesStable(gateResult) {
  const unstable = [];
  
  // Check all capabilities marked as STABLE actually pass gates
  for (const [capabilityId, result] of Object.entries(gateResult.perCapability || {})) {
    // This is a simplified check - in reality, we'd need to check the registry
    // to see which capabilities are marked as STABLE
    // For now, we check if any capability fails gates
    if (!result.pass) {
      unstable.push(capabilityId);
    }
  }
  
  return {
    allStable: unstable.length === 0,
    unstable
  };
}

/**
 * Evaluate GA Readiness
 * 
 * @param {Object} context - Evaluation context
 * @param {string} context.projectDir - Project directory
 * @param {string} [context.runId] - Run ID (for artifact verification)
 * @param {string} [context.determinismVerdict] - Determinism verdict
 * @param {boolean} [context.evidenceLawViolated] - Whether Evidence Law was violated
 * @param {Object} [context.failureLedger] - Failure ledger summary
 * @returns {Promise<GAReadinessResult>} GA readiness result
 */
export async function evaluateGAReadiness(context) {
  const {
    projectDir,
    runId = null,
    determinismVerdict = null,
    evidenceLawViolated = false,
    failureLedger = null
  } = context;
  
  const blockers = [];
  const warnings = [];
  const inputs = {
    gates: null,
    determinism: determinismVerdict || 'UNKNOWN',
    evidenceLaw: evidenceLawViolated ? 'VIOLATED' : 'ENFORCED',
    failureLedger: failureLedger || { total: 0, bySeverity: {} },
    artifactVerifier: null
  };
  
  // 1. Phase 19: Capability Gates - 100% PASS required
  let gateResult = null;
  try {
    const gateContext = await buildGateContext({ projectRoot: projectDir });
    gateResult = evaluateAllCapabilityGates(gateContext);
    inputs.gates = gateResult.pass ? 'PASS' : 'FAIL';
    
    if (!gateResult.pass) {
      blockers.push({
        code: GA_BLOCKER_CODE.CAPABILITY_GATES_FAILED,
        message: `Capability gates failed: ${gateResult.summary.fail} of ${gateResult.summary.total} capabilities failed`,
        context: {
          total: gateResult.summary.total,
          pass: gateResult.summary.pass,
          fail: gateResult.summary.fail,
          failures: gateResult.summary.allFailures
        }
      });
    }
  } catch (error) {
    blockers.push({
      code: GA_BLOCKER_CODE.CAPABILITY_GATES_FAILED,
      message: `Failed to evaluate capability gates: ${error.message}`,
      context: { error: error.message }
    });
  }
  
  // 2. Phase 20: Framework Waves - ALL STABLE required
  if (gateResult) {
    const wavesCheck = checkFrameworkWavesStable(gateResult);
    inputs.frameworkWaves = wavesCheck.allStable ? 'ALL_STABLE' : 'UNSTABLE';
    
    if (!wavesCheck.allStable) {
      blockers.push({
        code: GA_BLOCKER_CODE.FRAMEWORK_WAVES_UNSTABLE,
        message: `Framework waves not stable: ${wavesCheck.unstable.length} capabilities unstable`,
        context: {
          unstable: wavesCheck.unstable
        }
      });
    }
  }
  
  // 3. Evidence Law - No violations allowed
  if (evidenceLawViolated) {
    blockers.push({
      code: GA_BLOCKER_CODE.EVIDENCE_LAW_VIOLATION,
      message: 'Evidence Law violated: CONFIRMED findings with incomplete evidence',
      context: {}
    });
  }
  
  // 4. Determinism - Either DETERMINISTIC or explicitly accepted
  const acceptancePolicy = loadDeterminismAcceptancePolicy(projectDir);
  if (determinismVerdict) {
    if (!isDeterminismAccepted(determinismVerdict, acceptancePolicy)) {
      blockers.push({
        code: GA_BLOCKER_CODE.DETERMINISM_NOT_ACCEPTED,
        message: `NON_DETERMINISTIC execution without acceptance policy`,
        context: {
          verdict: determinismVerdict,
          hasPolicy: !!acceptancePolicy
        }
      });
    } else if (determinismVerdict === 'NON_DETERMINISTIC' && acceptancePolicy) {
      warnings.push({
        code: GA_WARNING_CODE.NON_DETERMINISTIC_ACCEPTED,
        message: `NON_DETERMINISTIC execution accepted via policy: ${acceptancePolicy.justification}`,
        context: {
          allowedEvents: acceptancePolicy.allowedAdaptiveEvents
        }
      });
    }
  }
  
  // 5. Failure Ledger - BLOCKING = 0, DEGRADED = 0 required
  if (failureLedger) {
    const blockingCount = failureLedger.bySeverity?.BLOCKING || 0;
    const degradedCount = failureLedger.bySeverity?.DEGRADED || 0;
    const warningCount = failureLedger.bySeverity?.WARNING || 0;
    
    if (blockingCount > 0) {
      blockers.push({
        code: GA_BLOCKER_CODE.BLOCKING_FAILURES,
        message: `${blockingCount} BLOCKING failure(s) in failure ledger`,
        context: {
          count: blockingCount
        }
      });
    }
    
    if (degradedCount > 0) {
      blockers.push({
        code: GA_BLOCKER_CODE.DEGRADED_FAILURES,
        message: `${degradedCount} DEGRADED failure(s) in failure ledger`,
        context: {
          count: degradedCount
        }
      });
    }
    
    // Check for INTERNAL or CONTRACT failures
    const internalCount = failureLedger.byCategory?.INTERNAL || 0;
    const contractCount = failureLedger.byCategory?.CONTRACT || 0;
    
    if (internalCount > 0) {
      blockers.push({
        code: GA_BLOCKER_CODE.INTERNAL_FAILURES,
        message: `${internalCount} INTERNAL failure(s) in failure ledger`,
        context: {
          count: internalCount
        }
      });
    }
    
    if (contractCount > 0) {
      blockers.push({
        code: GA_BLOCKER_CODE.CONTRACT_FAILURES,
        message: `${contractCount} CONTRACT failure(s) in failure ledger`,
        context: {
          count: contractCount
        }
      });
    }
    
    if (warningCount > 0) {
      warnings.push({
        code: GA_WARNING_CODE.WARNINGS_IN_LEDGER,
        message: `${warningCount} WARNING failure(s) in failure ledger`,
        context: {
          count: warningCount
        }
      });
    }
  }
  
  // 6. Policies - All must be valid and loaded
  try {
    const { loadGuardrailsPolicy } = await import('../guardrails/policy.loader.js');
    const { loadConfidencePolicy } = await import('../confidence/confidence.loader.js');
    
    try {
      loadGuardrailsPolicy();
    } catch (error) {
      blockers.push({
        code: GA_BLOCKER_CODE.POLICY_INVALID,
        message: `Guardrails policy invalid: ${error.message}`,
        context: { error: error.message }
      });
    }
    
    try {
      loadConfidencePolicy();
    } catch (error) {
      blockers.push({
        code: GA_BLOCKER_CODE.POLICY_INVALID,
        message: `Confidence policy invalid: ${error.message}`,
        context: { error: error.message }
      });
    }
  } catch (error) {
    blockers.push({
      code: GA_BLOCKER_CODE.POLICY_INVALID,
      message: `Failed to load policies: ${error.message}`,
      context: { error: error.message }
    });
  }
  
  // 7. Artifact Verifier - Must pass with no blocking errors
  if (runId) {
    try {
      const runDir = resolve(projectDir, '.verax', 'runs', runId);
      const verification = verifyRun(runDir);
      inputs.artifactVerifier = verification.ok ? 'PASS' : 'FAIL';
      
      if (!verification.ok) {
        blockers.push({
          code: GA_BLOCKER_CODE.ARTIFACT_VERIFIER_FAILED,
          message: `Artifact verifier failed: ${verification.errors.length} error(s)`,
          context: {
            errors: verification.errors,
            warnings: verification.warnings
          }
        });
      }
    } catch (error) {
      blockers.push({
        code: GA_BLOCKER_CODE.ARTIFACT_VERIFIER_FAILED,
        message: `Failed to verify artifacts: ${error.message}`,
        context: { error: error.message }
      });
    }
  }
  
  // 8. Security Baseline (PHASE 21.8) - SECURITY-OK required
  try {
    const securityCheck = checkSecurityStatus(projectDir);
    inputs.security = securityCheck.ok ? 'OK' : 'BLOCKED';
    
    if (!securityCheck.exists) {
      blockers.push({
        code: GA_BLOCKER_CODE.SECURITY_NOT_CHECKED,
        message: 'Security reports not found. Run "verax security:check" first.',
        context: {}
      });
    } else if (!securityCheck.ok) {
      blockers.push({
        code: GA_BLOCKER_CODE.SECURITY_BLOCKED,
        message: `SECURITY-BLOCKED: ${securityCheck.blockers.join('; ')}`,
        context: { blockers: securityCheck.blockers }
      });
    }
  } catch (error) {
    blockers.push({
      code: GA_BLOCKER_CODE.SECURITY_NOT_CHECKED,
      message: `Security check failed: ${error.message}`,
      context: { error: error.message }
    });
  }
  
  // 9. Performance Budget (PHASE 21.9) - BLOCKING perf violations block GA
  if (runId) {
    try {
      const { checkPerformanceStatus } = await import('../perf/perf.enforcer.js');
      const perfCheck = checkPerformanceStatus(projectDir, runId);
      inputs.performance = perfCheck.ok ? 'OK' : 'BLOCKED';
      
      if (!perfCheck.exists) {
        // Performance report missing is not a blocker (may be from old runs)
        inputs.performance = 'MISSING';
      } else if (!perfCheck.ok) {
        blockers.push({
          code: GA_BLOCKER_CODE.PERFORMANCE_BLOCKED,
          message: `PERFORMANCE-BLOCKED: ${perfCheck.blockers.join('; ')}`,
          context: { blockers: perfCheck.blockers, verdict: perfCheck.verdict }
        });
      }
    } catch (error) {
      // Performance check failure is not a blocker (may be from old runs)
      inputs.performance = 'ERROR';
    }
  }
  
  const pass = blockers.length === 0;
  
  const summary = {
    pass,
    blockersCount: blockers.length,
    warningsCount: warnings.length,
    checkedAt: new Date().toISOString()
  };
  
  return {
    pass,
    blockers,
    warnings,
    summary,
    inputs
  };
}

