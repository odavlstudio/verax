/**
 * 
 * Formats and prints standardized CLI output for VERAX runs.
 * 
 * Output format (decision-oriented, minimal):
 * - ✔ VERAX finished
 * - ✔ 14 interactions tested
 * - ✖ 3 user problems found (2 HIGH, 1 MEDIUM)
 * - → Open .verax/SUMMARY.md
 */

/**
 * Format console output for a completed run
 * 
 * @param {Object} stats - Run statistics
 * @param {number} stats.flowsScanned - Public flows scanned
 * @param {number} stats.silentFailures - Silent failures detected
 * @param {string} stats.outDir - Output directory path
 * @returns {string} Formatted output (multiple lines)
 */
export function formatConsoleOutput(stats) {
  const lines = [];
  
  const flowsScanned = stats?.flowsScanned || 0;
  const silentFailures = stats?.silentFailures || 0;
  const outDir = stats?.outDir || '.verax';
  
  // Line 1: Scan complete summary
  const flowsStr = `${flowsScanned} flow${flowsScanned !== 1 ? 's' : ''}`;
  const failuresStr = `${silentFailures} silent failure${silentFailures !== 1 ? 's' : ''}`;
  lines.push(`✓ Scan complete — ${flowsStr} checked, ${failuresStr} found`);
  
  // Line 2: Point to SUMMARY.md
  lines.push(`→ See ${outDir}/SUMMARY.md for details`);
  
  // Line 3: Mention output directory
  lines.push('');
  lines.push(`Output saved to ${outDir}/`);
  lines.push(`  • SUMMARY.md — Human-readable findings`);
  lines.push(`  • REPORT.json — Machine-readable results`);
  
  return lines.join('\n');
}

/**
 * Print formatted console output to stdout
 */
export function printConsoleOutput(stats) {
  const output = formatConsoleOutput(stats);
  console.log(output);
  return output;
}

/**
 * Format and print error output when fatal error occurs
 * 
 * @param {string} message - Error message
 * @param {boolean} [_debug] - If true, include more details; if false, minimal
 */
export function formatErrorOutput(message, _debug = false) {
  // Single-line error message with [ERROR] prefix
  return `[ERROR] ${message}`;
}

/**
 * Print error output
 */
export function printErrorOutput(message, _debug = false) {
  const output = formatErrorOutput(message, _debug);
  console.error(output);
  return output;
}








