/**
 * Release Enforcer (Future Feature)
 *
 * Moved to internal/future-gates to isolate non-core release readiness.
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { checkGAStatus } from '../ga/ga.enforcer.js';
import { findLatestRunId } from '../../../cli/util/support/run-resolver.js';

export async function enforceReleaseReadiness(projectDir, operation = 'release') {
  const blockers = [];
  try {
    const runId = findLatestRunId(projectDir);
    if (!runId) blockers.push('No runs found. Run a scan and verify GA readiness first.');
    else {
      const gaCheck = checkGAStatus(projectDir, runId);
      if (!gaCheck.ready) {
        const blockerMessages = gaCheck.status?.blockers?.map(b => b.message).join('; ') || 'GA not ready';
        blockers.push(`GA-BLOCKED: ${blockerMessages}`);
      }
    }
  } catch (error) {
    blockers.push(`GA check failed: ${error.message}`);
  }
  const provenancePath = resolve(projectDir, 'release', 'release.provenance.json');
  if (!existsSync(provenancePath)) blockers.push('Provenance not found. Run "verax release:check" first.');
  else {
    try {
      const provenance = JSON.parse(/** @type {string} */ (readFileSync(provenancePath, 'utf-8')));
      if (provenance.git?.dirty) blockers.push('Provenance indicates dirty git repository');
      if (provenance.gaStatus !== 'GA-READY') blockers.push(`Provenance GA status is ${provenance.gaStatus}, not GA-READY`);
    } catch (error) {
      blockers.push(`Invalid provenance: ${error.message}`);
    }
  }
  const sbomPath = resolve(projectDir, 'release', 'sbom.json');
  if (!existsSync(sbomPath)) blockers.push('SBOM not found. Run "verax release:check" first.');
  else {
    try {
      const sbom = JSON.parse(/** @type {string} */ (readFileSync(sbomPath, 'utf-8')));
      if (!sbom.bomFormat || !sbom.components || !Array.isArray(sbom.components) || sbom.components.length === 0) blockers.push('Invalid or empty SBOM');
    } catch (error) {
      blockers.push(`Invalid SBOM: ${error.message}`);
    }
  }
  const reproducibilityPath = resolve(projectDir, 'release', 'reproducibility.report.json');
  if (!existsSync(reproducibilityPath)) blockers.push('Reproducibility report not found. Run "verax release:check" first.');
  else {
    try {
      const report = JSON.parse(/** @type {string} */ (readFileSync(reproducibilityPath, 'utf-8')));
      if (report.verdict !== 'REPRODUCIBLE') {
        const differences = report.differences?.map(d => d.message).join('; ') || 'Build is not reproducible';
        blockers.push(`NON_REPRODUCIBLE: ${differences}`);
      }
    } catch (error) {
      blockers.push(`Invalid reproducibility report: ${error.message}`);
    }
  }
  const secretsPath = resolve(projectDir, 'release', 'security.secrets.report.json');
  const vulnPath = resolve(projectDir, 'release', 'security.vuln.report.json');
  const supplyChainPath = resolve(projectDir, 'release', 'security.supplychain.report.json');
  if (!existsSync(secretsPath) || !existsSync(vulnPath) || !existsSync(supplyChainPath)) blockers.push('Security reports not found. Run "verax security:check" first.');
  else {
    try {
      const secretsReport = JSON.parse(/** @type {string} */ (readFileSync(secretsPath, 'utf-8')));
      if (secretsReport.hasSecrets) blockers.push(`SECURITY-BLOCKED: Secrets detected (${secretsReport.summary.total} finding(s))`);
      const vulnReport = JSON.parse(/** @type {string} */ (readFileSync(vulnPath, 'utf-8')));
      if (vulnReport.blocking) blockers.push(`SECURITY-BLOCKED: Critical/High vulnerabilities detected (${vulnReport.summary.critical + vulnReport.summary.high} total)`);
      const supplyChainReport = JSON.parse(/** @type {string} */ (readFileSync(supplyChainPath, 'utf-8')));
      if (!supplyChainReport.ok) blockers.push(`SECURITY-BLOCKED: Supply-chain violations (${supplyChainReport.summary.totalViolations} violation(s))`);
    } catch (error) {
      blockers.push(`Security check failed: ${error.message}`);
    }
  }
  const runId = findLatestRunId(projectDir);
  if (runId) {
    try {
      const { checkPerformanceStatus } = await import('../../../verax/core/perf/perf.enforcer.js');
      const perfCheck = checkPerformanceStatus(projectDir, runId);
      if (perfCheck.exists && !perfCheck.ok) blockers.push(`PERFORMANCE-BLOCKED: ${perfCheck.blockers.join('; ')}`);
    } catch {
      // ignore
    }
  }
  if (blockers.length > 0) {
    throw new Error(`Cannot ${operation}: ${blockers.join('; ')}`);
  }
}
