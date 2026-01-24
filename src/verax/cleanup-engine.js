/**
 * Run Retention & Hygiene Engine (PHASE 5.8)
 *
 * Evidence-based cleanup of VERAX runs with deterministic behavior.
 * Protects INCOMPLETE runs and CONFIRMED findings unless explicitly allowed.
 */

import { readdirSync, statSync, readFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { getTimeProvider } from '../cli/util/support/time-provider.js';

/**
 * Load all runs from .verax/runs directory
 * @param {string} runsDir - Path to .verax/runs directory
 * @returns {Array<Object>} Array of run metadata sorted by timestamp (oldest first)
 */
export function loadRuns(runsDir) {
  if (!existsSync(runsDir)) {
    return [];
  }
  
  const entries = readdirSync(runsDir)
    .filter(name => {
      // Skip latest.txt and non-directories
      if (name === 'latest.txt') return false;
      const path = join(runsDir, name);
      return statSync(path).isDirectory();
    })
    .sort((a, b) => a.localeCompare(b));
  
  const runs = [];
  
  for (const runId of entries) {
    const runDir = join(runsDir, runId);
    
    // Try to read run metadata
    const runMetaPath = join(runDir, 'run-meta.json');
    const summaryPath = join(runDir, 'summary.json');
    
    let runMeta = null;
    let summary = null;
    
    if (existsSync(runMetaPath)) {
      try {
        runMeta = JSON.parse(String(readFileSync(runMetaPath, 'utf-8')));
      } catch (e) {
        // Ignore parse errors
      }
    }
    
    if (existsSync(summaryPath)) {
      try {
        summary = JSON.parse(String(readFileSync(summaryPath, 'utf-8')));
      } catch (e) {
        // Ignore parse errors
      }
    }
    
    // Extract timestamp from runId (ISO 8601 format)
    const timestampMatch = runId.match(/^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)/);
    const timestamp = timestampMatch ? timestampMatch[1].replace(/-(\d{2})-(\d{2})-(\d{3})Z$/, ':$1:$2.$3Z') : null;
    
    runs.push({
      runId,
      runDir,
      timestamp,
      status: summary?.status || 'UNKNOWN',
      findingsCounts: summary?.findingsCounts || { HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 },
      hasConfirmedFindings: (summary?.findingsCounts?.HIGH || 0) > 0 || 
                           (summary?.findingsCounts?.MEDIUM || 0) > 0 || 
                           (summary?.findingsCounts?.LOW || 0) > 0,
      url: summary?.url || runMeta?.url || 'unknown',
      startedAt: runMeta?.startedAt || timestamp,
    });
  }
  
  // Sort by runId (lexicographic = chronological for ISO timestamps)
  return runs.sort((a, b) => a.runId.localeCompare(b.runId));
}

/**
 * Classify a run for cleanup eligibility
 * @param {Object} run - Run metadata
 * @param {Object} options - Cleanup options
 * @returns {Object} Classification with canDelete, reason, protected
 */
export function classifyRun(run, options = {}) {
  const { allowDeleteConfirmed = false } = options;
  
  // INCOMPLETE runs are ALWAYS protected
  if (run.status === 'INCOMPLETE') {
    return {
      canDelete: false,
      reason: 'INCOMPLETE runs are protected',
      protected: true,
      protectionReason: 'INCOMPLETE',
    };
  }
  
  // CONFIRMED findings are protected unless explicitly allowed
  if (run.hasConfirmedFindings && !allowDeleteConfirmed) {
    return {
      canDelete: false,
      reason: 'Run has CONFIRMED findings (use --allow-delete-confirmed to override)',
      protected: true,
      protectionReason: 'CONFIRMED_FINDINGS',
    };
  }
  
  // Eligible for deletion
  return {
    canDelete: true,
    reason: 'Eligible for deletion',
    protected: false,
    protectionReason: null,
  };
}

/**
 * Build cleanup plan based on retention rules
 * @param {Array<Object>} runs - All runs sorted by timestamp
 * @param {Object} options - Cleanup options
 * @returns {Object} Cleanup plan with toDelete, toKeep, protected
 */
export function buildCleanupPlan(runs, options = {}) {
  const {
    keepLast = 10,
    olderThanDays = null,
    allowDeleteConfirmed = false,
  } = options;
  const timeProvider = getTimeProvider();
  const now = timeProvider.now();
  const cutoffTime = olderThanDays ? now - olderThanDays * 24 * 60 * 60 * 1000 : null;
  
  const toDelete = [];
  const toKeep = [];
  const protectedRuns = [];
  
  // Classify all runs
  const classified = runs.map(run => ({
    run,
    classification: classifyRun(run, { allowDeleteConfirmed }),
  }));
  
  // Separate protected runs
  for (const { run, classification } of classified) {
    if (classification.protected) {
      protectedRuns.push({
        run,
        reason: classification.protectionReason,
      });
    }
  }
  
  // Filter to eligible runs (not protected)
  const eligible = classified
    .filter(({ classification }) => classification.canDelete)
    .map(({ run }) => run);
  
  // Apply retention rules to eligible runs
  if (keepLast !== null && keepLast >= 0) {
    // Keep last N runs (newest)
    const sortedDesc = [...eligible].sort((a, b) => b.runId.localeCompare(a.runId));
    const toKeepFromLast = sortedDesc.slice(0, keepLast);
    const toDeleteFromLast = sortedDesc.slice(keepLast);
    
    toKeep.push(...toKeepFromLast);
    
    // Apply olderThanDays filter to candidates for deletion
    for (const run of toDeleteFromLast) {
      if (cutoffTime && run.startedAt) {
        const runTime = Date.parse(run.startedAt);
        if (runTime > cutoffTime) {
          // Too recent, keep it
          toKeep.push(run);
          continue;
        }
      }
      toDelete.push(run);
    }
  } else if (cutoffTime) {
    // Only apply olderThanDays filter
    for (const run of eligible) {
      if (run.startedAt) {
        const runTime = Date.parse(run.startedAt);
        if (runTime > cutoffTime) {
          toKeep.push(run);
        } else {
          toDelete.push(run);
        }
      } else {
        // Unknown date, keep it
        toKeep.push(run);
      }
    }
  }
  
  // Remove duplicates (runs might be in both keep and delete)
  const deleteIds = new Set(toDelete.map(r => r.runId));
  const finalKeep = toKeep.filter(r => !deleteIds.has(r.runId));
  
  // Add protected runs to keep list
  finalKeep.push(...protectedRuns.map(p => p.run));
  
  return {
    toDelete: toDelete.sort((a, b) => a.runId.localeCompare(b.runId)),
    toKeep: finalKeep.sort((a, b) => a.runId.localeCompare(b.runId)),
    protected: protectedRuns.sort((a, b) => a.run.runId.localeCompare(b.run.runId)),
    totalRuns: runs.length,
  };
}

/**
 * Execute cleanup plan (delete runs)
 * @param {Object} plan - Cleanup plan from buildCleanupPlan
 * @param {boolean} dryRun - If true, only simulate deletion
 * @returns {Object} Execution result with deleted, errors
 */
export function executeCleanup(plan, dryRun = true) {
  const deleted = [];
  const errors = [];
  
  for (const run of plan.toDelete) {
    try {
      if (!dryRun) {
        rmSync(run.runDir, { recursive: true, force: true });
      }
      deleted.push({
        runId: run.runId,
        status: run.status,
        findingsCounts: run.findingsCounts,
        dryRun,
      });
    } catch (error) {
      errors.push({
        runId: run.runId,
        error: error.message,
      });
    }
  }
  
  return {
    deleted: deleted.sort((a, b) => a.runId.localeCompare(b.runId)),
    errors: errors.sort((a, b) => a.runId.localeCompare(b.runId)),
    dryRun,
  };
}

/**
 * Summarize cleanup operation
 * @param {Object} plan - Cleanup plan
 * @param {Object} result - Execution result
 * @returns {Object} Summary with counts and metadata
 */
export function summarizeCleanup(plan, result) {
  return {
    operation: result.dryRun ? 'DRY_RUN' : 'EXECUTED',
    totalRuns: plan.totalRuns,
    deleted: result.deleted.length,
    kept: plan.toKeep.length,
    protected: plan.protected.length,
    errors: result.errors.length,
    protectedReasons: plan.protected.reduce((acc, p) => {
      acc[p.reason] = (acc[p.reason] || 0) + 1;
      return acc;
    }, {}),
    deletedRuns: result.deleted.map(d => d.runId).sort((a, b) => a.localeCompare(b, 'en')),
    keptRuns: plan.toKeep.map(r => r.runId).sort((a, b) => a.localeCompare(b, 'en')),
    protectedRuns: plan.protected.map(p => ({
      runId: p.run.runId,
      reason: p.reason,
    })).sort((a, b) => a.runId.localeCompare(b.runId)),
  };
}
