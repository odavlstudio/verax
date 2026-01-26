/**
 * VERAX Diagnostics Engine (PHASE 5.1)
 * 
 * Post-hoc analysis engine that explains HOW and WHY a run behaved.
 * Evidence-based only: derives diagnostics from existing run artifacts.
 * 
 * Non-negotiables:
 * - No speculation or guessing
 * - Derived solely from .verax/runs/<runId> artifacts
 * - No browser re-execution
 * - No new runtime logging
 * - Deterministic output (same runId => same diagnostics)
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { DataError } from '../support/errors.js';
import { getTimeProvider } from '../support/time-provider.js';

/**
 * Generate diagnostics report from run artifacts
 * @param {string} projectRoot - Project root directory
 * @param {string} runId - Run identifier
 * @returns {Object} Diagnostics report
 */
export function generateDiagnostics(projectRoot, runId) {
  // Locate run directory
  const runDir = resolve(projectRoot, '.verax', 'runs', runId);
  
  if (!existsSync(runDir)) {
    throw new DataError(`Run directory not found: ${runDir}`);
  }
  
  // Load artifacts
  const summary = loadArtifact(runDir, 'summary.json');
  const findings = loadOptionalArtifact(runDir, 'findings.json');
  const traces = loadOptionalArtifact(runDir, 'traces.json');
  const expectations = loadOptionalArtifact(runDir, 'expectations.json');
  
  if (!summary) {
    throw new DataError(`Incomplete run: summary.json not found in ${runDir}`);
  }
  
  // Extract version from summary
  const veraxVersion = summary.meta?.version || 'unknown';
  const timeProvider = getTimeProvider();
  
  // Build diagnostics report
  const diagnostics = {
    meta: {
      runId,
      veraxVersion,
      generatedAt: timeProvider.iso(),
      runCompletedAt: summary.meta?.timestamp || null,
    },
    timing: extractTimingDiagnostics(summary, traces),
    skips: extractSkipsDiagnostics(summary, expectations),
    coverage: extractCoverageDiagnostics(summary, traces, findings),
    signals: extractFlakinesSignals(summary, traces),
    environment: extractEnvironmentDiagnostics(summary),
  };
  
  return diagnostics;
}

/**
 * Load artifact JSON file
 * @param {string} runDir - Run directory
 * @param {string} filename - Artifact filename
 * @returns {Object|null} Parsed JSON or null if not found
 */
function loadArtifact(runDir, filename) {
  const path = resolve(runDir, filename);
  if (!existsSync(path)) {
    return null;
  }
  try {
    const content = String(readFileSync(path, 'utf-8'));
    return JSON.parse(content);
  } catch (error) {
    throw new DataError(`Failed to parse ${filename}: ${error.message}`);
  }
}

/**
 * Load optional artifact (returns null if not found, no error)
 */
function loadOptionalArtifact(runDir, filename) {
  try {
    return loadArtifact(runDir, filename);
  } catch (error) {
    return null;
  }
}

/**
 * Extract timing breakdown from artifacts
 */
function extractTimingDiagnostics(summary, traces) {
  const timing = {
    total: {
      durationMs: 0,
      phase: 'complete',
    },
    learn: {
      durationMs: 0,
    },
    observe: {
      durationMs: 0,
    },
    detect: {
      durationMs: 0,
    },
    interactions: {
      count: 0,
      minMs: null,
      maxMs: null,
      avgMs: null,
      slowest: [],
    },
  };
  
  // Extract phase timings from summary.analysis.timeouts
  if (summary.analysis?.timeouts) {
    timing.observe.durationMs = summary.analysis.timeouts.observeMs || 0;
    timing.detect.durationMs = summary.analysis.timeouts.detectMs || 0;
    timing.total.durationMs = summary.analysis.timeouts.totalMs || 0;
    
    // Learn duration: calculated as total - (observe + detect)
    timing.learn.durationMs = Math.max(0, timing.total.durationMs - timing.observe.durationMs - timing.detect.durationMs);
  }
  
  // Extract per-interaction timing from traces
  if (traces && traces.traces && Array.isArray(traces.traces)) {
    const durations = [];
    const slowest = [];
    
    for (const trace of traces.traces) {
      // Calculate interaction duration from evidence timing
      if (trace.evidence?.timing?.startedAt && trace.evidence?.timing?.endedAt) {
        const start = Date.parse(trace.evidence.timing.startedAt);
        const end = Date.parse(trace.evidence.timing.endedAt);
        const durationMs = end - start;
        
        durations.push(durationMs);
        slowest.push({
          expectationId: trace.id || 'unknown',
          durationMs,
          selector: trace.selector || trace.promise?.selector || null,
        });
      }
    }
    
    if (durations.length > 0) {
      timing.interactions.count = durations.length;
      timing.interactions.minMs = Math.min(...durations);
      timing.interactions.maxMs = Math.max(...durations);
      timing.interactions.avgMs = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
      
      // Sort slowest and take top 5
      timing.interactions.slowest = slowest
        .sort((a, b) => b.durationMs - a.durationMs)
        .slice(0, 5);
    }
  }
  
  return timing;
}

/**
 * Extract skips and gaps analysis from artifacts
 */
function extractSkipsDiagnostics(summary, expectations) {
  const skips = {
    learn: {
      dynamic: 0,
      params: 0,
      computed: 0,
      external: 0,
      parseError: 0,
      other: 0,
    },
    observe: {
      crossOrigin: 0,
      shadowDOM: 0,
      iframe: 0,
      blockedActions: 0,
      unsafeInteractions: 0,
      externalNavigation: 0,
      timeout: 0,
    },
    runtime: {
      totalSkipped: summary.analysis?.expectationsSkipped || 0,
      reasons: summary.analysis?.skipReasons || {},
      examples: summary.analysis?.skipExamples || {},
    },
  };
  
  // Extract learn phase skips from expectations.json
  if (expectations && expectations.skipped) {
    skips.learn.dynamic = expectations.skipped.dynamic || 0;
    skips.learn.params = expectations.skipped.params || 0;
    skips.learn.computed = expectations.skipped.computed || 0;
    skips.learn.external = expectations.skipped.external || 0;
    skips.learn.parseError = expectations.skipped.parseError || 0;
    skips.learn.other = expectations.skipped.other || 0;
  }
  
  // Extract observe phase skips from summary (these are runtime skip reasons)
  if (summary.analysis?.skipReasons) {
    const reasons = summary.analysis.skipReasons;
    
    // Map skip reasons to categories
    skips.observe.externalNavigation = reasons.EXTERNAL_URL_SKIPPED || 0;
    skips.observe.timeout = reasons.OBSERVATION_TIMEOUT || 0;
    skips.observe.unsafeInteractions = reasons.UNSAFE_INTERACTION || 0;
    
    // Cross-origin, shadow DOM, iframe typically surface as selector mismatches or observation failures
    // We can't distinguish these without more granular tracking, so we report what's available
  }
  
  return skips;
}

/**
 * Extract coverage diagnostics
 */
function extractCoverageDiagnostics(summary, traces, findings) {
  const coverage = {
    expectations: {
      discovered: summary.analysis?.expectationsDiscovered || 0,
      analyzed: summary.analysis?.expectationsAnalyzed || 0,
      skipped: summary.analysis?.expectationsSkipped || 0,
      producingObservations: 0,
      producingFindings: 0,
    },
    findings: {
      total: summary.results?.findingsCount || 0,
      byType: {},
      byConfidence: {
        high: 0,
        medium: 0,
        low: 0,
      },
    },
  };
  
  // Count expectations producing observations from traces
  if (traces && traces.traces && Array.isArray(traces.traces)) {
    coverage.expectations.producingObservations = traces.traces.filter(t => t.observed === true).length;
  }
  
  // Count expectations producing findings
  if (findings && Array.isArray(findings)) {
    const findingExpIds = new Set(findings.map(f => f.expectationId).filter(Boolean));
    coverage.expectations.producingFindings = findingExpIds.size;
    
    // Count findings by type
    for (const finding of findings) {
      const type = finding.type || 'unknown';
      coverage.findings.byType[type] = (coverage.findings.byType[type] || 0) + 1;
      
      // Count by confidence
      const confidence = finding.confidence || 0;
      if (confidence >= 0.7) {
        coverage.findings.byConfidence.high++;
      } else if (confidence >= 0.4) {
        coverage.findings.byConfidence.medium++;
      } else {
        coverage.findings.byConfidence.low++;
      }
    }
  }
  
  return coverage;
}

/**
 * Extract flakiness signals (evidence-only, no labeling)
 */
function extractFlakinesSignals(summary, traces) {
  const signals = {
    lateAcknowledgments: {
      count: 0,
      examples: [],
    },
    timeouts: {
      count: 0,
      examples: [],
    },
    unstableSignals: {
      count: 0,
      examples: [],
    },
    note: 'These are observable signals, not definitive flakiness labels',
  };
  
  if (traces && traces.traces && Array.isArray(traces.traces)) {
    for (const trace of traces.traces) {
      const expId = trace.id || 'unknown';
      
      // Late acknowledgments: outcomeWatcher acknowledged = false with delayedAcknowledgment = true
      if (trace.evidence?.outcomeWatcher) {
        const watcher = trace.evidence.outcomeWatcher;
        if (watcher.acknowledged === false && trace.evidence.signals?.delayedAcknowledgment === true) {
          signals.lateAcknowledgments.count++;
          if (signals.lateAcknowledgments.examples.length < 5) {
            signals.lateAcknowledgments.examples.push({
              expectationId: expId,
              latencyBucket: watcher.latencyBucket || 'unknown',
              duration: watcher.duration || null,
            });
          }
        }
      }
      
      // Timeouts: reason = 'timeout' or policy.timeout = true
      if (trace.reason === 'timeout' || trace.policy?.timeout === true) {
        signals.timeouts.count++;
        if (signals.timeouts.examples.length < 5) {
          signals.timeouts.examples.push({
            expectationId: expId,
            selector: trace.selector || null,
          });
        }
      }
      
      // Unstable signals: DOM changed during settle, or route changed then reverted
      if (trace.dom?.settle?.domChangedDuringSettle === true) {
        signals.unstableSignals.count++;
        if (signals.unstableSignals.examples.length < 5) {
          signals.unstableSignals.examples.push({
            expectationId: expId,
            signal: 'dom_changed_during_settle',
          });
        }
      }
      
      // Route signature changed multiple times (transitions indicate instability)
      if (trace.evidence?.routeData?.transitions && trace.evidence.routeData.transitions.length > 1) {
        signals.unstableSignals.count++;
        if (signals.unstableSignals.examples.length < 5) {
          signals.unstableSignals.examples.push({
            expectationId: expId,
            signal: 'multiple_route_transitions',
            transitionCount: trace.evidence.routeData.transitions.length,
          });
        }
      }
    }
  }
  
  return signals;
}

/**
 * Extract environment and constraints diagnostics
 */
function extractEnvironmentDiagnostics(summary) {
  const environment = {
    framework: 'unknown',
    router: null,
    constraints: {
      readOnly: true, // VERAX is always read-only
      crossOriginBlocked: true, // VERAX always blocks cross-origin
    },
    budgets: {
      maxExpectations: summary.analysis?.budgets?.maxExpectations || null,
      budgetExceeded: summary.analysis?.budgets?.exceeded || false,
    },
    url: summary.meta?.url || null,
    nodeVersion: summary.meta?.node || 'unknown',
    os: summary.meta?.os || 'unknown',
  };
  
  // Framework and router information may be added to summary schema in future versions
  
  return environment;
}
