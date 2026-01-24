// @ts-nocheck
import { applyRules } from './apply-rules.js';
import { RULES_TABLE } from './rules-table.js';

export function scoreMissingStateAction({ expectationStrength, evidenceSignals, boosts }) {
  const { totalBoosts } = applyRules({
    boostsRules: RULES_TABLE.missing_state_action.boosts,
    evidenceSignals,
    expectationStrength,
    boosts
  });

  return totalBoosts;
}

export function penalizeMissingStateAction({ evidenceSignals, penalties }) {
  const { totalPenalties } = applyRules({
    penaltiesRules: RULES_TABLE.missing_state_action.penalties,
    evidenceSignals,
    penalties
  });

  return totalPenalties;
}
