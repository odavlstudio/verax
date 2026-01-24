/**
 * ENTERPRISE READINESS — GA Report Writer
 * 
 * Writes ga.report.json artifact with GA readiness evaluation results.
 */

// @ts-ignore
import { getTimeProvider } from '../../../cli/util/support/time-provider.js';

import { resolve } from 'path';
import { writeFileSync, mkdirSync, existsSync } from 'fs';

/**
 * Write GA report
 * 
 * @param {string} projectDir - Project directory
 * @param {string} runId - Run ID
 * @param {Object} gaResult - GA readiness evaluation result
 * @returns {string} Path to written file
 */
export function writeGAReport(projectDir, runId, gaResult) {
  const outputDir = resolve(projectDir, '.verax', 'security');
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  
  const reportPath = resolve(outputDir, 'ga.report.json');
  
  const report = {
    contractVersion: 1,
    generatedAt: getTimeProvider().iso(),
    runId,
    gaReady: gaResult.pass,
    blockers: gaResult.blockers || [],
    warnings: gaResult.warnings || [],
    summary: gaResult.summary || {},
    inputs: gaResult.inputs || {},
    failureCodes: gaResult.blockers?.map(b => b.code) || [],
    warningCodes: gaResult.warnings?.map(w => w.code) || []
  };
  
  writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  
  return reportPath;
}




