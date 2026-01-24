// @ts-nocheck
import { applyRules } from './apply-rules.js';
import { RULES_TABLE } from './rules-table.js';

export function scoreMissingFeedbackFailure({ evidenceSignals, boosts }) {
  const { totalBoosts } = applyRules({
    boostsRules: RULES_TABLE.missing_feedback_failure.boosts,
    evidenceSignals,
    boosts
  });

  return totalBoosts;
}

export function penalizeMissingFeedbackFailure({ evidenceSignals, penalties }) {
  const { totalPenalties } = applyRules({
    penaltiesRules: RULES_TABLE.missing_feedback_failure.penalties,
    evidenceSignals,
    penalties
  });

  return totalPenalties;
}
