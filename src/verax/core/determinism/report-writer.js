/**
 * PHASE 21.2 — Determinism Report Writer
 * 
 * Writes determinism.report.json with HARD TRUTH about determinism.
 * No marketing language. Only binary verdict: DETERMINISTIC or NON_DETERMINISTIC.
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { getTimeProvider } from '../../../cli/util/support/time-provider.js';
import { ARTIFACT_REGISTRY, getArtifactVersions } from '../artifacts/registry.js';
import { computeDeterminismVerdict, DETERMINISM_VERDICT, DETERMINISM_REASON } from './contract.js';
import { DecisionRecorder } from '../determinism-model.js';

/**
 * PHASE 21.2: Write determinism report from DecisionRecorder
 * 
 * @param {string} runDir - Run directory path
 * @param {DecisionRecorder} decisionRecorder - Decision recorder instance
 * @returns {string} Path to determinism report
 */
export function writeDeterminismReport(runDir, decisionRecorder) {
  const reportPath = resolve(runDir, ARTIFACT_REGISTRY.determinismReport.filename);
  
  // PHASE 21.2: Compute HARD verdict from adaptive events
  const verdict = computeDeterminismVerdict(decisionRecorder);
  
  const report = {
    version: 1,
    contractVersion: 1,
    artifactVersions: getArtifactVersions(),
    generatedAt: getTimeProvider().iso(),
    // PHASE 21.2: HARD TRUTH - binary verdict only
    verdict: verdict.verdict,
    message: verdict.message,
    reasons: verdict.reasons,
    adaptiveEvents: verdict.adaptiveEvents,
    // PHASE 21.2: Decision summary for transparency
    decisionSummary: decisionRecorder ? decisionRecorder.getSummary() : null,
    // PHASE 21.2: Contract definition
    contract: {
      deterministic: 'Same inputs + same environment + same config → identical normalized artifacts',
      nonDeterministic: 'Any adaptive behavior (adaptive stabilization, retries, truncations) → NON_DETERMINISTIC',
      tracking: 'Tracking adaptive decisions is NOT determinism. Only absence of adaptive events = DETERMINISTIC.'
    }
  };
  
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  
  return reportPath;
}

/**
 * PHASE 21.2: Write determinism report from decisions.json file
 * 
 * @param {string} runDir - Run directory path
 * @returns {string|null} Path to determinism report, or null if decisions.json not found
 */
export function writeDeterminismReportFromFile(runDir) {
  const decisionsPath = resolve(runDir, 'decisions.json');
  
  if (!existsSync(decisionsPath)) {
    return null;
  }
  
  try {
  // @ts-expect-error - readFileSync with encoding returns string
    const decisionsData = JSON.parse(readFileSync(decisionsPath, 'utf-8'));
    const decisionRecorder = DecisionRecorder.fromExport(decisionsData);
    return writeDeterminismReport(runDir, decisionRecorder);
  } catch (error) {
    // If we can't read decisions, we can't determine determinism
    const reportPath = resolve(runDir, ARTIFACT_REGISTRY.determinismReport.filename);
    const report = {
      version: 1,
      contractVersion: 1,
      artifactVersions: getArtifactVersions(),
      generatedAt: getTimeProvider().iso(),
      verdict: DETERMINISM_VERDICT.NON_DETERMINISTIC,
      message: `Cannot determine determinism: ${error.message}`,
      reasons: [DETERMINISM_REASON.ENVIRONMENT_VARIANCE],
      adaptiveEvents: [],
      decisionSummary: null,
      contract: {
        deterministic: 'Same inputs + same environment + same config → identical normalized artifacts',
        nonDeterministic: 'Any adaptive behavior (adaptive stabilization, retries, truncations) → NON_DETERMINISTIC',
        tracking: 'Tracking adaptive decisions is NOT determinism. Only absence of adaptive events = DETERMINISTIC.'
      }
    };
    writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    return reportPath;
  }
}




