const ZERO_COUNTS = {
  expectationsTotal: 0,
  attempted: 0,
  observed: 0,
  silentFailures: 0,
  coverageGaps: 0,
  unproven: 0,
  informational: 0,
};

function pickCounts(counts) {
  return {
    ...ZERO_COUNTS,
    ...(counts || {}),
  };
}

function formatCountsLine(counts) {
  return `Counts: Silent failures: ${counts.silentFailures} | Coverage gaps: ${counts.coverageGaps} | Unproven: ${counts.unproven}`;
}

function formatExpectationsLine(counts) {
  return `Expectations: total=${counts.expectationsTotal} | attempted=${counts.attempted} | observed=${counts.observed}`;
}

function outcomeHeadline(outcome) {
  const normalized = (outcome || 'UNKNOWN').toUpperCase();
  return `VERAX RUN — ${normalized}`;
}

function formatFindingLine(finding, index) {
  const status = finding?.status || 'UNKNOWN';
  const severity = finding?.severity || finding?.impact || 'UNKNOWN';
  const confidence = Number.isFinite(finding?.confidence) ? finding.confidence.toFixed(2) : 'n/a';
  const title = finding?.shortTitle || finding?.description || finding?.reason || finding?.findingId || 'finding';
  return `${index + 1}) ${status}/${severity} (conf ${confidence}) — ${title}`;
}

function nextStep(decision) {
  if (decision?.actions && decision.actions.length > 0) {
    return decision.actions[0];
  }
  const outcome = (decision?.outcome || '').toUpperCase();
  const defaults = {
    CLEAN: 'Re-run after changes to confirm stability.',
    FINDINGS: 'Review top findings and evidence, then re-run after fixes.',
    INCOMPLETE: 'Re-run after resolving incomplete conditions.',
    INVALID_INPUT: 'Fix CLI arguments or input then re-run.',
    TOOL_ERROR: 'Inspect logs for the error and retry.',
  };
  return defaults[outcome] || 'Review run artifacts for details.';
}

export function formatRunSummaryLines(decision, options = {}) {
  const counts = pickCounts(decision?.counts);
  const runId = decision?.runId || options.runId || 'unknown';
  const runPath = decision?.runPath || options.runPath || 'runs';
  const outcome = decision?.outcome || 'UNKNOWN';
  const exitCode = decision?.exitCode;
  const url = options.url || decision?.url || 'n/a';

  const lines = [];
  lines.push(outcomeHeadline(outcome));
  lines.push(`Outcome: ${outcome}${exitCode !== undefined ? ` (exit ${exitCode})` : ''}`);
  lines.push(`Run ID: ${runId}`);
  lines.push(`Run folder: ${runPath}`);
  // CI-friendly: point directly to decision.json in run folder
  lines.push(`Decision: ${runPath}/decision.json`);
  lines.push(`URL: ${url}`);
  lines.push(formatCountsLine(counts));
  lines.push(formatExpectationsLine(counts));

  const topFindings = Array.isArray(decision?.topFindings) ? decision.topFindings.slice(0, 3) : [];
  if (topFindings.length === 0) {
    lines.push('Top findings: none');
  } else {
    lines.push('Top findings (up to 3):');
    topFindings.forEach((f, idx) => {
      lines.push(formatFindingLine(f, idx));
    });
  }

  lines.push(`Next: ${nextStep(decision)}`);
  return lines;
}

export function formatInspectLines(decision, options = {}) {
  const counts = pickCounts(decision?.counts);
  const runId = decision?.runId || options.runId || 'unknown';
  const runPath = decision?.runPath || options.runPath || 'runs';
  const outcome = decision?.outcome || 'UNKNOWN';
  const _exitCode = decision?.exitCode;
  const integrity = options.integrity || decision?.integrity;

  const lines = [];
  lines.push(`VERAX INSPECT — ${outcome.toUpperCase()}`);
  lines.push(`Run ID: ${runId}`);
  lines.push(`Run folder: ${runPath}`);
  lines.push(formatCountsLine(counts));
  if (integrity) {
    const missingCount = Array.isArray(integrity.missing) ? integrity.missing.length : 0;
    const mismatchedCount = Array.isArray(integrity.mismatched) ? integrity.mismatched.length : 0;
    const extraCount = Array.isArray(integrity.extraArtifacts) ? integrity.extraArtifacts.length : 0;
    lines.push(`Integrity: ${integrity.status || 'UNKNOWN'} (missing=${missingCount}, mismatched=${mismatchedCount}, extra=${extraCount})`);
  }

  const topFindings = Array.isArray(decision?.topFindings) ? decision.topFindings.slice(0, 3) : [];
  if (topFindings.length === 0) {
    lines.push('Top findings: none');
  } else {
    lines.push('Top findings (up to 3):');
    topFindings.forEach((f, idx) => {
      lines.push(formatFindingLine(f, idx));
    });
  }

  lines.push(`Next: ${nextStep(decision)}`);
  return lines;
}








