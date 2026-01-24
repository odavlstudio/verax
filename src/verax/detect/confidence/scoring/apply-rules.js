import { PREDICATES } from './predicates.js';

/**
 * Evaluates a single rule condition against context
 * 
 * CORE #4 (Promise-Extraction): Only predicates that derive from observable evidence
 * 
 * @param {string|object} when - Condition to evaluate (predicate name or signal key)
 * @param {object} context - Evaluation context (evidenceSignals, expectationStrength, etc)
 * @returns {boolean} true if condition met, false otherwise
 */
function evaluateCondition(when, context) {
  if (typeof when === 'string') {
    const predicate = PREDICATES[when];
    if (predicate) {
      return predicate(context) === true;
    }
    return context.evidenceSignals?.[when] === true;
  }
  return false;
}

/**
 * Applies boost and penalty rules in order without reordering
 * 
 * INVARIANT: Rules are evaluated in declaration order (CORE #3 - Determinism)
 * INVARIANT: No sorting, filtering, or selective rule application
 * INVARIANT: All matching rules contribute to final score (additive)
 * 
 * @param {object} config - Rule application configuration
 * @param {array} config.boostsRules - Ordered boost rules to evaluate
 * @param {array} config.penaltiesRules - Ordered penalty rules to evaluate
 * @param {object} config.evidenceSignals - Observable signals from runtime
 * @param {string} config.expectationStrength - 'PROVEN', 'INFERRED', 'OBSERVED'
 * @param {object} config.expectation - Original expectation object
 * @param {array} config.boosts - Accumulator for applied boost reasons
 * @param {array} config.penalties - Accumulator for applied penalty reasons
 * 
 * @returns {object} { totalBoosts, totalPenalties, boostsApplied, penaltiesApplied, explainAdds }
 */
export function applyRules({
  boostsRules = [],
  penaltiesRules = [],
  evidenceSignals = {},
  expectationStrength,
  expectation,
  boosts = [],
  penalties = []
}) {
  const context = { evidenceSignals, expectationStrength, expectation };
  let totalBoosts = 0;
  let totalPenalties = 0;
  const boostsApplied = [];
  const penaltiesApplied = [];
  const explainAdds = [];

  // Apply boost rules in order (CORE #3: deterministic evaluation)
  for (const rule of boostsRules) {
    if (evaluateCondition(rule.when, context)) {
      totalBoosts += rule.weight;
      boosts.push(rule.reason);
      boostsApplied.push(rule.reason);
      explainAdds.push(rule.reason);
    }
  }

  // Apply penalty rules in order (CORE #3: deterministic evaluation)
  for (const rule of penaltiesRules) {
    if (evaluateCondition(rule.when, context)) {
      totalPenalties += rule.weight;
      penalties.push(rule.reason);
      penaltiesApplied.push(rule.reason);
      explainAdds.push(rule.reason);
    }
  }

  return {
    totalBoosts,
    totalPenalties,
    scoreDelta: totalBoosts - totalPenalties,
    explainAdds,
    boostsApplied,
    penaltiesApplied
  };
}
