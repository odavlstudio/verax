// ⚠️ FROZEN FOR V1 — Not part of VERAX v1 product guarantee
// Release gates (provenance, SBOM) planned for v1.1+ enterprise features.

/**
 * PHASE 21.7 — Release Enforcer
 * 
 * Hard lock: blocks publish/release without GA-READY + Provenance + SBOM + Reproducible.
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { checkGAStatus } from '../ga/ga.enforcer.js';
import { findLatestRunId } from '../../../cli/util/support/run-resolver.js';
import { FAILURE_CODE } from '../failures/failure.types.js';
import { isBaselineFrozen, enforceBaseline } from '../baseline/baseline.enforcer.js';
import { FailureLedger } from '../failures/failure.ledger.js';

/**
 * Check if release is allowed
 * 
 * @param {string} projectDir - Project directory
 * @param {string} operation - Operation name (publish, release, tag)
 * @throws {Error} If release is blocked
 */
export async function enforceReleaseReadiness(projectDir, operation = 'release') {
  const blockers = [];
  
  // 1. Check GA status
  try {
    const runId = findLatestRunId(projectDir);
    if (!runId) {
      blockers.push('No runs found. Run a scan and verify GA readiness first.');
    } else {
      const gaCheck = checkGAStatus(projectDir, runId);
      if (!gaCheck.ready) {
        const blockerMessages = gaCheck.status?.blockers?.map(b => b.message).join('; ') || 'GA not ready';
        blockers.push(`GA-BLOCKED: ${blockerMessages}`);
      }
    }
  } catch (error) {
    blockers.push(`GA check failed: ${error.message}`);
  }
  
  // 2. Check Provenance
  const provenancePath = resolve(projectDir, 'release', 'release.provenance.json');
  if (!existsSync(provenancePath)) {
    blockers.push('Provenance not found. Run "verax release:check" first.');
  } else {
    try {
  // @ts-expect-error - readFileSync with encoding returns string
      const provenance = JSON.parse(readFileSync(provenancePath, 'utf-8'));
      if (provenance.git?.dirty) {
        blockers.push('Provenance indicates dirty git repository');
      }
      if (provenance.gaStatus !== 'GA-READY') {
        blockers.push(`Provenance GA status is ${provenance.gaStatus}, not GA-READY`);
      }
    } catch (error) {
      blockers.push(`Invalid provenance: ${error.message}`);
    }
  }
  
  // 3. Check SBOM
  const sbomPath = resolve(projectDir, 'release', 'sbom.json');
  if (!existsSync(sbomPath)) {
    blockers.push('SBOM not found. Run "verax release:check" first.');
  } else {
    try {
  // @ts-expect-error - readFileSync with encoding returns string
      const sbom = JSON.parse(readFileSync(sbomPath, 'utf-8'));
      if (!sbom.bomFormat || !sbom.components || !Array.isArray(sbom.components) || sbom.components.length === 0) {
        blockers.push('Invalid or empty SBOM');
      }
    } catch (error) {
      blockers.push(`Invalid SBOM: ${error.message}`);
    }
  }
  
  // 4. Check Reproducibility
  const reproducibilityPath = resolve(projectDir, 'release', 'reproducibility.report.json');
  if (!existsSync(reproducibilityPath)) {
    blockers.push('Reproducibility report not found. Run "verax release:check" first.');
  } else {
    try {
  // @ts-expect-error - readFileSync with encoding returns string
      const report = JSON.parse(readFileSync(reproducibilityPath, 'utf-8'));
      if (report.verdict !== 'REPRODUCIBLE') {
        const differences = report.differences?.map(d => d.message).join('; ') || 'Build is not reproducible';
        blockers.push(`NON_REPRODUCIBLE: ${differences}`);
      }
    } catch (error) {
      blockers.push(`Invalid reproducibility report: ${error.message}`);
    }
  }
  
  // 5. Check Security (PHASE 21.8)
  const secretsPath = resolve(projectDir, 'release', 'security.secrets.report.json');
  const vulnPath = resolve(projectDir, 'release', 'security.vuln.report.json');
  const supplyChainPath = resolve(projectDir, 'release', 'security.supplychain.report.json');
  
  if (!existsSync(secretsPath) || !existsSync(vulnPath) || !existsSync(supplyChainPath)) {
    blockers.push('Security reports not found. Run "verax security:check" first.');
  } else {
    try {
      // Check secrets
      // @ts-expect-error - readFileSync with encoding returns string
      const secretsReport = JSON.parse(readFileSync(secretsPath, 'utf-8'));
      if (secretsReport.hasSecrets) {
        blockers.push(`SECURITY-BLOCKED: Secrets detected (${secretsReport.summary.total} finding(s))`);
      }
      
      // Check vulnerabilities
      // @ts-expect-error - readFileSync with encoding returns string
      const vulnReport = JSON.parse(readFileSync(vulnPath, 'utf-8'));
      if (vulnReport.blocking) {
        blockers.push(`SECURITY-BLOCKED: Critical/High vulnerabilities detected (${vulnReport.summary.critical + vulnReport.summary.high} total)`);
      }
      
      // Check supply-chain
      // @ts-expect-error - readFileSync with encoding returns string
      const supplyChainReport = JSON.parse(readFileSync(supplyChainPath, 'utf-8'));
      if (!supplyChainReport.ok) {
        blockers.push(`SECURITY-BLOCKED: Supply-chain violations (${supplyChainReport.summary.totalViolations} violation(s))`);
      }
    } catch (error) {
      blockers.push(`Security check failed: ${error.message}`);
    }
  }
  
  // 6. Check Performance (PHASE 21.9) - BLOCKING perf violations block release
  const runId = findLatestRunId(projectDir);
  if (runId) {
    try {
      const { checkPerformanceStatus } = await import('../perf/perf.enforcer.js');
      const perfCheck = checkPerformanceStatus(projectDir, runId);
      
      if (perfCheck.exists && !perfCheck.ok) {
        blockers.push(`PERFORMANCE-BLOCKED: ${perfCheck.blockers.join('; ')}`);
      }
    } catch (error) {
      // Performance check failure is not a blocker (may be from old runs)
    }
  }
  
  // 7. Baseline Freeze Enforcement (PHASE 21.11)
  // After GA, baseline must be frozen and unchanged
  if (isBaselineFrozen(projectDir)) {
    const failureLedger = new FailureLedger(projectDir, runId || 'unknown');
    const baselineCheck = enforceBaseline(projectDir, failureLedger);
    if (baselineCheck.blocked) {
      blockers.push(`BASELINE-DRIFT: ${baselineCheck.message}. Changes to core contracts/policies after GA require MAJOR version bump and baseline regeneration.`);
    }
  }
  
  // If any blockers, throw error
  if (blockers.length > 0) {
    const message = `Cannot ${operation}: RELEASE-BLOCKED. ${blockers.join('; ')}`;
    const error = new Error(message);
    // @ts-expect-error - Custom error properties for enforcement context
    error.code = FAILURE_CODE.INTERNAL_UNEXPECTED_ERROR;
    // @ts-expect-error - Custom error property
    error.component = 'release.enforcer';
    // @ts-expect-error - Custom error property
    error.context = { operation, blockers };
    throw error;
  }
}




