// ⚠️ FROZEN FOR V1 — Not part of VERAX v1 product guarantee
// Post-hoc explanation [ALPHA] — Not core to scan workflow.

/*
Command: verax explain [ALPHA]
Purpose: Generate post-hoc explanation for a specific finding (WHY did it exist).
Required: <runId> <findingId>
Optional: --json
Outputs: Exactly one RESULT/REASON/ACTION block (JSON or text) plus explain/<findingId>.json artifact.
Exit Codes: 0 SUCCESS | 20 FINDINGS | 30 INCOMPLETE | 50 INVARIANT_VIOLATION | 64 USAGE_ERROR
Forbidden: run artifact mutation outside explain/ directory; multiple RESULT blocks; interactive prompts.
*/

import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { generateExplanation } from '../util/explain/explain-engine.js';
import { UsageError, DataError } from '../util/support/errors.js';
import { buildOutcome as _buildOutcome, EXIT_CODES as _EXIT_CODES } from '../config/cli-contract.js';

/**
 * Handler for the explain command
 * @param {Object} options - Command options
 * @param {string} options.projectRoot - Project root directory
 * @param {string} options.runIdArg - Run ID argument
 * @param {string} options.findingIdArg - Finding ID argument
 * @param {boolean} options.json - Output JSON only (skip console)
 * @returns {Promise<Object>} Result with code and message
 */
export async function explainCommand(options) {
  const {
    projectRoot = process.cwd(),
    runIdArg,
    findingIdArg,
    json = false
  } = options;
  
  if (!runIdArg || !findingIdArg) {
    throw new UsageError('explain: requires <runId> and <findingId>\nUsage: verax explain <runId> <findingId> [--json]');
  }
  
  try {
    // Parse arguments (runId can be plain ID or path)
    const runId = runIdArg.replace(/^\.verax\/runs\//, '').replace(/\/$/, '');
    
    // Generate explanation from artifacts
    const explanation = generateExplanation(projectRoot, runId, findingIdArg);
    
    // Write JSON to disk
    const explainDir = resolve(projectRoot, '.verax', 'runs', runId, 'explain');
    mkdirSync(explainDir, { recursive: true });
    const explainPath = resolve(explainDir, `${findingIdArg}.json`);
    writeFileSync(explainPath, JSON.stringify(explanation, null, 2));
    
    // Output
    if (json) {
      // JSON-only output
      console.log(JSON.stringify(explanation, null, 2));
    } else {
      // Console summary
      printExplanationSummary(explanation, explainPath);
    }
    
    return {
      explanation,
      explainPath,
    };
  } catch (error) {
    if (error instanceof DataError) {
      throw error; // Let caller handle with exit code 50 (DataError → INVARIANT_VIOLATION)
    }
    throw error;
  }
}

/**
 * Print human-readable explanation summary to console
 * @param {Object} explanation - Explanation object
 * @param {string} explainPath - Path where explanation was written
 */
function printExplanationSummary(explanation, explainPath) {
  const finding = explanation.finding || {};
  const triggers = explanation.triggers || {};
  const evidence = explanation.evidence || {};
  const confidence = explanation.confidence || {};
  const guidance = explanation.guidance || {};
  
  // Header
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  FINDING EXPLANATION: ${finding.type || 'Unknown'}`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  
  // Finding Identity
  console.log('📌 FINDING IDENTITY');
  console.log(`   ID:         ${finding.id}`);
  console.log(`   Type:       ${finding.type}`);
  console.log(`   Status:     ${finding.status}`);
  console.log(`   Severity:   ${finding.severity}`);
  console.log(`   Confidence: ${formatConfidence(finding.confidence)}`);
  if (finding.selector) {
    console.log(`   Selector:   ${truncate(finding.selector, 60)}`);
  }
  if (finding.interactionType) {
    console.log(`   Interaction: ${finding.interactionType}`);
  }
  console.log('');
  
  // Trigger Conditions
  console.log('⚡ TRIGGER CONDITIONS (Why this finding fired)');
  const conditions = triggers.conditions || [];
  if (conditions.length > 0) {
    for (const cond of conditions) {
      const symbol = cond.value ? '✓' : '✗';
      console.log(`   ${symbol} ${cond.name}: ${cond.value}`);
    }
  } else {
    console.log('   (No trigger conditions recorded)');
  }
  console.log('');
  
  // Evidence Map
  console.log('📦 EVIDENCE');
  const used = evidence.used || [];
  if (used.length > 0) {
    console.log('   Used Evidence:');
    for (const item of used.slice(0, 8)) {
      let desc = `${item.type}`;
      if (item.path) desc += ` - ${truncate(item.path, 50)}`;
      if (item.value) desc += ` - ${truncate(item.value, 50)}`;
      if (item.count) desc += ` (${item.count})`;
      console.log(`     • ${desc}`);
    }
  }
  
  const missing = evidence.missing || [];
  if (missing.length > 0) {
    console.log('');
    console.log('   Missing Evidence:');
    for (const item of missing.slice(0, 4)) {
      console.log(`     • ${item.type} - ${item.reason}`);
    }
  }
  console.log('');
  
  // Confidence Breakdown
  console.log('📊 CONFIDENCE BREAKDOWN');
  console.log(`   Final Confidence: ${formatConfidence(confidence.final)} (${confidence.level})`);
  if (confidence.explanation && confidence.explanation !== 'Engine does not emit per-step breakdown') {
    console.log(`   Explanation: ${confidence.explanation}`);
  }
  console.log('');
  
  // Actionable Guidance
  console.log('💡 NEXT STEPS');
  const nextChecks = guidance.nextChecks || [];
  if (nextChecks.length > 0) {
    for (let i = 0; i < nextChecks.length; i++) {
      console.log(`   ${i + 1}. ${nextChecks[i]}`);
    }
  }
  console.log('');
  
  // Reproduction Info
  console.log('🔄 REPRODUCE THIS FINDING');
  const reproduce = guidance.reproduce || {};
  console.log(`   Run ID:     ${reproduce.runId}`);
  console.log(`   Command:    ${reproduce.command}`);
  if (reproduce.selector && reproduce.selector !== 'N/A') {
    console.log(`   Selector:   ${truncate(reproduce.selector, 60)}`);
  }
  if (reproduce.expectation) {
    console.log(`   Expected:   ${truncate(reproduce.expectation, 60)}`);
  }
  console.log(`   Evidence:   ${reproduce.artifactPaths?.evidenceDir || 'N/A'}`);
  console.log('');
  
  // Footer
  console.log(`✅ Explanation written to:`);
  console.log(`   ${explainPath}`);
  console.log('');
}

/**
 * Format confidence as percentage and level
 * @param {number} value - Confidence value (0-1)
 * @returns {string} Formatted confidence
 */
function formatConfidence(value) {
  if (typeof value !== 'number') return 'Unknown';
  const percent = Math.round(value * 100);
  let level = 'UNPROVEN';
  if (value >= 0.85) level = 'HIGH';
  else if (value >= 0.60) level = 'MEDIUM';
  return `${percent}% (${level})`;
}

/**
 * Truncate string with ellipsis
 * @param {string} str - String to truncate
 * @param {number} max - Max length
 * @returns {string} Truncated string
 */
function truncate(str, max = 50) {
  if (!str) return '';
  if (str.length <= max) return str;
  return str.substring(0, max - 3) + '...';
}
