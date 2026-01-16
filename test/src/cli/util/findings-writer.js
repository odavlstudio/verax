import { atomicWriteJson } from './atomic-write.js';
import { resolve } from 'path';
import { findingIdFromExpectationId } from './idgen.js';
import { ARTIFACT_REGISTRY } from '../../verax/core/artifacts/registry.js';

/**
 * Write findings.json artifact with deterministic IDs
 */
export function writeFindingsJson(runDir, findingsData) {
  const findingsPath = resolve(runDir, 'findings.json');
  
  // Add deterministic finding IDs based on expectation IDs
  const findingsWithIds = (findingsData.findings || []).map(finding => ({
    ...finding,
    findingId: findingIdFromExpectationId(finding.id),
  }));
  
  const payload = {
    contractVersion: ARTIFACT_REGISTRY.findings.contractVersion,
    findings: findingsWithIds,
    total: findingsData.stats?.total || 0,
    stats: {
      total: findingsData.stats?.total || 0,
      silentFailures: findingsData.stats?.silentFailures || 0,
      observed: findingsData.stats?.observed || 0,
      coverageGaps: findingsData.stats?.coverageGaps || 0,
      unproven: findingsData.stats?.unproven || 0,
      informational: findingsData.stats?.informational || 0,
    },
    detectedAt: findingsData.detectedAt || new Date().toISOString(),
    enforcement: findingsData.enforcement || null,
  };
  
  atomicWriteJson(findingsPath, payload);
}
