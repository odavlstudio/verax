// @ts-nocheck
import { applyRules } from './apply-rules.js';
import { RULES_TABLE } from './rules-table.js';

// Intentionally no scoring rules — relies on base score only.
// flow_silent_failure has no type-specific boost/penalty logic.

export function scoreFlowSilentFailure({ boosts }) {
  const { totalBoosts } = applyRules({
    boostsRules: RULES_TABLE.flow_silent_failure.boosts,
    boosts
  });

  return totalBoosts;
}

export function penalizeFlowSilentFailure({ penalties }) {
  const { totalPenalties } = applyRules({
    penaltiesRules: RULES_TABLE.flow_silent_failure.penalties,
    penalties
  });

  return totalPenalties;
}
