/**
 * STAGE 6.5: CLI UX Law
 * 
 * Three clear output lines:
 * 1. RESULT: Clear, one-line status
 * 2. REASON: Why (evidence-based)
 * 3. ACTION: What to do next
 * 
 * All outputs are human-readable and deterministic.
 */

import { getTimeProvider } from '../support/time-provider.js';

/**
 * Format CLI result line
 * @param {Object} summary
 * @param {Array} findings
 * @returns {string} One-line result
 */
export function formatResultLine(summary, findings = []) {
  const status = summary?.status || 'UNKNOWN';
  const findingCount = findings?.length || 0;
  const seal = summary?.productionSeal ? ' [PRODUCTION_GRADE]' : '';
  
  const resultMap = {
    'COMPLETE': `✅ COMPLETE: Flow executed successfully with ${findingCount} finding(s)${seal}`,
    'INCOMPLETE': `⚠️  INCOMPLETE: Flow was interrupted`,
    'FAILED': `❌ FAILED: ${findingCount} critical issue(s) detected${seal}`,
    'TIMEOUT': `⏱️  TIMEOUT: Execution exceeded time limit`,
    'RUNNING': `⏳ RUNNING: Execution in progress`,
  };
  
  return resultMap[status] || `❓ UNKNOWN: ${status}`;
}

/**
 * Format CLI reason line
 * Explain why in one concise line
 * @param {Object} summary
 * @param {Array} findings
 * @param {Object} coverage
 * @returns {string} One-line reason
 */
export function formatReasonLine(summary, findings = [], coverage = {}) {
  const status = summary?.status || 'UNKNOWN';
  const findingCount = findings?.length || 0;
  const coverageRatio = coverage?.coverageRatio || 0;
  
  // Build reason based on status and findings
  if (status === 'COMPLETE' && findingCount === 0) {
    return `REASON: All expectations met. Coverage: ${(coverageRatio * 100).toFixed(1)}%`;
  }
  
  if (status === 'COMPLETE' && findingCount > 0) {
    const highCount = findings.filter(f => f.confidence?.severity === 'HIGH').length;
    return `REASON: ${findingCount} finding(s) detected (${highCount} high severity). Coverage: ${(coverageRatio * 100).toFixed(1)}%`;
  }
  
  if (status === 'INCOMPLETE') {
    const reason = summary?.incompleteReasons?.[0] || 'Flow was not completed';
    return `REASON: ${reason}`;
  }
  
  if (status === 'TIMEOUT') {
    return `REASON: Execution exceeded timeout limit. Increase timeout or optimize slow interactions.`;
  }
  
  if (status === 'FAILED') {
    const reason = summary?.notes || `${findingCount} critical issue(s) blocked completion`;
    return `REASON: ${reason}`;
  }
  
  return `REASON: Status is ${status}`;
}

/**
 * Format CLI action line
 * What should the user do next
 * @param {Object} summary
 * @param {Array} findings
 * @param {Object} coverage
 * @returns {string} One-line action
 */
export function formatActionLine(summary, findings = [], coverage = {}) {
  const status = summary?.status || 'UNKNOWN';
  const findingCount = findings?.length || 0;
  const coverageRatio = coverage?.coverageRatio || 0;
  
  if (status === 'COMPLETE' && findingCount === 0 && coverageRatio > 0.9) {
    return `ACTION: Flow is healthy. Run again to verify determinism. 🚀`;
  }
  
  if (findingCount > 0) {
    const criticalCount = findings.filter(f => f.confidence?.severity === 'CRITICAL').length;
    const highCount = findings.filter(f => f.confidence?.severity === 'HIGH').length;
    
    if (criticalCount > 0) {
      return `ACTION: Fix ${criticalCount} critical issue(s) before release. See summary.`;
    }
    
    if (highCount > 0) {
      return `ACTION: Review ${highCount} high-severity issues. Run 'verax inspect' for details.`;
    }
    
    return `ACTION: Review findings and update expectations if needed.`;
  }
  
  if (status === 'INCOMPLETE') {
    return `ACTION: Complete the flow execution or increase timeout.`;
  }
  
  if (status === 'TIMEOUT') {
    return `ACTION: Increase timeout or optimize slow interactions.`;
  }
  
  if (status === 'FAILED') {
    return `ACTION: Fix errors and rerun. Check logs for details.`;
  }
  
  return `ACTION: Review run details with 'verax inspect'.`;
}

/**
 * Format complete CLI output
 * Three clear lines: RESULT, REASON, ACTION
 * @param {Object} context
 * @returns {string} Formatted output
 */
export function formatCliOutput(context = {}) {
  const { summary = {}, findings = [], coverage = {}, displayRunName = '' } = context;
  
  const lines = [];
  
  // Run identification
  if (displayRunName) {
    lines.push(`📊 ${displayRunName}`);
    lines.push('');
  }
  
  // Three required lines
  lines.push(formatResultLine(summary, findings));
  lines.push('');
  lines.push(formatReasonLine(summary, findings, coverage));
  lines.push('');
  lines.push(formatActionLine(summary, findings, coverage));
  lines.push('');
  
  // Artifacts location
  if (context.artifactDir) {
    lines.push(`📁 Artifacts: ${context.artifactDir}`);
  }
  
  return lines.join('\n');
}

/**
 * Format compact one-liner status for progress output
 * @param {Object} summary
 * @param {Array} findings
 * @returns {string}
 */
export function formatStatusOneLiner(summary = {}, findings = []) {
  const status = summary.status || 'UNKNOWN';
  const findingCount = findings?.length || 0;
  const seal = summary.productionSeal ? '🔒' : '';
  
  const emoji = {
    'COMPLETE': '✅',
    'INCOMPLETE': '⚠️',
    'FAILED': '❌',
    'TIMEOUT': '⏱️',
    'RUNNING': '⏳',
  }[status] || '❓';
  
  return `${emoji} ${status} (${findingCount} findings)${seal ? ' ' + seal : ''}`;
}

/**
 * Format findings summary for CLI (no verbose output)
 * @param {Array} findings
 * @returns {string}
 */
export function formatFindingsSummary(findings = []) {
  if (findings.length === 0) {
    return '✅ No findings';
  }
  
  const bySeverity = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
  };
  
  for (const finding of findings) {
    const sev = finding.confidence?.severity || 'MEDIUM';
    if (Object.prototype.hasOwnProperty.call(bySeverity, sev)) {
      bySeverity[sev]++;
    }
  }
  
  const parts = [];
  if (bySeverity.CRITICAL > 0) parts.push(`🔴 ${bySeverity.CRITICAL} critical`);
  if (bySeverity.HIGH > 0) parts.push(`🟠 ${bySeverity.HIGH} high`);
  if (bySeverity.MEDIUM > 0) parts.push(`🟡 ${bySeverity.MEDIUM} medium`);
  if (bySeverity.LOW > 0) parts.push(`🟢 ${bySeverity.LOW} low`);
  
  return parts.join(' | ');
}

/**
 * Format coverage for CLI
 * @param {Object} coverage
 * @returns {string}
 */
export function formatCoverageCliLine(coverage = {}) {
  if (!coverage.coverageRatio) {
    return 'Coverage: unknown';
  }
  
  const ratio = coverage.coverageRatio;
  const r = Number(ratio || 0);
  const percent = (r * 100).toFixed(1);
  const minCov = Number(coverage.minCoverage || 0.9);
  const minPercent = (minCov * 100).toFixed(0);
  
  const bar = buildBar(r, 20);
  
  if (ratio >= minCov) {
    return `Coverage: ${bar} ${percent}% ✅ (≥${minPercent}%)`;
  } else {
    return `Coverage: ${bar} ${percent}% ⚠️ (<${minPercent}%)`;
  }
}

/**
 * Build simple bar chart for display
 * @param {number} ratio - 0-1
 * @param {number} width - number of characters
 * @returns {string}
 */
function buildBar(ratio, width = 20) {
  const r = Number(ratio || 0);
  const filled = Math.round(r * width);
  const empty = width - filled;
  return `[${('█'.repeat(filled) + '░'.repeat(empty))}]`;
}

/**
 * Format timing information
 * @param {string} startedAt - ISO time
 * @param {string} completedAt - ISO time
 * @returns {string}
 */
export function formatTiming(startedAt, completedAt) {
  if (!startedAt || !completedAt) {
    return 'Duration: unknown';
  }
  
  try {
    const tp = getTimeProvider();
    const startMs = tp.parse(startedAt);
    const endMs = tp.parse(completedAt);
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) return 'Duration: unknown';
    const ms = endMs - startMs;
    
    if (ms < 1000) {
      return `Duration: ${ms}ms`;
    }
    
    if (ms < 60000) {
      return `Duration: ${(ms / 1000).toFixed(1)}s`;
    }
    
    const mins = (ms / 60000).toFixed(1);
    return `Duration: ${mins}min`;
  } catch {
    return 'Duration: unknown';
  }
}

/**
 * Format exit code explanation
 * @param {number} exitCode
 * @returns {string}
 */
export function formatExitCodeExplanation(exitCode) {
  const explanations = {
    0: 'Success',
    1: 'General error',
    2: 'Internal crash',
    64: 'Invalid CLI usage',
    65: 'Invalid input data',
    66: 'Input file not found',
    67: 'Internal software error',
    70: 'Software error',
  };
  
  return explanations[exitCode] || `Exit code ${exitCode}`;
}
