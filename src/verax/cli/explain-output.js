/**
 * Wave 4 — Explain Output
 * 
 * Human-readable explanation of expectations and their usage.
 */

/**
 * Format expectation for --explain output
 * @param {Object} expectation - Expectation object from expectations.json
 * @returns {string} Formatted string
 */
function formatExpectation(expectation) {
  const lines = [];
  
  lines.push(`  ID: ${expectation.id}`);
  lines.push(`  Type: ${expectation.type}`);
  lines.push(`  Proof: ${expectation.proof}`);
  lines.push(`  Reason: ${expectation.reason}`);
  
  if (expectation.source) {
    const sourceStr = expectation.source.file 
      ? `${expectation.source.file}${expectation.source.line ? `:${expectation.source.line}` : ''}`
      : 'unknown source';
    lines.push(`  Source: ${sourceStr}`);
  }
  
  lines.push(`  Used: ${expectation.used ? 'YES' : 'NO'}`);
  
  if (expectation.usedReason) {
    lines.push(`  Used Reason: ${expectation.usedReason}`);
  } else if (!expectation.used) {
    lines.push(`  Not Used: ${expectation.usedReason || 'no matching interaction'}`);
  }
  
  return lines.join('\n');
}

/**
 * Print explain output
 * @param {Array} expectations - Array of expectation objects
 * @param {Object} summary - Expectations summary
 */
export function printExplainOutput(expectations, summary) {
  console.error('\n' + '═'.repeat(60));
  console.error('VERAX Expectations Explanation');
  console.error('═'.repeat(60));
  console.error('');
  
  console.error(`Summary:`);
  console.error(`  Total expectations: ${summary.total}`);
  console.error(`  By type: navigation=${summary.byType.navigation}, network_action=${summary.byType.network_action}, state_action=${summary.byType.state_action}`);
  console.error(`  Used: ${summary.total - summary.skipped}`);
  console.error(`  Unused: ${summary.skipped}`);
  console.error('');
  
  if (expectations.length === 0) {
    console.error('No expectations found in your project.');
    console.error('VERAX needs static code patterns to create expectations.');
    console.error('See README for supported patterns.');
    console.error('');
    return;
  }
  
  // Group by type
  const byType = {
    navigation: expectations.filter(e => e.type === 'navigation'),
    network_action: expectations.filter(e => e.type === 'network_action'),
    state_action: expectations.filter(e => e.type === 'state_action')
  };
  
  // Print by type
  for (const [type, exps] of Object.entries(byType)) {
    if (exps.length === 0) continue;
    
    console.error(`${type.toUpperCase().replace('_', ' ')} (${exps.length}):`);
    console.error('─'.repeat(60));
    
    for (const exp of exps) {
      console.error(formatExpectation(exp));
      console.error('');
    }
  }
  
  // Summary of unused expectations
  const unused = expectations.filter(e => !e.used);
  if (unused.length > 0) {
    console.error('Unused Expectations Summary:');
    console.error('─'.repeat(60));
    
    const unusedByReason = {};
    for (const exp of unused) {
      const reason = exp.usedReason || 'no matching interaction';
      unusedByReason[reason] = (unusedByReason[reason] || 0) + 1;
    }
    
    for (const [reason, count] of Object.entries(unusedByReason)) {
      console.error(`  ${reason}: ${count}`);
    }
    console.error('');
  }
  
  console.error('═'.repeat(60));
  console.error('');
}




