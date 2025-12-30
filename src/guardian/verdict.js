/**
 * Unified Verdict Builder
 * Deterministic, explainable verdict and confidence scoring
 */

function clamp01(x) { return Math.max(0, Math.min(1, x)); }

const isExecutedAttempt = (attempt) => attempt && attempt.outcome !== 'SKIPPED';

function mapRunResultToVerdict(runResult) {
  const r = (runResult || '').toUpperCase();
  if (r === 'PASSED') return 'READY';
  if (r === 'FAILED') return 'DO_NOT_LAUNCH';
  if (r === 'INSUFFICIENT_EVIDENCE') return 'INSUFFICIENT_EVIDENCE';
  return 'FRICTION'; // WARN or anything else
}

function computeCoverageScore(snapshot) {
  const disc = snapshot.discovery || {};
  if (disc.interactionsDiscovered && disc.interactionsDiscovered > 0) {
    return clamp01((disc.interactionsExecuted || 0) / (disc.interactionsDiscovered || 1));
  }
  const attempts = snapshot.attempts || [];
  const executedAttempts = attempts.filter(isExecutedAttempt);
  const executed = executedAttempts.length;
  return executed > 0 ? 1 : 0; // if we have executed attempts, consider coverage adequate
}

function computeEvidenceScore(snapshot) {
  const e = snapshot.evidence || {};
  const features = [
    !!e.marketReportJson,
    !!e.marketReportHtml,
    !!e.traceZip,
    !!(e.attemptArtifacts && Object.keys(e.attemptArtifacts).length > 0)
  ];
  const present = features.filter(Boolean).length;
  return clamp01(present / features.length);
}

function computePenalty(snapshot) {
  const attempts = snapshot.attempts || [];
  const failures = attempts.filter(a => a.outcome === 'FAILURE').length;
  const frictions = attempts.filter(a => a.outcome === 'FRICTION').length;
  const perFailure = 0.15;
  const perFriction = 0.1;
  const raw = failures * perFailure + frictions * perFriction;
  return Math.min(0.5, raw);
}

function levelFromScore(score) {
  if (score >= 0.66) return 'high';
  if (score >= 0.33) return 'medium';
  return 'low';
}

function collectKeyFindings(snapshot) {
  const findings = [];
  const attempts = snapshot.attempts || [];
  const executedAttempts = attempts.filter(a => a.outcome !== 'SKIPPED');
  const skippedAttempts = attempts.filter(a => a.outcome === 'SKIPPED');
  const successful = executedAttempts.filter(a => a.outcome === 'SUCCESS').length;
  const failed = executedAttempts.filter(a => a.outcome === 'FAILURE').length;
  const friction = executedAttempts.filter(a => a.outcome === 'FRICTION').length;

  // Attempt outcomes
  if (executedAttempts.length > 0) {
    findings.push(`${successful} of ${executedAttempts.length} executed attempts completed`);
    if (failed > 0) findings.push(`${failed} attempt did not complete`);
    if (friction > 0) findings.push(`${friction} attempt showed friction (slower or rougher than baseline)`);
    if (skippedAttempts.length > 0) {
      findings.push(`${skippedAttempts.length} attempt was not executed`);
    }
  }

  // Market impact
  const mi = snapshot.marketImpactSummary || {};
  const counts = mi.countsBySeverity || { CRITICAL: 0, WARNING: 0, INFO: 0 };
  if (counts.CRITICAL > 0 || counts.WARNING > 0) {
    findings.push(`${counts.CRITICAL} critical risk and ${counts.WARNING} warning risk identified`);
  } else {
    findings.push(`No critical or warning risks identified`);
  }

  // Discovery coverage
  const disc = snapshot.discovery || {};
  if ((disc.interactionsExecuted || 0) > 0) {
    findings.push(`${disc.interactionsExecuted}/${disc.interactionsDiscovered || 0} discovered interactions executed`);
  }

  // Evidence
  const e = snapshot.evidence || {};
  const hasReports = !!(e.marketReportJson && e.marketReportHtml);
  const hasTraces = !!e.traceZip;
  const hasScreenshots = !!(e.attemptArtifacts && Object.keys(e.attemptArtifacts).length > 0);
  const evidenceCount = [hasReports, hasTraces, hasScreenshots].filter(Boolean).length;
  if (evidenceCount === 3) {
    findings.push(`Complete evidence: reports, traces, and screenshots captured`);
  } else if (evidenceCount > 0) {
    findings.push(`Partial evidence: ${[hasReports && 'reports', hasTraces && 'traces', hasScreenshots && 'screenshots'].filter(Boolean).join(', ')}`);
  }

  return findings.slice(0, 7);
}

function collectEvidenceRefs(snapshot) {
  const e = snapshot.evidence || {};
  const reportPaths = [];
  if (e.marketReportJson) reportPaths.push(e.marketReportJson);
  if (e.marketReportHtml) reportPaths.push(e.marketReportHtml);
  const traces = e.traceZip ? [e.traceZip] : [];
  const screenshots = [];
  if (e.attemptArtifacts) {
    Object.values(e.attemptArtifacts).forEach(a => {
      if (a.screenshotDir) screenshots.push(a.screenshotDir);
    });
  }
  const affectedPages = (snapshot.discovery?.pagesVisited || []).slice(0, 10);
  return { reportPaths, traces, screenshots, affectedPages };
}

function defaultLimits() {
  return [
    'Live-site variability may affect signals',
    'Browser/viewport differences can change outcomes',
    'Coverage limited to configured attempts and discovered interactions'
  ];
}

function situationalLimits(snapshot) {
  const limits = [];
  const attempts = snapshot.attempts || [];
  const skippedCount = attempts.filter(a => a.outcome === 'SKIPPED').length;
  const disc = snapshot.discovery || {};

  // Skipped attempts
  if (skippedCount > 0) {
    limits.push(`${skippedCount} additional attempt was not executed; verdict is therefore limited to fewer paths`);
  }

  // Discovery coverage gaps
  const discovered = disc.interactionsDiscovered || 0;
  const executed = disc.interactionsExecuted || 0;
  if (discovered > 0 && executed < discovered) {
    limits.push(`${discovered - executed} of ${discovered} discovered interactions were not tested`);
  }

  // Evidence gaps
  const e = snapshot.evidence || {};
  if (!e.traceZip) {
    limits.push(`Detailed timing traces were not captured; timing-related issues may not be visible`);
  }
  if (!e.marketReportJson) {
    limits.push(`Market risk analysis was not run; business impact is unassessed`);
  }

  // Environment variability
  limits.push(`Live site behavior shifts over time; this verdict reflects this moment`);

  // Browser/environment
  limits.push(`Results are specific to this browser and viewport; other browsers may differ`);

  return limits.slice(0, 6);
}

/**
 * Build unified verdict from snapshot
 */
function deriveRunResult(snapshot) {
  const meta = snapshot.meta || {};
  if (meta.result) return meta.result;
  const attempts = snapshot.attempts || [];
  
  // Count different outcome types
  const executedAttempts = attempts.filter(a => a.outcome !== 'SKIPPED' && a.outcome !== 'NOT_APPLICABLE');
  const discoveryFailedAttempts = attempts.filter(a => a.outcome === 'DISCOVERY_FAILED');
  const notApplicableAttempts = attempts.filter(a => a.outcome === 'NOT_APPLICABLE');
  const skippedCount = attempts.filter(a => a.outcome === 'SKIPPED').length;
  
  const executed = executedAttempts.length;
  const successful = executedAttempts.filter(a => a.outcome === 'SUCCESS').length;
  const failed = executedAttempts.filter(a => a.outcome === 'FAILURE').length;
  
  // Golden Path Fix: Differentiate between:
  // 1. Discovery failures (site unreachable/broken) → INSUFFICIENT_EVIDENCE → DO_NOT_LAUNCH
  // 2. Everything skipped/not applicable (static site) → WARN → FRICTION
  
  // If ONLY discovery failures (no successful navigation), site is critically broken
  if (executed > 0 && executed === discoveryFailedAttempts.length) {
    return 'INSUFFICIENT_EVIDENCE';
  }
  
  // If nothing executed at all (all skipped/not applicable), it's a static site - safe
  if (executed === 0) {
    return 'WARN';
  }
  
  if (failed === 0 && successful === executed) return 'PASSED';
  if (failed === executed) return 'FAILED';
  return 'WARN';
}

function buildVerdictExplanation(snapshot, verdictStr, executedCount, successCount, failureCount, skippedCount, evidenceScore, penaltyApplied) {
  let why = '';
  
  if (verdictStr === 'READY') {
    why = `All ${executedCount} executed attempts completed successfully without critical issues. `;
    if (skippedCount > 0) {
      why += `${skippedCount} additional attempt was not executed. `;
    }
    why += `Evidence is ${evidenceScore >= 0.75 ? 'complete' : 'sufficient'}. `;
    why += `This differs from FRICTION because all attempts succeeded, and from DO_NOT_LAUNCH because no critical issues were found.`;
  } else if (verdictStr === 'DO_NOT_LAUNCH') {
    why = `${failureCount} critical issue was found, preventing safe launch. `;
    why += `This differs from READY because critical issues must be resolved, and from FRICTION because severity exceeds acceptable limits.`;
  } else if (verdictStr === 'INSUFFICIENT_EVIDENCE') {
    why = `Guardian could not execute meaningful tests on this site. `;
    why += `This typically means the site was unreachable, element discovery failed, or critical navigation errors occurred. `;
    why += `Unlike sites with no applicable tests (which receive FRICTION), this indicates a technical problem preventing observation. `;
    why += `Verdict cannot be determined without successful connection and navigation.`;
  } else {
    why = `Results show ${successCount} of ${executedCount} attempted success with some roughness. `;
    if (failureCount > 0) {
      why += `${failureCount} attempt did not complete. `;
    }
    if (executedCount === 0) {
      why += `Note: No interactive elements were tested because the site appears to be static (no forms, login, checkout). `;
      why += `This is FRICTION (limited testing coverage) not a launch blocker. The site is functional for read-only use. `;
    }
    why += `This differs from READY because outcomes were mixed, and from DO_NOT_LAUNCH because no critical failure was found.`;
  }
  
  return why;
}

function deriveNextRunHint(snapshot, confidenceLevel) {
  // Non-intrusive guard: suppress when confidence is high and limits are empty
  const limits = situationalLimits(snapshot) || [];
  if (confidenceLevel === 'high' && limits.length === 0) {
    return null;
  }

  // (a) Evidence completeness
  const e = snapshot.evidence || {};
  const hasReports = !!(e.marketReportJson && e.marketReportHtml);
  const hasTrace = !!e.traceZip;
  const hasScreenshots = !!(e.attemptArtifacts && Object.keys(e.attemptArtifacts).length > 0);
  if (!hasTrace || !hasScreenshots) {
    return 'Capture additional evidence (e.g., traces) to strengthen timing and flow visibility.';
  }

  // (b) Coverage completeness
  const disc = snapshot.discovery || {};
  const discovered = disc.interactionsDiscovered || 0;
  const executed = disc.interactionsExecuted || 0;
  if (discovered > 0 && executed < discovered) {
    return 'Expand coverage to include additional discovered interactions.';
  }

  // (c) Recurring timeouts/flakiness within this run
  const attempts = snapshot.attempts || [];
  const flows = snapshot.flows || [];
  const timeoutRegex = /(timeout|timed out)/i;
  const timeoutCount = (
    attempts.filter(a => typeof a.error === 'string' && timeoutRegex.test(a.error)).length +
    flows.filter(f => typeof f.error === 'string' && timeoutRegex.test(f.error)).length
  );
  const frictionCount = attempts.filter(a => a.friction && a.friction.isFriction).length;
  if (timeoutCount >= 2 || frictionCount >= 2) {
    return 'Use a conservative timeout profile to reduce flakiness.';
  }

  // (d) Otherwise: no hint
  return null;
}

function buildVerdict(snapshot) {
  const runRes = deriveRunResult(snapshot);
  const verdictStr = mapRunResultToVerdict(runRes || 'WARN');

  const outcomeScore = verdictStr === 'READY' ? 1 : verdictStr === 'DO_NOT_LAUNCH' ? 0.2 : 0.5;
  const coverageScore = computeCoverageScore(snapshot); // 0..1
  const evidenceScore = computeEvidenceScore(snapshot); // 0..1
  const penalty = computePenalty(snapshot); // 0..0.5

  const raw = 0.5 * outcomeScore + 0.2 * coverageScore + 0.3 * evidenceScore - penalty;
  const score = clamp01(raw);
  const level = levelFromScore(score);

  // Detailed metrics for explanation
  const attempts = snapshot.attempts || [];
  const executedAttempts = attempts.filter(a => a.outcome !== 'SKIPPED');
  const executedCount = executedAttempts.length;
  const successCount = executedAttempts.filter(a => a.outcome === 'SUCCESS').length;
  const failureCount = executedAttempts.filter(a => a.outcome === 'FAILURE').length;
  const skippedCount = attempts.filter(a => a.outcome === 'SKIPPED').length;

  const reasons = [];
  if (successCount === executedCount && executedCount > 0) {
    reasons.push(`All ${executedCount} executed attempts completed`);
  } else if (successCount > 0) {
    reasons.push(`${successCount} of ${executedCount} executed attempts completed`);
  }
  if (coverageScore > 0.66) reasons.push('Good coverage from discovered interactions');
  if (evidenceScore >= 0.75) reasons.push('Complete evidence captured (reports, traces, screenshots)');
  if (penalty > 0) reasons.push(`${failureCount > 0 ? 'Incomplete attempts' : 'Friction signals'} observed (${(penalty * 100).toFixed(0)}% impact)`);
  // Do not include 'not executed' in drivers; it appears in findings/limits

  const why = buildVerdictExplanation(
    snapshot,
    verdictStr,
    executedCount,
    successCount,
    failureCount,
    skippedCount,
    evidenceScore,
    penalty > 0
  );

  const nextRunHint = deriveNextRunHint(snapshot, level);

  return {
    verdict: verdictStr,
    confidence: { level, score, reasons },
    why,
    keyFindings: collectKeyFindings(snapshot),
    evidence: collectEvidenceRefs(snapshot),
    limits: situationalLimits(snapshot),
    nextRunHint
  };
}

module.exports = { buildVerdict };
