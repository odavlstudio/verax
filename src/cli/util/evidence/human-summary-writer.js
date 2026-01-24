import { resolve } from 'path';
import { atomicWriteText } from '../support/atomic-write.js';

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
export function writeHumanSummaryMarkdown(runDir, { summaryData, coverage, judgments, productionSeal }) {
  const mdPath = resolve(runDir, 'verax-summary.md');

  const lines = [];
  lines.push(`# VERAX Run Summary`);
  lines.push('');
  lines.push(`- URL: ${summaryData?.url || 'n/a'}`);
  lines.push(`- Run ID: ${summaryData?.runId || 'unknown'}`);
  lines.push(`- Status: ${summaryData?.status || 'UNKNOWN'}`);
  if (productionSeal) {
    lines.push(`- Seal: ${productionSeal}`);
  }
  lines.push('');
  lines.push(`## What Was Tested`);
  lines.push(`- Total promises: ${summaryData?.coverage?.learn?.totalExpectations || 0}`);
  lines.push(`- Attempted: ${summaryData?.coverage?.observe?.attempted || 0}`);
  lines.push(`- Observed: ${summaryData?.coverage?.observe?.completed || 0}`);
  lines.push('');
  lines.push(`## Coverage Truth`);
  lines.push(`- Coverage: ${coverage?.coveragePercent ?? Math.round((summaryData?.coverage?.coverageRatio || 0) * 100)}%`);
    lines.push(`- Threshold: ${Math.round(((coverage?.threshold ?? summaryData?.coverage?.minCoverage) || 0.9) * 100)}%`);
  lines.push(`- Status: ${coverage?.status || (summaryData?.coverage?.coverageRatio >= (summaryData?.coverage?.minCoverage || 0.9) ? 'PASS' : 'FAIL')}`);
  lines.push('');
  lines.push(`## Judgments`);
  const counts = judgments?.counts || {};
  lines.push(`- Failure (misleading): ${counts.FAILURE_MISLEADING || 0}`);
  lines.push(`- Failure (silent): ${counts.FAILURE_SILENT || 0}`);
  lines.push(`- Needs review: ${counts.NEEDS_REVIEW || 0}`);
  lines.push(`- Weak pass: ${counts.WEAK_PASS || 0}`);
  lines.push(`- Pass: ${counts.PASS || 0}`);
  lines.push('');
  if (Array.isArray(judgments?.judgments) && judgments.judgments.length > 0) {
    lines.push(`### Top Items`);
    const top = judgments.judgments.slice(0, 5);
    top.forEach((j, idx) => {
      lines.push(`- ${idx + 1}) ${j.judgment} — ${j.title} (${j.explanation})`);
    });
    lines.push('');
  }
  lines.push(`## Recommended Next Steps`);
  const next = recommendNextSteps({ summaryData, coverage, judgments, productionSeal });
  next.forEach((line) => lines.push(`- ${line}`));

  atomicWriteText(mdPath, lines.join('\n') + '\n');
}

function recommendNextSteps({ summaryData, coverage, judgments, productionSeal }) {
  const items = [];
  const covStatus = coverage?.status || (summaryData?.coverage?.coverageRatio >= (summaryData?.coverage?.minCoverage || 0.9) ? 'PASS' : 'FAIL');
  const hasFailures = (judgments?.counts?.FAILURE_SILENT || 0) + (judgments?.counts?.FAILURE_MISLEADING || 0) > 0;
  if (productionSeal === 'PRODUCTION_GRADE') {
    items.push('Proceed with deployment; monitor with VERAX in CI.');
  } else if (covStatus === 'FAIL') {
    items.push('Increase coverage by adding tests for unobserved promises.');
  }
  if (hasFailures) {
    items.push('Fix the failure cases and re-run VERAX.');
  }
  items.push('Review findings and evidence artifacts for details.');
  return items;
}
