/**
 * VERAX Diagnose - Output Formatting
 * 
 * Formats and prints human-readable diagnostics summary.
 */

/**
 * Print human-readable diagnostics summary
 */
export function printDiagnosticsSummary(diagnostics, diagnosticsPath) {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  VERAX Diagnostics Report');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  
  // Meta
  console.log(`Run ID:         ${diagnostics.meta.runId}`);
  console.log(`VERAX Version:  ${diagnostics.meta.veraxVersion}`);
  console.log(`Completed:      ${diagnostics.meta.runCompletedAt || 'unknown'}`);
  console.log('');
  
  // Timing
  console.log('─────────────────────────────────────────────────────────');
  console.log('TIMING BREAKDOWN');
  console.log('─────────────────────────────────────────────────────────');
  console.log(`  Total:        ${formatDuration(diagnostics.timing.total.durationMs)}`);
  console.log(`  Learn:        ${formatDuration(diagnostics.timing.learn.durationMs)}`);
  console.log(`  Observe:      ${formatDuration(diagnostics.timing.observe.durationMs)}`);
  console.log(`  Detect:       ${formatDuration(diagnostics.timing.detect.durationMs)}`);
  console.log('');
  
  if (diagnostics.timing.interactions.count > 0) {
    console.log(`  Interactions: ${diagnostics.timing.interactions.count} observed`);
    console.log(`    Min:        ${formatDuration(diagnostics.timing.interactions.minMs)}`);
    console.log(`    Avg:        ${formatDuration(diagnostics.timing.interactions.avgMs)}`);
    console.log(`    Max:        ${formatDuration(diagnostics.timing.interactions.maxMs)}`);
    console.log('');
    
    if (diagnostics.timing.interactions.slowest.length > 0) {
      console.log('  Slowest interactions:');
      for (const slow of diagnostics.timing.interactions.slowest) {
        const selector = slow.selector ? ` (${truncate(slow.selector, 40)})` : '';
        console.log(`    • ${formatDuration(slow.durationMs)} - ${slow.expectationId}${selector}`);
      }
      console.log('');
    }
  }
  
  // Skips & Gaps
  console.log('─────────────────────────────────────────────────────────');
  console.log('SKIPS & GAPS ANALYSIS');
  console.log('─────────────────────────────────────────────────────────');
  
  const learnTotal = Object.values(diagnostics.skips.learn).reduce((a, b) => a + b, 0);
  console.log(`  Learn Phase:  ${learnTotal} patterns skipped`);
  if (diagnostics.skips.learn.dynamic > 0) {
    console.log(`    • Dynamic:        ${diagnostics.skips.learn.dynamic} (variables, template strings, function calls)`);
  }
  if (diagnostics.skips.learn.params > 0) {
    console.log(`    • Params:         ${diagnostics.skips.learn.params} (route params like [id], [...rest])`);
  }
  if (diagnostics.skips.learn.computed > 0) {
    console.log(`    • Computed:       ${diagnostics.skips.learn.computed} (runtime-dependent values)`);
  }
  if (diagnostics.skips.learn.external > 0) {
    console.log(`    • External:       ${diagnostics.skips.learn.external} (cross-origin URLs)`);
  }
  if (diagnostics.skips.learn.parseError > 0) {
    console.log(`    • Parse Errors:   ${diagnostics.skips.learn.parseError} (malformed code)`);
  }
  if (diagnostics.skips.learn.other > 0) {
    console.log(`    • Other:          ${diagnostics.skips.learn.other}`);
  }
  console.log('');
  
  const observeTotal = Object.values(diagnostics.skips.observe).reduce((a, b) => a + b, 0);
  console.log(`  Observe Phase: ${observeTotal} interactions skipped`);
  if (diagnostics.skips.observe.externalNavigation > 0) {
    console.log(`    • External Nav:   ${diagnostics.skips.observe.externalNavigation} (cross-origin blocked)`);
  }
  if (diagnostics.skips.observe.timeout > 0) {
    console.log(`    • Timeout:        ${diagnostics.skips.observe.timeout}`);
  }
  if (diagnostics.skips.observe.unsafeInteractions > 0) {
    console.log(`    • Unsafe:         ${diagnostics.skips.observe.unsafeInteractions} (file upload, logout, etc.)`);
  }
  console.log('');
  
  if (Object.keys(diagnostics.skips.runtime.reasons).length > 0) {
    console.log('  Runtime Skip Reasons:');
    for (const [reason, count] of Object.entries(diagnostics.skips.runtime.reasons)) {
      console.log(`    • ${reason}: ${count}`);
      
      // Show examples if available
      if (diagnostics.skips.runtime.examples[reason]?.length > 0) {
        const examples = diagnostics.skips.runtime.examples[reason].slice(0, 3);
        console.log(`      Examples: ${examples.join(', ')}`);
      }
    }
    console.log('');
  }
  
  // Coverage
  console.log('─────────────────────────────────────────────────────────');
  console.log('EVIDENCE COVERAGE');
  console.log('─────────────────────────────────────────────────────────');
  console.log(`  Expectations:     ${diagnostics.coverage.expectations.discovered} discovered`);
  console.log(`    Analyzed:       ${diagnostics.coverage.expectations.analyzed}`);
  console.log(`    Skipped:        ${diagnostics.coverage.expectations.skipped}`);
  console.log(`    Observations:   ${diagnostics.coverage.expectations.producingObservations}`);
  console.log(`    Findings:       ${diagnostics.coverage.expectations.producingFindings}`);
  console.log('');
  console.log(`  Findings:         ${diagnostics.coverage.findings.total} total`);
  if (diagnostics.coverage.findings.total > 0) {
    console.log(`    High confidence:   ${diagnostics.coverage.findings.byConfidence.high}`);
    console.log(`    Medium confidence: ${diagnostics.coverage.findings.byConfidence.medium}`);
    console.log(`    Low confidence:    ${diagnostics.coverage.findings.byConfidence.low}`);
    console.log('');
    
    if (Object.keys(diagnostics.coverage.findings.byType).length > 0) {
      console.log('  Findings by type:');
      for (const [type, count] of Object.entries(diagnostics.coverage.findings.byType)) {
        console.log(`    • ${type}: ${count}`);
      }
      console.log('');
    }
  }
  
  // Flakiness Signals
  if (diagnostics.signals.lateAcknowledgments.count > 0 || 
      diagnostics.signals.timeouts.count > 0 || 
      diagnostics.signals.unstableSignals.count > 0) {
    console.log('─────────────────────────────────────────────────────────');
    console.log('FLAKINESS SIGNALS (Evidence-only)');
    console.log('─────────────────────────────────────────────────────────');
    console.log('  Note: These are observable signals, not definitive labels');
    console.log('');
    
    if (diagnostics.signals.lateAcknowledgments.count > 0) {
      console.log(`  Late Acknowledgments: ${diagnostics.signals.lateAcknowledgments.count}`);
      if (diagnostics.signals.lateAcknowledgments.examples.length > 0) {
        for (const ex of diagnostics.signals.lateAcknowledgments.examples) {
          console.log(`    • ${ex.expectationId} (${ex.latencyBucket}, ${ex.duration}ms)`);
        }
      }
      console.log('');
    }
    
    if (diagnostics.signals.timeouts.count > 0) {
      console.log(`  Timeouts:             ${diagnostics.signals.timeouts.count}`);
      if (diagnostics.signals.timeouts.examples.length > 0) {
        for (const ex of diagnostics.signals.timeouts.examples) {
          const selector = ex.selector ? ` (${truncate(ex.selector, 40)})` : '';
          console.log(`    • ${ex.expectationId}${selector}`);
        }
      }
      console.log('');
    }
    
    if (diagnostics.signals.unstableSignals.count > 0) {
      console.log(`  Unstable Signals:     ${diagnostics.signals.unstableSignals.count}`);
      if (diagnostics.signals.unstableSignals.examples.length > 0) {
        for (const ex of diagnostics.signals.unstableSignals.examples) {
          console.log(`    • ${ex.expectationId} (${ex.signal})`);
        }
      }
      console.log('');
    }
  }
  
  // Environment
  console.log('─────────────────────────────────────────────────────────');
  console.log('ENVIRONMENT & CONSTRAINTS');
  console.log('─────────────────────────────────────────────────────────');
  console.log(`  URL:              ${diagnostics.environment.url || 'unknown'}`);
  console.log(`  Framework:        ${diagnostics.environment.framework}`);
  if (diagnostics.environment.router) {
    console.log(`  Router:           ${diagnostics.environment.router}`);
  }
  console.log(`  Node Version:     ${diagnostics.environment.nodeVersion}`);
  console.log(`  OS:               ${diagnostics.environment.os}`);
  console.log('');
  console.log('  Constraints:');
  console.log(`    • Read-only:         ${diagnostics.environment.constraints.readOnly ? 'enforced' : 'disabled'}`);
  console.log(`    • Cross-origin:      ${diagnostics.environment.constraints.crossOriginBlocked ? 'blocked' : 'allowed'}`);
  console.log('');
  
  if (diagnostics.environment.budgets.maxExpectations) {
    console.log('  Budgets:');
    console.log(`    • Max Expectations:  ${diagnostics.environment.budgets.maxExpectations}`);
    console.log(`    • Budget Exceeded:   ${diagnostics.environment.budgets.budgetExceeded ? 'yes' : 'no'}`);
    console.log('');
  }
  
  // Footer
  console.log('─────────────────────────────────────────────────────────');
  console.log(`  Diagnostics saved to: ${diagnosticsPath}`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
}

/**
 * Format duration in milliseconds to human-readable string
 */
function formatDuration(ms) {
  if (ms === null || ms === undefined) return 'N/A';
  if (ms === 0) return '0ms';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Truncate string to max length
 */
function truncate(str, maxLength) {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}
