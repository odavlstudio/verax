/**
 * PHASE 5 — DIAGNOSTICS SUMMARY AGGREGATION
 * 
 * Deterministically aggregates diagnostic outcomes to provide
 * one actionable line of output without spam or guesswork.
 */

/**
 * Compute diagnostic summary from diagnostics array
 * 
 * @param {Array} diagnostics - Array of diagnostic entries from Phase 4
 * @returns {Object} { topOutcome, topCount, totalAttempted }
 * 
 * Deterministic aggregation:
 * 1. Count each phaseOutcome
 * 2. Sort by count (desc), then by outcome name (asc) for tie-breaking
 * 3. Return top outcome and count
 */
export function computeDiagnosticsSummary(diagnostics) {
  if (!Array.isArray(diagnostics) || diagnostics.length === 0) {
    return {
      topOutcome: null,
      topCount: 0,
      totalAttempted: 0,
    };
  }

  const totalAttempted = diagnostics.length;
  const outcomeCounts = {};

  // Count each outcome
  for (const diagnostic of diagnostics) {
    const outcome = diagnostic.phaseOutcome || 'UNKNOWN_FAILURE';
    outcomeCounts[outcome] = (outcomeCounts[outcome] || 0) + 1;
  }

  // Convert to array and sort deterministically
  const entries = Object.entries(outcomeCounts);
  entries.sort((a, b) => {
    // Primary: count descending
    if (b[1] !== a[1]) {
      return b[1] - a[1];
    }
    // Tie-break: outcome name ascending (alphabetically)
    return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
  });

  if (entries.length === 0) {
    return {
      topOutcome: null,
      topCount: 0,
      totalAttempted,
    };
  }

  const [topOutcome, topCount] = entries[0];

  return {
    topOutcome,
    topCount,
    totalAttempted,
  };
}

/**
 * Format diagnostic summary for console output
 * 
 * @param {Object} summary - Output from computeDiagnosticsSummary
 * @returns {string|null} Single formatted line or null if not printable
 */
export function formatDiagnosticsSummaryLine(summary) {
  if (!summary || !summary.topOutcome || summary.totalAttempted === 0) {
    return null;
  }

  return `Most common execution outcome: ${summary.topOutcome} (${summary.topCount}/${summary.totalAttempted}). See observe.json diagnostics for exact causes.`;
}
