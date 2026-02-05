import { atomicWriteJson } from '../support/atomic-write.js';
import { ARTIFACT_REGISTRY, getRunArtifactContract } from '../../../verax/core/artifacts/registry.js';
import { buildTruthBlock } from '../../../verax/core/truth-classifier.js';
import { isDeterministicOutputMode, normalizeDeterministicArtifact } from '../support/deterministic-output.js';

/**
 * Write summary.json with deterministic digest and truth classification
 * The digest provides stable counts that should be identical across runs
 * on the same input (assuming site behavior is stable)
 */
export function writeSummaryJson(summaryPath, summaryData, stats = {}, truthResult = null) {
  // TRUST SURFACE LOCK: stats is the SINGLE SOURCE OF TRUTH for all counts
  // All counts MUST come from stats param, not summaryData
  const expectationsTotal = Number(stats?.expectationsTotal ?? 0);
  const attempted = Number(stats?.attempted ?? 0);
  const observed = Number(stats?.observed ?? 0);
  
  // TRUST SURFACE LOCK: Coverage MUST NEVER exceed 100%
  // If attempted > expectationsTotal, cap at 1.0 and note the anomaly
  let coverageRatio = expectationsTotal > 0 ? attempted / expectationsTotal : 0;
  if (coverageRatio > 1.0) {
    coverageRatio = 1.0;
  }
  
  const observeBlock = {
    expectationsTotal,
    attempted,
    observed,
    coverageRatio,
    incompleteReasons: Array.isArray(summaryData?.incompleteReasons) ? summaryData.incompleteReasons : [],
    unattemptedReasons: typeof summaryData?.coverage?.observe?.skippedReasons === 'object' && summaryData?.coverage?.observe?.skippedReasons
      ? summaryData.coverage.observe.skippedReasons
      : {},
  };

  // TRUST SURFACE LOCK: learn block derives from stats (single source)
  const learnBlock = {
    expectationsTotal,
  };

  // TRUST SURFACE LOCK: detect block derives from stats (single source)
  const detectBlock = {
    findingsCounts: {
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
    
    // TRUST SURFACE LOCK: digest uses stats as single source
    digest: {
      expectationsTotal,
      attempted,
      observed,
      silentFailures: stats.silentFailures || 0,
      coverageGaps: stats.coverageGaps || 0,
      unproven: stats.unproven || 0,
      informational: stats.informational || 0,
    },

    // TRUST SURFACE LOCK: truth block uses single source counts
    truth: truthResult ? buildTruthBlock(truthResult, {
      expectationsTotal,
      attempted,
      observed,
      coverageRatio,
      threshold: Number(summaryData?.coverage?.minCoverage ?? 0.90),
      unattemptedCount: Math.max(0, observeBlock.expectationsTotal - observeBlock.attempted),
      unattemptedBreakdown: observeBlock.unattemptedReasons || {},
      incompleteReasons: observeBlock.incompleteReasons || [],
    }) : {},
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

    // Artifact contract visibility (single source of truth).
    // Values are run-dir-relative paths; directories include a trailing slash.
    artifactsContract: getRunArtifactContract(),

    // Stage 6.6: Product Seal (deterministic)
    productionSeal: computeProductionSeal(summaryData, stats),
  };
  
  const normalized = normalizeDeterministicArtifact('summary', payload);
  atomicWriteJson(summaryPath, normalized, { deterministic: isDeterministicOutputMode() });
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



