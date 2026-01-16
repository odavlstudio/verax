/**
 * PHASE 21.7 — Release Check CLI Command
 * 
 * Checks release readiness: GA status, Provenance, SBOM, Reproducibility.
 * Exit codes: 0 = RELEASE-READY, 5 = RELEASE-BLOCKED, 70 = Internal corruption
 */

import { buildProvenance, writeProvenance } from '../../verax/core/release/provenance.builder.js';
import { buildSBOM, writeSBOM } from '../../verax/core/release/sbom.builder.js';
import { checkReproducibility, writeReproducibilityReport } from '../../verax/core/release/reproducibility.check.js';
import { checkGAStatus } from '../../verax/core/ga/ga.enforcer.js';
import { writeReleaseReport } from '../../verax/core/release/release-report-writer.js';
import { findLatestRunId } from '../util/run-resolver.js';
import { resolve } from 'path';
import { existsSync, readFileSync } from 'fs';

/**
 * Check release readiness
 * 
 * @param {Object} options - Options
 * @param {boolean} [options.json] - Output as JSON
 */
export async function releaseCheckCommand(options = {}) {
  const { json = false } = options;
  const projectDir = resolve(process.cwd());
  
  const status = {
    ga: { ok: false, status: 'UNKNOWN', blockers: [] },
    provenance: { ok: false, exists: false, blockers: [] },
    sbom: { ok: false, exists: false, blockers: [] },
    reproducibility: { ok: false, verdict: 'UNKNOWN', blockers: [] }
  };
  
  // 1. Check GA status
  try {
    const runId = findLatestRunId(projectDir);
    if (runId) {
      const gaCheck = checkGAStatus(projectDir, runId);
      status.ga.ok = gaCheck.ready;
      status.ga.status = gaCheck.ready ? 'GA-READY' : 'GA-BLOCKED';
      if (!gaCheck.ready && gaCheck.status?.blockers) {
        status.ga.blockers = gaCheck.status.blockers.map(b => b.message);
      }
    } else {
      status.ga.blockers.push('No runs found. Run a scan first.');
    }
  } catch (error) {
    status.ga.blockers.push(`GA check failed: ${error.message}`);
  }
  
  // 2. Check Provenance
  try {
    const provenancePath = resolve(projectDir, 'release', 'release.provenance.json');
    if (existsSync(provenancePath)) {
      status.provenance.exists = true;
  // @ts-expect-error - readFileSync with encoding returns string
      const provenance = JSON.parse(readFileSync(provenancePath, 'utf-8'));
      
      // Validate provenance structure
      if (!provenance.version || !provenance.git || !provenance.env) {
        status.provenance.blockers.push('Invalid provenance structure');
      } else if (provenance.git.dirty) {
        status.provenance.blockers.push('Provenance indicates dirty git repository');
      } else if (provenance.gaStatus !== 'GA-READY') {
        status.provenance.blockers.push(`GA status is ${provenance.gaStatus}, not GA-READY`);
      } else {
        status.provenance.ok = true;
      }
    } else {
      // Try to build it
      try {
        const provenance = await buildProvenance(projectDir);
        writeProvenance(projectDir, provenance);
        status.provenance.exists = true;
        status.provenance.ok = true;
      } catch (error) {
        status.provenance.blockers.push(`Cannot build provenance: ${error.message}`);
      }
    }
  } catch (error) {
    status.provenance.blockers.push(`Provenance check failed: ${error.message}`);
  }
  
  // 3. Check SBOM
  try {
    const sbomPath = resolve(projectDir, 'release', 'sbom.json');
    if (existsSync(sbomPath)) {
      status.sbom.exists = true;
  // @ts-expect-error - readFileSync with encoding returns string
      const sbom = JSON.parse(readFileSync(sbomPath, 'utf-8'));
      
      // Validate SBOM structure
      if (!sbom.bomFormat || !sbom.components || !Array.isArray(sbom.components)) {
        status.sbom.blockers.push('Invalid SBOM structure');
      } else if (sbom.components.length === 0) {
        status.sbom.blockers.push('SBOM has no components');
      } else {
        status.sbom.ok = true;
      }
    } else {
      // Try to build it
      try {
        const sbom = await buildSBOM(projectDir);
        writeSBOM(projectDir, sbom);
        status.sbom.exists = true;
        status.sbom.ok = true;
      } catch (error) {
        status.sbom.blockers.push(`Cannot build SBOM: ${error.message}`);
      }
    }
  } catch (error) {
    status.sbom.blockers.push(`SBOM check failed: ${error.message}`);
  }
  
  // 4. Check Reproducibility
  try {
    const report = await checkReproducibility(projectDir);
    writeReproducibilityReport(projectDir, report);
    
    if (report.verdict === 'REPRODUCIBLE') {
      status.reproducibility.ok = true;
      status.reproducibility.verdict = 'REPRODUCIBLE';
    } else {
      status.reproducibility.verdict = 'NON_REPRODUCIBLE';
      if (report.differences && report.differences.length > 0) {
        status.reproducibility.blockers = report.differences.map(d => d.message);
      } else {
        status.reproducibility.blockers.push('Build is not reproducible');
      }
    }
  } catch (error) {
    status.reproducibility.blockers.push(`Reproducibility check failed: ${error.message}`);
  }
  
  // Determine overall status
  const allOk = status.ga.ok && status.provenance.ok && status.sbom.ok && status.reproducibility.ok;
  const hasInternalCorruption = 
    status.ga.blockers.some(b => b.includes('corruption') || b.includes('INTERNAL')) ||
    status.provenance.blockers.some(b => b.includes('corruption')) ||
    status.sbom.blockers.some(b => b.includes('corruption'));
  
  // Write release report
  const releaseStatus = {
    releaseReady: allOk,
    status,
    summary: {
      ga: status.ga.ok ? 'OK' : 'BLOCKED',
      provenance: status.provenance.ok ? 'OK' : 'BLOCKED',
      sbom: status.sbom.ok ? 'OK' : 'BLOCKED',
      reproducibility: status.reproducibility.ok ? 'OK' : 'BLOCKED'
    }
  };
  const releaseReportPath = writeReleaseReport(projectDir, releaseStatus);
  
  // Output
  if (json) {
    console.log(JSON.stringify({
      releaseReady: allOk,
      status,
      summary: {
        ga: status.ga.ok ? 'OK' : 'BLOCKED',
        provenance: status.provenance.ok ? 'OK' : 'BLOCKED',
        sbom: status.sbom.ok ? 'OK' : 'BLOCKED',
        reproducibility: status.reproducibility.ok ? 'OK' : 'BLOCKED'
      },
      reportPath: releaseReportPath
    }, null, 2));
  } else {
    console.log('\n' + '='.repeat(80));
    console.log('RELEASE READINESS CHECK');
    console.log('='.repeat(80));
    
    console.log(`\nGA Status: ${status.ga.ok ? '✅ READY' : '❌ BLOCKED'}`);
    if (status.ga.blockers.length > 0) {
      for (const blocker of status.ga.blockers) {
        console.log(`  - ${blocker}`);
      }
    }
    
    console.log(`\nProvenance: ${status.provenance.ok ? '✅ OK' : '❌ BLOCKED'}`);
    if (status.provenance.blockers.length > 0) {
      for (const blocker of status.provenance.blockers) {
        console.log(`  - ${blocker}`);
      }
    }
    
    console.log(`\nSBOM: ${status.sbom.ok ? '✅ OK' : '❌ BLOCKED'}`);
    if (status.sbom.blockers.length > 0) {
      for (const blocker of status.sbom.blockers) {
        console.log(`  - ${blocker}`);
      }
    }
    
    console.log(`\nReproducibility: ${status.reproducibility.ok ? '✅ REPRODUCIBLE' : '❌ NON_REPRODUCIBLE'}`);
    if (status.reproducibility.blockers.length > 0) {
      for (const blocker of status.reproducibility.blockers) {
        console.log(`  - ${blocker}`);
      }
    }
    
    console.log(`\nOverall: ${allOk ? '✅ RELEASE-READY' : '❌ RELEASE-BLOCKED'}`);
    console.log(`\nSee report: ${releaseReportPath}`);
    console.log('='.repeat(80) + '\n');
  }
  
  // Exit codes: 0 = RELEASE-READY, 2 = RELEASE-BLOCKED, 70 = Internal corruption
  if (allOk) {
    process.exit(0);
  } else if (hasInternalCorruption) {
    process.exit(70);
  } else {
    process.exit(2);
  }
}

