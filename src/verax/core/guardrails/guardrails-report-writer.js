/**
 * PHASE 23 — Guardrails Report Writer
 * 
 * Writes guardrails.report.json artifact per run.
 */

import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { ARTIFACT_REGISTRY } from '../artifacts/registry.js';

/**
 * Write guardrails report to disk.
 * 
 * @param {string} runDir - Absolute run directory path
 * @param {Array} findings - Array of findings with guardrails data
 * @param {Object} truthDecisions - Map of findingIdentity -> truthDecision
 * @returns {string} Path to written report
 */
export function writeGuardrailsReport(runDir, findings, truthDecisions = {}) {
  const reportPath = resolve(runDir, ARTIFACT_REGISTRY.guardrailsReport.filename);
  
  // Build per-finding entries (deterministic ordering by findingIdentity)
  const perFinding = {};
  const summary = {
    totalFindings: findings.length,
    byFinalDecision: {
      CONFIRMED: 0,
      SUSPECTED: 0,
      INFORMATIONAL: 0,
      IGNORED: 0
    },
    topRules: {},
    contradictionCount: 0,
    reconciliationCount: 0
  };
  
  for (const finding of findings) {
    const findingIdentity = finding.findingId || finding.id || `finding-${findings.indexOf(finding)}`;
    const guardrails = finding.guardrails || {};
    const truthDecision = truthDecisions[findingIdentity] || null;
    
    const appliedRules = guardrails.appliedRules || [];
    const contradictions = guardrails.contradictions || [];
    const finalDecision = truthDecision?.finalStatus || guardrails.finalDecision || finding.severity || 'SUSPECTED';
    
    // Track top rules
    for (const rule of appliedRules) {
      const ruleCode = rule.code || rule.ruleId || 'unknown';
      summary.topRules[ruleCode] = (summary.topRules[ruleCode] || 0) + 1;
    }
    
    // Track contradictions
    if (contradictions.length > 0) {
      summary.contradictionCount += contradictions.length;
    }
    
    // Track reconciliation
    if (truthDecision && truthDecision.reconciliationReasons.length > 0) {
      summary.reconciliationCount++;
    }
    
    // Track by final decision
    if (summary.byFinalDecision[finalDecision] !== undefined) {
      summary.byFinalDecision[finalDecision]++;
    }
    
    // Build per-finding entry
    perFinding[findingIdentity] = {
      appliedRules: appliedRules.map(r => ({
        code: r.code || r.ruleId,
        severity: r.severity,
        category: r.category
      })),
      contradictions: contradictions.map(c => ({
        code: c.code,
        message: c.message
      })),
      finalDecision,
      confidenceDelta: truthDecision?.confidenceDelta || guardrails.confidenceDelta || 0,
      confidenceBefore: truthDecision?.confidenceBefore || finding.confidence || 0,
      confidenceAfter: truthDecision?.confidenceAfter || finding.confidence || 0,
      reconciliationReasons: truthDecision?.reconciliationReasons || [],
      contradictionsResolved: truthDecision?.contradictionsResolved || []
    };
  }
  
  // Sort top rules by count (descending)
  const topRulesSorted = Object.entries(summary.topRules)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([code, count]) => ({ code, count }));
  
  // Build report
  const report = {
    version: 1,
    generatedAt: new Date().toISOString(),
    summary: {
      ...summary,
      topRules: topRulesSorted
    },
    perFinding
  };
  
  // Write to disk
  writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  
  return reportPath;
}

