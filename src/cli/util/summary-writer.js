import { atomicWriteJson } from './atomic-write.js';

/**
 * Write summary.json with deterministic digest
 * The digest provides stable counts that should be identical across runs
 * on the same input (assuming site behavior is stable)
 */
export function writeSummaryJson(summaryPath, summaryData, stats = {}) {
  const payload = {
    runId: summaryData.runId,
    status: summaryData.status,
    startedAt: summaryData.startedAt,
    completedAt: summaryData.completedAt,
    command: summaryData.command,
    url: summaryData.url,
    notes: summaryData.notes,
    metrics: summaryData.metrics || {
      learnMs: stats.learnMs || 0,
      observeMs: stats.observeMs || 0,
      detectMs: stats.detectMs || 0,
      totalMs: stats.totalMs || 0,
    },
    findingsCounts: summaryData.findingsCounts || {
      HIGH: stats.HIGH || 0,
      MEDIUM: stats.MEDIUM || 0,
      LOW: stats.LOW || 0,
      UNKNOWN: stats.UNKNOWN || 0,
    },
    
    // Stable digest that should be identical across repeated runs on same input
    digest: {
      expectationsTotal: stats.expectationsTotal || 0,
      attempted: stats.attempted || 0,
      observed: stats.observed || 0,
      silentFailures: stats.silentFailures || 0,
      coverageGaps: stats.coverageGaps || 0,
      unproven: stats.unproven || 0,
      informational: stats.informational || 0,
    },
  };
  
  atomicWriteJson(summaryPath, payload);
}
