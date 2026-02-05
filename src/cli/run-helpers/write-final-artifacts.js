import { atomicWriteJson } from '../util/support/atomic-write.js';
import { writeSummaryJson } from '../util/evidence/summary-writer.js';
import { ARTIFACT_REGISTRY, getArtifactVersions } from '../../verax/core/artifacts/registry.js';
import { getTimeProvider } from '../util/support/time-provider.js';
import { VERSION } from '../../version.js';

function getVersion() {
  return VERSION;
}

/**
 * Extracted from runCommand Phase 6 (Finalize) for readability. No behavior change.
 * Writes final run status, metadata, and summary artifacts.
 */
export function writeFinalArtifacts(
  paths,
  runId,
  startedAt,
  projectRoot,
  url,
  src,
  srcPath,
  budget,
  expectations,
  observeData,
  detectData
) {
  const timeProvider = getTimeProvider();
  const completedAt = timeProvider.iso();
  const silentFailures = Number(detectData?.stats?.silentFailures ?? 0);
  const isIncomplete = observeData?.status === 'INCOMPLETE';
  const finalStatus = isIncomplete ? 'INCOMPLETE' : (silentFailures > 0 ? 'FINDINGS' : 'SUCCESS');
  
  atomicWriteJson(paths.runStatusJson, {
    contractVersion: 1,
    artifactVersions: getArtifactVersions(),
    status: finalStatus,
    lifecycle: 'FINAL',
    runId,
    startedAt,
    completedAt,
  });
  
  atomicWriteJson(paths.runMetaJson, {
    contractVersion: ARTIFACT_REGISTRY.runMeta.contractVersion,
    veraxVersion: getVersion(),
    nodeVersion: process.version,
    platform: process.platform,
    cwd: projectRoot,
    command: 'run',
    args: { url, src, out: '.verax' },
    url,
    src: srcPath,
    startedAt,
    completedAt,
    error: null,
    retries: observeData?.stats?.retries || null,
  });
  
  const runDurationMs = completedAt && startedAt ? (Date.parse(completedAt) - Date.parse(startedAt)) : 0;
  const metrics = {
    learnMs: observeData?.timings?.learnMs || 0,
    observeMs: observeData?.timings?.observeMs || observeData?.timings?.totalMs || 0,
    detectMs: detectData?.timings?.detectMs || detectData?.timings?.totalMs || 0,
    totalMs: runDurationMs > 0 ? runDurationMs : (budget?.ms || 0)
  };
  const findingsCounts = detectData?.findingsCounts || {
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    UNKNOWN: 0,
  };

  writeSummaryJson(paths.summaryJson, {
    runId,
    status: finalStatus,
    startedAt,
    completedAt,
    command: 'run',
    url,
    notes: finalStatus === 'INCOMPLETE' ? 'Run incomplete' : 'Run completed',
    metrics,
    findingsCounts,
    runtimeNavigation: observeData?.runtime || null,
  }, {
    expectationsTotal: expectations.length,
    attempted: observeData.stats?.attempted || 0,
    observed: observeData.stats?.observed || 0,
    silentFailures: silentFailures,
    coverageGaps: detectData.stats?.coverageGaps || 0,
    unproven: detectData.stats?.unproven || 0,
    informational: detectData.stats?.informational || 0,
    ...metrics,
    ...findingsCounts,
  });
  
  return { completedAt, metrics, findingsCounts };
}








