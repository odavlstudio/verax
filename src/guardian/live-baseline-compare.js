/**
 * Live Guardian Baseline Comparison
 * Compares human outcomes only: journey completion, attempt success/failure
 * Ignores cosmetic diffs that don't affect human risk
 */

const { normalizeCanonicalVerdict } = require('./verdicts');

function extractHumanOutcomes(snapshot) {
  if (!snapshot) return null;

  const journey = snapshot.journey || {};
  const attempts = Array.isArray(snapshot.attempts) ? snapshot.attempts : [];

  return {
    journey: {
      completed: journey.completedGoal || false,
      abandoned: journey.abandoned || false,
      frustrationLevel: journey.frustrationLevel || 0,
      attemptPath: Array.isArray(journey.attemptPath) ? journey.attemptPath : []
    },
    attempts: attempts.map(a => ({
      id: a.attemptId || a.id,
      outcome: a.outcome,
      success: a.outcome === 'SUCCESS'
    })),
    verdict: normalizeCanonicalVerdict(snapshot.finalVerdict),
    exitCode: typeof snapshot.exitCode === 'number' ? snapshot.exitCode : null
  };
}

function compareHumanOutcomes(baselineOutcomes, currentOutcomes) {
  const diffs = [];

  if (!baselineOutcomes || !currentOutcomes) {
    return {
      hasRegressions: true,
      diffs: [{ type: 'MISSING_DATA', message: 'Baseline or current outcomes missing' }]
    };
  }

  // Check journey completion: did we regress?
  if (baselineOutcomes.journey.completed && !currentOutcomes.journey.completed) {
    diffs.push({
      type: 'JOURNEY_COMPLETION_LOST',
      message: 'Journey previously completed; now incomplete or abandoned',
      severity: 'CRITICAL'
    });
  }

  // Check journey abandonment: did we introduce abandonment?
  if (!baselineOutcomes.journey.abandoned && currentOutcomes.journey.abandoned) {
    diffs.push({
      type: 'JOURNEY_ABANDONMENT',
      message: 'Journey previously persisted; now abandoned',
      severity: 'CRITICAL'
    });
  }

  // Check attempt outcomes: SUCCESS → FAILURE is regression
  const baselineAttemptMap = new Map(
    baselineOutcomes.attempts.map(a => [a.id, a])
  );

  for (const currentAttempt of currentOutcomes.attempts) {
    const baselineAttempt = baselineAttemptMap.get(currentAttempt.id);
    if (baselineAttempt && baselineAttempt.success && !currentAttempt.success) {
      diffs.push({
        type: 'ATTEMPT_REGRESSION',
        attemptId: currentAttempt.id,
        message: `Attempt '${currentAttempt.id}' was SUCCESS, now ${currentAttempt.outcome}`,
        severity: 'HIGH'
      });
    }
  }

  // Check verdict regression: READY → FRICTION/DO_NOT_LAUNCH
  const verdictRank = { READY: 0, FRICTION: 1, DO_NOT_LAUNCH: 2 };
  const baselineRank = verdictRank[baselineOutcomes.verdict] ?? 0;
  const currentRank = verdictRank[currentOutcomes.verdict] ?? 0;

  if (currentRank > baselineRank) {
    diffs.push({
      type: 'VERDICT_REGRESSION',
      message: `Verdict downgraded: ${baselineOutcomes.verdict} → ${currentOutcomes.verdict}`,
      severity: 'HIGH'
    });
  }

  const hasRegressions = diffs.length > 0;

  return {
    hasRegressions,
    diffs,
    baseline: baselineOutcomes,
    current: currentOutcomes
  };
}

function shouldAlert(comparison) {
  if (!comparison || !comparison.diffs) {
    return false;
  }

  // Alert if there are any diffs (journeys completing → failing, attempts flipping, verdicts degrading)
  return comparison.diffs.some(d => ['CRITICAL', 'HIGH'].includes(d.severity));
}

function formatComparisonForAlert(comparison) {
  if (!comparison || !comparison.diffs || comparison.diffs.length === 0) {
    return null;
  }

  const criticalDiffs = comparison.diffs.filter(d => d.severity === 'CRITICAL');
  const highDiffs = comparison.diffs.filter(d => d.severity === 'HIGH');

  const message = [];

  if (criticalDiffs.length > 0) {
    message.push('🚨 CRITICAL HUMAN RISKS:');
    for (const diff of criticalDiffs) {
      message.push(`  • ${diff.message}`);
    }
  }

  if (highDiffs.length > 0) {
    message.push('⚠️  HIGH SEVERITY REGRESSIONS:');
    for (const diff of highDiffs) {
      message.push(`  • ${diff.message}`);
    }
  }

  return {
    severity: criticalDiffs.length > 0 ? 'CRITICAL' : 'HIGH',
    message: message.join('\n'),
    diffCount: comparison.diffs.length,
    details: comparison.diffs
  };
}

module.exports = {
  extractHumanOutcomes,
  compareHumanOutcomes,
  shouldAlert,
  formatComparisonForAlert
};
