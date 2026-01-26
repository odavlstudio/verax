/**
 * PHASE 7 TESTS: One-Screen Sales Truth — CLI-Level Value Lock
 * 
 * Tests that VERAX communicates its value proposition in under 5 seconds:
 * - What VERAX detects
 * - Why existing tools miss it
 * - When VERAX is the right tool
 * 
 * Contract: Factual 3-line block, appears once, non-JSON only, deterministic.
 */

import assert from 'assert';
import test from 'node:test';
import { printSummary } from '../src/cli/run/output-summary.js';

// Capture console.log output for testing
function captureConsoleOutput(fn) {
  const originalLog = console.log;
  const logs = [];
  
  console.log = (...args) => {
    logs.push(args.join(' '));
  };
  
  try {
    fn();
  } finally {
    console.log = originalLog;
  }
  
  return logs;
}

// Helper to create mock observe data
function createObserveData({ status = 'SUCCESS', attempted = 0, observed = 0, diagnostics = [] }) {
  return {
    status,
    stats: { attempted, observed },
    diagnostics,
  };
}

// Helper to create mock detect data
function createDetectData({ silentFailures = 0, unproven = 0, coverageGaps = 0 }) {
  return {
    stats: { silentFailures, unproven, coverageGaps },
  };
}

// Helper to create mock paths
function createPaths() {
  return {
    baseDir: 'c:\\Users\\test\\.verax\\runs\\scan-123\\run-456',
  };
}

// Sales truth lines (exact wording)
const SALES_TRUTH_LINE_1 = 'VERAX checks whether real user actions actually produce visible results.';
const SALES_TRUTH_LINE_2 = 'These failures often pass tests and monitoring because nothing crashes.';
const SALES_TRUTH_LINE_3 = 'Use VERAX for public, pre-auth frontend flows when you have the source code.';

test('Sales Truth Block Presence', async (suite) => {
  await suite.test('should print sales truth block in normal run', () => {
    const url = 'https://example.com';
    const paths = createPaths();
    const expectations = [{ id: 'exp-1' }, { id: 'exp-2' }];
    const observeData = createObserveData({ status: 'SUCCESS', attempted: 2, observed: 2 });
    const detectData = createDetectData({ silentFailures: 0 });
    const isFirstRun = false;
    const status = 'SUCCESS';
    
    const output = captureConsoleOutput(() => {
      printSummary(url, paths, expectations, observeData, detectData, isFirstRun, status);
    });
    
    const line1 = output.find((line) => line === SALES_TRUTH_LINE_1);
    const line2 = output.find((line) => line === SALES_TRUTH_LINE_2);
    const line3 = output.find((line) => line === SALES_TRUTH_LINE_3);
    
    assert(line1, 'Sales truth line 1 should be present');
    assert(line2, 'Sales truth line 2 should be present');
    assert(line3, 'Sales truth line 3 should be present');
  });

  await suite.test('should print all three lines with exact wording', () => {
    const url = 'https://example.com';
    const paths = createPaths();
    const expectations = [{ id: 'exp-1' }];
    const observeData = createObserveData({ status: 'SUCCESS', attempted: 1, observed: 1 });
    const detectData = createDetectData({ silentFailures: 0 });
    const isFirstRun = false;
    const status = 'SUCCESS';
    
    const output = captureConsoleOutput(() => {
      printSummary(url, paths, expectations, observeData, detectData, isFirstRun, status);
    });
    
    const line1Index = output.indexOf(SALES_TRUTH_LINE_1);
    const line2Index = output.indexOf(SALES_TRUTH_LINE_2);
    const line3Index = output.indexOf(SALES_TRUTH_LINE_3);
    
    assert.notStrictEqual(line1Index, -1, 'Line 1 must be present');
    assert.notStrictEqual(line2Index, -1, 'Line 2 must be present');
    assert.notStrictEqual(line3Index, -1, 'Line 3 must be present');
    
    assert.strictEqual(output[line1Index], SALES_TRUTH_LINE_1, 'Line 1 exact wording');
    assert.strictEqual(output[line2Index], SALES_TRUTH_LINE_2, 'Line 2 exact wording');
    assert.strictEqual(output[line3Index], SALES_TRUTH_LINE_3, 'Line 3 exact wording');
  });

  await suite.test('should print block exactly once', () => {
    const url = 'https://example.com';
    const paths = createPaths();
    const expectations = [{ id: 'exp-1' }];
    const observeData = createObserveData({ status: 'SUCCESS', attempted: 1, observed: 1 });
    const detectData = createDetectData({ silentFailures: 0 });
    const isFirstRun = false;
    const status = 'SUCCESS';
    
    const output = captureConsoleOutput(() => {
      printSummary(url, paths, expectations, observeData, detectData, isFirstRun, status);
    });
    
    const line1Count = output.filter((line) => line === SALES_TRUTH_LINE_1).length;
    const line2Count = output.filter((line) => line === SALES_TRUTH_LINE_2).length;
    const line3Count = output.filter((line) => line === SALES_TRUTH_LINE_3).length;
    
    assert.strictEqual(line1Count, 1, 'Line 1 should appear exactly once');
    assert.strictEqual(line2Count, 1, 'Line 2 should appear exactly once');
    assert.strictEqual(line3Count, 1, 'Line 3 should appear exactly once');
  });

  await suite.test('should appear for SUCCESS status', () => {
    const url = 'https://example.com';
    const paths = createPaths();
    const expectations = [{ id: 'exp-1' }];
    const observeData = createObserveData({ status: 'SUCCESS', attempted: 1, observed: 1 });
    const detectData = createDetectData({ silentFailures: 0 });
    const isFirstRun = false;
    const status = 'SUCCESS';
    
    const output = captureConsoleOutput(() => {
      printSummary(url, paths, expectations, observeData, detectData, isFirstRun, status);
    });
    
    const hasBlock = output.some((line) => line === SALES_TRUTH_LINE_1);
    assert(hasBlock, 'Sales truth block should appear for SUCCESS');
  });

  await suite.test('should appear for FINDINGS status', () => {
    const url = 'https://example.com';
    const paths = createPaths();
    const expectations = [{ id: 'exp-1' }];
    const observeData = createObserveData({ status: 'FINDINGS', attempted: 1, observed: 1 });
    const detectData = createDetectData({ silentFailures: 1 });
    const isFirstRun = false;
    const status = 'FINDINGS';
    
    const output = captureConsoleOutput(() => {
      printSummary(url, paths, expectations, observeData, detectData, isFirstRun, status);
    });
    
    const hasBlock = output.some((line) => line === SALES_TRUTH_LINE_1);
    assert(hasBlock, 'Sales truth block should appear for FINDINGS');
  });

  await suite.test('should appear for INCOMPLETE status', () => {
    const url = 'https://example.com';
    const paths = createPaths();
    const expectations = [{ id: 'exp-1' }];
    const observeData = createObserveData({ status: 'INCOMPLETE', attempted: 1, observed: 0 });
    const detectData = createDetectData({ unproven: 1 });
    const isFirstRun = false;
    const status = 'INCOMPLETE';
    
    const output = captureConsoleOutput(() => {
      printSummary(url, paths, expectations, observeData, detectData, isFirstRun, status);
    });
    
    const hasBlock = output.some((line) => line === SALES_TRUTH_LINE_1);
    assert(hasBlock, 'Sales truth block should appear for INCOMPLETE');
  });
});

test('Block Placement and Order', async (suite) => {
  await suite.test('should appear after Phase 6 guards', () => {
    const url = 'https://example.com';
    const paths = createPaths();
    const expectations = [{ id: 'exp-1' }, { id: 'exp-2' }];
    const observeData = createObserveData({ status: 'SUCCESS', attempted: 1, observed: 1 });
    const detectData = createDetectData({ silentFailures: 0 });
    const isFirstRun = true; // Trigger persona lock
    const status = 'SUCCESS';
    
    const output = captureConsoleOutput(() => {
      printSummary(url, paths, expectations, observeData, detectData, isFirstRun, status);
    });
    
    const personaIndex = output.findIndex((line) => line.includes('VERAX is designed for frontend codebases'));
    const honestyIndex = output.findIndex((line) => line.includes('Some extracted promises were not exercised'));
    const salesIndex = output.findIndex((line) => line === SALES_TRUTH_LINE_1);
    
    assert(personaIndex >= 0, 'Persona lock should be present');
    assert(honestyIndex >= 0, 'Success honesty guard should be present');
    assert(salesIndex >= 0, 'Sales truth block should be present');
    
    // Sales truth should appear after both Phase 6 guards
    assert(salesIndex > personaIndex, 'Sales truth should appear after persona lock');
    assert(salesIndex > honestyIndex, 'Sales truth should appear after success honesty guard');
  });

  await suite.test('should appear before artifacts location', () => {
    const url = 'https://example.com';
    const paths = createPaths();
    const expectations = [{ id: 'exp-1' }];
    const observeData = createObserveData({ status: 'SUCCESS', attempted: 1, observed: 1 });
    const detectData = createDetectData({ silentFailures: 0 });
    const isFirstRun = false;
    const status = 'SUCCESS';
    
    const output = captureConsoleOutput(() => {
      printSummary(url, paths, expectations, observeData, detectData, isFirstRun, status);
    });
    
    const salesIndex = output.findIndex((line) => line === SALES_TRUTH_LINE_1);
    const artifactsIndex = output.findIndex((line) => line.includes('Artifacts written to'));
    
    assert(salesIndex >= 0, 'Sales truth block should be present');
    assert(artifactsIndex >= 0, 'Artifacts line should be present');
    assert(salesIndex < artifactsIndex, 'Sales truth should appear before artifacts location');
  });

  await suite.test('three lines should be consecutive', () => {
    const url = 'https://example.com';
    const paths = createPaths();
    const expectations = [{ id: 'exp-1' }];
    const observeData = createObserveData({ status: 'SUCCESS', attempted: 1, observed: 1 });
    const detectData = createDetectData({ silentFailures: 0 });
    const isFirstRun = false;
    const status = 'SUCCESS';
    
    const output = captureConsoleOutput(() => {
      printSummary(url, paths, expectations, observeData, detectData, isFirstRun, status);
    });
    
    const line1Index = output.indexOf(SALES_TRUTH_LINE_1);
    const line2Index = output.indexOf(SALES_TRUTH_LINE_2);
    const line3Index = output.indexOf(SALES_TRUTH_LINE_3);
    
    assert.notStrictEqual(line1Index, -1, 'Line 1 should be present');
    assert.notStrictEqual(line2Index, -1, 'Line 2 should be present');
    assert.notStrictEqual(line3Index, -1, 'Line 3 should be present');
    
    // Lines should be consecutive (with possible empty lines between)
    assert(line2Index > line1Index, 'Line 2 should follow line 1');
    assert(line3Index > line2Index, 'Line 3 should follow line 2');
    assert(line3Index - line1Index <= 3, 'Three lines should be within 3 positions of each other');
  });
});

test('Content Requirements', async (suite) => {
  await suite.test('line 1 communicates WHAT (checks user actions → visible results)', () => {
    assert(SALES_TRUTH_LINE_1.includes('checks'), 'Line 1 should explain what VERAX checks');
    assert(SALES_TRUTH_LINE_1.includes('user actions'), 'Line 1 should mention user actions');
    assert(SALES_TRUTH_LINE_1.includes('visible results'), 'Line 1 should mention visible results');
  });

  await suite.test('line 2 communicates WHY (failures pass existing tools)', () => {
    assert(SALES_TRUTH_LINE_2.includes('failures'), 'Line 2 should mention failures');
    assert(SALES_TRUTH_LINE_2.includes('pass tests'), 'Line 2 should mention tests');
    assert(SALES_TRUTH_LINE_2.includes('monitoring'), 'Line 2 should mention monitoring');
    assert(SALES_TRUTH_LINE_2.includes('nothing crashes'), 'Line 2 should explain why failures are missed');
  });

  await suite.test('line 3 communicates WHEN (public pre-auth flows with source)', () => {
    assert(SALES_TRUTH_LINE_3.includes('public'), 'Line 3 should mention public');
    assert(SALES_TRUTH_LINE_3.includes('pre-auth'), 'Line 3 should mention pre-auth');
    assert(SALES_TRUTH_LINE_3.includes('frontend flows'), 'Line 3 should mention frontend flows');
    assert(SALES_TRUTH_LINE_3.includes('source code'), 'Line 3 should mention source code');
  });

  await suite.test('no marketing language present', () => {
    const marketingWords = [
      'powerful', 'advanced', 'next-gen', 'revolutionary',
      'amazing', 'best', 'ultimate', 'perfect', 'guaranteed'
    ];
    
    const allLines = [SALES_TRUTH_LINE_1, SALES_TRUTH_LINE_2, SALES_TRUTH_LINE_3].join(' ').toLowerCase();
    
    for (const word of marketingWords) {
      assert(!allLines.includes(word), `Should not contain marketing word: ${word}`);
    }
  });

  await suite.test('no internal concepts mentioned', () => {
    const internalConcepts = [
      'expectation', 'truth classifier', 'observation engine',
      'diagnostic', 'phase outcome', 'artifact', 'determinism'
    ];
    
    const allLines = [SALES_TRUTH_LINE_1, SALES_TRUTH_LINE_2, SALES_TRUTH_LINE_3].join(' ').toLowerCase();
    
    for (const concept of internalConcepts) {
      assert(!allLines.includes(concept), `Should not contain internal concept: ${concept}`);
    }
  });

  await suite.test('total character count is reasonable (under 250 chars)', () => {
    const totalLength = SALES_TRUTH_LINE_1.length + SALES_TRUTH_LINE_2.length + SALES_TRUTH_LINE_3.length;
    assert(totalLength < 250, `Total length should be under 250 chars, got ${totalLength}`);
  });
});

test('Determinism', async (suite) => {
  await suite.test('same inputs produce identical output', () => {
    const url = 'https://example.com';
    const paths = createPaths();
    const expectations = [{ id: 'exp-1' }];
    const observeData = createObserveData({ status: 'SUCCESS', attempted: 1, observed: 1 });
    const detectData = createDetectData({ silentFailures: 0 });
    const isFirstRun = false;
    const status = 'SUCCESS';
    
    const output1 = captureConsoleOutput(() => {
      printSummary(url, paths, expectations, observeData, detectData, isFirstRun, status);
    });
    
    const output2 = captureConsoleOutput(() => {
      printSummary(url, paths, expectations, observeData, detectData, isFirstRun, status);
    });
    
    assert.deepStrictEqual(output1, output2, 'Identical inputs should produce identical output');
  });

  await suite.test('block content never changes across different run statuses', () => {
    const url = 'https://example.com';
    const paths = createPaths();
    const expectations = [{ id: 'exp-1' }];
    const detectData = createDetectData({ silentFailures: 0 });
    const isFirstRun = false;
    
    // SUCCESS run
    const successOutput = captureConsoleOutput(() => {
      const observeData = createObserveData({ status: 'SUCCESS', attempted: 1, observed: 1 });
      printSummary(url, paths, expectations, observeData, detectData, isFirstRun, 'SUCCESS');
    });
    
    // FINDINGS run
    const findingsOutput = captureConsoleOutput(() => {
      const observeData = createObserveData({ status: 'FINDINGS', attempted: 1, observed: 1 });
      printSummary(url, paths, expectations, observeData, { stats: { silentFailures: 1 } }, isFirstRun, 'FINDINGS');
    });
    
    // INCOMPLETE run
    const incompleteOutput = captureConsoleOutput(() => {
      const observeData = createObserveData({ status: 'INCOMPLETE', attempted: 1, observed: 0 });
      printSummary(url, paths, expectations, observeData, { stats: { unproven: 1 } }, isFirstRun, 'INCOMPLETE');
    });
    
    const successLine1 = successOutput.find((line) => line === SALES_TRUTH_LINE_1);
    const findingsLine1 = findingsOutput.find((line) => line === SALES_TRUTH_LINE_1);
    const incompleteLine1 = incompleteOutput.find((line) => line === SALES_TRUTH_LINE_1);
    
    assert.strictEqual(successLine1, SALES_TRUTH_LINE_1, 'SUCCESS run should have exact line 1');
    assert.strictEqual(findingsLine1, SALES_TRUTH_LINE_1, 'FINDINGS run should have exact line 1');
    assert.strictEqual(incompleteLine1, SALES_TRUTH_LINE_1, 'INCOMPLETE run should have exact line 1');
  });
});

test('Integration with Other Phases', async (suite) => {
  await suite.test('works correctly with Phase 5 diagnostic summary', () => {
    const url = 'https://example.com';
    const paths = createPaths();
    const expectations = [{ id: 'exp-1' }, { id: 'exp-2' }];
    const observeData = createObserveData({
      status: 'INCOMPLETE',
      attempted: 2,
      observed: 0,
      diagnostics: [
        { expectationId: 'exp-1', phaseOutcome: 'SELECTOR_NOT_FOUND' },
        { expectationId: 'exp-2', phaseOutcome: 'SELECTOR_NOT_FOUND' },
      ],
    });
    const detectData = createDetectData({ unproven: 2 });
    const isFirstRun = false;
    const status = 'INCOMPLETE';
    
    const output = captureConsoleOutput(() => {
      printSummary(url, paths, expectations, observeData, detectData, isFirstRun, status);
    });
    
    const diagnosticIndex = output.findIndex((line) => line.includes('Most common execution outcome'));
    const salesIndex = output.findIndex((line) => line === SALES_TRUTH_LINE_1);
    
    assert(diagnosticIndex >= 0, 'Phase 5 diagnostic summary should be present');
    assert(salesIndex >= 0, 'Sales truth block should be present');
    assert(salesIndex > diagnosticIndex, 'Sales truth should appear after Phase 5 diagnostics');
  });

  await suite.test('works correctly with Phase 6 persona lock', () => {
    const url = 'https://example.com';
    const paths = createPaths();
    const expectations = [{ id: 'exp-1' }];
    const observeData = createObserveData({ status: 'SUCCESS', attempted: 1, observed: 1 });
    const detectData = createDetectData({ silentFailures: 0 });
    const isFirstRun = true;
    const status = 'SUCCESS';
    
    const output = captureConsoleOutput(() => {
      printSummary(url, paths, expectations, observeData, detectData, isFirstRun, status);
    });
    
    const personaIndex = output.findIndex((line) => line.includes('VERAX is designed for frontend codebases'));
    const salesIndex = output.findIndex((line) => line === SALES_TRUTH_LINE_1);
    
    assert(personaIndex >= 0, 'Persona lock should be present');
    assert(salesIndex >= 0, 'Sales truth block should be present');
    assert(salesIndex > personaIndex, 'Sales truth should appear after persona lock');
  });

  await suite.test('works correctly with Phase 6 scope truth guard', () => {
    const url = 'https://example.com';
    const paths = createPaths();
    const expectations = [{ id: 'exp-1' }];
    const observeData = createObserveData({
      status: 'INCOMPLETE',
      attempted: 1,
      observed: 0,
      diagnostics: [
        { expectationId: 'exp-1', phaseOutcome: 'SELECTOR_NOT_FOUND' },
      ],
    });
    const detectData = createDetectData({ unproven: 1 });
    const isFirstRun = false;
    const status = 'INCOMPLETE';
    
    const output = captureConsoleOutput(() => {
      printSummary(url, paths, expectations, observeData, detectData, isFirstRun, status);
    });
    
    const scopeIndex = output.findIndex((line) => line.includes('No extracted promises matched the live page'));
    const salesIndex = output.findIndex((line) => line === SALES_TRUTH_LINE_1);
    
    assert(scopeIndex >= 0, 'Scope truth guard should be present');
    assert(salesIndex >= 0, 'Sales truth block should be present');
    assert(salesIndex > scopeIndex, 'Sales truth should appear after scope truth guard');
  });

  await suite.test('works correctly with Phase 6 success honesty guard', () => {
    const url = 'https://example.com';
    const paths = createPaths();
    const expectations = [{ id: 'exp-1' }, { id: 'exp-2' }];
    const observeData = createObserveData({ status: 'SUCCESS', attempted: 1, observed: 1 });
    const detectData = createDetectData({ silentFailures: 0 });
    const isFirstRun = false;
    const status = 'SUCCESS';
    
    const output = captureConsoleOutput(() => {
      printSummary(url, paths, expectations, observeData, detectData, isFirstRun, status);
    });
    
    const honestyIndex = output.findIndex((line) => line.includes('Some extracted promises were not exercised'));
    const salesIndex = output.findIndex((line) => line === SALES_TRUTH_LINE_1);
    
    assert(honestyIndex >= 0, 'Success honesty guard should be present');
    assert(salesIndex >= 0, 'Sales truth block should be present');
    assert(salesIndex > honestyIndex, 'Sales truth should appear after success honesty guard');
  });
});

test('Edge Cases', async (suite) => {
  await suite.test('appears even with zero expectations', () => {
    const url = 'https://example.com';
    const paths = createPaths();
    const expectations = [];
    const observeData = createObserveData({ status: 'INCOMPLETE', attempted: 0, observed: 0 });
    const detectData = createDetectData({ unproven: 0 });
    const isFirstRun = false;
    const status = 'INCOMPLETE';
    
    const output = captureConsoleOutput(() => {
      printSummary(url, paths, expectations, observeData, detectData, isFirstRun, status);
    });
    
    const hasBlock = output.some((line) => line === SALES_TRUTH_LINE_1);
    assert(hasBlock, 'Sales truth block should appear even with zero expectations');
  });

  await suite.test('appears regardless of isFirstRun value', () => {
    const url = 'https://example.com';
    const paths = createPaths();
    const expectations = [{ id: 'exp-1' }];
    const observeData = createObserveData({ status: 'SUCCESS', attempted: 1, observed: 1 });
    const detectData = createDetectData({ silentFailures: 0 });
    const status = 'SUCCESS';
    
    // First run
    const firstRunOutput = captureConsoleOutput(() => {
      printSummary(url, paths, expectations, observeData, detectData, true, status);
    });
    
    // Subsequent run
    const subsequentOutput = captureConsoleOutput(() => {
      printSummary(url, paths, expectations, observeData, detectData, false, status);
    });
    
    const firstRunHasBlock = firstRunOutput.some((line) => line === SALES_TRUTH_LINE_1);
    const subsequentHasBlock = subsequentOutput.some((line) => line === SALES_TRUTH_LINE_1);
    
    assert(firstRunHasBlock, 'Sales truth block should appear on first run');
    assert(subsequentHasBlock, 'Sales truth block should appear on subsequent runs');
  });

  await suite.test('appears regardless of status parameter value', () => {
    const url = 'https://example.com';
    const paths = createPaths();
    const expectations = [{ id: 'exp-1' }];
    const observeData = createObserveData({ status: 'SUCCESS', attempted: 1, observed: 1 });
    const detectData = createDetectData({ silentFailures: 0 });
    const isFirstRun = false;
    
    const nullStatusOutput = captureConsoleOutput(() => {
      printSummary(url, paths, expectations, observeData, detectData, isFirstRun, null);
    });
    
    const undefinedStatusOutput = captureConsoleOutput(() => {
      printSummary(url, paths, expectations, observeData, detectData, isFirstRun, undefined);
    });
    
    const nullHasBlock = nullStatusOutput.some((line) => line === SALES_TRUTH_LINE_1);
    const undefinedHasBlock = undefinedStatusOutput.some((line) => line === SALES_TRUTH_LINE_1);
    
    assert(nullHasBlock, 'Sales truth block should appear with null status');
    assert(undefinedHasBlock, 'Sales truth block should appear with undefined status');
  });
});
