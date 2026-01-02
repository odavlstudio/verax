const fs = require('fs');
const path = require('path');
const { normalizeCanonicalVerdict } = require('./verdicts');

// Minimum evidence thresholds for pre-launch gating
const MIN_COVERAGE_PERCENT = 50;
const MIN_EXECUTED_ATTEMPTS = 1;
const MIN_INTEGRITY_RATIO = 0.5;

function buildHonestySummary(honestyContract) {
  if (!honestyContract || !honestyContract.coverageStats) {
    return {
      present: false,
      coveragePercent: 0,
      executed: 0,
      total: 0,
      limits: ['Honesty contract missing']
    };
  }

  const stats = honestyContract.coverageStats;
  return {
    present: true,
    coveragePercent: stats.percent || 0,
    executed: stats.executed || 0,
    total: stats.total || 0,
    limits: honestyContract.limits || [],
    nonClaims: honestyContract.nonClaims || []
  };
}

function evaluatePrelaunchGate({
  prelaunch = false,
  verdict,
  exitCode = 1,
  allowFrictionOverride = false,
  honestyContract = null,
  coverage = {},
  baselinePresent = false,
  integrity = 0,
  evidence = {}
}) {
  const canonicalVerdict = normalizeCanonicalVerdict(verdict);
  const reasons = [];
  let blocking = false;
  let finalExitCode = exitCode !== undefined ? exitCode : 1; // CRITICAL: Must preserve 0

  const honestySummary = buildHonestySummary(honestyContract);
  const executedAttempts = evidence.executedAttempts ?? honestySummary.executed;
  const totalAttempts = evidence.totalPlanned ?? honestySummary.total;
  const coveragePercent = honestySummary.coveragePercent || coverage.percent || 0;

  if (!prelaunch) {
    return {
      blocking: false,
      exitCode: finalExitCode,
      releaseDecision: buildReleaseDecision({
        prelaunch,
        blocking: false,
        verdict: canonicalVerdict,
        exitCode: finalExitCode,
        reasons,
        baselinePresent,
        honestySummary,
        integrity,
        coveragePercent,
        executedAttempts,
        totalAttempts
      })
    };
  }

  // Honesty contract presence
  if (!honestySummary.present) {
    blocking = true;
    reasons.push({ code: 'HONESTY_MISSING', message: 'Honesty contract missing; cannot claim readiness.' });
  }

  // Baseline requirement
  if (!baselinePresent) {
    blocking = true;
    reasons.push({ code: 'BASELINE_MISSING', message: 'Baseline not found; prelaunch gate requires baseline comparison.' });
  }

  // Evidence thresholds
  if (executedAttempts < MIN_EXECUTED_ATTEMPTS) {
    blocking = true;
    reasons.push({ code: 'NO_EXECUTION', message: 'No executed attempts; insufficient evidence to launch.' });
  }

  if (coveragePercent < MIN_COVERAGE_PERCENT) {
    blocking = true;
    reasons.push({
      code: 'COVERAGE_TOO_LOW',
      message: `Coverage ${coveragePercent}% below required ${MIN_COVERAGE_PERCENT}% for prelaunch.`
    });
  }

  if (integrity < MIN_INTEGRITY_RATIO) {
    blocking = true;
    reasons.push({
      code: 'INTEGRITY_TOO_LOW',
      message: `Artifact integrity ${Math.round(integrity * 100)}% below required ${Math.round(MIN_INTEGRITY_RATIO * 100)}%.`
    });
  }

  // Verdict-based gating
  if (canonicalVerdict === 'DO_NOT_LAUNCH') {
    blocking = true;
    reasons.push({ code: 'VERDICT_DO_NOT_LAUNCH', message: 'Guardian verdict: DO_NOT_LAUNCH' });
    finalExitCode = 2;
  } else if (canonicalVerdict === 'FRICTION') {
    if (allowFrictionOverride) {
      reasons.push({ code: 'FRICTION_ACKNOWLEDGED', message: 'FRICTION overridden by explicit flag.' });
      if (!blocking) {
        finalExitCode = 0; // allow continuation when override explicitly granted and no other blockers
      }
    } else {
      blocking = true;
      reasons.push({ code: 'FRICTION_BLOCK', message: 'FRICTION verdict blocks release unless explicitly overridden.' });
      finalExitCode = finalExitCode === 0 ? 1 : finalExitCode;
    }
  } else if (canonicalVerdict === 'READY') {
    if (!blocking) {
      finalExitCode = 0;
    }
  }

  const releaseDecision = buildReleaseDecision({
    prelaunch: true,
    blocking,
    verdict: canonicalVerdict,
    exitCode: finalExitCode,
    reasons,
    baselinePresent,
    honestySummary,
    integrity,
    coveragePercent,
    executedAttempts,
    totalAttempts
  });

  return { blocking, exitCode: finalExitCode, releaseDecision };
}

function buildReleaseDecision({
  prelaunch,
  blocking,
  verdict,
  exitCode,
  reasons,
  baselinePresent,
  honestySummary,
  integrity,
  coveragePercent,
  executedAttempts,
  totalAttempts
}) {
  return {
    version: '1.0',
    mode: prelaunch ? 'prelaunch' : 'standard',
    verdict,
    blocking,
    exitCode,
    reasons,
    baseline: {
      required: prelaunch,
      present: baselinePresent
    },
    honesty: honestySummary,
    evidence: {
      coveragePercent,
      executedAttempts,
      totalAttempts,
      integrityPercent: Math.round((integrity || 0) * 100)
    },
    timestamp: new Date().toISOString()
  };
}

function writeReleaseDecisionArtifact(runDir, releaseDecision) {
  const target = path.join(runDir, 'release-decision.json');
  fs.writeFileSync(target, JSON.stringify(releaseDecision, null, 2));
  return target;
}

module.exports = {
  evaluatePrelaunchGate,
  writeReleaseDecisionArtifact,
  MIN_COVERAGE_PERCENT,
  MIN_EXECUTED_ATTEMPTS,
  MIN_INTEGRITY_RATIO
};
