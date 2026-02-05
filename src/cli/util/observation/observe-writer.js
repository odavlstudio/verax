import { atomicWriteJson } from '../support/atomic-write.js';
import { resolve } from 'path';
import { ARTIFACT_REGISTRY } from '../../../verax/core/artifacts/registry.js';
import { isDeterministicOutputMode, normalizeDeterministicArtifact } from '../support/deterministic-output.js';
import { summarizeNetworkFirewall } from './network-firewall.js';

/**
 * Write observe.json artifact
 */
export function writeObserveJson(runDir, observeData) {
  const observePath = resolve(runDir, 'observe.json');
  
  // Derive skipped reasons counts from observations
  const skippedReasons = {};
  const observations = observeData.observations || [];
  for (const o of observations) {
    if (o.attempted && !o.observed) {
      const reason = o.reason || 'unknown';
      const key = String(reason).toLowerCase();
      skippedReasons[key] = (skippedReasons[key] || 0) + 1;
    }
  }
  const completed = observeData.stats?.completed || observeData.stats?.observed || 0;
  const attempted = observeData.stats?.attempted || 0;
  const notObserved = observeData.stats?.notObserved || Math.max(0, attempted - completed);
  const totalExpectations = observeData.stats?.totalExpectations || 0;
  const skipped = observeData.stats?.skipped || 0;
  const coverageRatio = observeData.stats?.coverageRatio !== undefined ? observeData.stats?.coverageRatio : 
    (totalExpectations > 0 ? (completed / totalExpectations) : 1.0);

  const payload = {
    contractVersion: ARTIFACT_REGISTRY.observe.contractVersion,
    observations,
    runtimeExpectations: observeData.runtimeExpectations || [],
    runtime: observeData.runtime || null,
    networkFirewall: summarizeNetworkFirewall({
      enabled: Boolean(observeData?.networkFirewall?.enabled),
      blockedWrites: observeData?.blockedWrites || [],
    }),
    auth: observeData.auth || null,
    stats: {
      totalExpectations,
      attempted,
      completed,
      observed: completed,
      notObserved,
      skipped,
      skippedReasons,
      coverageRatio,
    },
    redaction: {
      headersRedacted: observeData.redaction?.headersRedacted || 0,
      tokensRedacted: observeData.redaction?.tokensRedacted || 0,
    },
    diagnostics: observeData.diagnostics || [],
  };
  
  const normalized = normalizeDeterministicArtifact('observe', payload);
  atomicWriteJson(observePath, normalized, { deterministic: isDeterministicOutputMode() });
}



