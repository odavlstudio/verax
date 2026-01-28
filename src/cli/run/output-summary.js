/**
 * Week 8: Output Formatter Module
 * Extracted from run.js
 * 
 * ZERO behavior changes from original run.js
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 * V1 OUTPUT CONTRACT — Human-Readable Summary
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Coverage Transparency Requirements:
 * - MUST show: total expectations, attempted, observed
 * - MUST show: unattempted count (if > 0)
 * - SHOULD show: top unattempted reasons (deterministic order)
 * 
 * This debug-level summary complements the final truth-first output.
 */

import { computeDiagnosticsSummary, formatDiagnosticsSummaryLine } from '../util/observation/diagnostics-summary.js';

/**
 * Print human-readable summary (non-JSON mode)
 * @param {boolean} isFirstRun - Whether this is the first VERAX run (for persona lock)
 * @param {string} status - Final truth state (SUCCESS/FINDINGS/INCOMPLETE) for honesty guard
 */
export function printSummary(url, paths, expectations, observeData, detectData, isFirstRun = false, status = null) {
  const parts = paths.baseDir.replace(/\\/g, '/').split('/');
  const relativePath = parts.slice(Math.max(0, parts.length - 2)).join('/');
  
  const total = expectations.length;
  const attempted = observeData.stats?.attempted || 0;
  const observed = observeData.stats?.observed || 0;
  const unattempted = Math.max(0, total - attempted);
  
  console.log('');
  console.log('VERAX — Silent Failure Detection');
  console.log('');
  console.log(`✔ URL: ${url}`);
  console.log('');
  console.log('Learn phase:');
  console.log(`  → Extracted ${total} promises`);
  console.log('');
  console.log('Observe phase:');
  console.log(`  → Total expectations: ${total}`);
  console.log(`  → Attempted: ${attempted}`);
  console.log(`  → Observed: ${observed}`);
  if (unattempted > 0) {
    console.log(`  → Unattempted: ${unattempted}`);
    // Show top reasons if available
    const reasons = observeData.coverage?.skippedReasons || observeData.stability?.unattemptedReasons || {};
    /** @type {Array<[string, number]>} */
    const entries = Object.entries(reasons).map(([k, v]) => [k, Number(v || 0)]);
    // Deterministic sort: by count desc, then key asc
    entries.sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
    });
    const top2 = entries.slice(0, 2);
    if (top2.length > 0) {
      console.log(`     Reasons: ${top2.map(([k, v]) => `${k} (${v})`).join(', ')}`);
    }
  }
  console.log('');
  console.log('Detect phase:');
  console.log(`  → Silent failures: ${detectData.stats?.silentFailures || 0}`);
  console.log(`  → Unproven: ${detectData.stats?.unproven || 0}`);
  console.log(`  → Coverage gaps: ${detectData.stats?.coverageGaps || 0}`);
  console.log('');
  
  // SCOPE AWARENESS v1.0: Show out-of-scope feedback count if present
  const outOfScopeCount = (detectData.stats?.outOfScope || 0);
  if (outOfScopeCount > 0) {
    console.log('⚠️  Scope Notice:');
    console.log(`  → ${outOfScopeCount} interaction(s) produced feedback outside VERAX's detection scope.`);
    console.log('     This is NOT a silent failure—it means VERAX cannot observe this type of change.');
    console.log('     See docs/FEEDBACK-SCOPE.md for what VERAX detects and does not detect.');
    console.log('');
  }
  if (observeData.status === 'INCOMPLETE' && attempted > 0) {
    const diagnostics = observeData.diagnostics || [];
    const summary = computeDiagnosticsSummary(diagnostics);
    const summaryLine = formatDiagnosticsSummaryLine(summary);
    if (summaryLine) {
      console.log(summaryLine);
      console.log('');
    }
  }
  
  // Guard 1: Persona Lock (first run only)
  if (isFirstRun) {
    console.log('VERAX is designed for frontend codebases (React / Next.js / Vue / Angular / SvelteKit) with local source code provided via --src.');
    console.log('');
  }
  
  // Guard 2: Scope Truth Guard (all diagnostics are SELECTOR_NOT_FOUND or UNSUPPORTED_PROMISE, observed=0)
  if (total > 0 && observed === 0 && attempted > 0) {
    const diagnostics = observeData.diagnostics || [];
    const allScopeMismatch = diagnostics.length > 0 && diagnostics.every((d) => 
      d.phaseOutcome === 'SELECTOR_NOT_FOUND' || d.phaseOutcome === 'UNSUPPORTED_PROMISE'
    );
    if (allScopeMismatch) {
      console.log('No extracted promises matched the live page. This usually means the provided --src does not correspond to the deployed URL.');
      console.log('');
    }
  }
  
  // Guard 3: Success Honesty Guard (SUCCESS with attempted < total)
  if (status === 'SUCCESS' && attempted < total && total > 0) {
    console.log('Some extracted promises were not exercised. SUCCESS indicates no silent failures in the observed subset.');
    console.log('');
  }
  console.log('VERAX checks whether real user actions actually produce visible results.');
  console.log('These failures often pass tests and monitoring because nothing crashes.');
  console.log('Use VERAX for public, pre-auth frontend flows when you have the source code.');
  console.log('');
  
  console.log('Artifacts written to:');
  console.log(`  .verax/runs/${relativePath}/`);
  console.log('');
}
