/**
 * ENTERPRISE READINESS — Release Report Writer
 * 
 * Writes release.report.json artifact with release readiness check results.
 */

import { getTimeProvider } from '../../../cli/util/support/time-provider.js';

import { resolve } from 'path';
import { existsSync, mkdirSync, writeFileSync } from 'fs';

/**
 * Write release report
 * 
 * @param {string} projectDir - Project directory
 * @param {Object} releaseStatus - Release readiness status
 * @returns {string} Path to written file
 */
export function writeReleaseReport(projectDir, releaseStatus) {
  const outputDir = resolve(projectDir, 'release');
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  
  const reportPath = resolve(outputDir, 'release.report.json');
  
  const report = {
    contractVersion: 1,
    generatedAt: getTimeProvider().iso(),
    releaseReady: releaseStatus.releaseReady || false,
    status: releaseStatus.status || {},
    summary: releaseStatus.summary || {},
    failureCodes: Object.entries(releaseStatus.status || {})
      .filter(([_, s]) => !s.ok)
      .flatMap(([key, s]) => s.blockers?.map(b => `${key.toUpperCase()}_${b.code || 'BLOCKED'}`) || [])
  };
  
  writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  
  return reportPath;
}




