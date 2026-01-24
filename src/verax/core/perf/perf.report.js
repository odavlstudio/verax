/**
 * PHASE 21.9 — Performance Report
 * 
 * Generates performance.report.json with budgets, actual usage, peaks, and violations.
 */

// @ts-ignore
import { getTimeProvider } from '../../../cli/util/support/time-provider.js';

import { resolve } from 'path';
import { readdirSync, statSync, existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { getPerfBudget, evaluatePerfBudget } from './perf.contract.js';

/**
 * Calculate artifacts size
 * 
 * @param {string} runDir - Run directory
 * @returns {number} Size in MB
 */
function calculateArtifactsSize(runDir) {
  let totalSize = 0;
  
  function scanDirectory(dir) {
    try {
      const entries = readdirSync(dir, { withFileTypes: true })
        // @ts-ignore - Dirent has name property
        .sort((a, b) => a.name.localeCompare(b.name, 'en'));
      
      for (const entry of entries) {
        const fullPath = resolve(dir, entry.name);
        
        if (entry.isDirectory()) {
          scanDirectory(fullPath);
        } else if (entry.isFile()) {
          try {
            const stats = statSync(fullPath);
            totalSize += stats.size;
          } catch {
            // Skip unreadable files
          }
        }
      }
    } catch {
      // Skip inaccessible directories
    }
  }
  
  if (existsSync(runDir)) {
    scanDirectory(runDir);
  }
  
  return totalSize / (1024 * 1024); // Convert to MB
}

/**
 * Load pipeline stage timings from run.meta.json
 * 
 * @param {string} projectDir - Project directory
 * @param {string} runId - Run ID
 * @returns {Object|null} Stage timings or null
 */
function loadPipelineStageTimings(projectDir, runId) {
  const runDir = resolve(projectDir, '.verax', 'runs', runId);
  const metaPath = resolve(runDir, 'run.meta.json');
  
  if (!existsSync(metaPath)) {
    return null;
  }
  
  try {
  // @ts-expect-error - readFileSync with encoding returns string
    const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
    return meta.pipelineStages || null;
  } catch {
    return null;
  }
}

/**
 * Generate performance report
 * 
 * @param {string} projectDir - Project directory
 * @param {string} runId - Run ID
 * @param {Object} monitorReport - Monitor report from PerformanceMonitor
 * @param {string} profile - Budget profile name
 * @returns {Object} Performance report
 */
export function generatePerformanceReport(projectDir, runId, monitorReport, profile = 'STANDARD') {
  const budget = getPerfBudget(profile);
  const runDir = resolve(projectDir, '.verax', 'runs', runId);
  const artifactsSizeMB = calculateArtifactsSize(runDir);
  
  // Load pipeline stage timings
  const pipelineStages = loadPipelineStageTimings(projectDir, runId);
  
  const actual = {
    runtimeMs: monitorReport.runtimeMs,
    memoryRSS: monitorReport.memoryRSS,
    pagesVisited: monitorReport.pagesVisited,
    interactionsExecuted: monitorReport.interactionsExecuted,
    artifactsSizeMB: artifactsSizeMB,
    eventLoopDelayMs: monitorReport.avgEventLoopDelay || 0
  };
  
  const evaluation = evaluatePerfBudget(actual, budget);
  
  // Extract stage timings if available
  const stageTimings = {};
  if (pipelineStages) {
    for (const [stageName, stageData] of Object.entries(pipelineStages)) {
      if (stageData.durationMs !== null && stageData.durationMs !== undefined) {
        stageTimings[stageName] = {
          durationMs: stageData.durationMs,
          startedAt: stageData.startedAt,
          completedAt: stageData.completedAt,
          status: stageData.status
        };
      }
    }
  }
  
  const report = {
    contractVersion: 1,
    runId,
    profile,
    budget: {
      maxRuntimeMs: budget.maxRuntimeMs,
      maxMemoryRSS: budget.maxMemoryRSS,
      maxPagesVisited: budget.maxPagesVisited,
      maxInteractionsExecuted: budget.maxInteractionsExecuted,
      maxArtifactsSizeMB: budget.maxArtifactsSizeMB,
      maxEventLoopDelayMs: budget.maxEventLoopDelayMs
    },
    actual,
    peaks: {
      memoryRSS: monitorReport.peakMemoryRSS,
      memoryHeapUsed: monitorReport.peakMemoryHeapUsed,
      memoryHeapTotal: monitorReport.peakMemoryHeapTotal,
      eventLoopDelay: monitorReport.peakEventLoopDelay
    },
    stageTimings: Object.keys(stageTimings).length > 0 ? stageTimings : null,
    networkRequests: monitorReport.networkRequests || 0,
    violations: evaluation.violations,
    warnings: evaluation.warnings,
    verdict: evaluation.verdict,
    ok: evaluation.ok,
    summary: {
      ...evaluation.summary,
      runtimeMs: actual.runtimeMs,
      memoryRSSMB: (actual.memoryRSS / (1024 * 1024)).toFixed(2),
      pagesVisited: actual.pagesVisited,
      networkRequests: monitorReport.networkRequests || 0,
      interactionsExecuted: actual.interactionsExecuted,
      artifactsSizeMB: actual.artifactsSizeMB.toFixed(2),
      slowPhases: monitorReport.slowPhases || []
    },
    generatedAt: getTimeProvider().iso()
  };
  
  return report;
}

/**
 * Write performance report
 * 
 * @param {string} projectDir - Project directory
 * @param {string} runId - Run ID
 * @param {Object} report - Performance report
 * @returns {string} Path to written file
 */
export function writePerformanceReport(projectDir, runId, report) {
  const runDir = resolve(projectDir, '.verax', 'runs', runId);
  if (!existsSync(runDir)) {
    mkdirSync(runDir, { recursive: true });
  }
  
  const outputPath = resolve(runDir, 'performance.report.json');
  writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
  
  return outputPath;
}

/**
 * Load performance report
 * 
 * @param {string} projectDir - Project directory
 * @param {string} runId - Run ID
 * @returns {Object|null} Performance report or null
 */
export function loadPerformanceReport(projectDir, runId) {
  const reportPath = resolve(projectDir, '.verax', 'runs', runId, 'performance.report.json');
  
  if (!existsSync(reportPath)) {
    return null;
  }
  
  try {
    const content = readFileSync(reportPath, 'utf-8');
  // @ts-expect-error - readFileSync with encoding returns string
    return JSON.parse(content);
  } catch {
    return null;
  }
}




