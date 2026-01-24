// @ts-nocheck
import { applyRules } from './apply-rules.js';
import { RULES_TABLE } from './rules-table.js';

export function scoreNoEffectSilentFailure({ evidenceSignals, boosts }) {
  const { totalBoosts } = applyRules({
    boostsRules: RULES_TABLE.no_effect_silent_failure.boosts,
    evidenceSignals,
    boosts
  });

  return totalBoosts;
}

export function penalizeNoEffectSilentFailure({ evidenceSignals, penalties }) {
  const { totalPenalties } = applyRules({
    penaltiesRules: RULES_TABLE.no_effect_silent_failure.penalties,
    evidenceSignals,
    penalties
  });

  return totalPenalties;
}
