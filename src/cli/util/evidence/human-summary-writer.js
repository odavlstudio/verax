import { resolve } from 'path';
import { atomicWriteText } from '../support/atomic-write.js';
import {
  RESULTS_INTERPRETATION,
  INCOMPLETE_SAFETY_LINE,
  POST_AUTH_DISCLAIMER_LINE,
} from '../../config/pilot-messages.js';
import { normalizeTruthState, TRUTH_STATES } from '../../../verax/shared/truth-states.js';

/**
 * Write human summary markdown (verax-summary.md)
 * Deterministic content: what was tested, failures, coverage truth, next steps.
 *
 * @param {string} runDir
 * @param {Object} params
 * @param {Object} params.summaryData - summary.json data
 * @param {Object} params.coverage - coverage.json data
 * @param {Object} params.judgments - judgments.json data
 * @param {string|null} params.productionSeal - PRODUCTION_GRADE or null
 */
export function writeHumanSummaryMarkdown(runDir, { summaryData, coverage, judgments: _judgments, productionSeal }) {
  const mdPath = resolve(runDir, 'verax-summary.md');
  const status = normalizeTruthState(summaryData?.status, TRUTH_STATES.INCOMPLETE);

  const lines = [];
  lines.push('# VERAX Run Summary');
  lines.push('');
  lines.push(`- URL: ${summaryData?.url || 'n/a'}`);
  lines.push(`- Run ID: ${summaryData?.runId || 'unknown'}`);
  lines.push(`- Result: ${status}`);
  if (productionSeal) {
    lines.push(`- Seal: ${productionSeal}`);
  }
  lines.push('');
  lines.push('## Interpretation');
  lines.push('');
  lines.push(RESULTS_INTERPRETATION[status] || RESULTS_INTERPRETATION.INCOMPLETE);
  if (status === 'INCOMPLETE') {
    lines.push(INCOMPLETE_SAFETY_LINE);
  }
  lines.push('');
  if (summaryData?.auth) {
    lines.push('Note: Authentication was used for this run.');
    lines.push(POST_AUTH_DISCLAIMER_LINE);
    lines.push('');
  }

  lines.push('## Scope & Coverage');
  lines.push('');
  const expectationsTotal = Number(
    summaryData?.learn?.expectationsTotal ??
    summaryData?.observe?.expectationsTotal ??
    summaryData?.digest?.expectationsTotal ??
    0
  );
  const attempted = Number(summaryData?.observe?.attempted ?? summaryData?.digest?.attempted ?? 0);
  const observed = Number(summaryData?.observe?.observed ?? summaryData?.digest?.observed ?? 0);
  lines.push(`- Promises (from source): ${expectationsTotal}`);
  lines.push(`- Attempted: ${attempted}`);
  lines.push(`- Observed: ${observed}`);
  lines.push('');

  lines.push('## Coverage Threshold');
  const coverageRatio =
    typeof coverage?.coverageRatio === 'number'
      ? coverage.coverageRatio
      : (summaryData?.observe?.coverageRatio ?? 0);
  const threshold =
    typeof coverage?.threshold === 'number'
      ? coverage.threshold
      : (summaryData?.truth?.coverageSummary?.threshold ?? 0.9);
  const covPct = coverage?.coveragePercent ?? Math.round(Number(coverageRatio || 0) * 100);
  lines.push(`- Coverage: ${covPct}%`);
  lines.push(`- Threshold: ${Math.round(Number(threshold || 0) * 100)}%`);
  lines.push(`- Meets threshold: ${Number(coverageRatio || 0) >= Number(threshold || 0) ? 'yes' : 'no'}`);
  lines.push('');

  const digest = summaryData?.digest || {};
  const findings = Number(digest.silentFailures || 0);
  lines.push('## Findings');
  lines.push('');
  lines.push(`- Findings (silent failures): ${findings}`);
  lines.push(`- Unproven interactions: ${Number(digest.unproven || 0)}`);
  lines.push(`- Coverage gaps: ${Number(digest.coverageGaps || 0)}`);
  lines.push('');

  lines.push('## Next Step');
  lines.push('');
  if (status === 'SUCCESS') {
    lines.push('- Keep this in CI and expand coverage for critical public flows.');
    lines.push('- Remember: SUCCESS only applies to the covered scope.');
  } else if (status === 'FINDINGS') {
    lines.push('- Review findings.json and the evidence/ directory.');
    lines.push('- Fix the issues or accept the risk explicitly, then rerun.');
  } else {
    lines.push(`- ${INCOMPLETE_SAFETY_LINE}`);
    lines.push('- Expand coverage or reduce scope, then rerun with the same inputs.');
    lines.push('- If findings exist, they are still actionable.');
  }

  atomicWriteText(mdPath, lines.join('\n') + '\n');
}
