/**
 * Zero Findings Explanation
 * 
 * Observational explanation of zero findings (not a judgment).
 */

/**
 * Generate explanation for zero findings
 * @param {Object} context - Context information
 * @returns {Array<string>} Explanation lines
 */
export function explainZeroFindings(context = {}) {
  const {
    expectationsCount = 0,
    interactionsObserved = 0,
    discrepanciesObserved = 0
  } = context;
  
  const lines = [
    '────────────────────────────────────────────────────────────',
    'OBSERVATION: No Discrepancies Detected',
    '────────────────────────────────────────────────────────────',
    '',
    `VERAX analyzed ${expectationsCount} code-derived expectations`,
    `Observed ${interactionsObserved} user interactions`,
    `Discrepancies observed: ${discrepanciesObserved}`,
    '',
    'What this means:',
    '  • During this scan, no discrepancies were observed between code promises and runtime behavior',
    '  • This does NOT guarantee safety, correctness, or completeness',
    '  • Some expectations may not have been evaluated (see gaps below)',
    '',
    'What was not observed:',
  ];
  
  if (expectationsCount === 0) {
    lines.push('  • No expectations found in code - no evaluation was possible');
    lines.push('  • VERAX requires PROVEN expectations (static patterns) to observe behavior');
  } else {
    lines.push('  • Check coverage gaps to see what was not evaluated');
  }
  
  return lines;
}

/**
 * Print zero findings explanation
 * @param {Object} context - Context
 */
export function printZeroFindingsExplanation(context = {}) {
  const lines = explainZeroFindings(context);
  lines.forEach(line => {
    console.error(line);
  });
  console.error('');
}

