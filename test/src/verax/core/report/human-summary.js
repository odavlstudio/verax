/**
 * PHASE 21.10 — Human Summary
 * 
 * Generates human-readable summary for Enterprise UX.
 * Clear, direct, no marketing.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

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
 * Generate human summary
 * 
 * @param {string} projectDir - Project directory
 * @param {string} runId - Run ID
 * @returns {Promise<Object>} Human summary
 */
export async function generateHumanSummary(projectDir, runId) {
  const runDir = resolve(projectDir, '.verax', 'runs', runId);
  
  if (!existsSync(runDir)) {
    return null;
  }
  
  const summary = loadArtifact(runDir, 'summary.json');
  const findings = loadArtifact(runDir, 'findings.json');
  const determinism = loadArtifact(runDir, 'decisions.json');
  const performanceReport = loadArtifact(runDir, 'performance.report.json');
  
  // Security reports are in release/ directory (project root)
  // Use projectDir parameter directly (already resolved)
  const releaseDir = resolve(projectDir, 'release');
  const securitySecrets = loadArtifact(releaseDir, 'security.secrets.report.json');
  const securityVuln = loadArtifact(releaseDir, 'security.vuln.report.json');
  
  const gaStatus = loadArtifact(runDir, 'ga.status.json');
  
  if (!summary) {
    return null;
  }
  
  const findingsArray = Array.isArray(findings?.findings) ? findings.findings : [];
  const confirmedFindings = findingsArray.filter(f => (f.severity || f.status) === 'CONFIRMED');
  const suspectedFindings = findingsArray.filter(f => (f.severity || f.status) === 'SUSPECTED');
  
  // What VERAX is confident about
  const confident = {
    findings: confirmedFindings.length,
    message: confirmedFindings.length > 0 
      ? `${confirmedFindings.length} finding(s) with complete evidence`
      : 'No findings with complete evidence',
    details: confirmedFindings.map(f => ({
      type: f.type,
      outcome: f.outcome,
      confidence: f.confidenceLevel || 'UNKNOWN'
    }))
  };
  
  // What VERAX is NOT confident about
  const notConfident = {
    findings: suspectedFindings.length,
    message: suspectedFindings.length > 0
      ? `${suspectedFindings.length} finding(s) with incomplete evidence (SUSPECTED)`
      : 'No findings with incomplete evidence',
    details: suspectedFindings.map(f => ({
      type: f.type,
      outcome: f.outcome,
      confidence: f.confidenceLevel || 'UNKNOWN',
      missingEvidence: f.evidencePackage?.isComplete === false
    }))
  };
  
  // Why some things were skipped
  const skips = [];
  if (summary.truth?.observe?.skips) {
    for (const skip of summary.truth.observe.skips) {
      skips.push({
        reason: skip.reason || skip.code || 'UNKNOWN',
        count: skip.count || 1,
        message: skip.message || `Skipped: ${skip.reason || skip.code}`
      });
    }
  }
  
  // Determinism verdict
  let determinismVerdict = 'UNKNOWN';
  if (determinism) {
    try {
      // @ts-expect-error - Dynamic import path
      const { DecisionRecorder } = await import('../../../core/determinism-model.js');
      const recorder = DecisionRecorder.fromExport(determinism);
      // @ts-expect-error - Dynamic import path
      const { computeDeterminismVerdict } = await import('../../../core/determinism/contract.js');
      const verdict = computeDeterminismVerdict(recorder);
      determinismVerdict = verdict.verdict;
    } catch {
      determinismVerdict = summary.determinism?.verdict || 'UNKNOWN';
    }
  } else if (summary.determinism) {
    determinismVerdict = summary.determinism.verdict || 'UNKNOWN';
  }
  
  // Performance verdict
  const performanceVerdict = performanceReport?.verdict || 'UNKNOWN';
  const performanceOk = performanceReport?.ok !== false;
  
  // Security verdict
  const securityOk = !securitySecrets?.hasSecrets && 
                     !securityVuln?.blocking &&
                     (securitySecrets !== null || securityVuln !== null); // At least one report exists
  
  // GA verdict
  const gaReady = gaStatus?.gaReady === true;
  const gaVerdict = gaReady ? 'GA-READY' : (gaStatus ? 'GA-BLOCKED' : 'UNKNOWN');
  
  return {
    runId,
    whatWeKnow: {
      confident: confident,
      notConfident: notConfident,
      skips: skips.length > 0 ? {
        total: skips.reduce((sum, s) => sum + s.count, 0),
        reasons: skips
      } : null
    },
    verdicts: {
      determinism: {
        verdict: determinismVerdict,
        message: determinismVerdict === 'DETERMINISTIC' 
          ? 'Run was reproducible (same inputs = same outputs)'
          : determinismVerdict === 'NON_DETERMINISTIC'
          ? 'Run was not reproducible (adaptive events detected)'
          : 'Determinism not evaluated'
      },
      performance: {
        verdict: performanceVerdict,
        ok: performanceOk,
        message: performanceOk
          ? 'Performance within budget'
          : performanceReport?.violations?.length > 0
          ? `${performanceReport.violations.length} BLOCKING performance violation(s)`
          : 'Performance not evaluated'
      },
      security: {
        ok: securityOk,
        message: securityOk
          ? 'Security baseline passed'
          : securitySecrets?.hasSecrets
          ? 'Secrets detected'
          : securityVuln?.blocking
          ? 'Critical vulnerabilities detected'
          : 'Security not evaluated'
      },
      ga: {
        verdict: gaVerdict,
        ready: gaReady,
        message: gaReady
          ? 'GA-READY: All gates passed'
          : gaStatus
          ? `GA-BLOCKED: ${gaStatus.blockers?.length || 0} blocker(s)`
          : 'GA not evaluated'
      }
    },
    generatedAt: new Date().toISOString()
  };
}

/**
 * Format finding with Human-Readable Report Contract v1
 * Six-line template per finding
 */
function formatFinding(finding, index) {
  const lines = [];
  lines.push(`\nFinding #${index + 1}`);
  
  // Summary: what the user did (handle both old and new format)
  const summary = finding.what_happened || 
                  (finding.interaction ? `User interacted with ${finding.interaction.target || 'element'}` : '') ||
                  (finding.promise ? `Expected ${finding.promise.kind}: ${finding.promise.value}` : '') ||
                  'Interaction occurred';
  lines.push(`  Summary: ${summary}`);
  
  // Expected: what user expected (handle both old and new format)
  const expected = finding.what_was_expected || 
                   (finding.promise ? `${finding.promise.kind} ${finding.promise.value}` : '') ||
                   'Expected behavior not specified';
  lines.push(`  Expected: ${expected}`);
  
  // Observed: what actually happened (handle both old and new format)
  const observed = finding.what_was_observed || 
                   finding.reason || 
                   (finding.classification ? `${finding.classification}` : '') ||
                   'Actual behavior not specified';
  lines.push(`  Observed: ${observed}`);
  
  // Evidence (before) - Use interaction ID or finding ID as stable reference
  const beforeId = finding.interaction?.sequenceId 
    ? `UI#${finding.interaction.sequenceId}` 
    : finding.id ? `REF#${finding.id}` 
    : 'UI#?';
  lines.push(`  Evidence (before): ${beforeId}`);
  
  // Evidence (after) - Use evidence package references if available
  const afterIds = [];
  if (finding.evidencePackage?.evidence?.dom) afterIds.push('DOM#' + (finding.interaction?.sequenceId || finding.id || '?'));
  if (finding.evidencePackage?.evidence?.network) afterIds.push('NET#' + (finding.interaction?.sequenceId || finding.id || '?'));
  if (finding.evidencePackage?.evidence?.console) afterIds.push('LOG#' + (finding.interaction?.sequenceId || finding.id || '?'));
  const afterId = afterIds.length > 0 
    ? afterIds.join(', ') 
    : finding.id ? `REF#${finding.id}` 
    : 'UI#?';
  lines.push(`  Evidence (after): ${afterId}`);
  
  // Why this matters - Neutral impact statement
  const impact = finding.signals?.impact || finding.impact || 'UNKNOWN';
  const userRisk = finding.signals?.userRisk || 'affects user workflow';
  lines.push(`  Why this matters: ${impact} impact, ${userRisk}`);
  
  return lines.join('\n');
}

/**
 * Format coverage transparency block
 */
function formatCoverage(summary) {
  const lines = [];
  lines.push('\n' + '='.repeat(80));
  lines.push('COVERAGE');
  lines.push('='.repeat(80));
  
  // Tested interactions (confirmed + suspected findings)
  const testedCount = summary.whatWeKnow.confident.findings + summary.whatWeKnow.notConfident.findings;
  lines.push(`\nTested interactions: ${testedCount}`);
  if (testedCount > 0) {
    lines.push(`  ${summary.whatWeKnow.confident.findings} with complete evidence`);
    lines.push(`  ${summary.whatWeKnow.notConfident.findings} with incomplete evidence`);
  }
  
  // Skipped interactions (aggregated by canonical enum)
  if (summary.whatWeKnow.skips && summary.whatWeKnow.skips.canonicalReasons) {
    lines.push(`\nSkipped interactions: ${summary.whatWeKnow.skips.total}`);
    for (const skip of summary.whatWeKnow.skips.canonicalReasons) {
      lines.push(`  ${skip.canonical}: ${skip.count}`);
    }
  } else if (summary.whatWeKnow.skips) {
    // Backward compatibility: use raw reasons if canonical not available
    lines.push(`\nSkipped interactions: ${summary.whatWeKnow.skips.total}`);
    for (const skip of summary.whatWeKnow.skips.reasons) {
      lines.push(`  ${skip.code || skip.reason}: ${skip.count}`);
    }
  } else {
    lines.push(`\nSkipped interactions: 0`);
  }
  
  // Coverage disclaimer
  lines.push('');
  lines.push('Coverage indicates what was observed in this run; it does not guarantee absence of issues.');
  lines.push('='.repeat(80));
  
  return lines.join('\n');
}

/**
 * Format human summary for CLI display
 * 
 * @param {Object} summary - Human summary
 * @returns {string} Formatted string
 */
export function formatHumanSummary(summary) {
  if (!summary) {
    return 'Summary: Not available';
  }
  
  const lines = [];
  lines.push('\n' + '='.repeat(80));
  lines.push('HUMAN SUMMARY');
  lines.push('='.repeat(80));
  
  // What we know
  lines.push('\nWhat VERAX is confident about:');
  lines.push(`  ${summary.whatWeKnow.confident.message}`);
  
  lines.push('\nWhat VERAX is NOT confident about:');
  lines.push(`  ${summary.whatWeKnow.notConfident.message}`);
  
  if (summary.whatWeKnow.skips) {
    lines.push('\nWhy some things were skipped:');
    for (const skip of summary.whatWeKnow.skips.reasons) {
      lines.push(`  - ${skip.message} (${skip.count}x)`);
    }
  }
  
  // Verdicts
  lines.push('\nVerdicts:');
  lines.push(`  Determinism: ${summary.verdicts.determinism.verdict} - ${summary.verdicts.determinism.message}`);
  lines.push(`  Performance: ${summary.verdicts.performance.verdict} - ${summary.verdicts.performance.message}`);
  lines.push(`  Security: ${summary.verdicts.security.ok ? 'OK' : 'BLOCKED'} - ${summary.verdicts.security.message}`);
  lines.push(`  GA: ${summary.verdicts.ga.verdict} - ${summary.verdicts.ga.message}`);
  
  lines.push('='.repeat(80) + '\n');
  
  return lines.join('\n');
}

/**
 * Format detailed findings report with Human-Readable Report Contract v1
 * Adds six-line finding summaries + coverage transparency
 * 
 * @param {string} projectDir - Project directory
 * @param {string} runId - Run ID
 * @returns {Promise<string>} Formatted report
 */
export async function formatFindingsReport(projectDir, runId) {
  const runDir = resolve(projectDir, '.verax', 'runs', runId);
  const findings = loadArtifact(runDir, 'findings.json');
  const summary = await generateHumanSummary(projectDir, runId);
  
  if (!findings || !summary) {
    return 'Findings report not available';
  }
  
  const lines = [];
  lines.push('\n' + '='.repeat(80));
  lines.push('FINDINGS REPORT (Human-Readable Contract v1)');
  lines.push('='.repeat(80));
  
  const findingsArray = findings.findings || [];
  
  if (findingsArray.length === 0) {
    lines.push('\nNo findings detected');
  } else {
    lines.push(`\nTotal findings: ${findingsArray.length}`);
    
    // Format each finding with 6-line template
    for (let i = 0; i < findingsArray.length; i++) {
      lines.push(formatFinding(findingsArray[i], i));
    }
  }
  
  // Add coverage transparency block
  lines.push(formatCoverage(summary));
  lines.push('='.repeat(80) + '\n');
  
  return lines.join('\n');
}

