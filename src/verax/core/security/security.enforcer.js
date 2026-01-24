/**
 * PHASE 21.8 — Security Enforcer
 * 
 * Hard lock: blocks GA/Release without SECURITY-OK.
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { createInternalFailure } from '../failures/failure.factory.js';
import { FAILURE_CODE } from '../failures/failure.types.js';

/**
 * Check security status (prefers unified report, falls back to individual reports)
 * 
 * @param {string} projectDir - Project directory
 * @returns {Object} Security status
 */
export function checkSecurityStatus(projectDir) {
  // Try unified report first
  const unifiedPath = resolve(projectDir, '.verax', 'security', 'security.report.json');
  
  const status = {
    exists: false,
    ok: false,
    blockers: []
  };
  
  if (existsSync(unifiedPath)) {
    try {
  // @ts-expect-error - readFileSync with encoding returns string
      const unifiedReport = JSON.parse(readFileSync(unifiedPath, 'utf-8'));
      status.exists = true;
      status.ok = unifiedReport.securityOk || false;
      
      if (!status.ok && unifiedReport.status) {
        // Extract blockers from unified report
        if (unifiedReport.status.secrets && !unifiedReport.status.secrets.ok) {
          status.blockers.push(...(unifiedReport.status.secrets.blockers || []));
        }
        if (unifiedReport.status.vulnerabilities && !unifiedReport.status.vulnerabilities.ok) {
          status.blockers.push(...(unifiedReport.status.vulnerabilities.blockers || []));
        }
        if (unifiedReport.status.supplychain && !unifiedReport.status.supplychain.ok) {
          status.blockers.push(...(unifiedReport.status.supplychain.blockers || []));
        }
      }
      
      return status;
    } catch {
      // Fall through to individual reports
    }
  }
  
  // Fallback to individual reports for backward compatibility
  const secretsPath = resolve(projectDir, 'release', 'security.secrets.report.json');
  const vulnPath = resolve(projectDir, 'release', 'security.vuln.report.json');
  const supplyChainPath = resolve(projectDir, 'release', 'security.supplychain.report.json');
  
  if (!existsSync(secretsPath) || !existsSync(vulnPath) || !existsSync(supplyChainPath)) {
    return status;
  }
  
  status.exists = true;
  
  try {
    // Check secrets
    // @ts-expect-error - readFileSync with encoding returns string
    const secretsReport = JSON.parse(readFileSync(secretsPath, 'utf-8'));
    if (secretsReport.hasSecrets) {
      status.blockers.push(`Secrets detected: ${secretsReport.summary.total} finding(s)`);
    }
    
    // Check vulnerabilities
    // @ts-expect-error - readFileSync with encoding returns string
    const vulnReport = JSON.parse(readFileSync(vulnPath, 'utf-8'));
    if (vulnReport.blocking) {
      status.blockers.push(`Critical/High vulnerabilities: ${vulnReport.summary.critical + vulnReport.summary.high} total`);
    }
    
    // Check supply-chain
    // @ts-expect-error - readFileSync with encoding returns string
    const supplyChainReport = JSON.parse(readFileSync(supplyChainPath, 'utf-8'));
    if (!supplyChainReport.ok) {
      status.blockers.push(`Supply-chain violations: ${supplyChainReport.summary.totalViolations} violation(s)`);
    }
    
    status.ok = status.blockers.length === 0;
  } catch (error) {
    status.blockers.push(`Security check failed: ${error.message}`);
  }
  
  return status;
}

/**
 * Enforce security readiness
 * 
 * @param {string} projectDir - Project directory
 * @param {string} operation - Operation name (ga, release, publish)
 * @throws {Error} If security not OK
 */
export function enforceSecurityReadiness(projectDir, operation = 'operation') {
  const check = checkSecurityStatus(projectDir);
  
  if (!check.exists) {
    const failure = createInternalFailure(
      FAILURE_CODE.INTERNAL_UNEXPECTED_ERROR,
      `Cannot ${operation}: Security reports not found. Run 'verax security:check' first.`,
      'security.enforcer',
      { operation },
      null
    );
    throw failure;
  }
  
  if (!check.ok) {
    const blockerMessages = check.blockers.join('; ');
    const failure = createInternalFailure(
      FAILURE_CODE.INTERNAL_UNEXPECTED_ERROR,
      `Cannot ${operation}: SECURITY-BLOCKED. ${blockerMessages}`,
      'security.enforcer',
      { operation, blockers: check.blockers },
      null
    );
    throw failure;
  }
}




