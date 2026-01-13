/**
 * Wave 6 — Finding Explanation
 * 
 * Formats findings in a clear, human-readable way showing the chain:
 * Expectation → Observation → Mismatch → Why this is a silent failure
 */

/**
 * Format a single finding for console output
 * @param {Object} finding - Finding object
 * @param {Object} expectation - Related expectation (if available)
 * @returns {string} Formatted finding text
 */
export function formatFinding(finding, expectation = null) {
  const lines = [];
  
  // Finding type and confidence
  const confidenceLevel = finding.confidence?.level || 'UNKNOWN';
  const confidenceScore = finding.confidence?.score || 0;
  lines.push(`  [${confidenceLevel} (${confidenceScore}%)] ${finding.type || 'unknown'}`);
  
  // Expectation (what was promised)
  if (expectation) {
    let expectationDesc = '';
    if (expectation.type === 'navigation') {
      const target = expectation.raw?.targetPath || expectation.targetPath || 'route';
      expectationDesc = `Expected navigation to ${target}`;
    } else if (expectation.type === 'network_action') {
      const method = expectation.raw?.method || 'request';
      const url = expectation.raw?.urlPath || expectation.urlPath || 'endpoint';
      expectationDesc = `Expected ${method} request to ${url}`;
    } else if (expectation.type === 'state_action') {
      expectationDesc = `Expected state mutation`;
    } else {
      expectationDesc = `Expected ${expectation.type}`;
    }
    lines.push(`  └─ Expectation: ${expectationDesc}`);
  } else if (finding.expectationId) {
    lines.push(`  └─ Expectation: Referenced expectation ${finding.expectationId}`);
  }
  
  // Observation (what actually happened)
  const interaction = finding.interaction || {};
  if (interaction.type) {
    let interactionDesc = `${interaction.type}`;
    if (interaction.selector) {
      interactionDesc += ` on "${interaction.label || interaction.selector}"`;
    }
    lines.push(`  └─ Observation: User interacted (${interactionDesc})`);
  }
  
  // Mismatch (what went wrong)
  const evidence = finding.evidence || {};
  if (finding.type === 'silent_failure' || finding.type === 'navigation_silent_failure') {
    if (!evidence.hasUrlChange && !evidence.hasVisibleChange) {
      lines.push(`  └─ Mismatch: No navigation occurred, no visible change`);
    } else if (evidence.hasUrlChange && !evidence.hasVisibleChange) {
      lines.push(`  └─ Mismatch: URL changed but no visible feedback`);
    } else {
      lines.push(`  └─ Mismatch: Expected navigation did not occur`);
    }
  } else if (finding.type === 'network_silent_failure') {
    if (evidence.slowRequests && evidence.slowRequests > 0) {
      lines.push(`  └─ Mismatch: Request was slow (${evidence.slowRequests} slow request(s))`);
    } else {
      lines.push(`  └─ Mismatch: Request failed or returned error with no user feedback`);
    }
  } else if (finding.type === 'missing_network_action') {
    lines.push(`  └─ Mismatch: Expected network request never fired`);
  } else if (finding.type === 'missing_state_action') {
    lines.push(`  └─ Mismatch: Expected state change did not occur`);
  }
  
  // Why this is a silent failure
  if (finding.reason) {
    lines.push(`  └─ Silent Failure: ${finding.reason}`);
  } else {
    lines.push(`  └─ Silent Failure: User receives no feedback when expected behavior fails`);
  }
  
  // Source location if available
  if (expectation?.source?.file) {
    const sourceLine = expectation.source.line ? `:${expectation.source.line}` : '';
    lines.push(`  └─ Source: ${expectation.source.file}${sourceLine}`);
  }
  
  return lines.join('\n');
}

/**
 * Print top findings with explanations
 * @param {Array} findings - Array of finding objects
 * @param {Array} expectations - Array of expectation objects (for lookup)
 * @param {number} limit - Maximum number of findings to print
 */
export function printFindings(findings, expectations = [], limit = 5) {
  if (!findings || findings.length === 0) {
    return;
  }
  
  console.error('\n' + '─'.repeat(60));
  console.error(`Top Findings (${Math.min(findings.length, limit)} of ${findings.length})`);
  console.error('─'.repeat(60));
  
  const topFindings = findings.slice(0, limit);
  
  // Create expectation lookup map
  const expectationMap = new Map();
  for (const exp of expectations) {
    if (exp.id) {
      expectationMap.set(exp.id, exp);
    }
  }
  
  topFindings.forEach((finding, index) => {
    const expectation = finding.expectationId 
      ? expectationMap.get(finding.expectationId)
      : null;
    
    console.error(`\n${index + 1}.`);
    console.error(formatFinding(finding, expectation));
  });
  
  if (findings.length > limit) {
    console.error(`\n... and ${findings.length - limit} more (see findings.json)`);
  }
  
  console.error('─'.repeat(60) + '\n');
}

