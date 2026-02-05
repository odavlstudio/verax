import { getTimeProvider } from '../util/support/time-provider.js';
import { atomicWriteJson, atomicWriteText } from '../util/support/atomic-write.js';
import { writeSummaryJson } from '../util/evidence/summary-writer.js';
import { writeFindingsJson } from '../util/evidence/findings-writer.js';
import { writeProjectJson } from '../util/support/project-writer.js';
import { writeLearnJson } from '../util/evidence/learn-writer.js';
import { writeObserveJson } from '../util/observation/observe-writer.js';
import { saveDigest } from '../util/evidence/digest-engine.js';
import { ARTIFACT_REGISTRY, getArtifactVersions } from '../../verax/core/artifacts/registry.js';
import { join } from 'path';
import { loadPolicy, applyPolicy, countNonSuppressedFindings } from '../util/policy/policy-loader.js';
import { VERSION } from '../../version.js';

function getVersion() {
  return VERSION;
}

/**
 * Finalize Phase
 * 
 * @param {Object} params - { runId, paths, startedAt, url, src, projectRoot, projectProfile, expectations, skipped, observeData, detectData, events, budget, profile, maxTotalMs, exitOnFirstActionable }
 * @returns {void}
 */
export function finalizePhase(params) {
  const { runId, paths, startedAt, url, src, projectRoot, projectProfile, expectations, skipped, observeData, detectData, events, budget, profile, maxTotalMs, exitOnFirstActionable } = params;
  
  const completedAt = getTimeProvider().iso();
  
  // Determine run truth status (official vocabulary only)
  const observedIncomplete = observeData?.status === 'INCOMPLETE';
  const silentFailures = Number(detectData?.stats?.silentFailures ?? 0);
  const runStatus = observedIncomplete ? 'INCOMPLETE' : (silentFailures > 0 ? 'FINDINGS' : 'SUCCESS');
  
  atomicWriteJson(paths.runStatusJson, {
    contractVersion: 1,
    artifactVersions: getArtifactVersions(),
    status: runStatus,
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
    args: { url, src, out: paths.baseDir },
    url,
    src,
    startedAt,
    completedAt,
    error: null,
    profile: profile ? {
      name: profile.name,
      maxInteractions: profile.maxInteractions,
      maxRuntimeExpectations: profile.maxRuntimeExpectations,
    } : null,
    budgets: {
      maxTotalMs: maxTotalMs || null,
      exitOnFirstActionable: exitOnFirstActionable || false,
    },
  });
  
  const runDurationMs = completedAt && startedAt ? (Date.parse(completedAt) - Date.parse(startedAt)) : 0;
  const metrics = {
    learnMs: observeData?.timings?.learnMs || 0,
    observeMs: observeData?.timings?.observeMs || observeData?.timings?.totalMs || 0,
    detectMs: detectData?.timings?.detectMs || detectData?.timings?.totalMs || 0,
    totalMs: runDurationMs > 0 ? runDurationMs : (budget?.ms || 0)
  };

  // Load and apply policy to findings
  let rawFindings = Array.isArray(detectData?.findings) ? detectData.findings : [];
  const policy = loadPolicy(projectRoot);
  const finalFindings = applyPolicy(rawFindings, policy);

  // Count only non-suppressed findings for summary
  const findingsCounts = countNonSuppressedFindings(finalFindings);
  
  writeSummaryJson(paths.summaryJson, {
    runId,
    status: runStatus,
    startedAt,
    completedAt,
    command: 'run',
    url,
    notes: runStatus === 'INCOMPLETE' ? 'Run incomplete' : 'Run completed',
    metrics,
    findingsCounts,
    incompleteReasons: observeData?.stability?.incompleteReasons || [],
    runtimeNavigation: observeData?.runtime || null,
  }, {
    expectationsTotal: expectations.length,
    attempted: observeData.stats?.attempted || 0,
    observed: observeData.stats?.observed || 0,
    silentFailures: finalFindings.length,
    coverageGaps: detectData.stats?.coverageGaps || 0,
    unproven: detectData.stats?.unproven || 0,
    informational: detectData.stats?.informational || 0,
    ...metrics,
    ...findingsCounts,
  });
  
  // Write findings with policy metadata included
  writeFindingsJson(paths.baseDir, {
    findings: finalFindings,
    stats: detectData.stats,
    enforcement: detectData.enforcement
  });
  
  const allEvents = events.getEvents();
  const tracesContent = allEvents
    .map(e => JSON.stringify(e))
    .join('\n') + '\n';
  atomicWriteText(paths.tracesJsonl, tracesContent);
  
  writeProjectJson(paths, projectProfile);
  writeLearnJson(paths, expectations, skipped);
  writeObserveJson(paths.baseDir, observeData);
  
  if (observeData && observeData.digest) {
     saveDigest(join(paths.baseDir, 'run.digest.json'), observeData.digest);
  }
}
