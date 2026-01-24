// @ts-expect-error - TypeScript module resolution issue with time-provider path
import { getTimeProvider } from '../../../../cli/util/support/time-provider.js';
/**
 * PHASE 21.10 — Decision Trace
 * 
 * Traces why each finding was detected, which signals contributed,
 * which guardrails applied, and why confidence/status decisions were made.
 */

import { readFileSync, existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { safeParseJsonFile } from '../../../cli/util/support/atomic-write.js';

/**
 * Build decision trace for findings
 * 
 * @param {string} projectDir - Project directory
 * @param {string} runId - Run ID
 * @returns {Object} Decision trace
 */
export function buildDecisionTrace(projectDir, runId) {
  const runDir = resolve(projectDir, '.verax', 'runs', runId);
  
  if (!existsSync(runDir)) {
    return null;
  }
  
  const findingsPath = resolve(runDir, 'findings.json');
  if (!existsSync(findingsPath)) {
    return null;
  }
  
  // Parse findings with safe validation - reject if corrupt
  const findings = safeParseJsonFile(findingsPath);
  if (!findings) {
    return {
      runId,
      findings: [],
      summary: { total: 0, error: 'FAIL_DATA' },
      generatedAt: getTimeProvider().iso()
    };
  }
  const traces = [];
  
  if (!Array.isArray(findings.findings)) {
    return {
      runId,
      findings: [],
      summary: { total: 0 },
      generatedAt: getTimeProvider().iso()
    };
  }
  
  for (const finding of findings.findings) {
    const findingId = finding.findingId || finding.id || `finding-${traces.length}`;
    
    // Why detected?
    const detectionReasons = [];
    if (finding.type) {
      detectionReasons.push({
        code: 'FINDING_TYPE',
        reason: `Finding type: ${finding.type}`,
        value: finding.type
      });
    }
    if (finding.outcome) {
      detectionReasons.push({
        code: 'OUTCOME_CLASSIFICATION',
        reason: `Outcome: ${finding.outcome}`,
        value: finding.outcome
      });
    }
    if (finding.promise?.type) {
      detectionReasons.push({
        code: 'PROMISE_TYPE',
        reason: `Promise type: ${finding.promise.type}`,
        value: finding.promise.type
      });
    }
    
    // Which signals contributed?
    const signals = [];
    if (finding.evidence?.sensors) {
      const sensors = finding.evidence.sensors;
      
      if (sensors.network) {
        signals.push({
          type: 'NETWORK',
          contributed: sensors.network.totalRequests > 0 || sensors.network.failedRequests > 0,
          data: {
            totalRequests: sensors.network.totalRequests || 0,
            failedRequests: sensors.network.failedRequests || 0
          }
        });
      }
      
      if (sensors.console) {
        signals.push({
          type: 'CONSOLE',
          contributed: (sensors.console.errors || 0) > 0 || (sensors.console.warnings || 0) > 0,
          data: {
            errors: sensors.console.errors || 0,
            warnings: sensors.console.warnings || 0
          }
        });
      }
      
      if (sensors.uiSignals) {
        signals.push({
          type: 'UI_SIGNALS',
          contributed: sensors.uiSignals.diff?.changed === true,
          data: {
            changed: sensors.uiSignals.diff?.changed || false
          }
        });
      }
    }
    
    // Which guardrails applied?
    const guardrailsApplied = [];
    if (finding.guardrails?.appliedRules) {
      for (const rule of finding.guardrails.appliedRules) {
        guardrailsApplied.push({
          ruleId: rule.id || rule,
          category: rule.category || null,
          action: rule.action || null,
          matched: rule.matched || true
        });
      }
    }
    
    // Why confidence = X?
    const confidenceReasons = [];
    if (finding.confidenceLevel) {
      confidenceReasons.push({
        code: 'CONFIDENCE_LEVEL',
        reason: `Confidence level: ${finding.confidenceLevel}`,
        value: finding.confidenceLevel
      });
    }
    if (finding.confidence !== undefined) {
      confidenceReasons.push({
        code: 'CONFIDENCE_SCORE',
        reason: `Confidence score: ${finding.confidence}`,
        value: finding.confidence
      });
    }
    if (finding.confidenceReasons && Array.isArray(finding.confidenceReasons)) {
      for (const reason of finding.confidenceReasons) {
        confidenceReasons.push({
          code: 'CONFIDENCE_FACTOR',
          reason: reason,
          value: reason
        });
      }
    }
    
    // Why status = CONFIRMED / SUSPECTED / DROPPED?
    const statusReasons = [];
    const status = finding.severity || finding.status || 'SUSPECTED';
    
    statusReasons.push({
      code: 'STATUS_ASSIGNED',
      reason: `Status: ${status}`,
      value: status
    });
    
    if (finding.evidencePackage) {
      if (finding.evidencePackage.isComplete) {
        statusReasons.push({
          code: 'EVIDENCE_COMPLETE',
          reason: 'Evidence package is complete',
          value: true
        });
      } else {
        statusReasons.push({
          code: 'EVIDENCE_INCOMPLETE',
          reason: 'Evidence package is incomplete',
          value: false
        });
      }
    }
    
    if (finding.guardrails?.finalDecision) {
      statusReasons.push({
        code: 'GUARDRAILS_DECISION',
        reason: `Guardrails decision: ${finding.guardrails.finalDecision}`,
        value: finding.guardrails.finalDecision
      });
    }
    
    if (status === 'CONFIRMED' && finding.evidencePackage && !finding.evidencePackage.isComplete) {
      statusReasons.push({
        code: 'EVIDENCE_LAW_VIOLATION',
        reason: 'CONFIRMED finding with incomplete evidence violates Evidence Law',
        value: 'VIOLATION'
      });
    }
    
    traces.push({
      findingId,
      detection: {
        why: detectionReasons,
        signals: signals.filter(s => s.contributed),
        expectationId: finding.expectationId || null,
        interactionId: finding.interaction?.selector || null
      },
      guardrails: {
        applied: guardrailsApplied,
        finalDecision: finding.guardrails?.finalDecision || null,
        contradictions: finding.guardrails?.contradictions || []
      },
      confidence: {
        level: finding.confidenceLevel || null,
        score: finding.confidence !== undefined ? finding.confidence : null,
        why: confidenceReasons
      },
      status: {
        value: status,
        why: statusReasons
      },
      evidence: {
        packageId: finding.evidencePackage?.id || null,
        isComplete: finding.evidencePackage?.isComplete || false,
        files: finding.evidencePackage?.files || []
      }
    });
  }
  
  return {
    runId,
    findings: traces,
    summary: {
      total: traces.length,
      byStatus: traces.reduce((acc, t) => {
        const status = t.status.value;
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {}),
      byConfidence: traces.reduce((acc, t) => {
        const level = t.confidence.level || 'UNKNOWN';
        acc[level] = (acc[level] || 0) + 1;
        return acc;
      }, {}),
      withGuardrails: traces.filter(t => t.guardrails.applied.length > 0).length,
      withCompleteEvidence: traces.filter(t => t.evidence.isComplete).length
    },
    generatedAt: getTimeProvider().iso()
  };
}

/**
 * Write decision trace to file
 * 
 * @param {string} projectDir - Project directory
 * @param {string} runId - Run ID
 * @param {Object} trace - Decision trace
 * @returns {string} Path to written file
 */
export function writeDecisionTrace(projectDir, runId, trace) {
  const runDir = resolve(projectDir, '.verax', 'runs', runId);
  const outputPath = resolve(runDir, 'decisions.trace.json');
  writeFileSync(outputPath, JSON.stringify(trace, null, 2), 'utf-8');
  return outputPath;
}

/**
 * Load decision trace from file
 * 
 * @param {string} projectDir - Project directory
 * @param {string} runId - Run ID
 * @returns {Object|null} Decision trace or null
 */
export function loadDecisionTrace(projectDir, runId) {
  const runDir = resolve(projectDir, '.verax', 'runs', runId);
  const tracePath = resolve(runDir, 'decisions.trace.json');
  
  if (!existsSync(tracePath)) {
    return null;
  }
  
  try {
  // @ts-expect-error - readFileSync with encoding returns string
    return JSON.parse(readFileSync(tracePath, 'utf-8'));
  } catch {
    return null;
  }
}




