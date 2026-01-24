// @ts-nocheck
import { applyRules } from './apply-rules.js';
import { RULES_TABLE } from './rules-table.js';

// Intentionally no scoring rules — relies on base score only.
// observed_break has no type-specific boost/penalty logic.

export function scoreObservedBreak({ boosts }) {
  const { totalBoosts } = applyRules({
    boostsRules: RULES_TABLE.observed_break.boosts,
    boosts
  });

  return totalBoosts;
}

export function penalizeObservedBreak({ penalties }) {
  const { totalPenalties } = applyRules({
    penaltiesRules: RULES_TABLE.observed_break.penalties,
    penalties
  });

  return totalPenalties;
}
