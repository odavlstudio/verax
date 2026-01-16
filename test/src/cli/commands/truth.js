/**
 * PHASE 21.11 — Truth Command
 * 
 * `verax truth` - Shows truth certificate summary
 */

import { findLatestRunId } from '../util/run-resolver.js';
import { generateTruthCertificate, loadTruthCertificate } from '../../verax/core/truth/truth.certificate.js';

/**
 * Truth command
 * 
 * @param {string} projectDir - Project directory
 * @param {Object} options - Command options
 */
export async function truthCommand(projectDir, options = {}) {
  const { json = false, runId: runIdOpt = null } = options;
  
  const runId = runIdOpt || findLatestRunId(projectDir);
  
  if (!runId) {
    if (json) {
      console.log(JSON.stringify({
        error: 'NO_RUNS_FOUND',
        message: 'No runs found. Run a scan first.'
      }, null, 2));
    } else {
      console.log('\n=== Truth Certificate ===\n');
      console.log('Error: No runs found. Run a scan first.\n');
    }
    return;
  }
  
  // Try to load existing certificate, otherwise generate
  let certificate = loadTruthCertificate(projectDir, runId);
  
  if (!certificate) {
    certificate = await generateTruthCertificate(projectDir, runId);
    if (certificate) {
      const { writeTruthCertificate } = await import('../../verax/core/truth/truth.certificate.js');
      writeTruthCertificate(projectDir, runId, certificate);
    }
  }
  
  if (!certificate) {
    if (json) {
      console.log(JSON.stringify({
        error: 'CERTIFICATE_GENERATION_FAILED',
        message: 'Failed to generate truth certificate'
      }, null, 2));
    } else {
      console.log('\n=== Truth Certificate ===\n');
      console.log('Error: Failed to generate truth certificate\n');
    }
    return;
  }
  
  if (json) {
    console.log(JSON.stringify(certificate, null, 2));
  } else {
    console.log('\n=== Truth Certificate ===\n');
    console.log(`Run ID: ${certificate.runId}`);
    console.log(`URL: ${certificate.url || 'N/A'}`);
    console.log(`Generated: ${certificate.generatedAt}`);
    
    console.log('\nEvidence Law:');
    console.log(`  Status: ${certificate.evidenceLaw.status}`);
    console.log(`  Violated: ${certificate.evidenceLaw.violated ? 'YES' : 'NO'}`);
    
    console.log('\nDeterminism:');
    console.log(`  Verdict: ${certificate.determinism.verdict}`);
    console.log(`  Message: ${certificate.determinism.message}`);
    
    console.log('\nFailures:');
    console.log(`  Total: ${certificate.failures.total}`);
    console.log(`  Blocking: ${certificate.failures.blocking ? 'YES' : 'NO'}`);
    console.log(`  Degraded: ${certificate.failures.degraded ? 'YES' : 'NO'}`);
    console.log(`  By Severity: ${JSON.stringify(certificate.failures.bySeverity)}`);
    
    console.log('\nGA:');
    console.log(`  Verdict: ${certificate.ga.verdict}`);
    console.log(`  Ready: ${certificate.ga.ready ? 'YES' : 'NO'}`);
    console.log(`  Blockers: ${certificate.ga.blockers}`);
    console.log(`  Warnings: ${certificate.ga.warnings}`);
    
    console.log('\nSecurity:');
    console.log(`  Overall: ${certificate.security.overall}`);
    console.log(`  Secrets: ${certificate.security.secrets}`);
    console.log(`  Vulnerabilities: ${certificate.security.vulnerabilities}`);
    
    console.log('\nPerformance:');
    console.log(`  Verdict: ${certificate.performance.verdict}`);
    console.log(`  OK: ${certificate.performance.ok ? 'YES' : 'NO'}`);
    console.log(`  Violations: ${certificate.performance.violations}`);
    
    console.log('\nBaseline:');
    console.log(`  Hash: ${certificate.baseline.hash || 'N/A'}`);
    console.log(`  Frozen: ${certificate.baseline.frozen ? 'YES' : 'NO'}`);
    console.log(`  Version: ${certificate.baseline.version || 'N/A'}`);
    
    console.log('\nProvenance:');
    console.log(`  Hash: ${certificate.provenance.hash || 'N/A'}`);
    console.log(`  Version: ${certificate.provenance.version || 'N/A'}`);
    
    console.log('\nOverall Verdict:');
    console.log(`  Status: ${certificate.overallVerdict.status}`);
    if (certificate.overallVerdict.reasons.length > 0) {
      console.log(`  Reasons: ${certificate.overallVerdict.reasons.join('; ')}`);
    }
    console.log('');
  }
}

