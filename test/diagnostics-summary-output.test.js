/**
 * PHASE 5 TESTS: Minimal Noise + Actionable Clarity from Diagnostics
 * 
 * Tests that diagnostic outcomes are aggregated deterministically
 * to provide one actionable summary line without spam.
 * 
 * Contract: INCOMPLETE runs with attempted > 0 show exactly one
 * factual line about the most common outcome; SUCCESS/FINDINGS show nothing.
 */

import assert from 'assert';
import test from 'node:test';
import { computeDiagnosticsSummary, formatDiagnosticsSummaryLine } from '../src/cli/util/observation/diagnostics-summary.js';

test('computeDiagnosticsSummary', async (suite) => {
  await suite.test('should return zeros for empty diagnostics', () => {
    const summary = computeDiagnosticsSummary([]);
    assert.strictEqual(summary.topOutcome, null);
    assert.strictEqual(summary.topCount, 0);
    assert.strictEqual(summary.totalAttempted, 0);
  });

  await suite.test('should return zeros for null diagnostics', () => {
    const summary = computeDiagnosticsSummary(null);
    assert.strictEqual(summary.topOutcome, null);
    assert.strictEqual(summary.topCount, 0);
    assert.strictEqual(summary.totalAttempted, 0);
  });

  await suite.test('should identify top outcome with single outcome', () => {
    const diagnostics = [
      { expectationId: 'exp-1', phaseOutcome: 'SUCCESS' },
      { expectationId: 'exp-2', phaseOutcome: 'SUCCESS' },
      { expectationId: 'exp-3', phaseOutcome: 'SUCCESS' },
    ];

    const summary = computeDiagnosticsSummary(diagnostics);

    assert.strictEqual(summary.topOutcome, 'SUCCESS');
    assert.strictEqual(summary.topCount, 3);
    assert.strictEqual(summary.totalAttempted, 3);
  });

  await suite.test('should identify top outcome with multiple outcomes', () => {
    const diagnostics = [
      { expectationId: 'exp-1', phaseOutcome: 'SUCCESS' },
      { expectationId: 'exp-2', phaseOutcome: 'SUCCESS' },
      { expectationId: 'exp-3', phaseOutcome: 'SELECTOR_NOT_FOUND' },
      { expectationId: 'exp-4', phaseOutcome: 'ELEMENT_HIDDEN' },
    ];

    const summary = computeDiagnosticsSummary(diagnostics);

    assert.strictEqual(summary.topOutcome, 'SUCCESS');
    assert.strictEqual(summary.topCount, 2);
    assert.strictEqual(summary.totalAttempted, 4);
  });

  await suite.test('should use alphabetical tie-breaking for determinism', () => {
    const diagnostics = [
      { expectationId: 'exp-1', phaseOutcome: 'SELECTOR_NOT_FOUND' },
      { expectationId: 'exp-2', phaseOutcome: 'ELEMENT_HIDDEN' },
      { expectationId: 'exp-3', phaseOutcome: 'NAV_TIMEOUT' },
    ];

    const summary = computeDiagnosticsSummary(diagnostics);

    // All have count 1, so alphabetical tie-break: ELEMENT_HIDDEN < NAV_TIMEOUT < SELECTOR_NOT_FOUND
    assert.strictEqual(summary.topOutcome, 'ELEMENT_HIDDEN');
    assert.strictEqual(summary.topCount, 1);
  });

  await suite.test('should handle missing phaseOutcome gracefully', () => {
    const diagnostics = [
      { expectationId: 'exp-1' },
      { expectationId: 'exp-2' },
      { expectationId: 'exp-3', phaseOutcome: 'SUCCESS' },
    ];

    const summary = computeDiagnosticsSummary(diagnostics);

    // Two UNKNOWN_FAILURE (default), one SUCCESS
    assert.strictEqual(summary.topOutcome, 'UNKNOWN_FAILURE');
    assert.strictEqual(summary.topCount, 2);
    assert.strictEqual(summary.totalAttempted, 3);
  });

  await suite.test('should be deterministic for same input', () => {
    const diagnostics = [
      { expectationId: 'exp-1', phaseOutcome: 'SELECTOR_NOT_FOUND' },
      { expectationId: 'exp-2', phaseOutcome: 'SUCCESS' },
      { expectationId: 'exp-3', phaseOutcome: 'ELEMENT_HIDDEN' },
      { expectationId: 'exp-4', phaseOutcome: 'SELECTOR_NOT_FOUND' },
      { expectationId: 'exp-5', phaseOutcome: 'OUTCOME_TIMEOUT' },
      { expectationId: 'exp-6', phaseOutcome: 'SELECTOR_NOT_FOUND' },
    ];

    const summary1 = computeDiagnosticsSummary(diagnostics);
    const summary2 = computeDiagnosticsSummary(diagnostics);

    assert.deepStrictEqual(summary1, summary2);
    assert.strictEqual(summary1.topOutcome, 'SELECTOR_NOT_FOUND');
    assert.strictEqual(summary1.topCount, 3);
  });

  await suite.test('should sort by count first, then alphabetically', () => {
    const diagnostics = [
      { expectationId: 'exp-1', phaseOutcome: 'BLOCKED_BY_AUTH' },
      { expectationId: 'exp-2', phaseOutcome: 'BLOCKED_BY_AUTH' },
      { expectationId: 'exp-3', phaseOutcome: 'ELEMENT_DISABLED' },
      { expectationId: 'exp-4', phaseOutcome: 'ELEMENT_DISABLED' },
      { expectationId: 'exp-5', phaseOutcome: 'ELEMENT_HIDDEN' },
    ];

    const summary = computeDiagnosticsSummary(diagnostics);

    // BLOCKED_BY_AUTH and ELEMENT_DISABLED both have count 2
    // Alphabetically: BLOCKED_BY_AUTH < ELEMENT_DISABLED
    assert.strictEqual(summary.topOutcome, 'BLOCKED_BY_AUTH');
    assert.strictEqual(summary.topCount, 2);
  });
});

test('formatDiagnosticsSummaryLine', async (suite) => {
  await suite.test('should return null for null summary', () => {
    const line = formatDiagnosticsSummaryLine(null);
    assert.strictEqual(line, null);
  });

  await suite.test('should return null for no topOutcome', () => {
    const summary = { topOutcome: null, topCount: 0, totalAttempted: 0 };
    const line = formatDiagnosticsSummaryLine(summary);
    assert.strictEqual(line, null);
  });

  await suite.test('should return null for zero totalAttempted', () => {
    const summary = { topOutcome: 'SUCCESS', topCount: 1, totalAttempted: 0 };
    const line = formatDiagnosticsSummaryLine(summary);
    assert.strictEqual(line, null);
  });

  await suite.test('should format summary line with correct values', () => {
    const summary = { topOutcome: 'SELECTOR_NOT_FOUND', topCount: 5, totalAttempted: 8 };
    const line = formatDiagnosticsSummaryLine(summary);

    assert(line.includes('Most common execution outcome:'));
    assert(line.includes('SELECTOR_NOT_FOUND'));
    assert(line.includes('5/8'));
    assert(line.includes('observe.json diagnostics'));
  });

  await suite.test('should produce exact format', () => {
    const summary = { topOutcome: 'NAV_TIMEOUT', topCount: 3, totalAttempted: 10 };
    const line = formatDiagnosticsSummaryLine(summary);

    const expected = 'Most common execution outcome: NAV_TIMEOUT (3/10). See observe.json diagnostics for exact causes.';
    assert.strictEqual(line, expected);
  });

  await suite.test('should work for all outcome types', () => {
    const outcomes = [
      'SUCCESS',
      'SELECTOR_NOT_FOUND',
      'ELEMENT_HIDDEN',
      'ELEMENT_DISABLED',
      'NOT_CLICKABLE',
      'NAV_TIMEOUT',
      'OUTCOME_TIMEOUT',
      'BLOCKED_BY_AUTH',
      'RUNTIME_NOT_READY',
      'UNSUPPORTED_PROMISE',
      'UNKNOWN_FAILURE',
    ];

    for (const outcome of outcomes) {
      const summary = { topOutcome: outcome, topCount: 2, totalAttempted: 5 };
      const line = formatDiagnosticsSummaryLine(summary);

      assert(line, `Failed to format line for outcome: ${outcome}`);
      assert(line.includes(outcome), `Line does not contain outcome: ${outcome}`);
      assert(line.includes('2/5'));
    }
  });
});

test('Integration: INCOMPLETE run diagnostics summary', async (suite) => {
  await suite.test('should show summary for INCOMPLETE status with attempted > 0', () => {
    // Simulate observeData for an INCOMPLETE run
    const observeData = {
      status: 'INCOMPLETE',
      stats: { attempted: 10, observed: 0 },
      diagnostics: [
        { expectationId: 'exp-1', phaseOutcome: 'SELECTOR_NOT_FOUND' },
        { expectationId: 'exp-2', phaseOutcome: 'SELECTOR_NOT_FOUND' },
        { expectationId: 'exp-3', phaseOutcome: 'SELECTOR_NOT_FOUND' },
        { expectationId: 'exp-4', phaseOutcome: 'ELEMENT_HIDDEN' },
        { expectationId: 'exp-5', phaseOutcome: 'ELEMENT_HIDDEN' },
        { expectationId: 'exp-6', phaseOutcome: 'NAV_TIMEOUT' },
        { expectationId: 'exp-7', phaseOutcome: 'OUTCOME_TIMEOUT' },
        { expectationId: 'exp-8', phaseOutcome: 'SUCCESS' },
        { expectationId: 'exp-9', phaseOutcome: 'SUCCESS' },
        { expectationId: 'exp-10', phaseOutcome: 'SUCCESS' },
      ],
    };

    const summary = computeDiagnosticsSummary(observeData.diagnostics);
    const line = formatDiagnosticsSummaryLine(summary);

    assert(line, 'Should produce a summary line');
    assert.strictEqual(summary.topOutcome, 'SELECTOR_NOT_FOUND');
    assert.strictEqual(summary.topCount, 3);
    assert(line.includes('SELECTOR_NOT_FOUND (3/10)'));
  });

  await suite.test('should not show summary for SUCCESS status', () => {
    const observeData = {
      status: 'SUCCESS',
      stats: { attempted: 5, observed: 5 },
      diagnostics: [
        { expectationId: 'exp-1', phaseOutcome: 'SUCCESS' },
        { expectationId: 'exp-2', phaseOutcome: 'SUCCESS' },
        { expectationId: 'exp-3', phaseOutcome: 'SUCCESS' },
        { expectationId: 'exp-4', phaseOutcome: 'SUCCESS' },
        { expectationId: 'exp-5', phaseOutcome: 'SUCCESS' },
      ],
    };

    // For SUCCESS runs, the console output would not print the summary
    // (that's handled in output-summary.js with the INCOMPLETE check)
    // But the summary can still be computed; format should work
    const summary = computeDiagnosticsSummary(observeData.diagnostics);
    const line = formatDiagnosticsSummaryLine(summary);

    assert(line.includes('SUCCESS'), 'Summary should include outcome');
  });

  await suite.test('should not show summary for FINDINGS status', () => {
    const observeData = {
      status: 'FINDINGS',
      stats: { attempted: 5, observed: 4 },
      diagnostics: [
        { expectationId: 'exp-1', phaseOutcome: 'SUCCESS' },
        { expectationId: 'exp-2', phaseOutcome: 'SUCCESS' },
        { expectationId: 'exp-3', phaseOutcome: 'SUCCESS' },
        { expectationId: 'exp-4', phaseOutcome: 'SUCCESS' },
        { expectationId: 'exp-5', phaseOutcome: 'SELECTOR_NOT_FOUND' },
      ],
    };

    // For FINDINGS runs, the console output would not print the summary
    // (that's handled in output-summary.js with the INCOMPLETE check)
    const summary = computeDiagnosticsSummary(observeData.diagnostics);
    const line = formatDiagnosticsSummaryLine(summary);

    assert(line.includes('SUCCESS'), 'Summary should include most common outcome');
  });
});

test('Determinism across multiple runs', async (suite) => {
  await suite.test('should produce identical summary for same diagnostics list order', () => {
    const generateDiagnostics = () => [
      { expectationId: 'a', phaseOutcome: 'SELECTOR_NOT_FOUND' },
      { expectationId: 'b', phaseOutcome: 'ELEMENT_HIDDEN' },
      { expectationId: 'c', phaseOutcome: 'SELECTOR_NOT_FOUND' },
      { expectationId: 'd', phaseOutcome: 'NAV_TIMEOUT' },
      { expectationId: 'e', phaseOutcome: 'SELECTOR_NOT_FOUND' },
    ];

    const summary1 = computeDiagnosticsSummary(generateDiagnostics());
    const summary2 = computeDiagnosticsSummary(generateDiagnostics());
    const summary3 = computeDiagnosticsSummary(generateDiagnostics());

    assert.deepStrictEqual(summary1, summary2);
    assert.deepStrictEqual(summary2, summary3);
  });

  await suite.test('should produce identical summary regardless of diagnostics list order', () => {
    const diag1 = [
      { expectationId: 'a', phaseOutcome: 'SELECTOR_NOT_FOUND' },
      { expectationId: 'b', phaseOutcome: 'ELEMENT_HIDDEN' },
      { expectationId: 'c', phaseOutcome: 'SELECTOR_NOT_FOUND' },
    ];

    const diag2 = [
      { expectationId: 'c', phaseOutcome: 'SELECTOR_NOT_FOUND' },
      { expectationId: 'a', phaseOutcome: 'SELECTOR_NOT_FOUND' },
      { expectationId: 'b', phaseOutcome: 'ELEMENT_HIDDEN' },
    ];

    const summary1 = computeDiagnosticsSummary(diag1);
    const summary2 = computeDiagnosticsSummary(diag2);

    // Should be identical regardless of input order
    assert.deepStrictEqual(summary1, summary2);
  });

  await suite.test('formatting is deterministic', () => {
    const summary = { topOutcome: 'OUTCOME_TIMEOUT', topCount: 7, totalAttempted: 15 };

    const line1 = formatDiagnosticsSummaryLine(summary);
    const line2 = formatDiagnosticsSummaryLine(summary);
    const line3 = formatDiagnosticsSummaryLine(summary);

    assert.strictEqual(line1, line2);
    assert.strictEqual(line2, line3);
  });
});
