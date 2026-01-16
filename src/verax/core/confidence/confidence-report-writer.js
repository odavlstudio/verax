/**
 * PHASE 24 — Confidence Report Writer
 * 
 * Writes confidence.report.json artifact per run.
 */

import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { ARTIFACT_REGISTRY } from '../artifacts/registry.js';

/**
 * Write confidence report to disk.
 * 
 * @param {string} runDir - Absolute run directory path
 * @param {Array} findings - Array of findings with confidence data
 * @param {Object} confidenceData - Map of findingIdentity -> confidence computation result
 * @returns {string} Path to written report
 */
export function writeConfidenceReport(runDir, findings, confidenceData = {}) {
  const reportPath = resolve(runDir, ARTIFACT_REGISTRY.confidenceReport.filename);
  
  // Build per-finding entries (deterministic ordering by findingIdentity)
  const perFinding = {};
  const summary = {
    totalFindings: findings.length,
    byConfidenceLevel: {
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      UNPROVEN: 0
    },
    byTruthStatus: {
      CONFIRMED: 0,
      SUSPECTED: 0,
      INFORMATIONAL: 0,
      IGNORED: 0
    },
    invariantViolationsCount: 0,
    averageConfidenceBefore: 0,
    averageConfidenceAfter: 0
  };
  
  let totalConfidenceBefore = 0;
  let totalConfidenceAfter = 0;
  
  for (const finding of findings) {
    const findingIdentity = finding.findingId || finding.id || `finding-${findings.indexOf(finding)}`;
    const confidenceResult = confidenceData[findingIdentity] || null;
    const truthStatus = finding.severity || finding.status || 'SUSPECTED';
    
    const confidenceBefore = confidenceResult?.confidenceBefore || finding.confidence || 0;
    const confidenceAfter = confidenceResult?.confidenceAfter || finding.confidence || 0;
    const confidenceLevel = confidenceResult?.confidenceLevel || finding.confidenceLevel || 'UNPROVEN';
    
    totalConfidenceBefore += confidenceBefore;
    totalConfidenceAfter += confidenceAfter;
    
    // Track by confidence level
    if (summary.byConfidenceLevel[confidenceLevel] !== undefined) {
      summary.byConfidenceLevel[confidenceLevel]++;
    }
    
    // Track by truth status
    if (summary.byTruthStatus[truthStatus] !== undefined) {
      summary.byTruthStatus[truthStatus]++;
    }
    
    // Track invariant violations
    const violations = confidenceResult?.invariantViolations || finding.invariantViolations || [];
    if (violations.length > 0) {
      summary.invariantViolationsCount += violations.length;
    }
    
    // Build per-finding entry
    perFinding[findingIdentity] = {
      confidenceBefore,
      confidenceAfter,
      confidenceLevel,
      truthStatus,
      appliedInvariants: confidenceResult?.appliedInvariants || [],
      invariantViolations: violations.map(v => ({
        code: v.code,
        message: v.message,
        originalConfidence: v.originalConfidence,
        correctedConfidence: v.correctedConfidence || v.corrected
      })),
      explanation: confidenceResult?.explanation || finding.confidenceReasons || [],
      expectationProof: confidenceResult?.expectationProof || finding.expectation?.proof || null,
      verificationStatus: confidenceResult?.verificationStatus || null
    };
  }
  
  // Compute averages
  if (findings.length > 0) {
    summary.averageConfidenceBefore = totalConfidenceBefore / findings.length;
    summary.averageConfidenceAfter = totalConfidenceAfter / findings.length;
  }
  
  // Build report
  const report = {
    version: 1,
    generatedAt: new Date().toISOString(),
    summary,
    perFinding
  };
  
  // Write to disk
  writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  
  return reportPath;
}

