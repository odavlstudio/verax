/**
 * PHASE 21.6 — GA Readiness CLI Command
 * 
 * Pure inspection command. Evaluates GA readiness using existing artifacts only.
 * No URL, no browser, no project execution.
 */

import { evaluateGAReadiness } from '../../verax/core/ga/ga.contract.js';
import { writeGAStatus } from '../../verax/core/ga/ga.artifact.js';
import { writeGAReport } from '../../verax/core/ga/ga-report-writer.js';
import { GA_BLOCKER_CODE } from '../../verax/core/ga/ga.contract.js';
import { resolve } from 'path';
import { readFileSync, existsSync } from 'fs';
import { findLatestRunId, validateRunId } from '../util/run-resolver.js';
import { UsageError } from '../util/errors.js';

/**
 * Load failure ledger summary
 * 
 * @param {string} projectDir - Project directory
 * @param {string} runId - Run ID
 * @returns {Object|null} Failure ledger summary or null
 */
function loadFailureLedger(projectDir, runId) {
  const ledgerPath = resolve(projectDir, '.verax', 'runs', runId, 'failure.ledger.json');
  if (!existsSync(ledgerPath)) {
    return null;
  }
  
  try {
    const content = readFileSync(ledgerPath, 'utf-8');
  // @ts-expect-error - readFileSync with encoding returns string
    const ledger = JSON.parse(content);
    return ledger.summary || null;
  } catch (error) {
    return null;
  }
}

/**
 * Load determinism verdict
 * 
 * @param {string} projectDir - Project directory
 * @param {string} runId - Run ID
 * @returns {Promise<string|null>} Determinism verdict or null
 */
async function loadDeterminismVerdict(projectDir, runId) {
  const decisionsPath = resolve(projectDir, '.verax', 'runs', runId, 'decisions.json');
  if (!existsSync(decisionsPath)) {
    return null;
  }
  
  try {
  // @ts-expect-error - readFileSync with encoding returns string
    const decisions = JSON.parse(readFileSync(decisionsPath, 'utf-8'));
    const { DecisionRecorder } = await import('../../verax/core/determinism-model.js');
    const recorder = DecisionRecorder.fromExport(decisions);
    const { computeDeterminismVerdict } = await import('../../verax/core/determinism/contract.js');
    const verdict = computeDeterminismVerdict(recorder);
    return verdict.verdict;
  } catch (error) {
    return null;
  }
}

/**
 * Check for Evidence Law violations
 * 
 * @param {string} projectDir - Project directory
 * @param {string} runId - Run ID
 * @returns {boolean} Whether Evidence Law was violated
 */
function checkEvidenceLawViolations(projectDir, runId) {
  const findingsPath = resolve(projectDir, '.verax', 'runs', runId, 'findings.json');
  if (!existsSync(findingsPath)) {
    return false;
  }
  
  try {
    const content = readFileSync(findingsPath, 'utf-8');
  // @ts-expect-error - readFileSync with encoding returns string
    const findings = JSON.parse(content);
    
    if (!Array.isArray(findings.findings)) {
      return false;
    }
    
    // Check for CONFIRMED findings with incomplete evidence
    for (const finding of findings.findings) {
      if ((finding.severity === 'CONFIRMED' || finding.status === 'CONFIRMED') &&
          finding.evidencePackage && !finding.evidencePackage.isComplete) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    return false;
  }
}

/**
 * PHASE 21.6.1: `verax ga` command
 * 
 * Pure inspection command. No URL, no browser, no execution.
 * 
 * @param {Object} options - Options
 * @param {string} [options.runId] - Run ID (defaults to latest)
 * @param {boolean} [options.json] - Output as JSON
 */
export async function gaCommand(options = {}) {
  const { runId: providedRunId = null, json = false } = options;
  
  const projectDir = resolve(process.cwd());
  
  // Resolve run ID: use provided or find latest
  let runId = providedRunId;
  
  if (!runId) {
    // Find latest run
    runId = findLatestRunId(projectDir);
    
    if (!runId) {
      // No runs found - GA is BLOCKED
      const gaResult = {
        pass: false,
        blockers: [{
          code: GA_BLOCKER_CODE.NO_RUNS_FOUND || 'GA_NO_RUNS_FOUND',
          message: 'No runs found in .verax/runs/. Run a scan first.',
          context: {}
        }],
        warnings: [],
        summary: {
          pass: false,
          blockersCount: 1,
          warningsCount: 0,
          checkedAt: new Date().toISOString()
        },
        inputs: {
          gates: null,
          determinism: null,
          evidenceLaw: null,
          failureLedger: null
        }
      };
      
      if (json) {
        console.log(JSON.stringify({
          gaReady: false,
          blockers: gaResult.blockers,
          warnings: [],
          summary: gaResult.summary
        }, null, 2));
      } else {
        console.log('\n' + '='.repeat(80));
        console.log('GA READINESS EVALUATION');
        console.log('='.repeat(80));
        console.log('\nGA STATUS: ❌ BLOCKED');
        console.log('\nBlockers:');
        console.log('- No runs found in .verax/runs/. Run a scan first.');
        console.log('='.repeat(80) + '\n');
      }
      
      process.exit(4);
      return;
    }
  } else {
    // Validate provided run ID
    if (!validateRunId(projectDir, runId)) {
      const error = new UsageError(`Run ID not found: ${runId}`);
      // UsageError already has exit code 64
      throw error;
    }
  }
  
  // Load context from artifacts (pure filesystem reads)
  const failureLedger = loadFailureLedger(projectDir, runId);
  const determinismVerdict = await loadDeterminismVerdict(projectDir, runId);
  const evidenceLawViolated = checkEvidenceLawViolations(projectDir, runId);
  
  // Evaluate GA readiness
  const gaResult = await evaluateGAReadiness({
    projectDir,
    runId,
    determinismVerdict,
    evidenceLawViolated,
    failureLedger
  });
  
  // Write status artifact
  const artifactPath = writeGAStatus(projectDir, runId, gaResult);
  
  // Write GA report
  const reportPath = writeGAReport(projectDir, runId, gaResult);
  
  // Output
  if (json) {
    console.log(JSON.stringify({
      gaReady: gaResult.pass,
      blockers: gaResult.blockers,
      warnings: gaResult.warnings,
      summary: gaResult.summary,
      artifactPath,
      reportPath
    }, null, 2));
  } else {
    console.log('\n' + '='.repeat(80));
    console.log('GA READINESS EVALUATION');
    console.log('='.repeat(80));
    console.log(`\nGA STATUS: ${gaResult.pass ? '✅ READY' : '❌ BLOCKED'}`);
    
    if (gaResult.blockers.length > 0) {
      console.log('\nBlockers:');
      for (const blocker of gaResult.blockers) {
        console.log(`- ${blocker.message}`);
      }
    }
    
    if (gaResult.warnings.length > 0) {
      console.log('\nWarnings:');
      for (const warning of gaResult.warnings) {
        console.log(`- ${warning.message}`);
      }
    }
    
    console.log(`\nSee: ${artifactPath}`);
    console.log(`Report: ${reportPath}`);
    console.log('='.repeat(80) + '\n');
  }
  
  // Exit codes: 0 = GA-READY, 2 = GA-BLOCKED, 70 = Internal corruption
  if (!gaResult.pass) {
    // Check if it's an internal corruption issue
    const hasInternalBlocker = gaResult.blockers.some(b => 
      b.code === 'GA_INTERNAL_FAILURES' || 
      b.code === 'GA_CONTRACT_FAILURES'
    );
    
    if (hasInternalBlocker) {
      process.exit(70);
    } else {
      process.exit(2);
    }
  }
}

