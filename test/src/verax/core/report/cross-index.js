/**
 * PHASE 21.10 — Artifact Cross-Index
 * 
 * Builds cross-index linking findingId to all related artifacts.
 */

import { readFileSync, existsSync, writeFileSync, readdirSync as _readdirSync } from 'fs';
import { resolve, relative as _relative } from 'path';

/**
 * Build cross-index
 * 
 * @param {string} projectDir - Project directory
 * @param {string} runId - Run ID
 * @returns {Object} Cross-index
 */
export function buildCrossIndex(projectDir, runId) {
  const runDir = resolve(projectDir, '.verax', 'runs', runId);
  
  if (!existsSync(runDir)) {
    return null;
  }
  
  const index = {};
  
  // Load findings
  const findingsPath = resolve(runDir, 'findings.json');
  if (!existsSync(findingsPath)) {
    return {
      runId,
      findings: {},
      summary: { total: 0 },
      generatedAt: new Date().toISOString()
    };
  }
  
  // @ts-expect-error - readFileSync with encoding returns string
  const findings = JSON.parse(readFileSync(findingsPath, 'utf-8'));
  const _evidenceIndex = loadArtifact(runDir, 'evidence.index.json');
  const decisionTrace = loadArtifact(runDir, 'decisions.trace.json');
  const timeline = loadArtifact(runDir, 'run.timeline.json');
  const failureLedger = loadArtifact(runDir, 'failure.ledger.json');
  const performanceReport = loadArtifact(runDir, 'performance.report.json');
  
  if (!Array.isArray(findings.findings)) {
    return {
      runId,
      findings: {},
      summary: { total: 0 },
      generatedAt: new Date().toISOString()
    };
  }
  
  for (const finding of findings.findings) {
    const findingId = finding.findingId || finding.id || `finding-${Object.keys(index).length}`;
    
    const entry = {
      findingId,
      type: finding.type || null,
      status: finding.severity || finding.status || null,
      
      // Evidence files
      evidence: {
        packageId: finding.evidencePackage?.id || null,
        files: finding.evidencePackage?.files || [],
        isComplete: finding.evidencePackage?.isComplete || false,
        beforeScreenshot: finding.evidence?.before || null,
        afterScreenshot: finding.evidence?.after || null
      },
      
      // Confidence reasons
      confidence: {
        level: finding.confidenceLevel || null,
        score: finding.confidence !== undefined ? finding.confidence : null,
        reasons: finding.confidenceReasons || [],
        trace: decisionTrace?.findings?.find(t => t.findingId === findingId)?.confidence || null
      },
      
      // Guardrails rules
      guardrails: {
        applied: finding.guardrails?.appliedRules?.map(r => ({
          id: r.id || r,
          category: r.category || null,
          action: r.action || null
        })) || [],
        finalDecision: finding.guardrails?.finalDecision || null,
        contradictions: finding.guardrails?.contradictions || [],
        trace: decisionTrace?.findings?.find(t => t.findingId === findingId)?.guardrails || null
      },
      
      // Failures (if any related)
      failures: failureLedger?.failures?.filter(f => 
        f.context?.findingId === findingId || 
        f.message?.includes(findingId)
      ).map(f => ({
        code: f.code,
        message: f.message,
        severity: f.severity,
        timestamp: f.timestamp
      })) || [],
      
      // Performance impacts (if any)
      performance: performanceReport?.violations?.some(v => 
        v.message?.includes(findingId)
      ) ? {
        impacted: true,
        violations: performanceReport.violations.filter(v => 
          v.message?.includes(findingId)
        )
      } : null,
      
      // Timeline entries
      timeline: timeline?.events?.filter(e => 
        e.data?.findingId === findingId ||
        (e.event === 'guardrails_applied' && e.data?.findingId === findingId) ||
        (e.event === 'evidence_enforced' && e.data?.findingId === findingId)
      ).map(e => ({
        timestamp: e.timestamp,
        phase: e.phase,
        event: e.event,
        data: e.data
      })) || []
    };
    
    index[findingId] = entry;
  }
  
  return {
    runId,
    findings: index,
    summary: {
      total: Object.keys(index).length,
      withEvidence: Object.values(index).filter(e => e.evidence.files.length > 0).length,
      withGuardrails: Object.values(index).filter(e => e.guardrails.applied.length > 0).length,
      withFailures: Object.values(index).filter(e => e.failures.length > 0).length,
      withTimeline: Object.values(index).filter(e => e.timeline.length > 0).length
    },
    generatedAt: new Date().toISOString()
  };
}

/**
 * Load artifact JSON
 */
function loadArtifact(runDir, filename) {
  const path = resolve(runDir, filename);
  if (!existsSync(path)) {
    return null;
  }
  try {
  // @ts-expect-error - readFileSync with encoding returns string
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Write cross-index to file
 * 
 * @param {string} projectDir - Project directory
 * @param {string} runId - Run ID
 * @param {Object} index - Cross-index
 * @returns {string} Path to written file
 */
export function writeCrossIndex(projectDir, runId, index) {
  const runDir = resolve(projectDir, '.verax', 'runs', runId);
  const outputPath = resolve(runDir, 'artifacts.index.json');
  writeFileSync(outputPath, JSON.stringify(index, null, 2), 'utf-8');
  return outputPath;
}

/**
 * Load cross-index from file
 * 
 * @param {string} projectDir - Project directory
 * @param {string} runId - Run ID
 * @returns {Object|null} Cross-index or null
 */
export function loadCrossIndex(projectDir, runId) {
  const runDir = resolve(projectDir, '.verax', 'runs', runId);
  const indexPath = resolve(runDir, 'artifacts.index.json');
  
  if (!existsSync(indexPath)) {
    return null;
  }
  
  try {
  // @ts-expect-error - readFileSync with encoding returns string
    return JSON.parse(readFileSync(indexPath, 'utf-8'));
  } catch {
    return null;
  }
}

