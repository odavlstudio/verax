/**
 * Wave 6 — Zero Interaction Explanation
 * 
 * Explains why no interactions were executed and what could/could not be validated.
 */

/**
 * Explain why no interactions were executed
 * @param {Object} context - Scan context
 * @returns {Array<string>} Explanation lines
 */
export function explainZeroInteractions(context = {}) {
  const {
    verdict = 'UNKNOWN',
    contextCheck = null,
    interactionsObserved = 0,
    expectationsTotal = 0,
    observation = null
  } = context;
  
  // If interactions were actually observed, return empty
  if (interactionsObserved > 0) {
    return [];
  }
  
  // If no expectations, different explanation
  if (expectationsTotal === 0) {
    return [
      'No interactions executed because no expectations were found.',
      'VERAX needs code-derived expectations to know what to test.'
    ];
  }
  
  const reasons = [];
  
  // Context validation stopped early
  if (verdict === 'INVALID_CONTEXT' && contextCheck && !contextCheck.forced) {
    reasons.push([
      '⚠️  No interactions executed because context validation failed.',
      '',
      'VERAX stopped the scan early to prevent analyzing the wrong site.',
      '',
      'What VERAX could validate:',
      `  ✓ Discovered ${expectationsTotal} expectations from your code`,
      '  ✗ Could not validate interactions (scan stopped)',
      '',
      'What to do:',
      '  • Use --force to scan anyway, or',
      '  • Ensure your URL matches the project being analyzed'
    ]);
  } else if (verdict === 'INVALID_CONTEXT_FORCED') {
    reasons.push([
      '⚠️  Limited interactions executed due to context mismatch.',
      '',
      'VERAX continued with --force but may not have found expected routes.',
      '',
      'What VERAX validated:',
      `  ✓ ${expectationsTotal} expectations found`,
      '  ⚠ Interactions may not match expectations (context mismatch)',
      '',
      'What to do:',
      '  • Verify URL matches project deployment',
      '  • Check that routes exist on the live site'
    ]);
  } else {
    // No interactions discovered or executed
    const observationDetails = observation?.observeTruth || {};
    
    if (observationDetails.interactionsObserved === 0) {
      reasons.push([
        '⚠️  No interactions executed.',
        '',
        'VERAX could not discover any interactive elements on the page.',
        '',
        'What VERAX could validate:',
        `  ✓ Discovered ${expectationsTotal} expectations from your code`,
        '  ✗ Could not test interactions (no discoverable elements)',
        '',
        'Possible reasons:',
        '  • Page has no clickable links, buttons, or forms',
        '  • Elements are hidden or not rendered',
        '  • JavaScript errors prevented interaction discovery',
        '',
        'What to do:',
        '  • Verify the page loads correctly',
        '  • Check browser console for errors',
        '  • Ensure interactive elements are visible and accessible'
      ]);
    } else {
      // Interactions discovered but none executed
      reasons.push([
        '⚠️  No interactions executed despite discoveries.',
        '',
        'VERAX discovered interactions but could not execute them.',
        '',
        'What VERAX could validate:',
        `  ✓ Discovered ${expectationsTotal} expectations from your code`,
        '  ✗ Could not test interactions (execution failed)',
        '',
        'What to do:',
        '  • Check network connectivity',
        '  • Verify page is accessible',
        '  • Review error logs for details'
      ]);
    }
  }
  
  return reasons.flat();
}

/**
 * Print zero interaction explanation
 * @param {Object} context - Scan context
 */
export function printZeroInteractionExplanation(context) {
  const explanation = explainZeroInteractions(context);
  if (explanation.length > 0) {
    console.error('\n' + '─'.repeat(60));
    console.error('Interaction Status');
    console.error('─'.repeat(60));
    explanation.forEach(line => {
      console.error(line);
    });
    console.error('─'.repeat(60) + '\n');
  }
}

