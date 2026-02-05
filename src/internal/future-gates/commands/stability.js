// ⚠️ FROZEN FOR V1 — Not part of VERAX v1 product guarantee
// Stability metrics [ALPHA] — Not core to scan workflow.

/*
Command: verax stability [ALPHA]
Purpose: Generate stability metrics for a single run from existing artifacts.
Required: <runId>
Optional: --json
Outputs: Exactly one RESULT/REASON/ACTION block (JSON or text) plus stability.json artifact.
Exit Codes: 0 SUCCESS | 20 FINDINGS | 30 INCOMPLETE | 50 INVARIANT_VIOLATION | 64 USAGE_ERROR
Forbidden: run artifact mutation outside stability.json; multiple RESULT blocks; interactive prompts.
*/

import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { generateRunStability } from '../util/stability/stability-engine.js';
import { UsageError, DataError } from '../util/support/errors.js';
import { buildOutcome as _buildOutcome, EXIT_CODES as _EXIT_CODES } from '../config/cli-contract.js';

/**
 * Handler for the stability command
 * @param {Object} options - Command options
 * @param {string} options.projectRoot - Project root directory
 * @param {string} options.runId - Run ID argument
 * @param {boolean} options.json - Output JSON only
 * @returns {Promise<Object>} Result with code and message
 */
export async function stabilityCommand(options) {
  const {
    projectRoot = process.cwd(),
    runId,
    json = false
  } = options;
  
  if (!runId) {
    throw new UsageError('stability: requires <runId>\nUsage: verax stability <runId> [--json]');
  }
  
  try {
    // Parse runId (can be plain ID or path)
    const parsedRunId = runId.replace(/^\.verax\/runs\//, '').replace(/\/$/, '');
    
    // Generate stability metrics from artifacts
    const stability = generateRunStability(projectRoot, parsedRunId);
    
    // Write JSON to disk
    const stabilityDir = resolve(projectRoot, '.verax', 'runs', parsedRunId);
    mkdirSync(stabilityDir, { recursive: true });
    const stabilityPath = resolve(stabilityDir, 'stability.json');
    writeFileSync(stabilityPath, JSON.stringify(stability, null, 2));
    
    // Output
    if (json) {
      // JSON-only output
      console.log(JSON.stringify(stability, null, 2));
    } else {
      // Console summary
      printStabilitySummary(stability, stabilityPath);
    }
    
    return {
      stability,
      stabilityPath,
    };
  } catch (error) {
    if (error instanceof DataError) {
      throw error; // Let caller handle with exit code 50 (DataError → INVARIANT_VIOLATION)
    }
    throw error;
  }
}

/**
 * Print human-readable stability summary to console
 * @param {Object} stability - Stability metrics
 * @param {string} stabilityPath - Path where stability.json was written
 */
function printStabilitySummary(stability, stabilityPath) {
  const findings = stability.findings || {};
  const observations = stability.observations || {};
  const timing = stability.timing || {};
  const toolHealth = stability.toolHealth || {};
  
  // Header
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  STABILITY METRICS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  
  // Findings Summary
  console.log('📊 FINDINGS');
  console.log(`   Count:        ${findings.count}`);
  console.log(`   Signature:    ${findings.signatureHash}`);
  console.log(`   By Type:      ${formatCounts(findings.byType)}`);
  console.log(`   By Status:    ${formatCounts(findings.byStatus)}`);
  console.log(`   By Confidence:`);
  console.log(`     • High:     ${findings.byConfidence?.high || 0}`);
  console.log(`     • Medium:   ${findings.byConfidence?.medium || 0}`);
  console.log(`     • Low:      ${findings.byConfidence?.low || 0}`);
  console.log('');
  
  // Observations Summary
  console.log('👁️ OBSERVATIONS');
  console.log(`   Expectations Executed: ${observations.expectationsExecuted}`);
  console.log(`   Observations Recorded: ${observations.observationsRecorded}`);
  console.log(`   Observation Ratio:     ${(observations.observationRatio * 100).toFixed(1)}%`);
  console.log(`   Key Signals:`);
  const signals = observations.signalCounts || {};
  console.log(`     • Route Changed:         ${signals.routeChanged || 0}`);
  console.log(`     • Outcome Acknowledged:  ${signals.outcomeAcknowledged || 0}`);
  console.log(`     • Meaningful UI Change:  ${signals.meaningfulUIChange || 0}`);
  console.log(`     • Delayed Acknowledgment: ${signals.delayedAcknowledgment || 0}`);
  console.log('');
  
  // Timing Summary
  console.log('⏱️ TIMING');
  console.log(`   Total Duration:    ${formatDuration(timing.totalMs)}`);
  console.log(`     • Learn Phase:   ${formatDuration(timing.learnMs)}`);
  console.log(`     • Observe Phase: ${formatDuration(timing.observeMs)}`);
  console.log(`     • Detect Phase:  ${formatDuration(timing.detectMs)}`);
  const perInt = timing.perInteraction || {};
  console.log(`   Per-Interaction (${perInt.count} total):`);
  console.log(`     • Min:    ${formatDuration(perInt.minMs)}`);
  console.log(`     • Max:    ${formatDuration(perInt.maxMs)}`);
  console.log(`     • Avg:    ${formatDuration(perInt.avgMs)}`);
  console.log(`     • Spread: ${(perInt.spreadCv || 0).toFixed(2)} (CV)`);
  console.log('');
  
  // Tool Health
  console.log('🔧 TOOL HEALTH');
  console.log(`   State:          ${toolHealth.state}`);
  console.log(`   Timed Out:      ${toolHealth.timedOut ? 'YES' : 'NO'}`);
  console.log(`   Incomplete:     ${toolHealth.isIncomplete ? 'YES' : 'NO'}`);
  console.log('');
  
  // Footer
  console.log(`✅ Stability metrics written to:`);
  console.log(`   ${stabilityPath}`);
  console.log('');
}

/**
 * Format duration in milliseconds as human string
 * @param {number} ms - Milliseconds
 * @returns {string} Formatted duration
 */
function formatDuration(ms) {
  if (typeof ms !== 'number') return '0ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Format object counts as human string
 * @param {Object} counts - Object with counts
 * @returns {string} Formatted string
 */
function formatCounts(counts = {}) {
  if (Object.keys(counts).length === 0) return 'None';
  return Object.entries(counts)
    .map(([key, val]) => `${key}=${val}`)
    .join(', ');
}
