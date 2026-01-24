import { getTimeProvider } from '../../cli/util/support/time-provider.js';
import { resolve } from 'path';
import { atomicWriteJsonSync, atomicMkdirSync } from '../../cli/util/atomic-write.js';
import { CANONICAL_OUTCOMES } from '../core/canonical-outcomes.js';
import { ARTIFACT_REGISTRY } from '../core/artifacts/registry.js';
import { enforceFinalInvariantsWithReport } from '../detect/invariants-enforcer.js';
import { canonicalizeFinding } from './finding-contract.js';
import { deduplicateFindings } from './deduplication.js';

const DEFAULT_CLOCK = () => getTimeProvider().iso();

/**
 * Deterministic sorting key for findings.
 * Primary: sourceRef (file:line:col if present)
 * Then: type, status, severity, promise.kind/value, id
 */
function getDeterministicSortKey(finding) {
  const parts = [];
  
  // Primary: sourceRef if present
  if (finding.interaction?.sourceRef) {
    parts.push(finding.interaction.sourceRef);
  } else if (finding.source?.file) {
    const line = finding.source.line || 0;
    const col = finding.source.col || 0;
    parts.push(`${finding.source.file}:${line}:${col}`);
  } else {
    parts.push('~'); // Sort findings without source last
  }
  
  // Then: type, status, severity
  parts.push(finding.type || '');
  parts.push(finding.status || '');
  parts.push(finding.severity || '');
  
  // Promise kind and value
  parts.push(finding.promise?.kind || finding.promise?.type || '');
  parts.push(finding.promise?.value || finding.promise?.expected || '');
  
  // Finally: id
  parts.push(finding.id || '');
  
  return parts.join('|');
}

/**
 * Sort findings deterministically.
 */
function sortFindingsDeterministically(findings) {
  return [...findings].sort((a, b) => {
    const keyA = getDeterministicSortKey(a);
    const keyB = getDeterministicSortKey(b);
    return keyA.localeCompare(keyB);
  });
}

/**
 * Sort evidence references within a finding deterministically.
 */
function sortEvidenceReferences(finding) {
  if (!finding.evidence || typeof finding.evidence !== 'object') {
    return finding;
  }
  
  const sortedEvidence = { ...finding.evidence };
  
  // Sort array fields alphabetically
  for (const key of Object.keys(sortedEvidence)) {
    if (Array.isArray(sortedEvidence[key])) {
      sortedEvidence[key] = [...sortedEvidence[key]].sort((a, b) => {
        if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b);
        if (typeof a === 'number' && typeof b === 'number') return a - b;
        return String(a).localeCompare(String(b));
      });
    }
  }
  
  return { ...finding, evidence: sortedEvidence };
}

// Pure: builds deterministic report object from provided data and timestamp
export function buildFindingsReport({ url, findings = [], coverageGaps = [], detectedAt: _detectedAt }) {
  const outcomeSummary = {};
  Object.values(CANONICAL_OUTCOMES).forEach(outcome => {
    outcomeSummary[outcome] = 0;
  });

  const promiseSummary = {};

  // Normalize to canonical contract before enforcement
  const canonicalFindings = (findings || [])
    .map(canonicalizeFinding)
    .filter(Boolean);

  // Contract enforcement: enforce invariants and collect metadata
  const { findings: enforcedFindings, enforcement } = enforceFinalInvariantsWithReport(canonicalFindings);
  
  // PHASE 6: Deduplicate findings to prevent flooding
  const { findings: deduplicatedFindings, deduplicatedCount } = deduplicateFindings(enforcedFindings);
  
  // Sort evidence references within each finding
  const findingsWithSortedEvidence = deduplicatedFindings.map(sortEvidenceReferences);
  
  // Sort findings deterministically
  const sortedFindings = sortFindingsDeterministically(findingsWithSortedEvidence);
  
  // Build outcome and promise summary from enforced findings
  for (const finding of sortedFindings) {
    const outcome = finding.outcome || CANONICAL_OUTCOMES.SILENT_FAILURE;
    outcomeSummary[outcome] = (outcomeSummary[outcome] || 0) + 1;

    const promiseType = finding.promise?.type || 'UNKNOWN_PROMISE';
    promiseSummary[promiseType] = (promiseSummary[promiseType] || 0) + 1;
  }

  return {
    version: 1,
    contractVersion: ARTIFACT_REGISTRY.findings.contractVersion,
    url,
    outcomeSummary,  // PHASE 2
    promiseSummary,  // PHASE 3
    findings: sortedFindings,
    coverageGaps,
    notes: [],
    enforcement: {
      evidenceLawEnforced: enforcement.evidenceLawEnforced,
      contractVersion: enforcement.contractVersion,
      droppedCount: enforcement.droppedCount,
      downgradedCount: enforcement.downgradedCount,
      deduplicatedCount,  // PHASE 6
      downgrades: enforcement.downgrades || [],
      dropped: enforcement.dropped || []
    }
  };
}

// Side-effectful: persists a fully built report to disk using atomic writes (Week 3)
export function persistFindingsReport(runDir, report) {
  if (!runDir) {
    throw new Error('runDirOpt is required');
  }
  // @ts-ignore - atomicMkdirSync supports recursive option
  atomicMkdirSync(runDir, { recursive: true });
  const findingsPath = resolve(runDir, 'findings.json');
  atomicWriteJsonSync(findingsPath, report);
  return { ...report, findingsPath };
}

/**
 * Write findings to canonical artifact root.
 * Writes to .verax/runs/<runId>/findings.json.
 *
 * PHASE 2: Includes outcome classification summary.
 * PHASE 3: Includes promise type summary.
 *
 * @param {string} projectDir
 * @param {string} url
 * @param {Array} findings
 * @param {Array} coverageGaps
 * @param {string} runDirOpt - Required absolute run directory path
 */
export function writeFindings(projectDir, url, findings, coverageGaps = [], runDirOpt) {
  const detectedAt = DEFAULT_CLOCK();
  const report = buildFindingsReport({ url, findings: findings || [], coverageGaps: coverageGaps || [], detectedAt });
  return persistFindingsReport(runDirOpt, report);
}




