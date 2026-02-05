import { getTimeProvider as _getTimeProvider } from '../support/time-provider.js';
import { atomicWriteJson } from '../support/atomic-write.js';
import { resolve } from 'path';
import { findingIdFromExpectationId } from '../support/idgen.js';
import { ARTIFACT_REGISTRY } from '../../../verax/core/artifacts/registry.js';
import { isDeterministicOutputMode, normalizeDeterministicArtifact } from '../support/deterministic-output.js';

/**
 * Write findings.json artifact with deterministic IDs
 * Note: findingsData.findings may include policy metadata (suppressed, downgraded, policy field)
 */
export function writeFindingsJson(runDir, findingsData) {
  const findingsPath = resolve(runDir, 'findings.json');
  
  // Add deterministic finding IDs based on expectation IDs
  // Include all findings (suppressed and non-suppressed) with policy metadata
  const findingsWithIds = (findingsData.findings || []).map(finding => ({
    ...finding,
    findingId: findingIdFromExpectationId(finding.id),
  }));
  const executionOrder = findingsWithIds.map(f => ({ findingId: f.findingId, expectationId: f.id }));
  const deterministicSorted = [...findingsWithIds].sort((a, b) => {
    const fa = (a.findingId || '').localeCompare(b.findingId || '', 'en');
    if (fa !== 0) return fa;
    return (a.id || '').localeCompare(b.id || '', 'en');
  });
  const deterministicOrder = deterministicSorted.map(f => ({ findingId: f.findingId, expectationId: f.id }));
  
  const payload = {
    contractVersion: ARTIFACT_REGISTRY.findings.contractVersion,
    findings: deterministicSorted,
    total: findingsData.stats?.total || 0,
    stats: {
      total: findingsData.stats?.total || 0,
      silentFailures: findingsData.stats?.silentFailures || 0,
      observed: findingsData.stats?.observed || 0,
      coverageGaps: findingsData.stats?.coverageGaps || 0,
      unproven: findingsData.stats?.unproven || 0,
      informational: findingsData.stats?.informational || 0,
    },    enforcement: findingsData.enforcement || null,
    findingsExecutionOrder: executionOrder,
    findingsDeterministicOrder: deterministicOrder,
  };
  
  const normalized = normalizeDeterministicArtifact('findings', payload);
  atomicWriteJson(findingsPath, normalized, { deterministic: isDeterministicOutputMode() });
}



