/**
 * SILENCE VISIBILITY TEST
 * 
 * Verifies that all edge cases produce explicit output:
 * - Zero expectations
 * - Zero interactions
 * - All interactions skipped
 * - Budget exceeded
 * - Incremental reuse
 * - Sensor failures
 * 
 * NO SILENT SUCCESS. Every scenario must show gaps/unknowns explicitly.
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { computeObservationSummary, formatObservationSummary } from '../src/verax/detect/verdict-engine.js';

test('SILENCE VISIBILITY - Zero expectations scenario', () => {
  const findings = [];
  const observeTruth = {
    interactionsObserved: 0,
    coverage: {
      pagesVisited: 1,
      pagesDiscovered: 1,
      interactionsExecuted: 0,
      interactionsDiscovered: 0,
      candidatesSelected: 0,
      candidatesDiscovered: 0
    },
    traces: []
  };
  const learnTruth = {
    expectationsDiscovered: 0
  };
  const coverageGaps = [];
  const budgetExceeded = false;

  const summary = computeObservationSummary(findings, observeTruth, learnTruth, coverageGaps, budgetExceeded);
  const output = formatObservationSummary(summary);

  assert.equal(summary.observations.discrepanciesObserved, 0, 'Zero findings');
  assert.equal(summary.coverage.expectationsDiscovered, 0, 'Zero expectations discovered');
  assert.equal(summary.gaps.total, 0, 'Zero gaps');
  
  // CRITICAL: Zero must be explicit in output
  assert.match(output, /discrepancies observed between code promises/i, 'Zero findings explicitly stated');
  assert.match(output, /0 not evaluated/i, 'Zero gaps explicitly shown');
  assert.match(output, /No gaps reported|all discovered items were evaluated/i, 'Explicit zero gap message');
});

test('SILENCE VISIBILITY - Zero interactions scenario', () => {
  const findings = [];
  const observeTruth = {
    interactionsObserved: 0,
    coverage: {
      pagesVisited: 1,
      pagesDiscovered: 1,
      interactionsExecuted: 0,
      interactionsDiscovered: 0
    },
    traces: []
  };
  const learnTruth = {
    expectationsDiscovered: 5
  };
  const coverageGaps = [
    { expectationId: 'e1', reason: 'no_interaction' },
    { expectationId: 'e2', reason: 'no_interaction' },
    { expectationId: 'e3', reason: 'no_interaction' },
    { expectationId: 'e4', reason: 'no_interaction' },
    { expectationId: 'e5', reason: 'no_interaction' }
  ];
  const budgetExceeded = false;

  const summary = computeObservationSummary(findings, observeTruth, learnTruth, coverageGaps, budgetExceeded);
  const output = formatObservationSummary(summary);

  assert.equal(summary.observations.discrepanciesObserved, 0, 'Zero findings');
  assert.equal(summary.coverage.interactionsDiscovered, 0, 'Zero interactions discovered');
  assert.equal(summary.coverage.interactionsEvaluated, 0, 'Zero interactions evaluated');
  assert.equal(summary.gaps.expectations, 5, 'Five expectations not evaluated');
  assert(summary.gaps.total > 0, 'Total gaps > 0');
  
  // CRITICAL: Gaps must be explicit
  assert.match(output, /5 not evaluated/i, 'Five unevaluated expectations shown');
  assert.match(output, /EVALUATION GAPS/i, 'Gaps section present');
  
});

test('SILENCE VISIBILITY - All interactions skipped scenario', () => {
  const findings = [];
  const observeTruth = {
    interactionsObserved: 0,
    coverage: {
      pagesVisited: 1,
      pagesDiscovered: 1,
      interactionsExecuted: 0,
      interactionsDiscovered: 10,
      skippedInteractions: 10
    },
    traces: []
  };
  const learnTruth = {
    expectationsDiscovered: 10
  };
  const coverageGaps = [
    { expectationId: 'e1', reason: 'interaction_skipped' },
    { expectationId: 'e2', reason: 'interaction_skipped' },
    { expectationId: 'e3', reason: 'interaction_skipped' },
    { expectationId: 'e4', reason: 'interaction_skipped' },
    { expectationId: 'e5', reason: 'interaction_skipped' },
    { expectationId: 'e6', reason: 'interaction_skipped' },
    { expectationId: 'e7', reason: 'interaction_skipped' },
    { expectationId: 'e8', reason: 'interaction_skipped' },
    { expectationId: 'e9', reason: 'interaction_skipped' },
    { expectationId: 'e10', reason: 'interaction_skipped' }
  ];
  const budgetExceeded = false;

  const summary = computeObservationSummary(findings, observeTruth, learnTruth, coverageGaps, budgetExceeded);
  const output = formatObservationSummary(summary);

  assert.equal(summary.observations.discrepanciesObserved, 0, 'Zero findings');
  assert.equal(summary.coverage.interactionsEvaluated, 0, 'Zero interactions evaluated');
  assert.equal(summary.coverage.interactionsDiscovered, 10, '10 interactions discovered');
  assert.equal(summary.gaps.interactions, 20, '20 total interaction gaps (10 + 10 skipped)');
  
  // CRITICAL: All skips must be visible
  assert.match(output, /20 not evaluated/i, 'All skipped interactions shown in gaps');
  assert.match(output, /EVALUATION GAPS/i, 'Gaps section present');
  
});

test('SILENCE VISIBILITY - Budget exceeded scenario', () => {
  const findings = [];
  const observeTruth = {
    interactionsObserved: 50,
    budgetExceeded: true,
    coverage: {
      pagesVisited: 5,
      pagesDiscovered: 20,
      interactionsExecuted: 50,
      interactionsDiscovered: 200,
      capped: true,
      cap: 50
    },
    traces: []
  };
  const learnTruth = {
    expectationsDiscovered: 100
  };
  const coverageGaps = [];
  const budgetExceeded = true;

  const summary = computeObservationSummary(findings, observeTruth, learnTruth, coverageGaps, budgetExceeded);
  const output = formatObservationSummary(summary);

  assert.equal(summary.observations.discrepanciesObserved, 0, 'Zero findings');
  assert.equal(summary.gaps.pages, 15, '15 pages not evaluated');
  assert.equal(summary.gaps.interactions, 150, '150 interactions not evaluated');
  assert(summary.gaps.total > 0, 'Total gaps > 0');
  
  // CRITICAL: Budget cap must be explicit
  assert.match(output, /Budget limit reached/i, 'Budget exceeded message');
  assert.match(output, /observation incomplete/i, 'Incomplete coverage stated');
  assert.match(output, /150 not evaluated/i, 'Unevaluated interaction count shown');
  
});

test('SILENCE VISIBILITY - Silences with timeout and sensor failures', () => {
  const findings = [];
  const observeTruth = {
    interactionsObserved: 5,
    coverage: {
      pagesVisited: 1,
      pagesDiscovered: 1,
      interactionsExecuted: 5,
      interactionsDiscovered: 5
    },
    traces: []
  };
  const learnTruth = {
    expectationsDiscovered: 5
  };
  const coverageGaps = [];
  const budgetExceeded = false;
  const detectTruth = {
    silences: {
      totalSilences: 3,
      byCategory: {
        timeout: 2,
        sensor: 1
      },
      byReason: {
        interaction_timeout: 2,
        sensor_unavailable: 1
      },
      scopes: {
        interaction: 2,
        sensor: 1
      }
    }
  };

  const summary = computeObservationSummary(findings, observeTruth, learnTruth, coverageGaps, budgetExceeded, detectTruth);
  const output = formatObservationSummary(summary);

  assert.equal(summary.observations.discrepanciesObserved, 0, 'Zero findings');
  assert(summary.silences, 'Silences attached to summary');
  assert.equal(summary.silences.totalSilences, 3, '3 silence events');
  
  // CRITICAL: Silences must be visible in output
  assert(output.includes('UNKNOWNS'), 'Unknowns section present');
  assert(output.includes('Silences'), 'Silences label present');
  assert(output.includes('3'), 'Count 3 present');
  assert(output.includes('silence events'), 'Silence events label present');
  assert(output.includes('timeout'), 'Timeout category shown');
  assert(output.includes('sensor'), 'Sensor category shown');
  assert(output.includes('interaction timeout'), 'Interaction timeout reason shown');
  assert(output.includes('sensor unavailable'), 'Sensor unavailable reason shown');
  
});

test('SILENCE VISIBILITY - Zero silences explicit message', () => {
  const findings = [];
  const observeTruth = {
    interactionsObserved: 5,
    coverage: {
      pagesVisited: 1,
      pagesDiscovered: 1,
      interactionsExecuted: 5,
      interactionsDiscovered: 5
    },
    traces: []
  };
  const learnTruth = {
    expectationsDiscovered: 5
  };
  const coverageGaps = [];
  const budgetExceeded = false;
  const detectTruth = {
    silences: {
      totalSilences: 0,
      byCategory: {},
      byReason: {},
      scopes: {}
    }
  };

  const summary = computeObservationSummary(findings, observeTruth, learnTruth, coverageGaps, budgetExceeded, detectTruth);
  const output = formatObservationSummary(summary);

  assert.equal(summary.observations.discrepanciesObserved, 0, 'Zero findings');
  assert(summary.silences, 'Silences attached to summary');
  assert.equal(summary.silences.totalSilences, 0, 'Zero silence events');
  
  // CRITICAL: Zero silences must have explicit message (no silent success)
  assert.match(output, /UNKNOWNS.*Silences/i, 'Unknowns section still present');
  assert.match(output, /No silence events recorded|all attempted actions completed/i, 'Explicit zero silences message');
  
});

test('SILENCE VISIBILITY - Incremental reuse scenario', () => {
  const findings = [];
  const observeTruth = {
    interactionsObserved: 2,
    coverage: {
      pagesVisited: 1,
      pagesDiscovered: 1,
      interactionsExecuted: 2,
      interactionsDiscovered: 10
    },
    traces: [
      { interaction: { label: 'Click submit' }, incremental: false },
      { interaction: { label: 'Click cancel' }, incremental: false }
    ]
  };
  const learnTruth = {
    expectationsDiscovered: 10
  };
  const coverageGaps = [];
  const budgetExceeded = false;
  const detectTruth = {
    silences: {
      totalSilences: 8,
      byCategory: {
        incremental: 8
      },
      byReason: {
        incremental_unchanged: 8
      },
      scopes: {
        interaction: 8
      }
    }
  };

  const summary = computeObservationSummary(findings, observeTruth, learnTruth, coverageGaps, budgetExceeded, detectTruth);
  const output = formatObservationSummary(summary);

  assert.equal(summary.coverage.interactionsEvaluated, 2, '2 interactions evaluated');
  assert.equal(summary.coverage.interactionsDiscovered, 10, '10 interactions discovered');
  assert.equal(summary.gaps.interactions, 8, '8 interactions not evaluated');
  assert(summary.silences, 'Silences attached');
  assert.equal(summary.silences.totalSilences, 8, '8 incremental reuses tracked as silence');
  
  // CRITICAL: Incremental reuse must be visible
  assert(output.includes('8'), 'Count 8 present');
  assert(output.includes('silence events'), 'Silence events label present');
  assert(output.includes('incremental'), 'Incremental category shown');
  assert(output.includes('incremental unchanged'), 'Incremental unchanged reason shown');
  
});

console.log('\n=== SILENCE VISIBILITY TEST SUITE ===\n');
console.log('Verifying NO SILENT SUCCESS across all edge cases:\n');
console.log('✓ Zero expectations');
console.log('✓ Zero interactions');
console.log('✓ All interactions skipped');
console.log('✓ Budget exceeded');
console.log('✓ Timeouts and sensor failures');
console.log('✓ Zero silences (explicit message)');
console.log('✓ Incremental reuse');
console.log('\nRunning tests...\n');


