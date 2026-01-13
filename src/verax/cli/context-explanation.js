/**
 * Wave 4.1 — Context Validation Explanation
 * 
 * Provides detailed explanations when context validation fails or matches.
 */

/**
 * Generate context validation explanation
 * @param {Object} contextCheck - Context check result
 * @param {Array} projectRoutes - Routes extracted from project
 * @returns {Array<string>} Explanation lines
 */
export function explainContextValidation(contextCheck, projectRoutes = []) {
  const lines = [];
  
  if (!contextCheck.ran) {
    if (contextCheck.reason === 'no_routes_extracted') {
      lines.push('Context validation skipped: No routes extracted from project.');
    } else if (contextCheck.reason === 'invalid_url') {
      lines.push('Context validation skipped: Invalid URL format.');
    } else {
      lines.push('Context validation skipped.');
    }
    return lines;
  }
  
  if (contextCheck.verdict === 'VALID_CONTEXT') {
    lines.push(`✓ Context validated: URL matches project`);
    lines.push(`  ${contextCheck.matchedRoutesCount} of ${contextCheck.totalRoutesChecked || projectRoutes.length} routes matched`);
    if (contextCheck.sampleMatched && contextCheck.sampleMatched.length > 0) {
      lines.push(`  Sample matched routes: ${contextCheck.sampleMatched.slice(0, 3).join(', ')}`);
    }
    return lines;
  }
  
  // INVALID_CONTEXT or INVALID_CONTEXT_FORCED
  lines.push(`⚠ Context mismatch: URL does not match project`);
  lines.push(`  Project routes found: ${projectRoutes.length}`);
  lines.push(`  Routes matched: ${contextCheck.matchedRoutesCount} of ${contextCheck.totalRoutesChecked || projectRoutes.length}`);
  
  if (projectRoutes.length > 0 && contextCheck.matchedRoutesCount === 0) {
    lines.push('');
    lines.push('  Project routes (sample):');
    const sampleRoutes = projectRoutes.slice(0, 5);
    for (const route of sampleRoutes) {
      lines.push(`    - ${route}`);
    }
    
    if (contextCheck.internalLinksFound !== undefined) {
      lines.push(`  Live site internal links found: ${contextCheck.internalLinksFound}`);
    }
    
    lines.push('');
    lines.push('  Possible reasons:');
    lines.push('    • Route paths don\'t match (e.g., /about vs /about.html)');
    lines.push('    • Project routes not linked on homepage');
    lines.push('    • SPA routes not accessible at expected paths');
    
    if (contextCheck.verdict === 'INVALID_CONTEXT') {
      lines.push('');
      lines.push('  Next steps:');
      lines.push('    • Use --force to scan anyway');
      lines.push('    • Verify URL matches project deployment');
      lines.push('    • Check that routes exist on the live site');
    } else {
      lines.push('');
      lines.push('  Scan continued with --force flag despite mismatch.');
    }
  }
  
  return lines;
}

/**
 * Print context validation explanation
 * @param {Object} contextCheck - Context check result
 * @param {Array} projectRoutes - Routes extracted from project
 */
export function printContextExplanation(contextCheck, projectRoutes = []) {
  const lines = explainContextValidation(contextCheck, projectRoutes);
  if (lines.length > 0) {
    console.error('');
    console.error('Context Validation:');
    lines.forEach(line => {
      console.error(line);
    });
  }
}

