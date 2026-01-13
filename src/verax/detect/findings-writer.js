import { resolve } from 'path';
import { mkdirSync, writeFileSync } from 'fs';
import { CANONICAL_OUTCOMES } from '../core/canonical-outcomes.js';

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
  if (!runDirOpt) {
    throw new Error('runDirOpt is required');
  }
  mkdirSync(runDirOpt, { recursive: true });
  const findingsPath = resolve(runDirOpt, 'findings.json');

  // PHASE 2: Compute outcome summary
  const outcomeSummary = {};
  Object.values(CANONICAL_OUTCOMES).forEach(outcome => {
    outcomeSummary[outcome] = 0;
  });
  
  // PHASE 3: Compute promise summary
  const promiseSummary = {};
  
  for (const finding of (findings || [])) {
    const outcome = finding.outcome || CANONICAL_OUTCOMES.SILENT_FAILURE;
    outcomeSummary[outcome] = (outcomeSummary[outcome] || 0) + 1;
    
    const promiseType = finding.promise?.type || 'UNKNOWN_PROMISE';
    promiseSummary[promiseType] = (promiseSummary[promiseType] || 0) + 1;
  }

  const findingsReport = {
    version: 1,
    detectedAt: new Date().toISOString(),
    url: url,
    outcomeSummary: outcomeSummary,  // PHASE 2
    promiseSummary: promiseSummary,  // PHASE 3
    findings: findings,
    coverageGaps: coverageGaps,
    notes: []
  };

  writeFileSync(findingsPath, JSON.stringify(findingsReport, null, 2) + '\n');

  return {
    ...findingsReport,
    findingsPath: findingsPath
  };
}

