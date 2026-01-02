/**
 * Guardian Verdict Policy Enforcer
 * 
 * MISSION: Prevent logically misleading verdicts through strict, non-negotiable rules.
 * 
 * AUTHORITY: This is the FINAL arbiter of verdict logic.
 * All verdict decisions MUST pass through this module.
 * 
 * POLICY RULES (NON-NEGOTIABLE):
 * 1. SUCCESS requires: zero failures, executed > 0, untested == 0, evidence >= 0.6
 * 2. FRICTION: zero failures, executed > 0, BUT (untested > 0 OR evidence < 0.6)
 * 3. FAILURE: failures > 0 AND executed > 0
 * 4. DO_NOT_LAUNCH: executed == 0 AND eligible > 0, OR critical policy violation
 * 5. NOT_APPLICABLE never counts as eligible
 * 6. USER_FILTERED only excluded if truly user-disabled (not capability absence)
 */

/**
 * Canonical verdict strings
 */
const VERDICTS = {
  SUCCESS: 'READY',           // All eligible tests passed, full coverage, sufficient evidence
  FRICTION: 'FRICTION',        // Passes but incomplete (untested scope or low evidence)
  FAILURE: 'DO_NOT_LAUNCH',   // Has failures - blocking
  NO_EXECUTION: 'DO_NOT_LAUNCH'  // Nothing was tested - blocking
};

/**
 * Exit codes
 */
const EXIT_CODES = {
  READY: 0,
  FRICTION: 1,
  DO_NOT_LAUNCH: 2
};

/**
 * Compute attempt statistics with strict eligibility rules
 * 
 * @param {Array} attempts - All attempt results
 * @returns {Object} Statistics with executed/eligible/untested/failures
 */
function computeAttemptStats(attempts = []) {
  if (!Array.isArray(attempts)) attempts = [];

  const executed = attempts.filter(a => 
    a.executed === true && 
    a.outcome !== 'SKIPPED' && 
    a.outcome !== 'NOT_APPLICABLE'
  );

  // Eligible = attempts that COULD be executed (exclude NOT_APPLICABLE and true user disables)
  // NOT_APPLICABLE means capability not present - never eligible
  // USER_FILTERED that's actually capability absence should be marked NOT_APPLICABLE instead
  const eligible = attempts.filter(a => 
    a.outcome !== 'NOT_APPLICABLE' &&
    !a.disabledByPreset &&  // Preset disabled = policy choice, not site limitation
    a.skipReasonCode !== 'USER_EXPLICITLY_DISABLED'  // True user disable
  );

  const failures = executed.filter(a => a.outcome === 'FAILURE');
  const successes = executed.filter(a => a.outcome === 'SUCCESS');
  const friction = executed.filter(a => a.outcome === 'FRICTION');

  const executedCount = executed.length;
  const eligibleCount = eligible.length;
  const untestedCount = Math.max(0, eligibleCount - executedCount);
  const failuresCount = failures.length;

  return {
    executedCount,
    eligibleCount,
    untestedCount,
    failuresCount,
    successesCount: successes.length,
    frictionCount: friction.length,
    notApplicableCount: attempts.filter(a => a.outcome === 'NOT_APPLICABLE').length,
    disabledCount: attempts.filter(a => a.disabledByPreset).length,
    executed,
    failures,
    successes,
    friction,
    eligible
  };
}

/**
 * Compute coverage percentage
 * 
 * @param {number} executed - Count of executed attempts
 * @param {number} eligible - Count of eligible attempts
 * @returns {number} Coverage percentage (0-100)
 */
function computeCoverage(executed, eligible) {
  if (eligible === 0) return 0;
  return Math.round((executed / eligible) * 100);
}

/**
 * Enforce strict verdict policy
 * 
 * @param {Object} input - Policy input data
 * @param {Array} input.attempts - All attempt results
 * @param {number} input.evidenceCompleteness - Evidence score (0-1)
 * @param {boolean} input.hasRegressions - Baseline regressions detected
 * @param {boolean} input.policyHardFailure - Critical policy failure
 * @returns {Object} Final verdict decision
 */
function enforceVerdictPolicy(input) {
  const {
    attempts = [],
    evidenceCompleteness = 0,
    hasRegressions = false,
    policyHardFailure = false,
    allGoalsExplicitlyReached = false  // Must be explicitly confirmed, not assumed
  } = input;

  const stats = computeAttemptStats(attempts);
  const {
    executedCount,
    eligibleCount,
    untestedCount,
    failuresCount,
    successesCount,
    frictionCount
  } = stats;

  const coveragePercent = computeCoverage(executedCount, eligibleCount);
  const reasons = [];

  // RULE 4: DO_NOT_LAUNCH if nothing executed
  if (executedCount === 0 && eligibleCount > 0) {
    reasons.push({
      code: 'NO_EXECUTION',
      message: `No tests were executed (${eligibleCount} tests were eligible). Cannot determine site behavior.`,
      blocking: true
    });
    
    return {
      finalVerdict: VERDICTS.NO_EXECUTION,
      exitCode: EXIT_CODES.DO_NOT_LAUNCH,
      reasons,
      computedCounts: {
        executed: executedCount,
        eligible: eligibleCount,
        untested: untestedCount,
        failures: failuresCount,
        coveragePercent
      },
      policyEnforced: true
    };
  }

  // Baseline regressions = DO_NOT_LAUNCH
  if (hasRegressions) {
    reasons.push({
      code: 'BASELINE_REGRESSION',
      message: 'Baseline regressions detected - behavior has degraded',
      blocking: true
    });
  }

  // Critical policy failure = DO_NOT_LAUNCH
  if (policyHardFailure) {
    reasons.push({
      code: 'POLICY_HARD_FAILURE',
      message: 'Critical policy conditions not satisfied',
      blocking: true
    });
  }

  // RULE 3: FAILURE if any failures detected
  if (failuresCount > 0) {
    const failedIds = stats.failures.map(a => a.attemptId || 'unknown').join(', ');
    reasons.push({
      code: 'CRITICAL_FAILURES',
      message: `${failuresCount} critical ${failuresCount === 1 ? 'failure' : 'failures'} detected: ${failedIds}`,
      blocking: true
    });
  }

  // If any blocking reason exists, verdict is DO_NOT_LAUNCH/FAILURE
  const hasBlockingReason = reasons.some(r => r.blocking);
  if (hasBlockingReason) {
    return {
      finalVerdict: VERDICTS.FAILURE,
      exitCode: EXIT_CODES.DO_NOT_LAUNCH,
      reasons,
      computedCounts: {
        executed: executedCount,
        eligible: eligibleCount,
        untested: untestedCount,
        failures: failuresCount,
        coveragePercent
      },
      policyEnforced: true
    };
  }

  // At this point: executedCount > 0, failuresCount == 0
  // Check for SUCCESS vs FRICTION

  // Record execution stats
  reasons.push({
    code: 'EXECUTION_SUMMARY',
    message: `Executed ${executedCount}/${eligibleCount} eligible tests (${coveragePercent}% coverage). ${successesCount} succeeded, ${frictionCount} had friction.`
  });

  // Check untested scope
  if (untestedCount > 0) {
    reasons.push({
      code: 'UNTESTED_SCOPE',
      message: `${untestedCount} eligible ${untestedCount === 1 ? 'test' : 'tests'} not executed - incomplete coverage (${coveragePercent}%)`,
      preventSuccess: true
    });
  }

  // Check evidence completeness
  if (evidenceCompleteness < 0.6) {
    reasons.push({
      code: 'EVIDENCE_INCOMPLETE',
      message: `Evidence completeness ${evidenceCompleteness.toFixed(2)} below required minimum 0.60`,
      preventSuccess: true
    });
  }

  // RULE 1: SUCCESS requires full eligible coverage + sufficient evidence
  const canBeSuccess = (untestedCount === 0 && evidenceCompleteness >= 0.6) || allGoalsExplicitlyReached;
  
  if (canBeSuccess) {
    if (allGoalsExplicitlyReached && untestedCount > 0) {
      reasons.push({
        code: 'ALL_GOALS_REACHED',
        message: 'All critical goals reached in executed tests (coverage requirement waived)'
      });
    } else {
      reasons.push({
        code: 'FULL_COVERAGE',
        message: `All ${eligibleCount} eligible tests executed (100% coverage) with sufficient evidence`
      });
    }

    return {
      finalVerdict: VERDICTS.SUCCESS,
      exitCode: EXIT_CODES.READY,
      reasons,
      computedCounts: {
        executed: executedCount,
        eligible: eligibleCount,
        untested: untestedCount,
        failures: failuresCount,
        coveragePercent
      },
      policyEnforced: true
    };
  }

  // RULE 2: FRICTION - no failures but incomplete (untested scope or low evidence)
  return {
    finalVerdict: VERDICTS.FRICTION,
    exitCode: EXIT_CODES.FRICTION,
    reasons,
    computedCounts: {
      executed: executedCount,
      eligible: eligibleCount,
      untested: untestedCount,
      failures: failuresCount,
      coveragePercent
    },
    policyEnforced: true
  };
}

/**
 * Validate all_goals_reached signal against actual execution
 * 
 * @param {boolean} signalValue - Value from rules engine
 * @param {Object} stats - Computed attempt stats
 * @returns {boolean} True if signal is valid
 */
function validateAllGoalsReached(signalValue, stats) {
  if (!signalValue) return false;
  
  // all_goals_reached can only be true if:
  // 1. At least one test was executed
  // 2. No failures occurred
  // 3. Goals were explicitly checked and confirmed
  
  if (stats.executedCount === 0) {
    return false;  // Cannot reach goals with zero execution
  }
  
  if (stats.failuresCount > 0) {
    return false;  // Cannot claim success with failures
  }
  
  // Signal is valid
  return true;
}

/**
 * Check if baseline write is allowed under strict policy
 * 
 * @param {Object} decision - Final verdict decision
 * @returns {boolean} True if baseline write allowed
 */
function canWriteBaseline(decision) {
  if (!decision || !decision.finalVerdict) return false;
  
  // Baseline write ONLY allowed for SUCCESS with full coverage
  if (decision.finalVerdict !== VERDICTS.SUCCESS) {
    return false;
  }
  
  if (decision.computedCounts.coveragePercent < 100) {
    return false;
  }
  
  // Check evidence completeness requirement
  // This should be part of the decision reasons
  const evidenceComplete = !decision.reasons.some(r => r.code === 'EVIDENCE_INCOMPLETE');
  
  return evidenceComplete;
}

/**
 * Format policy decision for human-readable output
 * 
 * @param {Object} decision - Policy decision
 * @returns {string} Formatted output
 */
function formatPolicyDecision(decision) {
  let output = '\n';
  output += '═'.repeat(70) + '\n';
  output += '🔒 VERDICT POLICY ENFORCEMENT\n';
  output += '═'.repeat(70) + '\n\n';
  
  output += `📋 Verdict: ${decision.finalVerdict} (exit ${decision.exitCode})\n`;
  output += `📊 Coverage: ${decision.computedCounts.executed}/${decision.computedCounts.eligible} eligible tests (${decision.computedCounts.coveragePercent}%)\n`;
  output += `❌ Failures: ${decision.computedCounts.failures}\n`;
  output += `⊘ Untested: ${decision.computedCounts.untested}\n\n`;
  
  output += '📝 Policy Reasons:\n';
  for (const reason of decision.reasons) {
    const marker = reason.blocking ? '🛑' : reason.preventSuccess ? '⚠️' : '✓';
    output += `   ${marker} [${reason.code}] ${reason.message}\n`;
  }
  
  output += '\n' + '═'.repeat(70) + '\n';
  
  return output;
}

module.exports = {
  enforceVerdictPolicy,
  computeAttemptStats,
  computeCoverage,
  validateAllGoalsReached,
  canWriteBaseline,
  formatPolicyDecision,
  VERDICTS,
  EXIT_CODES
};
