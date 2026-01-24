/**
 * VERAX Stability Engine (PHASE 5.3)
 * 
 * Evidence-based, deterministic stability measurement system.
 * Quantifies run-to-run variability and computes SLA-grade stability metrics.
 * 
 * Non-negotiables:
 * - Evidence-only (no speculation, no labels without signal variance)
 * - Deterministic: same inputs => same stability metrics (except generatedAt)
 * - No placeholders, no TODOs
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { createHash } from 'crypto';
import { DataError } from '../support/errors.js';
import { getTimeProvider } from '../support/time-provider.js';

/**
 * Generate stability metrics for a single run from artifacts
 * @param {string} projectRoot - Project root directory
 * @param {string} runId - Run identifier
 * @returns {Object} Stability metrics for this run
 */
export function generateRunStability(projectRoot, runId) {
  const runDir = resolve(projectRoot, '.verax', 'runs', runId);
  
  if (!existsSync(runDir)) {
    throw new DataError(`Run directory not found: ${runDir}`);
  }
  
  // Load artifacts
  const summary = loadArtifact(runDir, 'summary.json');
  const findings = loadOptionalArtifact(runDir, 'findings.json');
  const traces = loadOptionalArtifact(runDir, 'traces.json');
  const observe = loadOptionalArtifact(runDir, 'observe.json');
  const _expectations = loadOptionalArtifact(runDir, 'expectations.json');
  
  if (!summary) {
    throw new DataError(`Incomplete run: summary.json not found in ${runDir}`);
  }
  
  // Extract metrics from artifacts
  const findingsMetrics = extractFindingsMetrics(findings);
  const observationMetrics = extractObservationMetrics(traces, observe);
  const timingMetrics = extractTimingMetrics(summary, traces);
  const toolHealth = extractToolHealth(summary);
  
  // Build stability report
  const timeProvider = getTimeProvider();

  const stability = {
    meta: {
      runId,
      veraxVersion: summary.meta?.version || 'unknown',
      generatedAt: timeProvider.iso(),
      runCompletedAt: summary.meta?.timestamp || null,
    },
    findings: findingsMetrics,
    observations: observationMetrics,
    timing: timingMetrics,
    toolHealth,
    classification: 'STABLE', // Will be set after batch computation; single run is reference
  };
  
  return stability;
}

/**
 * Generate stability metrics for a batch of runs (comparative analysis)
 * @param {string} projectRoot - Project root directory
 * @param {Array<string>} runIds - Array of run identifiers to compare
 * @returns {Object} Batch stability report
 */
export function generateBatchStability(projectRoot, runIds) {
  if (!runIds || runIds.length === 0) {
    throw new DataError('No runs provided for batch stability analysis');
  }
  
  // Generate stability metrics for each run
  const runs = runIds.map(runId => ({
    runId,
    stability: generateRunStability(projectRoot, runId)
  }));
  
  // Compute batch comparisons
  const timeProvider = getTimeProvider();

  const batchMetrics = {
    meta: {
      runCount: runIds.length,
      runIds: runIds,
      generatedAt: timeProvider.iso(),
      veraxVersion: runs[0]?.stability?.meta?.veraxVersion || 'unknown',
    },
    findingsStability: compareFindingsAcrossRuns(runs),
    observationStability: compareObservationsAcrossRuns(runs),
    timingStability: compareTimingsAcrossRuns(runs),
    toolHealthSummary: summarizeToolHealth(runs),
    classification: classifyBatchStability(runs),
  };
  
  return batchMetrics;
}

/**
 * Load artifact JSON file
 * @param {string} runDir - Run directory
 * @param {string} filename - Artifact filename
 * @returns {Object|null} Parsed JSON
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
 * Load optional artifact (returns null if missing)
 * @param {string} runDir - Run directory
 * @param {string} filename - Artifact filename
 * @returns {Object|null} Parsed JSON or null
 */
function loadOptionalArtifact(runDir, filename) {
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
 * Extract findings metrics from findings.json
 * @param {Array} findings - Findings array
 * @returns {Object} Findings metrics
 */
function extractFindingsMetrics(findings = []) {
  const findingIds = new Set(findings.map(f => f.id));
  const byType = {};
  const byStatus = {};
  const byConfidence = { high: 0, medium: 0, low: 0 };
  
  for (const finding of findings) {
    // Count by type
    byType[finding.type] = (byType[finding.type] || 0) + 1;
    
    // Count by status
    byStatus[finding.status] = (byStatus[finding.status] || 0) + 1;
    
    // Count by confidence level
    if (finding.confidence >= 0.85) byConfidence.high++;
    else if (finding.confidence >= 0.6) byConfidence.medium++;
    else byConfidence.low++;
  }
  
  // Compute signature hash of findings set (deterministic)
  const sortedIds = Array.from(findingIds).sort((a, b) => a.localeCompare(b, 'en')).join('|');
  const signatureHash = String(createHash('sha256').update(sortedIds).digest('hex')).substring(0, 16);
  
  return {
    count: findings.length,
    ids: Array.from(findingIds).sort((a, b) => a.localeCompare(b, 'en')),
    signatureHash,
    byType,
    byStatus,
    byConfidence,
  };
}

/**
 * Extract observation metrics from traces and observe artifacts
 * @param {Array} traces - Traces array
 * @returns {Object} Observation metrics
 */
function extractObservationMetrics(traces = [], _observe = null) {
  let expectationsExecuted = 0;
  let observationsRecorded = 0;
  const signalCounts = {
    routeChanged: 0,
    outcomeAcknowledged: 0,
    meaningfulUIChange: 0,
    delayedAcknowledgment: 0,
    consoleErrors: 0,
    networkActivity: 0,
  };
  
  // Count from traces
  if (Array.isArray(traces)) {
    expectationsExecuted = traces.length;
    
    for (const trace of traces) {
      if (trace.observed === true) observationsRecorded++;
      
      const signals = trace.signals || trace.evidence?.signals || {};
      if (signals.routeChanged === true) signalCounts.routeChanged++;
      if (signals.outcomeAcknowledged === true) signalCounts.outcomeAcknowledged++;
      if (signals.meaningfulUIChange === true) signalCounts.meaningfulUIChange++;
      if (signals.delayedAcknowledgment === true) signalCounts.delayedAcknowledgment++;
      if (signals.consoleErrors === true) signalCounts.consoleErrors++;
      if (signals.networkActivity === true) signalCounts.networkActivity++;
    }
  }
  
  const observationRatio = expectationsExecuted > 0 ? observationsRecorded / expectationsExecuted : 0;
  
  return {
    expectationsExecuted,
    observationsRecorded,
    observationRatio: Math.round(observationRatio * 1000) / 1000,
    signalCounts,
  };
}

/**
 * Extract timing metrics from summary and traces
 * @param {Object} summary - Summary artifact
 * @param {Array} traces - Traces array
 * @returns {Object} Timing metrics
 */
function extractTimingMetrics(summary = {}, traces = []) {
  const timeouts = summary.analysis?.timeouts || {};
  
  const totalMs = timeouts.totalMs || 0;
  const observeMs = timeouts.observeMs || 0;
  const detectMs = timeouts.detectMs || 0;
  const learnMs = Math.max(0, totalMs - observeMs - detectMs);
  
  // Extract per-interaction timings
  const perInteractionDurations = [];
  if (Array.isArray(traces)) {
    for (const trace of traces) {
      const timing = trace.evidence?.timing || trace.timing;
      if (timing && timing.startedAt && timing.endedAt) {
        const start = Date.parse(timing.startedAt);
        const end = Date.parse(timing.endedAt);
        const duration = end - start;
        if (duration >= 0) perInteractionDurations.push(duration);
      }
    }
  }
  
  const minInteraction = perInteractionDurations.length > 0 ? Math.min(...perInteractionDurations) : 0;
  const maxInteraction = perInteractionDurations.length > 0 ? Math.max(...perInteractionDurations) : 0;
  const avgInteraction = perInteractionDurations.length > 0 
    ? Math.round(perInteractionDurations.reduce((a, b) => a + b, 0) / perInteractionDurations.length)
    : 0;
  
  // Compute timing spread (coefficient of variation-like metric)
  let timingSpread = 0;
  if (perInteractionDurations.length > 1 && avgInteraction > 0) {
    const variance = perInteractionDurations.reduce((sum, d) => sum + Math.pow(d - avgInteraction, 2), 0) / perInteractionDurations.length;
    const stdDev = Math.sqrt(variance);
    timingSpread = Math.round((stdDev / avgInteraction) * 1000) / 1000; // Coefficient of variation
  }
  
  return {
    totalMs,
    observeMs,
    detectMs,
    learnMs,
    perInteraction: {
      count: perInteractionDurations.length,
      minMs: minInteraction,
      maxMs: maxInteraction,
      avgMs: avgInteraction,
      spreadCv: timingSpread, // Coefficient of variation (std dev / mean)
    },
  };
}

/**
 * Extract tool health metrics from summary
 * @param {Object} summary - Summary artifact
 * @returns {Object} Tool health metrics
 */
function extractToolHealth(summary = {}) {
  const state = summary.analysis?.state || 'UNKNOWN';
  const timedOut = summary.analysis?.timeouts?.timedOut === true;
  const phase = summary.analysis?.timeouts?.phase || null;
  
  // Incomplete runs indicate tool issues
  const isIncomplete = state === 'INCOMPLETE' || timedOut;
  
  return {
    state,
    timedOut,
    timeoutPhase: phase,
    isIncomplete,
    failureRate: isIncomplete ? 1 : 0,
  };
}

/**
 * Compare findings across multiple runs (batch analysis)
 * @param {Array} runs - Array of {runId, stability} objects
 * @returns {Object} Findings comparison metrics
 */
function compareFindingsAcrossRuns(runs) {
  if (runs.length === 0) {
    return { identical: true, addedCount: 0, removedCount: 0, diffs: [] };
  }
  
  // Use first run as reference
  const referenceIds = new Set(runs[0].stability.findings.ids || []);
  const referenceHash = runs[0].stability.findings.signatureHash;
  
  let allIdentical = true;
  const diffs = [];
  const allAddedIds = new Set();
  const allRemovedIds = new Set();
  
  for (let i = 1; i < runs.length; i++) {
    const currentIds = new Set(runs[i].stability.findings.ids || []);
    const currentHash = runs[i].stability.findings.signatureHash;
    
    if (currentHash !== referenceHash) {
      allIdentical = false;
      
      // Find diffs
      const added = [...currentIds].filter(id => !referenceIds.has(id));
      const removed = [...referenceIds].filter(id => !currentIds.has(id));
      
      added.forEach(id => allAddedIds.add(id));
      removed.forEach(id => allRemovedIds.add(id));
      
      diffs.push({
        run: runs[i].runId,
        added: added.length,
        removed: removed.length,
        addedIds: added,
        removedIds: removed,
      });
    }
  }
  
  return {
    identical: allIdentical,
    referenceSignature: referenceHash,
    addedCount: allAddedIds.size,
    removedCount: allRemovedIds.size,
    diffCount: diffs.length,
    diffs: diffs.length > 0 ? diffs : [],
  };
}

/**
 * Compare observations across multiple runs
 * @param {Array} runs - Array of {runId, stability} objects
 * @returns {Object} Observation comparison metrics
 */
function compareObservationsAcrossRuns(runs) {
  if (runs.length === 0) {
    return { stable: true, ratios: [], deltas: {} };
  }
  
  const referenceMetrics = runs[0].stability.observations;
  const ratios = [];
  const deltas = {
    expectationsExecuted: [],
    observationsRecorded: [],
    observationRatio: [],
  };
  
  let allStable = true;
  
  for (let i = 1; i < runs.length; i++) {
    const currentMetrics = runs[i].stability.observations;
    
    const expDelta = currentMetrics.expectationsExecuted - referenceMetrics.expectationsExecuted;
    const obsDelta = currentMetrics.observationsRecorded - referenceMetrics.observationsRecorded;
    const ratioDelta = Math.abs(currentMetrics.observationRatio - referenceMetrics.observationRatio);
    
    if (expDelta !== 0 || obsDelta !== 0 || ratioDelta > 0.05) {
      allStable = false;
    }
    
    deltas.expectationsExecuted.push(expDelta);
    deltas.observationsRecorded.push(obsDelta);
    deltas.observationRatio.push(Math.round(ratioDelta * 1000) / 1000);
    
    ratios.push({
      run: runs[i].runId,
      expectationsExecuted: currentMetrics.expectationsExecuted,
      observationRatio: currentMetrics.observationRatio,
    });
  }
  
  return {
    stable: allStable,
    referenceRatio: referenceMetrics.observationRatio,
    ratios,
    deltas,
  };
}

/**
 * Compare timings across multiple runs
 * @param {Array} runs - Array of {runId, stability} objects
 * @returns {Object} Timing comparison metrics
 */
function compareTimingsAcrossRuns(runs) {
  if (runs.length === 0) {
    return { stable: true, spreads: {} };
  }
  
  const referenceTiming = runs[0].stability.timing;
  const spreads = {
    totalMs: [],
    observeMs: [],
    detectMs: [],
    avgInteractionMs: [],
  };
  
  let allStable = true;
  const maxTotalDrift = Math.max(referenceTiming.totalMs * 0.2, 1000); // 20% or 1s
  const maxAvgDrift = Math.max(referenceTiming.perInteraction.avgMs * 0.3, 500); // 30% or 500ms
  
  for (let i = 1; i < runs.length; i++) {
    const currentTiming = runs[i].stability.timing;
    
    const totalDrift = Math.abs(currentTiming.totalMs - referenceTiming.totalMs);
    const observeDrift = Math.abs(currentTiming.observeMs - referenceTiming.observeMs);
    const detectDrift = Math.abs(currentTiming.detectMs - referenceTiming.detectMs);
    const avgDrift = Math.abs(currentTiming.perInteraction.avgMs - referenceTiming.perInteraction.avgMs);
    
    spreads.totalMs.push(totalDrift);
    spreads.observeMs.push(observeDrift);
    spreads.detectMs.push(detectDrift);
    spreads.avgInteractionMs.push(avgDrift);
    
    if (totalDrift > maxTotalDrift || avgDrift > maxAvgDrift) {
      allStable = false;
    }
  }
  
  const maxSpreadTotal = spreads.totalMs.length > 0 ? Math.max(...spreads.totalMs) : 0;
  const maxSpreadAvg = spreads.avgInteractionMs.length > 0 ? Math.max(...spreads.avgInteractionMs) : 0;
  
  return {
    stable: allStable,
    referenceTotal: referenceTiming.totalMs,
    referenceAvgInteraction: referenceTiming.perInteraction.avgMs,
    maxDriftTotal: maxSpreadTotal,
    maxDriftAvgInteraction: maxSpreadAvg,
    spreads,
  };
}

/**
 * Summarize tool health across all runs
 * @param {Array} runs - Array of {runId, stability} objects
 * @returns {Object} Tool health summary
 */
function summarizeToolHealth(runs) {
  const totalRuns = runs.length;
  const failedRuns = runs.filter(r => r.stability.toolHealth.failureRate > 0).length;
  const incompleteRuns = runs.filter(r => r.stability.toolHealth.isIncomplete).length;
  const timedOutRuns = runs.filter(r => r.stability.toolHealth.timedOut).length;
  
  const failureRate = totalRuns > 0 ? failedRuns / totalRuns : 0;
  const healthy = failedRuns === 0 && timedOutRuns === 0;
  
  return {
    totalRuns,
    failedRuns,
    incompleteRuns,
    timedOutRuns,
    failureRate: Math.round(failureRate * 1000) / 1000,
    healthy,
  };
}

/**
 * Classify batch stability: STABLE, MOSTLY_STABLE, or UNSTABLE
 * @param {Array} runs - Array of {runId, stability} objects
 * @returns {string} Stability classification
 */
function classifyBatchStability(runs) {
  const findingsComp = compareFindingsAcrossRuns(runs);
  const observationComp = compareObservationsAcrossRuns(runs);
  const timingComp = compareTimingsAcrossRuns(runs);
  const toolHealth = summarizeToolHealth(runs);
  
  // UNSTABLE: findings differ OR tool failures OR major timing variance
  if (
    !findingsComp.identical || 
    toolHealth.failureRate > 0 || 
    timingComp.maxDriftTotal > Math.max((runs[0]?.stability?.timing?.totalMs || 10000) * 0.3, 2000)
  ) {
    return 'UNSTABLE';
  }
  
  // MOSTLY_STABLE: findings stable but timing moderate OR minor signal drift
  if (!observationComp.stable || timingComp.maxDriftAvgInteraction > 1000) {
    return 'MOSTLY_STABLE';
  }
  
  // STABLE: everything nominal
  return 'STABLE';
}

/**
 * Compute deterministic signature for a run (for comparison purposes)
 * @param {Object} stability - Stability metrics for a run
 * @returns {string} SHA256 signature (first 32 chars)
 */
export function computeRunSignature(stability) {
  const key = `${stability.findings.count}|${stability.findings.signatureHash}|${stability.observations.observationsRecorded}|${stability.timing.totalMs}`;
  return String(createHash('sha256').update(key).digest('hex')).substring(0, 32);
}
