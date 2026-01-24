// @ts-nocheck
import { applyRules } from './apply-rules.js';
import { RULES_TABLE } from './rules-table.js';

export function scoreValidationSilentFailure({ evidenceSignals, boosts }) {
  const { totalBoosts } = applyRules({
    boostsRules: RULES_TABLE.validation_silent_failure.boosts,
    evidenceSignals,
    boosts
  });

  return totalBoosts;
}

export function penalizeValidationSilentFailure({ evidenceSignals, penalties }) {
  const { totalPenalties } = applyRules({
    penaltiesRules: RULES_TABLE.validation_silent_failure.penalties,
    evidenceSignals,
    penalties
  });

  return totalPenalties;
}
