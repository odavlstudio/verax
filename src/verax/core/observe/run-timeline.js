/**
 * PHASE 21.10 — Unified Run Timeline
 * 
 * Builds chronological timeline of all events in a run.
 */

import { getTimeProvider } from '../../../cli/util/support/time-provider.js';

import { resolve } from 'path';
import { existsSync, writeFileSync, readFileSync } from 'fs';

/**
 * Load artifact JSON
 */
function loadArtifact(runDir, filename) {
  const path = resolve(runDir, filename);
  if (!existsSync(path)) {
    return null;
  }
  try {
    const content = /** @type {string} */ (readFileSync(path, 'utf-8'));
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Build timeline from run artifacts
 * 
 * @param {string} projectDir - Project directory
 * @param {string} runId - Run ID
 * @returns {Object} Timeline object
 */
export function buildRunTimeline(projectDir, runId, timeProvider = getTimeProvider()) {
  const runDir = resolve(projectDir, '.verax', 'runs', runId);
  
  if (!existsSync(runDir)) {
    return null;
  }
  
  const timeline = [];
  
  // Load summary for phase timestamps
  const summary = loadArtifact(runDir, 'summary.json');
  const runStatus = loadArtifact(runDir, 'run.status.json');
  const decisions = loadArtifact(runDir, 'decisions.json');
  const failureLedger = loadArtifact(runDir, 'failure.ledger.json');
  const performanceReport = loadArtifact(runDir, 'performance.report.json');
  const findings = loadArtifact(runDir, 'findings.json');
  
  // Extract timestamps
  const startedAt = summary?.startedAt || runStatus?.startedAt;
  const completedAt = summary?.completedAt || runStatus?.completedAt;
  
  // Phase events
  if (startedAt) {
    timeline.push({
      timestamp: startedAt,
      phase: 'RUN_START',
      event: 'run_started',
      data: {
        runId,
        url: summary?.url || null
      }
    });
  }
  
  // LEARN phase
  if (summary?.metrics?.learnMs) {
    timeline.push({
      timestamp: startedAt || null,
      phase: 'LEARN',
      event: 'phase_started',
      data: {
        durationMs: summary.metrics.learnMs
      }
    });
    timeline.push({
      timestamp: startedAt ? timeProvider.addMs(startedAt, summary.metrics.learnMs) : null,
      phase: 'LEARN',
      event: 'phase_completed',
      data: {
        durationMs: summary.metrics.learnMs,
        expectationsFound: summary.digest?.expectationsTotal || 0
      }
    });
  }

  // OBSERVE phase
  if (summary?.metrics?.observeMs) {
    const observeStart = startedAt ? timeProvider.addMs(startedAt, summary.metrics.learnMs || 0) : null;
    timeline.push({
      timestamp: observeStart,
      phase: 'OBSERVE',
      event: 'phase_started',
      data: {
        durationMs: summary.metrics.observeMs
      }
    });
    timeline.push({
      timestamp: observeStart ? timeProvider.addMs(observeStart, summary.metrics.observeMs) : null,
      phase: 'OBSERVE',
      event: 'phase_completed',
      data: {
        durationMs: summary.metrics.observeMs,
        interactionsExecuted: summary.digest?.attempted || 0,
        pagesVisited: summary.digest?.pagesVisited || 0
      }
    });
  }

  // DETECT phase
  if (summary?.metrics?.detectMs) {
    const detectStart = startedAt ? timeProvider.addMs(startedAt, (summary.metrics.learnMs || 0) + (summary.metrics.observeMs || 0)) : null;
    timeline.push({
      timestamp: detectStart,
      phase: 'DETECT',
      event: 'phase_started',
      data: {
        durationMs: summary.metrics.detectMs
      }
    });
    timeline.push({
      timestamp: detectStart ? timeProvider.addMs(detectStart, summary.metrics.detectMs) : null,
      phase: 'DETECT',
      event: 'phase_completed',
      data: {
        durationMs: summary.metrics.detectMs,
        findingsDetected: Array.isArray(findings?.findings) ? findings.findings.length : 0
      }
    });
  }
  
  // Adaptive events from decisions
  if (decisions?.adaptiveEvents) {
    for (const event of decisions.adaptiveEvents) {
      timeline.push({
        timestamp: event.timestamp || null,
        phase: event.phase || 'UNKNOWN',
        event: 'adaptive_decision',
        data: {
          decisionId: event.decisionId,
          reason: event.reason,
          context: event.context || {}
        }
      });
    }
  }
  
  // Budget violations from performance report
  if (performanceReport?.violations) {
    for (const violation of performanceReport.violations) {
      timeline.push({
        timestamp: performanceReport.generatedAt || null,
        phase: 'PERFORMANCE',
        event: 'budget_violation',
        severity: 'BLOCKING',
        data: {
          type: violation.type,
          actual: violation.actual,
          budget: violation.budget,
          message: violation.message
        }
      });
    }
  }
  
  if (performanceReport?.warnings) {
    for (const warning of performanceReport.warnings) {
      timeline.push({
        timestamp: performanceReport.generatedAt || null,
        phase: 'PERFORMANCE',
        event: 'budget_warning',
        severity: 'DEGRADED',
        data: {
          type: warning.type,
          actual: warning.actual,
          budget: warning.budget,
          message: warning.message
        }
      });
    }
  }
  
  // Guardrails applied (from findings)
  if (findings?.findings) {
    for (const finding of findings.findings) {
      if (finding.guardrails?.appliedRules && finding.guardrails.appliedRules.length > 0) {
        timeline.push({
          timestamp: finding.timestamp || null,
          phase: 'DETECT',
          event: 'guardrails_applied',
          data: {
            findingId: finding.findingId || finding.id,
            rules: finding.guardrails.appliedRules.map(r => r.id || r),
            finalDecision: finding.guardrails.finalDecision
          }
        });
      }
    }
  }
  
  // Evidence enforcement (from findings)
  if (findings?.findings) {
    for (const finding of findings.findings) {
      if (finding.evidencePackage) {
        timeline.push({
          timestamp: finding.timestamp || null,
          phase: 'DETECT',
          event: 'evidence_enforced',
          data: {
            findingId: finding.findingId || finding.id,
            isComplete: finding.evidencePackage.isComplete,
            status: finding.severity || finding.status
          }
        });
      }
    }
  }
  
  // Failures from failure ledger
  if (failureLedger?.failures) {
    for (const failure of failureLedger.failures) {
      timeline.push({
        timestamp: failure.timestamp || (startedAt ? timeProvider.addMs(startedAt, failure.relativeTime || 0) : null),
        phase: failure.phase || 'UNKNOWN',
        event: 'failure_recorded',
        severity: failure.severity || 'WARNING',
        data: {
          code: failure.code,
          message: failure.message,
          category: failure.category,
          recoverable: failure.recoverable
        }
      });
    }
  }
  
  // Run completion
  if (completedAt) {
    timeline.push({
      timestamp: completedAt,
      phase: 'RUN_COMPLETE',
      event: 'run_completed',
      data: {
        status: summary?.status || runStatus?.status || 'UNKNOWN',
        totalDurationMs: startedAt && completedAt ? timeProvider.parse(completedAt) - timeProvider.parse(startedAt) : null
      }
    });
  }
  
  // Sort by timestamp
  timeline.sort((a, b) => {
    if (!a.timestamp && !b.timestamp) return 0;
    if (!a.timestamp) return 1;
    if (!b.timestamp) return -1;
    const timeA = timeProvider.parse(a.timestamp);
    const timeB = timeProvider.parse(b.timestamp);
    return timeA - timeB;
  });
  
  return {
    runId,
    startedAt,
    completedAt,
    events: timeline,
    summary: {
      totalEvents: timeline.length,
      byPhase: timeline.reduce((acc, e) => {
        acc[e.phase] = (acc[e.phase] || 0) + 1;
        return acc;
      }, {}),
      byEvent: timeline.reduce((acc, e) => {
        acc[e.event] = (acc[e.event] || 0) + 1;
        return acc;
      }, {}),
      blockingViolations: timeline.filter(e => e.severity === 'BLOCKING').length,
      degradedWarnings: timeline.filter(e => e.severity === 'DEGRADED').length
    },
    generatedAt: getTimeProvider().iso()
  };
}

/**
 * Write timeline to file
 * 
 * @param {string} projectDir - Project directory
 * @param {string} runId - Run ID
 * @param {Object} timeline - Timeline object
 * @returns {string} Path to written file
 */
export function writeRunTimeline(projectDir, runId, timeline) {
  const runDir = resolve(projectDir, '.verax', 'runs', runId);
  const outputPath = resolve(runDir, 'run.timeline.json');
  writeFileSync(outputPath, JSON.stringify(timeline, null, 2), 'utf-8');
  return outputPath;
}

/**
 * Load timeline from file
 * 
 * @param {string} projectDir - Project directory
 * @param {string} runId - Run ID
 * @returns {Object|null} Timeline or null
 */
export function loadRunTimeline(projectDir, runId) {
  const runDir = resolve(projectDir, '.verax', 'runs', runId);
  const timelinePath = resolve(runDir, 'run.timeline.json');
  
  if (!existsSync(timelinePath)) {
    return null;
  }
  
  try {
    const content = /** @type {string} */ (readFileSync(timelinePath, 'utf-8'));
    return JSON.parse(content);
  } catch {
    return null;
  }
}




