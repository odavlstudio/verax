// @ts-nocheck
import { applyRules } from './apply-rules.js';
import { RULES_TABLE } from './rules-table.js';

export function scoreMissingNetworkAction({ expectation, expectationStrength, evidenceSignals, boosts }) {
  const { totalBoosts } = applyRules({
    boostsRules: RULES_TABLE.missing_network_action.boosts,
    evidenceSignals,
    expectationStrength,
    expectation,
    boosts
  });

  return totalBoosts;
}

export function penalizeMissingNetworkAction({ evidenceSignals, penalties }) {
  const { totalPenalties } = applyRules({
    penaltiesRules: RULES_TABLE.missing_network_action.penalties,
    evidenceSignals,
    penalties
  });

  return totalPenalties;
}
