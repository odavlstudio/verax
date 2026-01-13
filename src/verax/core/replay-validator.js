/**
 * PHASE 6 — REPLAY TRUST VALIDATION
 * 
 * Compares decisions from previous run with current run to identify deviations.
 * DOES NOT fail on deviations - only reports them with explicit reasons.
 * 
 * Answers: "Why was result different?" or "Why is result identical?"
 * 
 * Rules:
 * - Load decisions.json from baseline run
 * - Compare with current run decisions
 * - Warn (not fail) on deviations
 * - Categorize deviations: truncation_difference, timeout_difference, environment_difference
 */

import { DecisionRecorder } from './determinism-model.js';

/**
 * Compare two decision values and determine if they're equivalent
 * @param {*} value1 - First value
 * @param {*} value2 - Second value
 * @returns {boolean} - True if values are considered equivalent
 */
function areValuesEquivalent(value1, value2) {
  // Handle null/undefined
  if (value1 == null && value2 == null) return true;
  if (value1 == null || value2 == null) return false;
  
  // Handle primitives
  if (typeof value1 !== 'object' || typeof value2 !== 'object') {
    return value1 === value2;
  }
  
  // Handle objects/arrays (shallow comparison for now)
  const keys1 = Object.keys(value1);
  const keys2 = Object.keys(value2);
  
  if (keys1.length !== keys2.length) return false;
  
  for (const key of keys1) {
    if (value1[key] !== value2[key]) return false;
  }
  
  return true;
}

/**
 * Categorize a decision deviation
 * @param {Object} baseline - Baseline decision
 * @param {Object} _current - Current decision (unused parameter, kept for API compatibility)
 * @returns {string} - Deviation category
 */
function categorizeDeviation(baseline, _current) {
  const category = baseline.category;
  
  switch (category) {
    case 'BUDGET':
      return 'budget_difference';
    case 'TIMEOUT':
      return 'timeout_difference';
    case 'TRUNCATION':
      return 'truncation_difference';
    case 'RETRY':
      return 'retry_difference';
    case 'ADAPTIVE_STABILIZATION':
      return 'stabilization_difference';
    case 'ENVIRONMENT':
      return 'environment_difference';
    default:
      return 'unknown_difference';
  }
}

/**
 * Explain why a deviation occurred
 * @param {Object} baseline - Baseline decision
 * @param {Object} current - Current decision
 * @returns {string} - Human-readable explanation
 */
function explainDeviation(baseline, current) {
  const _category = baseline.category;
  const devCategory = categorizeDeviation(baseline, current);
  
  // Build explanation based on decision type
  switch (devCategory) {
    case 'budget_difference':
      return `Budget configuration changed: baseline used ${JSON.stringify(baseline.chosen_value)}, current uses ${JSON.stringify(current.chosen_value)}`;
      
    case 'timeout_difference':
      return `Timeout configuration changed: baseline used ${baseline.chosen_value}ms, current uses ${current.chosen_value}ms`;
      
    case 'truncation_difference':
      if (baseline.decision_id === current.decision_id) {
        return `Truncation point changed: baseline reached limit at ${JSON.stringify(baseline.inputs)}, current reached at ${JSON.stringify(current.inputs)}`;
      } else {
        return `Different truncation occurred: baseline had ${baseline.decision_id}, current has ${current.decision_id}`;
      }
      
    case 'retry_difference':
      return `Retry behavior changed: baseline had ${baseline.chosen_value} retries, current has ${current.chosen_value} retries`;
      
    case 'stabilization_difference':
      return `Adaptive stabilization changed: baseline ${baseline.chosen_value ? 'extended' : 'did not extend'} stabilization, current ${current.chosen_value ? 'extends' : 'does not extend'}`;
      
    case 'environment_difference':
      return `Environment changed: baseline detected ${JSON.stringify(baseline.chosen_value)}, current detects ${JSON.stringify(current.chosen_value)}`;
      
    default:
      return `Decision changed: baseline value ${JSON.stringify(baseline.chosen_value)}, current value ${JSON.stringify(current.chosen_value)}`;
  }
}

/**
 * Decision comparison result
 * @typedef {Object} DecisionComparison
 * @property {string} decision_id - Decision identifier
 * @property {boolean} matches - Whether baseline and current match
 * @property {string} deviation_category - Category of deviation (if any)
 * @property {string} explanation - Human-readable explanation
 * @property {Object} baseline_value - Baseline chosen value
 * @property {Object} current_value - Current chosen value
 */

/**
 * Replay validation result
 * @typedef {Object} ReplayValidation
 * @property {boolean} isDeterministic - Whether runs are identical
 * @property {number} totalDecisions - Total decisions compared
 * @property {number} matchingDecisions - Count of matching decisions
 * @property {number} deviations - Count of deviations
 * @property {Object} deviationsByCategory - Deviations grouped by category
 * @property {DecisionComparison[]} comparisonDetails - Detailed comparison for each decision
 * @property {string[]} baselineOnlyDecisions - Decision IDs present only in baseline
 * @property {string[]} currentOnlyDecisions - Decision IDs present only in current
 * @property {string} verdict - Overall verdict ('identical', 'minor_deviations', 'major_deviations')
 */

/**
 * Compare decisions from baseline and current run
 * @param {Object} baselineExport - Exported decisions from baseline run
 * @param {Object} currentExport - Exported decisions from current run
 * @returns {ReplayValidation} - Comparison result
 */
export function compareReplayDecisions(baselineExport, currentExport) {
  const baselineRecorder = DecisionRecorder.fromExport(baselineExport);
  const currentRecorder = DecisionRecorder.fromExport(currentExport);
  
  const baselineDecisions = baselineRecorder.getAll();
  const currentDecisions = currentRecorder.getAll();
  
  // Index current decisions by decision_id for fast lookup
  const currentByDecisionId = new Map();
  for (const decision of currentDecisions) {
    // Multiple decisions with same ID possible (e.g., multiple truncations)
    if (!currentByDecisionId.has(decision.decision_id)) {
      currentByDecisionId.set(decision.decision_id, []);
    }
    currentByDecisionId.get(decision.decision_id).push(decision);
  }
  
  // Track comparison details
  const comparisonDetails = [];
  let matchingDecisions = 0;
  const deviationsByCategory = {};
  const baselineOnlyDecisions = [];
  const currentOnlyDecisions = [];
  
  // Compare baseline decisions with current
  for (const baselineDecision of baselineDecisions) {
    const decisionId = baselineDecision.decision_id;
    
    if (!currentByDecisionId.has(decisionId)) {
      // Decision present in baseline but not in current
      baselineOnlyDecisions.push(decisionId);
      const deviation = categorizeDeviation(baselineDecision, null);
      deviationsByCategory[deviation] = (deviationsByCategory[deviation] || 0) + 1;
      
      comparisonDetails.push({
        decision_id: decisionId,
        matches: false,
        deviation_category: deviation,
        explanation: `Decision present in baseline but missing in current run: ${baselineDecision.reason}`,
        baseline_value: baselineDecision.chosen_value,
        current_value: null
      });
      continue;
    }
    
    // Find matching decision in current run (compare by timestamp proximity or sequence)
    const currentCandidates = currentByDecisionId.get(decisionId);
    let bestMatch = null;
    let bestMatchDistance = Infinity;
    
    for (const currentCandidate of currentCandidates) {
      // Use timestamp proximity to match decisions (within 1 second)
      const timeDiff = Math.abs(currentCandidate.timestamp - baselineDecision.timestamp);
      if (timeDiff < bestMatchDistance) {
        bestMatchDistance = timeDiff;
        bestMatch = currentCandidate;
      }
    }
    
    // Compare values
    const valuesMatch = areValuesEquivalent(baselineDecision.chosen_value, bestMatch.chosen_value);
    const inputsMatch = areValuesEquivalent(baselineDecision.inputs, bestMatch.inputs);
    
    if (valuesMatch && inputsMatch) {
      matchingDecisions++;
      comparisonDetails.push({
        decision_id: decisionId,
        matches: true,
        deviation_category: null,
        explanation: 'Decision identical between runs',
        baseline_value: baselineDecision.chosen_value,
        current_value: bestMatch.chosen_value
      });
    } else {
      const deviation = categorizeDeviation(baselineDecision, bestMatch);
      deviationsByCategory[deviation] = (deviationsByCategory[deviation] || 0) + 1;
      
      comparisonDetails.push({
        decision_id: decisionId,
        matches: false,
        deviation_category: deviation,
        explanation: explainDeviation(baselineDecision, bestMatch),
        baseline_value: baselineDecision.chosen_value,
        current_value: bestMatch.chosen_value
      });
    }
  }
  
  // Check for decisions only in current run
  const baselineDecisionIds = new Set(baselineDecisions.map(d => d.decision_id));
  for (const currentDecision of currentDecisions) {
    if (!baselineDecisionIds.has(currentDecision.decision_id)) {
      currentOnlyDecisions.push(currentDecision.decision_id);
      const deviation = categorizeDeviation(currentDecision, null);
      deviationsByCategory[deviation] = (deviationsByCategory[deviation] || 0) + 1;
      
      comparisonDetails.push({
        decision_id: currentDecision.decision_id,
        matches: false,
        deviation_category: deviation,
        explanation: `Decision present in current run but missing in baseline: ${currentDecision.reason}`,
        baseline_value: null,
        current_value: currentDecision.chosen_value
      });
    }
  }
  
  // Compute overall verdict
  const totalDecisions = Math.max(baselineDecisions.length, currentDecisions.length);
  const deviations = totalDecisions - matchingDecisions;
  const isDeterministic = deviations === 0;
  
  let verdict = 'identical';
  if (deviations > 0) {
    // Minor deviations: only environment or timeout differences
    const hasMajorDeviations = Object.keys(deviationsByCategory).some(cat => 
      !['environment_difference', 'timeout_difference'].includes(cat)
    );
    verdict = hasMajorDeviations ? 'major_deviations' : 'minor_deviations';
  }
  
  return {
    isDeterministic,
    totalDecisions,
    matchingDecisions,
    deviations,
    deviationsByCategory,
    comparisonDetails,
    baselineOnlyDecisions: [...new Set(baselineOnlyDecisions)],
    currentOnlyDecisions: [...new Set(currentOnlyDecisions)],
    verdict
  };
}

/**
 * Load and compare decisions from file paths
 * @param {string} baselinePath - Path to baseline decisions.json
 * @param {string} currentPath - Path to current decisions.json
 * @returns {ReplayValidation} - Comparison result
 */
export function validateReplay(baselinePath, currentPath) {
  const fs = require('fs');
  
  if (!fs.existsSync(baselinePath)) {
    throw new Error(`Baseline decisions not found: ${baselinePath}`);
  }
  
  if (!fs.existsSync(currentPath)) {
    throw new Error(`Current decisions not found: ${currentPath}`);
  }
  
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));
  const current = JSON.parse(fs.readFileSync(currentPath, 'utf-8'));
  
  return compareReplayDecisions(baseline, current);
}

/**
 * Format replay validation result for display
 * @param {ReplayValidation} validation - Validation result
 * @returns {string} - Formatted text output
 */
export function formatReplayValidation(validation) {
  const lines = [];
  
  lines.push('=== REPLAY VALIDATION RESULT ===');
  lines.push('');
  lines.push(`Verdict: ${validation.verdict.toUpperCase()}`);
  lines.push(`Deterministic: ${validation.isDeterministic ? 'YES' : 'NO'}`);
  lines.push(`Total Decisions: ${validation.totalDecisions}`);
  lines.push(`Matching: ${validation.matchingDecisions}`);
  lines.push(`Deviations: ${validation.deviations}`);
  lines.push('');
  
  if (validation.deviations > 0) {
    lines.push('--- Deviations by Category ---');
    for (const [category, count] of Object.entries(validation.deviationsByCategory)) {
      lines.push(`  ${category}: ${count}`);
    }
    lines.push('');
    
    lines.push('--- Deviation Details ---');
    for (const detail of validation.comparisonDetails) {
      if (!detail.matches) {
        lines.push(`[${detail.decision_id}]`);
        lines.push(`  ${detail.explanation}`);
        lines.push('');
      }
    }
  } else {
    lines.push('✓ All decisions identical between baseline and current run');
  }
  
  if (validation.baselineOnlyDecisions.length > 0) {
    lines.push('--- Baseline-Only Decisions ---');
    lines.push(validation.baselineOnlyDecisions.join(', '));
    lines.push('');
  }
  
  if (validation.currentOnlyDecisions.length > 0) {
    lines.push('--- Current-Only Decisions ---');
    lines.push(validation.currentOnlyDecisions.join(', '));
    lines.push('');
  }
  
  return lines.join('\n');
}
