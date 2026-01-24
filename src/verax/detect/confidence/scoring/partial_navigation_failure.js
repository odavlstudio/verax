// @ts-nocheck
import { applyRules } from './apply-rules.js';
import { RULES_TABLE } from './rules-table.js';

export function scorePartialNavigationFailure({ evidenceSignals, boosts }) {
  const { totalBoosts } = applyRules({
    boostsRules: RULES_TABLE.partial_navigation_failure.boosts,
    evidenceSignals,
    boosts
  });

  return totalBoosts;
}

export function penalizePartialNavigationFailure({ evidenceSignals, penalties }) {
  const { totalPenalties } = applyRules({
    penaltiesRules: RULES_TABLE.partial_navigation_failure.penalties,
    evidenceSignals,
    penalties
  });

  return totalPenalties;
}
