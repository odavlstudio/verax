/**
 * ENTERPRISE READINESS — Unified Security Report
 * 
 * Produces security.report.json with all security check results in one unified artifact.
 */

import { getTimeProvider } from '../../../cli/util/support/time-provider.js';

import { resolve } from 'path';
import { existsSync, mkdirSync, writeFileSync } from 'fs';

/**
 * Write unified security report
 * 
 * @param {string} projectDir - Project directory
 * @param {Object} report - Security check results
 * @param {string} [outputPath] - Optional custom output path
 * @returns {string} Path to written file
 */
export function writeSecurityReport(projectDir, report, outputPath = null) {
  // Write to .verax/security/security.report.json (run-less artifact)
  const securityDir = resolve(projectDir, '.verax', 'security');
  if (!existsSync(securityDir)) {
    mkdirSync(securityDir, { recursive: true });
  }
  
  const unifiedPath = outputPath || resolve(securityDir, 'security.report.json');
  
  const unifiedReport = {
    contractVersion: 1,
    generatedAt: getTimeProvider().iso(),
    securityOk: report.securityOk,
    status: report.status,
    summary: report.summary,
    findings: {
      secrets: report.secretsReport || null,
      vulnerabilities: report.vulnReport || null,
      supplychain: report.supplyChainReport || null
    },
    toolAvailability: {
      secrets: report.status?.secrets?.tool || 'VERAX_SECRETS_SCANNER',
      vulnerabilities: report.status?.vulnerabilities?.tool || null,
      osv: report.status?.vulnerabilities?.osvAvailable || false,
      supplychain: report.status?.supplychain?.tool || 'VERAX_SUPPLYCHAIN_POLICY'
    }
  };
  
  writeFileSync(unifiedPath, JSON.stringify(unifiedReport, null, 2), 'utf-8');
  
  return unifiedPath;
}




