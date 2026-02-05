import { describe, test } from 'node:test';
import assert from 'node:assert';
import { formatRunSummaryLines, formatInspectLines } from '../../src/cli/util/support/console-formatters.js';

const cleanDecision = {
  outcome: 'CLEAN',
  exitCode: 0,
  runId: 'run_clean',
  runPath: 'runs/run_clean',
  counts: {
    expectationsTotal: 5,
    attempted: 5,
    observed: 5,
    silentFailures: 0,
    coverageGaps: 0,
    unproven: 0,
    informational: 1,
  },
  topFindings: [],
  actions: ['Re-run after changes to confirm stability.'],
};

const findingsDecision = {
  outcome: 'FINDINGS',
  exitCode: 20,
  runId: 'run_findings',
  runPath: 'runs/run_findings',
  counts: {
    expectationsTotal: 6,
    attempted: 6,
    observed: 4,
    silentFailures: 2,
    coverageGaps: 1,
    unproven: 0,
    informational: 0,
  },
  topFindings: [
    { findingId: 'f1', status: 'CONFIRMED', severity: 'HIGH', confidence: 0.9, shortTitle: 'Submit has no feedback' },
    { findingId: 'f2', status: 'SUSPECTED', severity: 'MEDIUM', confidence: 0.5, shortTitle: 'Navigation stalled' },
  ],
  actions: ['Review decision.json then findings.json for details.'],
};

describe('CLI console formatters', () => {
  test('run summary lines for CLEAN stay concise and deterministic', () => {
    const linesA = formatRunSummaryLines(cleanDecision, { url: 'https://example.com' });
    const linesB = formatRunSummaryLines(cleanDecision, { url: 'https://example.com' });
    assert.strictEqual(linesA.length >= 9 && linesA.length <= 13, true); // extra line for decision.json pointer
    assert.deepStrictEqual(linesA, linesB);
    assert.ok(linesA[0].includes('CLEAN'));
    assert.ok(linesA.some((l) => l.includes('decision.json')));
    assert.ok(linesA[linesA.length - 1].startsWith('Next:'));
  });

  test('run summary lines for FINDINGS list top findings in order', () => {
    const lines = formatRunSummaryLines(findingsDecision, { url: 'https://example.com' });
    const idx1 = lines.findIndex((l) => l.includes('Submit has no feedback'));
    const idx2 = lines.findIndex((l) => l.includes('Navigation stalled'));
    assert.ok(idx1 !== -1 && idx2 !== -1 && idx1 < idx2);
    assert.strictEqual(lines.length <= 13, true);
    assert.ok(lines.some((l) => l.includes('decision.json')));
  });

  test('inspect lines reuse decision snapshot deterministically', () => {
    const linesA = formatInspectLines(findingsDecision);
    const linesB = formatInspectLines(findingsDecision);
    assert.deepStrictEqual(linesA, linesB);
    assert.ok(linesA[0].includes('FINDINGS'));
    assert.ok(linesA[linesA.length - 1].startsWith('Next:'));
  });
});




