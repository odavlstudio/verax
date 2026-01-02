/**
 * Final Outcome Authority - Single source of truth for verdict and exit code
 * 
 * This module implements deterministic merge logic to resolve conflicts between:
 * - Rules engine verdict (READY/FRICTION/DO_NOT_LAUNCH)
 * - Policy evaluation (coverage gaps, evidence issues)
 * - Attempt/flow results
 * 
 * Precedence rules:
 * 1. DO_NOT_LAUNCH dominates everything (critical failures)
 * 2. FRICTION stays unless DO_NOT_LAUNCH (partial success, friction detected)
 * 3. READY + coverage gaps → downgrade to FRICTION (insufficient coverage warning)
 * 4. READY + clean policy → final READY
 * 
 * Exit code mapping (centralized):
 * - READY → 0
 * - FRICTION → 1
 * - DO_NOT_LAUNCH → 2
 */

const { mapExitCodeFromCanonical } = require('./verdicts');

/**
 * Compute final outcome by merging rules verdict and policy evaluation
 * @param {Object} inputs
 * @param {string} inputs.rulesVerdict - Verdict from rules engine (READY/FRICTION/DO_NOT_LAUNCH)
 * @param {number} inputs.rulesExitCode - Exit code from rules engine
 * @param {Array} inputs.rulesReasons - Reasons from rules engine
 * @param {Array} inputs.rulesTriggeredIds - Triggered rule IDs
 * @param {Object} inputs.policySignals - Policy signals from rules engine
 * @param {Object} inputs.policyEval - Policy evaluation result
 * @param {boolean} inputs.policyEval.passed - Whether policy passed
 * @param {number} inputs.policyEval.exitCode - Policy exit code (2=warnings, 1=hard failure)
 * @param {Array} inputs.policyEval.reasons - Policy failure reasons
 * @param {Object} inputs.coverage - Coverage signals
 * @param {number} inputs.coverage.gaps - Number of coverage gaps
 * @param {number} inputs.coverage.total - Total coverage items
 * @param {number} inputs.coverage.executed - Executed coverage items
 * @returns {Object} { finalVerdict, finalExitCode, reasons, triggeredRuleIds, source }
 */
function computeFinalOutcome(inputs) {
  const {
    rulesVerdict = 'DO_NOT_LAUNCH',
    rulesReasons = [],
    rulesTriggeredIds = [],
    policyEval = null,
    coverage = { gaps: 0, total: 0, executed: 0 },
    policy = null  // Policy object to check failOnGap setting
  } = inputs;

  // Start with rules engine verdict as baseline
  const reasons = [...rulesReasons];
  const triggeredRuleIds = [...rulesTriggeredIds];

  // PRECEDENCE RULE 1: DO_NOT_LAUNCH dominates everything
  if (rulesVerdict === 'DO_NOT_LAUNCH') {
    return {
      finalVerdict: 'DO_NOT_LAUNCH',
      finalExitCode: mapExitCodeFromCanonical('DO_NOT_LAUNCH'),
      reasons,
      triggeredRuleIds,
      source: 'rules-engine-critical',
      mergeInfo: {
        rulesVerdict,
        policyPassed: policyEval?.passed ?? true,
        coverageGaps: coverage.gaps,
        decision: 'Rules engine returned DO_NOT_LAUNCH (critical failure dominates)'
      }
    };
  }

  // PRECEDENCE RULE 2: FRICTION stays unless DO_NOT_LAUNCH
  if (rulesVerdict === 'FRICTION') {
    // FRICTION from rules engine stays, but we add policy warnings if present
    if (policyEval && !policyEval.passed && policyEval.exitCode === 2) {
      reasons.push({
        ruleId: 'policy_coverage_warning',
        message: `Policy evaluation warnings: ${policyEval.reasons?.join('; ') || 'Coverage or evidence gaps detected'}`,
        category: 'POLICY',
        priority: 100
      });
    }
    return {
      finalVerdict: 'FRICTION',
      finalExitCode: mapExitCodeFromCanonical('FRICTION'),
      reasons,
      triggeredRuleIds,
      source: 'rules-engine-friction',
      mergeInfo: {
        rulesVerdict,
        policyPassed: policyEval?.passed ?? true,
        coverageGaps: coverage.gaps,
        decision: 'Rules engine returned FRICTION (preserved)'
      }
    };
  }

  // PRECEDENCE RULE 3: READY + coverage gaps → downgrade to FRICTION
  if (rulesVerdict === 'READY') {
    // Only downgrade on coverage gaps if policy says to fail on gaps
    const shouldFailOnCoverageGaps = !policy || policy.coverage?.failOnGap !== false; // Default to true
    const hasCoverageGaps = shouldFailOnCoverageGaps && (coverage.gaps > 0 || (coverage.executed < coverage.total && coverage.total > 0));
    const hasPolicyWarnings = policyEval && !policyEval.passed && policyEval.exitCode === 2;
    const hasPolicyHardFailure = policyEval && !policyEval.passed && policyEval.exitCode === 1;

    // Policy hard failure (exitCode=1) should downgrade to FRICTION
    if (hasPolicyHardFailure) {
      reasons.push({
        ruleId: 'policy_hard_failure',
        message: `Policy hard failure: ${policyEval.reasons?.join('; ') || 'Critical policy conditions not met'}`,
        category: 'POLICY',
        priority: 50
      });
      triggeredRuleIds.push('policy_hard_failure');
      return {
        finalVerdict: 'FRICTION',
        finalExitCode: mapExitCodeFromCanonical('FRICTION'),
        reasons,
        triggeredRuleIds,
        source: 'policy-downgrade-hard',
        mergeInfo: {
          rulesVerdict,
          policyPassed: false,
          coverageGaps: coverage.gaps,
          decision: 'READY downgraded to FRICTION due to policy hard failure'
        }
      };
    }

    // Coverage gaps or policy warnings (exitCode=2) should downgrade to FRICTION
    if (hasCoverageGaps || hasPolicyWarnings) {
      const gapReason = hasCoverageGaps
        ? `Coverage gaps detected: ${coverage.gaps} of ${coverage.total} items not executed`
        : null;
      const policyReason = hasPolicyWarnings
        ? `Policy warnings: ${policyEval.reasons?.join('; ') || 'Insufficient evidence or coverage'}`
        : null;

      const combinedReason = [gapReason, policyReason].filter(Boolean).join('; ');
      
      reasons.push({
        ruleId: 'ready_downgraded_coverage_gaps',
        message: combinedReason,
        category: 'POLICY',
        priority: 60
      });
      triggeredRuleIds.push('ready_downgraded_coverage_gaps');

      return {
        finalVerdict: 'FRICTION',
        finalExitCode: mapExitCodeFromCanonical('FRICTION'),
        reasons,
        triggeredRuleIds,
        source: 'policy-downgrade-coverage',
        mergeInfo: {
          rulesVerdict,
          policyPassed: false,
          coverageGaps: coverage.gaps,
          decision: 'READY downgraded to FRICTION due to coverage gaps or policy warnings'
        }
      };
    }

    // PRECEDENCE RULE 4: READY + clean policy → final READY
    return {
      finalVerdict: 'READY',
      finalExitCode: mapExitCodeFromCanonical('READY'),
      reasons,
      triggeredRuleIds,
      source: 'rules-engine-clean',
      mergeInfo: {
        rulesVerdict,
        policyPassed: policyEval?.passed ?? true,
        coverageGaps: 0,
        decision: 'READY confirmed (rules engine + clean policy)'
      }
    };
  }

  // Fallback (should not reach here in normal operation)
  return {
    finalVerdict: 'DO_NOT_LAUNCH',
    finalExitCode: mapExitCodeFromCanonical('DO_NOT_LAUNCH'),
    reasons: [
      ...reasons,
      {
        ruleId: 'fallback_safety',
        message: 'Unknown verdict state; failing safe',
        category: 'SYSTEM',
        priority: 0
      }
    ],
    triggeredRuleIds: [...triggeredRuleIds, 'fallback_safety'],
    source: 'fallback',
    mergeInfo: {
      rulesVerdict,
      policyPassed: policyEval?.passed ?? false,
      coverageGaps: coverage.gaps,
      decision: 'Fallback safety triggered (unknown state)'
    }
  };
}

module.exports = {
  computeFinalOutcome
};
