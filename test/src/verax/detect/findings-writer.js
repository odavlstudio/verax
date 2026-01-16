import { resolve } from 'path';
import { mkdirSync, writeFileSync } from 'fs';
import { CANONICAL_OUTCOMES } from '../core/canonical-outcomes.js';
import { ARTIFACT_REGISTRY } from '../core/artifacts/registry.js';

const DEFAULT_CLOCK = () => new Date().toISOString();

// Pure: builds deterministic report object from provided data and timestamp
export function buildFindingsReport({ url, findings = [], coverageGaps = [], detectedAt }) {
  const outcomeSummary = {};
  Object.values(CANONICAL_OUTCOMES).forEach(outcome => {
    outcomeSummary[outcome] = 0;
  });

  const promiseSummary = {};

  // Contract enforcement: separate findings into valid, downgradable, and droppable
  const downgrades = [];
  const droppedFindingIds = [];
  const enforcedFindings = [];

  for (const finding of findings) {
    // Check for critical missing fields (drop these)
    const hasCriticalNarrativeFields = 
      finding.what_happened &&
      finding.what_was_expected &&
      finding.what_was_observed &&
      finding.why_it_matters;

    const hasRequiredType = finding.type;

    if (!hasRequiredType || !hasCriticalNarrativeFields) {
      droppedFindingIds.push(finding.id || 'unknown');
      continue;
    }

    // Check for Evidence Law violation (downgrade)
    if (finding.status === 'CONFIRMED' && (!finding.evidence || Object.keys(finding.evidence).length === 0)) {
      const downgradedFinding = {
        ...finding,
        status: 'SUSPECTED',
        reason: (finding.reason || '') + ' (Evidence Law enforced - no evidence exists for CONFIRMED status)'
      };
      downgrades.push({
        id: finding.id || 'unknown',
        originalStatus: 'CONFIRMED',
        downgradeToStatus: 'SUSPECTED',
        reason: 'Evidence Law enforced - no evidence exists for CONFIRMED status'
      });
      enforcedFindings.push(downgradedFinding);
    } else {
      // Valid finding
      enforcedFindings.push(finding);
    }
  }

  // Build outcome and promise summary from enforced findings
  for (const finding of enforcedFindings) {
    const outcome = finding.outcome || CANONICAL_OUTCOMES.SILENT_FAILURE;
    outcomeSummary[outcome] = (outcomeSummary[outcome] || 0) + 1;

    const promiseType = finding.promise?.type || 'UNKNOWN_PROMISE';
    promiseSummary[promiseType] = (promiseSummary[promiseType] || 0) + 1;
  }

  return {
    version: 1,
    contractVersion: ARTIFACT_REGISTRY.findings.contractVersion,
    detectedAt: detectedAt,
    url,
    outcomeSummary,  // PHASE 2
    promiseSummary,  // PHASE 3
    findings: enforcedFindings,
    coverageGaps,
    notes: [],
    enforcement: {
      evidenceLawEnforced: true,
      contractVersion: 1,
      timestamp: detectedAt,
      droppedCount: droppedFindingIds.length,
      downgradedCount: downgrades.length,
      downgrades: downgrades
    }
  };
}

// Side-effectful: persists a fully built report to disk
export function persistFindingsReport(runDir, report) {
  if (!runDir) {
    throw new Error('runDirOpt is required');
  }
  mkdirSync(runDir, { recursive: true });
  const findingsPath = resolve(runDir, 'findings.json');
  writeFileSync(findingsPath, JSON.stringify(report, null, 2) + '\n');
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

