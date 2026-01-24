/**
 * PHASE 21.11 — Truth Certificate
 * 
 * Generates a comprehensive certificate of truth for Enterprise audit.
 * This is the document presented to management/audit/enterprise.
 */

import { getTimeProvider } from '../../../cli/util/support/time-provider.js';

import { resolve } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { loadBaselineSnapshot } from '../baseline/baseline.snapshot.js';

/**
 * Load artifact JSON
 */
function loadArtifact(runDir, filename) {
  const path = resolve(runDir, filename);
  if (!existsSync(path)) {
    return null;
  }
  try {
  // @ts-expect-error - readFileSync with encoding returns string
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Generate truth certificate
 * 
 * @param {string} projectDir - Project directory
 * @param {string} runId - Run ID
 * @returns {Promise<Object>} Truth certificate
 */
export async function generateTruthCertificate(projectDir, runId) {
  const runDir = resolve(projectDir, '.verax', 'runs', runId);
  
  if (!existsSync(runDir)) {
    return null;
  }
  
  // Load all relevant artifacts
  const summary = loadArtifact(runDir, 'summary.json');
  const findings = loadArtifact(runDir, 'findings.json');
  const failureLedger = loadArtifact(runDir, 'failure.ledger.json');
  const performanceReport = loadArtifact(runDir, 'performance.report.json');
  const gaStatus = loadArtifact(runDir, 'ga.status.json');
  const decisions = loadArtifact(runDir, 'decisions.json');
  
  // Security reports
  const releaseDir = resolve(projectDir, 'release');
  const securitySecrets = loadArtifact(releaseDir, 'security.secrets.report.json');
  const securityVuln = loadArtifact(releaseDir, 'security.vuln.report.json');
  
  // Release provenance
  const provenance = loadArtifact(releaseDir, 'release.provenance.json');
  
  // Baseline snapshot
  const baseline = loadBaselineSnapshot(projectDir);
  
  // Evidence Law status
  let evidenceLawStatus = 'UNKNOWN';
  let evidenceLawViolated = false;
  
  if (findings?.findings) {
    for (const finding of findings.findings) {
      if ((finding.severity === 'CONFIRMED' || finding.status === 'CONFIRMED') &&
          finding.evidencePackage && !finding.evidencePackage.isComplete) {
        evidenceLawViolated = true;
        break;
      }
    }
  }
  evidenceLawStatus = evidenceLawViolated ? 'VIOLATED' : 'ENFORCED';
  
  // Determinism verdict
  let determinismVerdict = 'UNKNOWN';
  if (decisions) {
    try {
      const { DecisionRecorder } = await import('../../core/determinism-model.js');
      const recorder = DecisionRecorder.fromExport(decisions);
      const { computeDeterminismVerdict } = await import('../../core/determinism/contract.js');
      const verdict = computeDeterminismVerdict(recorder);
      determinismVerdict = verdict.verdict;
    } catch {
      determinismVerdict = summary?.determinism?.verdict || 'UNKNOWN';
    }
  } else if (summary?.determinism) {
    determinismVerdict = summary.determinism.verdict || 'UNKNOWN';
  }
  
  // Failure summary
  const failureSummary = failureLedger?.summary || {
    total: 0,
    bySeverity: {},
    byCategory: {}
  };
  
  // GA verdict
  const gaVerdict = gaStatus?.gaReady === true ? 'GA-READY' : (gaStatus ? 'GA-BLOCKED' : 'UNKNOWN');
  const gaBlockers = gaStatus?.blockers || [];
  const gaWarnings = gaStatus?.warnings || [];
  
  // Security verdict
  const securityVerdict = {
    secrets: securitySecrets?.hasSecrets ? 'BLOCKED' : (securitySecrets ? 'OK' : 'NOT_CHECKED'),
    vulnerabilities: securityVuln?.blocking ? 'BLOCKED' : (securityVuln ? 'OK' : 'NOT_CHECKED'),
    overall: (securitySecrets?.hasSecrets || securityVuln?.blocking) ? 'BLOCKED' : 
             (securitySecrets || securityVuln) ? 'OK' : 'NOT_CHECKED'
  };
  
  // Performance verdict
  const performanceVerdict = performanceReport?.verdict || 'UNKNOWN';
  const performanceOk = performanceReport?.ok !== false;
  const performanceViolations = performanceReport?.violations || [];
  
  // Baseline hash
  const baselineHash = baseline?.baselineHash || null;
  
  // Release provenance hash
  const provenanceHash = provenance?.hashes?.dist || null;
  
  const certificate = {
    version: 1,
    runId,
    generatedAt: getTimeProvider().iso(),
    url: summary?.url || null,
    
    // Evidence Law
    evidenceLaw: {
      status: evidenceLawStatus,
      violated: evidenceLawViolated,
      statement: 'A finding cannot be marked CONFIRMED without sufficient evidence.'
    },
    
    // Determinism
    determinism: {
      verdict: determinismVerdict,
      message: determinismVerdict === 'DETERMINISTIC' 
        ? 'Run was reproducible (same inputs = same outputs)'
        : determinismVerdict === 'NON_DETERMINISTIC'
        ? 'Run was not reproducible (adaptive events detected)'
        : 'Determinism not evaluated'
    },
    
    // Failures
    failures: {
      total: failureSummary.total,
      bySeverity: failureSummary.bySeverity || {},
      byCategory: failureSummary.byCategory || {},
      blocking: (failureSummary.bySeverity?.BLOCKING || 0) > 0,
      degraded: (failureSummary.bySeverity?.DEGRADED || 0) > 0
    },
    
    // GA
    ga: {
      verdict: gaVerdict,
      ready: gaStatus?.gaReady === true,
      blockers: gaBlockers.length,
      warnings: gaWarnings.length,
      details: {
        blockers: gaBlockers.map(b => ({ code: b.code, message: b.message })),
        warnings: gaWarnings.map(w => ({ code: w.code, message: w.message }))
      }
    },
    
    // Security
    security: securityVerdict,
    
    // Performance
    performance: {
      verdict: performanceVerdict,
      ok: performanceOk,
      violations: performanceViolations.length,
      details: performanceViolations.map(v => ({
        type: v.type,
        actual: v.actual,
        budget: v.budget
      }))
    },
    
    // Baseline
    baseline: {
      hash: baselineHash,
      frozen: baseline?.frozen || false,
      version: baseline?.veraxVersion || null,
      commit: baseline?.gitCommit || null
    },
    
    // Release provenance
    provenance: {
      hash: provenanceHash,
      version: provenance?.version || null,
      commit: provenance?.git?.commit || null
    },
    
    // Overall verdict
    overallVerdict: {
      status: (gaVerdict === 'GA-READY' && 
               evidenceLawStatus === 'ENFORCED' && 
               securityVerdict.overall === 'OK' && 
               performanceOk) ? 'CERTIFIED' : 'NOT_CERTIFIED',
      reasons: [
        evidenceLawViolated ? 'Evidence Law violated' : null,
        gaVerdict !== 'GA-READY' ? 'GA not ready' : null,
        securityVerdict.overall !== 'OK' ? 'Security blocked' : null,
        !performanceOk ? 'Performance violations' : null
      ].filter(Boolean)
    }
  };
  
  return certificate;
}

/**
 * Write truth certificate to file
 * 
 * @param {string} projectDir - Project directory
 * @param {string} runId - Run ID
 * @param {Object} certificate - Truth certificate
 * @returns {string} Path to written file
 */
export function writeTruthCertificate(projectDir, runId, certificate) {
  const runDir = resolve(projectDir, '.verax', 'runs', runId);
  const outputPath = resolve(runDir, 'truth.certificate.json');
  writeFileSync(outputPath, JSON.stringify(certificate, null, 2), 'utf-8');
  return outputPath;
}

/**
 * Load truth certificate from file
 * 
 * @param {string} projectDir - Project directory
 * @param {string} runId - Run ID
 * @returns {Object|null} Truth certificate or null
 */
export function loadTruthCertificate(projectDir, runId) {
  const runDir = resolve(projectDir, '.verax', 'runs', runId);
  const certPath = resolve(runDir, 'truth.certificate.json');
  
  if (!existsSync(certPath)) {
    return null;
  }
  
  try {
  // @ts-expect-error - readFileSync with encoding returns string
    return JSON.parse(readFileSync(certPath, 'utf-8'));
  } catch {
    return null;
  }
}




