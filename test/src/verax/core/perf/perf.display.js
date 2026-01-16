/**
 * PHASE 21.9 — Performance Display
 * 
 * Formats performance metrics for CLI display.
 */

import { loadPerformanceReport } from './perf.report.js';

/**
 * Format performance metrics for display
 * 
 * @param {Object} report - Performance report
 * @returns {string} Formatted string
 */
export function formatPerformanceMetrics(report) {
  if (!report) {
    return 'Performance: No report available';
  }
  
  const lines = [];
  lines.push('Performance:');
  
  // Runtime
  const runtimeSec = (report.actual.runtimeMs / 1000).toFixed(1);
  const runtimeBudgetSec = (report.budget.maxRuntimeMs / 1000).toFixed(0);
  const runtimeStatus = report.actual.runtimeMs <= report.budget.maxRuntimeMs ? 'OK' : 'EXCEEDED';
  lines.push(`  Runtime: ${runtimeSec}s / ${runtimeBudgetSec}s ${runtimeStatus}`);
  
  // Memory
  const memoryMB = (report.actual.memoryRSS / (1024 * 1024)).toFixed(0);
  const memoryBudgetMB = (report.budget.maxMemoryRSS / (1024 * 1024)).toFixed(0);
  const memoryStatus = report.actual.memoryRSS <= report.budget.maxMemoryRSS ? 'OK' : 'EXCEEDED';
  lines.push(`  Memory: ${memoryMB}MB / ${memoryBudgetMB}MB ${memoryStatus}`);
  
  // Pages
  const pagesStatus = report.actual.pagesVisited <= report.budget.maxPagesVisited ? 'OK' : 'EXCEEDED';
  lines.push(`  Pages: ${report.actual.pagesVisited} / ${report.budget.maxPagesVisited} ${pagesStatus}`);
  
  // Interactions
  const interactionsStatus = report.actual.interactionsExecuted <= report.budget.maxInteractionsExecuted ? 'OK' : 'EXCEEDED';
  lines.push(`  Interactions: ${report.actual.interactionsExecuted} / ${report.budget.maxInteractionsExecuted} ${interactionsStatus}`);
  
  // Verdict
  const verdictSymbol = report.verdict === 'OK' ? '✅' : report.verdict === 'DEGRADED' ? '⚠️' : '❌';
  lines.push(`Verdict: ${verdictSymbol} ${report.verdict}`);
  
  return lines.join('\n');
}

/**
 * Display performance metrics in inspect command
 * 
 * @param {string} projectDir - Project directory
 * @param {string} runId - Run ID
 */
export function displayPerformanceInInspect(projectDir, runId) {
  const report = loadPerformanceReport(projectDir, runId);
  
  if (!report) {
    return;
  }
  
  console.log('\n' + formatPerformanceMetrics(report));
}

