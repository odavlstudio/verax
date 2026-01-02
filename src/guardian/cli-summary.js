/**
 * STRICT CLI SUMMARY: factual, artifact-traceable lines only
 */
const { formatHonestyForCLI } = require('./honesty');

function generateCliSummary(snapshot, policyEval, baselineCheckResult, options = {}) {
  if (!snapshot) return 'No snapshot data available.';
  const meta = snapshot.meta || {};
  const coverage = snapshot.coverage || {};
  const counts = coverage.counts || {};
  const evidence = snapshot.evidenceMetrics || {};
  const resolved = snapshot.resolved || {};
  const verdict = snapshot.verdict || {};

  let output = '\n';
  output += '━'.repeat(70) + '\n';
  output += '🛡️  Guardian Reality Summary\n';
  output += '━'.repeat(70) + '\n\n';

  // VERDICT CARD
  output += '═══ VERDICT CARD ═══\n';
  output += `Verdict: ${verdict.verdict || meta.result || 'UNKNOWN'}\n`;
  if (verdict.confidence) {
    output += `Confidence: ${(verdict.confidence.score * 100).toFixed(1)}%\n`;
  }
  if (verdict.honestyEnforced) {
    output += `⚠️  Honesty Adjustment Applied\n`;
  }
  output += '\n';

  output += `Target: ${meta.url || 'unknown'}\n`;
  output += `Run ID: ${meta.runId || 'unknown'}\n\n`;

  const pe = snapshot.policyEvaluation || {};
  output += `Policy Status: ${meta.result || (pe.passed ? 'PASSED' : pe.exitCode === 2 ? 'WARN' : 'FAILED')}\n`;
  output += `Exit Code: ${pe.exitCode ?? 'unknown'}\n`;

  const planned = coverage.total ?? (resolved.coverage?.total) ?? 'unknown';
  const executed = counts.executedCount ?? (resolved.coverage?.executedCount) ?? coverage.executed ?? 'unknown';
  output += `Executed / Planned: ${executed} / ${planned}\n`;

  const completeness = evidence.completeness ?? resolved.evidenceMetrics?.completeness ?? 'unknown';
  const integrity = evidence.integrity ?? resolved.evidenceMetrics?.integrity ?? 'unknown';
  output += `Coverage Completeness: ${typeof completeness === 'number' ? completeness.toFixed(4) : completeness}\n`;
  output += `Evidence Integrity: ${typeof integrity === 'number' ? integrity.toFixed(4) : integrity}\n`;

  if (meta.attestation?.hash) {
    output += `Attestation: ${meta.attestation.hash}\n`;
  }

  // Audit Summary
  const executedAttempts = (snapshot.attempts || []).filter(a => a.executed).map(a => a.attemptId);
  output += '\nAudit Summary:\n';
  output += `  Tested (${executedAttempts.length}): ${executedAttempts.join(', ') || 'none'}\n`;
  const skippedDisabled = (coverage.skippedDisabledByPreset || []).map(s => s.attempt);
  const skippedUserFiltered = (coverage.skippedUserFiltered || []).map(s => s.attempt);
  const skippedNotApplicable = (coverage.skippedNotApplicable || []).map(s => s.attempt);
  const skippedMissing = (coverage.skippedMissing || []).map(s => s.attempt);
  output += `  Not Tested — DisabledByPreset (${skippedDisabled.length}): ${skippedDisabled.join(', ') || 'none'}\n`;
  output += `  Not Tested — UserFiltered (${skippedUserFiltered.length}): ${skippedUserFiltered.join(', ') || 'none'}\n`;
  output += `  Not Tested — NotApplicable (${skippedNotApplicable.length}): ${skippedNotApplicable.join(', ') || 'none'}\n`;
  output += `  Not Tested — Missing (${skippedMissing.length}): ${skippedMissing.join(', ') || 'none'}\n`;

  const reasons = Array.isArray(pe.reasons) ? pe.reasons : [];
  if (reasons.length > 0) {
    output += '\nPolicy Reasons:\n';
    reasons.forEach(r => {
      if (typeof r === 'string') {
        output += `  • ${r}\n`;
      } else if (r.message) {
        output += `  • ${r.message}\n`;
      } else {
        output += `  • ${JSON.stringify(r)}\n`;
      }
    });
  }

  output += '\n📁 Full report: ' + (meta.runId ? `artifacts/${meta.runId}/` : 'See artifacts/') + '\n\n';
  output += '━'.repeat(70) + '\n';

  // HONESTY CONTRACT - Always display limits of the run
  if (verdict.honestyContract) {
    output += formatHonestyForCLI(verdict.honestyContract);
  } else {
    output += '\n⚠️  HONESTY DATA MISSING - Claims cannot be verified\n\n';
  }

  return output;
}

/**
 * Print summary to console
 */
function printCliSummary(snapshot, policyEval, baselineCheckResult, options = {}) {
  const summary = generateCliSummary(snapshot, policyEval, baselineCheckResult, options);
  console.log(summary);
}

module.exports = {
  generateCliSummary,
  printCliSummary
};
