/**
 * ENTERPRISE READINESS — Release Report Writer
 * 
 * Writes release.report.json artifact with release readiness check results.
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';

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
    generatedAt: new Date().toISOString(),
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

