import { atomicWriteJson } from '../support/atomic-write.js';
import { ARTIFACT_REGISTRY } from '../../../verax/core/artifacts/registry.js';
import { buildTruthBlock } from '../../../verax/core/truth-classifier.js';

/**
 * Write summary.json with deterministic digest and truth classification
 * The digest provides stable counts that should be identical across runs
 * on the same input (assuming site behavior is stable)
 */
export function writeSummaryJson(summaryPath, summaryData, stats = {}, truthResult = null) {
  // Derive stable observe block from provided coverage + stats
  const coverageObserve = summaryData?.coverage?.observe || {};
  const coverageLearn = summaryData?.coverage?.learn || {};
  const coverageRatio = typeof summaryData?.coverage?.coverageRatio === 'number'
    ? summaryData.coverage.coverageRatio
    : 0;
  const observeBlock = {
    expectationsTotal: Number(stats?.expectationsTotal ?? coverageLearn?.totalExpectations ?? 0),
    attempted: Number(stats?.attempted ?? coverageObserve?.attempted ?? 0),
    observed: Number(stats?.observed ?? coverageObserve?.completed ?? 0),
    coverageRatio: Number(coverageRatio ?? 0),
    incompleteReasons: Array.isArray(summaryData?.incompleteReasons) ? summaryData.incompleteReasons : [],
    unattemptedReasons: typeof coverageObserve?.skippedReasons === 'object' && coverageObserve?.skippedReasons
      ? coverageObserve.skippedReasons
      : {},
  };

  // Stable learn block (minimal)
  const learnBlock = {
    expectationsTotal: Number(coverageLearn?.totalExpectations ?? stats?.expectationsTotal ?? 0),
  };

  // Stable detect block (minimal)
  const detectBlock = {
    findingsCounts: summaryData?.findingsCounts || {
      HIGH: Number(stats?.HIGH ?? 0),
      MEDIUM: Number(stats?.MEDIUM ?? 0),
      LOW: Number(stats?.LOW ?? 0),
      UNKNOWN: Number(stats?.UNKNOWN ?? 0),
    },
  };

  const payload = {
    contractVersion: ARTIFACT_REGISTRY.summary.contractVersion,
    runId: summaryData.runId,
    status: summaryData.status,
    startedAt: summaryData.startedAt,
    completedAt: summaryData.completedAt,
    command: summaryData.command,
    url: summaryData.url,
    notes: summaryData.notes,
    reasons: summaryData.reasons || [],
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

    runtimeNavigation: summaryData.runtimeNavigation || null,
    
    // Auth block (if authentication was used)
    auth: summaryData.auth || null,
    
    // Incomplete reasons (if status is INCOMPLETE)
    incompleteReasons: summaryData.incompleteReasons || [],
    
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

    // Stage 4: Truth classification (explicit run state)
    truth: truthResult ? buildTruthBlock(truthResult, {
      expectationsTotal: observeBlock.expectationsTotal,
      attempted: observeBlock.attempted,
      observed: observeBlock.observed,
      coverageRatio: observeBlock.coverageRatio,
      threshold: Number(summaryData?.coverage?.minCoverage ?? 0.90),
      unattemptedCount: Math.max(0, observeBlock.expectationsTotal - observeBlock.attempted),
      unattemptedBreakdown: observeBlock.unattemptedReasons || {},
      incompleteReasons: observeBlock.incompleteReasons || [],
    }) : {},
    
    // PHASE 2: Always-available stable blocks
    observe: observeBlock || {},
    learn: learnBlock || {},
    detect: detectBlock || {},
    
    // Stable meta object
    meta: {
      runId: summaryData.runId,
      scanId: summaryData.scanId || null,
      status: summaryData.status,
      command: summaryData.command,
      url: summaryData.url,
      startedAt: summaryData.startedAt,
      completedAt: summaryData.completedAt,
      veraxVersion: summaryData.veraxVersion || null,
      nodeVersion: summaryData.nodeVersion || null,
      platform: summaryData.platform || null,
      cwd: summaryData.cwd || null,
    },

    // Stage 6.6: Product Seal (deterministic)
    productionSeal: computeProductionSeal(summaryData, stats),
  };
  
  atomicWriteJson(summaryPath, payload);
}

function computeProductionSeal(summaryData, stats) {
  try {
    const covRatio = Number(summaryData?.coverage?.coverageRatio || 0);
    const minCov = Number(summaryData?.coverage?.minCoverage || 0.9);
    const coverageOk = covRatio >= minCov;
    const noFailures = Number(stats?.silentFailures || 0) === 0;
    const hasDigest = Boolean(summaryData?.digest || null) || Boolean(stats?.expectationsTotal || 0);
    return (coverageOk && noFailures && hasDigest) ? 'PRODUCTION_GRADE' : null;
  } catch {
    return null;
  }
}



