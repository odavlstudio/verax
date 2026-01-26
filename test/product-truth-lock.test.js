/**
 * PHASE 6 TESTS: Product Truth Lock — Persona & Scope Enforcement
 * 
 * Tests that VERAX clearly communicates:
 * - Who it is designed for (persona lock)
 * - What scope mismatches mean (scope truth guard)
 * - What SUCCESS really guarantees (success honesty guard)
 * 
 * Contract: Factual messaging only, no behavior changes, no JSON mode output.
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

test('Persona Lock', async (suite) => {
  await suite.test('should print persona line on first run', () => {
    const url = 'https://example.com';
    const paths = createPaths();
    const expectations = [{ id: 'exp-1' }, { id: 'exp-2' }];
    const observeData = createObserveData({ status: 'SUCCESS', attempted: 2, observed: 2 });
    const detectData = createDetectData({ silentFailures: 0 });
    const isFirstRun = true;
    const status = 'SUCCESS';
    
    const output = captureConsoleOutput(() => {
      printSummary(url, paths, expectations, observeData, detectData, isFirstRun, status);
    });
    
    const personaLine = output.find((line) =>
      line.includes('VERAX is designed for frontend codebases')
    );
    
    assert(personaLine, 'Persona line should be present on first run');
    assert(personaLine.includes('React / Next.js / Vue / Angular / SvelteKit'), 'Should mention supported frameworks');
    assert(personaLine.includes('--src'), 'Should mention --src requirement');
  });

  await suite.test('should NOT print persona line on subsequent runs', () => {
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
    
    const personaLine = output.find((line) =>
      line.includes('VERAX is designed for frontend codebases')
    );
    
    assert.strictEqual(personaLine, undefined, 'Persona line should NOT be present on subsequent runs');
  });

  await suite.test('should print persona line only once per run', () => {
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
    
    const personaLines = output.filter((line) =>
      line.includes('VERAX is designed for frontend codebases')
    );
    
    assert.strictEqual(personaLines.length, 1, 'Persona line should appear exactly once');
  });

  await suite.test('persona line should use exact wording', () => {
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
    
    const personaLine = output.find((line) =>
      line.includes('VERAX is designed for frontend codebases')
    );
    
    const expected = 'VERAX is designed for frontend codebases (React / Next.js / Vue / Angular / SvelteKit) with local source code provided via --src.';
    assert.strictEqual(personaLine, expected, 'Persona line must match exact wording');
  });
});

test('Scope Truth Guard', async (suite) => {
  await suite.test('should trigger when all diagnostics are SELECTOR_NOT_FOUND and observed=0', () => {
    const url = 'https://example.com';
    const paths = createPaths();
    const expectations = [{ id: 'exp-1' }, { id: 'exp-2' }, { id: 'exp-3' }];
    const observeData = createObserveData({
      status: 'INCOMPLETE',
      attempted: 3,
      observed: 0,
      diagnostics: [
        { expectationId: 'exp-1', phaseOutcome: 'SELECTOR_NOT_FOUND' },
        { expectationId: 'exp-2', phaseOutcome: 'SELECTOR_NOT_FOUND' },
        { expectationId: 'exp-3', phaseOutcome: 'SELECTOR_NOT_FOUND' },
      ],
    });
    const detectData = createDetectData({ unproven: 3 });
    const isFirstRun = false;
    const status = 'INCOMPLETE';
    
    const output = captureConsoleOutput(() => {
      printSummary(url, paths, expectations, observeData, detectData, isFirstRun, status);
    });
    
    const guardLine = output.find((line) =>
      line.includes('No extracted promises matched the live page')
    );
    
    assert(guardLine, 'Scope truth guard should trigger');
    assert(guardLine.includes('--src does not correspond to the deployed URL'), 'Should explain likely cause');
  });

  await suite.test('should trigger when all diagnostics are UNSUPPORTED_PROMISE and observed=0', () => {
    const url = 'https://example.com';
    const paths = createPaths();
    const expectations = [{ id: 'exp-1' }, { id: 'exp-2' }];
    const observeData = createObserveData({
      status: 'INCOMPLETE',
      attempted: 2,
      observed: 0,
      diagnostics: [
        { expectationId: 'exp-1', phaseOutcome: 'UNSUPPORTED_PROMISE' },
        { expectationId: 'exp-2', phaseOutcome: 'UNSUPPORTED_PROMISE' },
      ],
    });
    const detectData = createDetectData({ unproven: 2 });
    const isFirstRun = false;
    const status = 'INCOMPLETE';
    
    const output = captureConsoleOutput(() => {
      printSummary(url, paths, expectations, observeData, detectData, isFirstRun, status);
    });
    
    const guardLine = output.find((line) =>
      line.includes('No extracted promises matched the live page')
    );
    
    assert(guardLine, 'Scope truth guard should trigger for UNSUPPORTED_PROMISE');
  });

  await suite.test('should trigger when mix of SELECTOR_NOT_FOUND and UNSUPPORTED_PROMISE', () => {
    const url = 'https://example.com';
    const paths = createPaths();
    const expectations = [{ id: 'exp-1' }, { id: 'exp-2' }, { id: 'exp-3' }];
    const observeData = createObserveData({
      status: 'INCOMPLETE',
      attempted: 3,
      observed: 0,
      diagnostics: [
        { expectationId: 'exp-1', phaseOutcome: 'SELECTOR_NOT_FOUND' },
        { expectationId: 'exp-2', phaseOutcome: 'UNSUPPORTED_PROMISE' },
        { expectationId: 'exp-3', phaseOutcome: 'SELECTOR_NOT_FOUND' },
      ],
    });
    const detectData = createDetectData({ unproven: 3 });
    const isFirstRun = false;
    const status = 'INCOMPLETE';
    
    const output = captureConsoleOutput(() => {
      printSummary(url, paths, expectations, observeData, detectData, isFirstRun, status);
    });
    
    const guardLine = output.find((line) =>
      line.includes('No extracted promises matched the live page')
    );
    
    assert(guardLine, 'Scope truth guard should trigger for mixed scope mismatch outcomes');
  });

  await suite.test('should NOT trigger when some diagnostics are other outcomes', () => {
    const url = 'https://example.com';
    const paths = createPaths();
    const expectations = [{ id: 'exp-1' }, { id: 'exp-2' }, { id: 'exp-3' }];
    const observeData = createObserveData({
      status: 'INCOMPLETE',
      attempted: 3,
      observed: 0,
      diagnostics: [
        { expectationId: 'exp-1', phaseOutcome: 'SELECTOR_NOT_FOUND' },
        { expectationId: 'exp-2', phaseOutcome: 'ELEMENT_HIDDEN' },
        { expectationId: 'exp-3', phaseOutcome: 'SELECTOR_NOT_FOUND' },
      ],
    });
    const detectData = createDetectData({ unproven: 3 });
    const isFirstRun = false;
    const status = 'INCOMPLETE';
    
    const output = captureConsoleOutput(() => {
      printSummary(url, paths, expectations, observeData, detectData, isFirstRun, status);
    });
    
    const guardLine = output.find((line) =>
      line.includes('No extracted promises matched the live page')
    );
    
    assert.strictEqual(guardLine, undefined, 'Scope truth guard should NOT trigger when other outcomes present');
  });

  await suite.test('should NOT trigger when observed > 0', () => {
    const url = 'https://example.com';
    const paths = createPaths();
    const expectations = [{ id: 'exp-1' }, { id: 'exp-2' }];
    const observeData = createObserveData({
      status: 'SUCCESS',
      attempted: 2,
      observed: 2,
      diagnostics: [
        { expectationId: 'exp-1', phaseOutcome: 'SUCCESS' },
        { expectationId: 'exp-2', phaseOutcome: 'SUCCESS' },
      ],
    });
    const detectData = createDetectData({ silentFailures: 0 });
    const isFirstRun = false;
    const status = 'SUCCESS';
    
    const output = captureConsoleOutput(() => {
      printSummary(url, paths, expectations, observeData, detectData, isFirstRun, status);
    });
    
    const guardLine = output.find((line) =>
      line.includes('No extracted promises matched the live page')
    );
    
    assert.strictEqual(guardLine, undefined, 'Scope truth guard should NOT trigger when observed > 0');
  });

  await suite.test('should NOT trigger when no expectations', () => {
    const url = 'https://example.com';
    const paths = createPaths();
    const expectations = [];
    const observeData = createObserveData({
      status: 'INCOMPLETE',
      attempted: 0,
      observed: 0,
      diagnostics: [],
    });
    const detectData = createDetectData({ unproven: 0 });
    const isFirstRun = false;
    const status = 'INCOMPLETE';
    
    const output = captureConsoleOutput(() => {
      printSummary(url, paths, expectations, observeData, detectData, isFirstRun, status);
    });
    
    const guardLine = output.find((line) =>
      line.includes('No extracted promises matched the live page')
    );
    
    assert.strictEqual(guardLine, undefined, 'Scope truth guard should NOT trigger when no expectations');
  });

  await suite.test('scope guard should use exact factual wording', () => {
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
    
    const guardLine = output.find((line) =>
      line.includes('No extracted promises matched the live page')
    );
    
    const expected = 'No extracted promises matched the live page. This usually means the provided --src does not correspond to the deployed URL.';
    assert.strictEqual(guardLine, expected, 'Scope guard must use exact factual wording');
  });
});

test('Success Honesty Guard', async (suite) => {
  await suite.test('should trigger when SUCCESS but attempted < total', () => {
    const url = 'https://example.com';
    const paths = createPaths();
    const expectations = [{ id: 'exp-1' }, { id: 'exp-2' }, { id: 'exp-3' }];
    const observeData = createObserveData({
      status: 'SUCCESS',
      attempted: 2,
      observed: 2,
      diagnostics: [
        { expectationId: 'exp-1', phaseOutcome: 'SUCCESS' },
        { expectationId: 'exp-2', phaseOutcome: 'SUCCESS' },
      ],
    });
    const detectData = createDetectData({ silentFailures: 0 });
    const isFirstRun = false;
    const status = 'SUCCESS';
    
    const output = captureConsoleOutput(() => {
      printSummary(url, paths, expectations, observeData, detectData, isFirstRun, status);
    });
    
    const honestyLine = output.find((line) =>
      line.includes('Some extracted promises were not exercised')
    );
    
    assert(honestyLine, 'Success honesty guard should trigger');
    assert(honestyLine.includes('SUCCESS indicates no silent failures in the observed subset'), 'Should clarify what SUCCESS means');
  });

  await suite.test('should NOT trigger when SUCCESS and attempted === total', () => {
    const url = 'https://example.com';
    const paths = createPaths();
    const expectations = [{ id: 'exp-1' }, { id: 'exp-2' }];
    const observeData = createObserveData({
      status: 'SUCCESS',
      attempted: 2,
      observed: 2,
      diagnostics: [
        { expectationId: 'exp-1', phaseOutcome: 'SUCCESS' },
        { expectationId: 'exp-2', phaseOutcome: 'SUCCESS' },
      ],
    });
    const detectData = createDetectData({ silentFailures: 0 });
    const isFirstRun = false;
    const status = 'SUCCESS';
    
    const output = captureConsoleOutput(() => {
      printSummary(url, paths, expectations, observeData, detectData, isFirstRun, status);
    });
    
    const honestyLine = output.find((line) =>
      line.includes('Some extracted promises were not exercised')
    );
    
    assert.strictEqual(honestyLine, undefined, 'Success honesty guard should NOT trigger when all expectations attempted');
  });

  await suite.test('should NOT trigger when status is FINDINGS', () => {
    const url = 'https://example.com';
    const paths = createPaths();
    const expectations = [{ id: 'exp-1' }, { id: 'exp-2' }, { id: 'exp-3' }];
    const observeData = createObserveData({
      status: 'FINDINGS',
      attempted: 2,
      observed: 2,
      diagnostics: [
        { expectationId: 'exp-1', phaseOutcome: 'SUCCESS' },
        { expectationId: 'exp-2', phaseOutcome: 'SUCCESS' },
      ],
    });
    const detectData = createDetectData({ silentFailures: 1 });
    const isFirstRun = false;
    const status = 'FINDINGS';
    
    const output = captureConsoleOutput(() => {
      printSummary(url, paths, expectations, observeData, detectData, isFirstRun, status);
    });
    
    const honestyLine = output.find((line) =>
      line.includes('Some extracted promises were not exercised')
    );
    
    assert.strictEqual(honestyLine, undefined, 'Success honesty guard should NOT trigger for FINDINGS status');
  });

  await suite.test('should NOT trigger when status is INCOMPLETE', () => {
    const url = 'https://example.com';
    const paths = createPaths();
    const expectations = [{ id: 'exp-1' }, { id: 'exp-2' }, { id: 'exp-3' }];
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
    
    const honestyLine = output.find((line) =>
      line.includes('Some extracted promises were not exercised')
    );
    
    assert.strictEqual(honestyLine, undefined, 'Success honesty guard should NOT trigger for INCOMPLETE status');
  });

  await suite.test('should NOT trigger when no expectations', () => {
    const url = 'https://example.com';
    const paths = createPaths();
    const expectations = [];
    const observeData = createObserveData({
      status: 'SUCCESS',
      attempted: 0,
      observed: 0,
      diagnostics: [],
    });
    const detectData = createDetectData({ silentFailures: 0 });
    const isFirstRun = false;
    const status = 'SUCCESS';
    
    const output = captureConsoleOutput(() => {
      printSummary(url, paths, expectations, observeData, detectData, isFirstRun, status);
    });
    
    const honestyLine = output.find((line) =>
      line.includes('Some extracted promises were not exercised')
    );
    
    assert.strictEqual(honestyLine, undefined, 'Success honesty guard should NOT trigger when no expectations');
  });

  await suite.test('success honesty guard should use exact wording', () => {
    const url = 'https://example.com';
    const paths = createPaths();
    const expectations = [{ id: 'exp-1' }, { id: 'exp-2' }];
    const observeData = createObserveData({
      status: 'SUCCESS',
      attempted: 1,
      observed: 1,
      diagnostics: [
        { expectationId: 'exp-1', phaseOutcome: 'SUCCESS' },
      ],
    });
    const detectData = createDetectData({ silentFailures: 0 });
    const isFirstRun = false;
    const status = 'SUCCESS';
    
    const output = captureConsoleOutput(() => {
      printSummary(url, paths, expectations, observeData, detectData, isFirstRun, status);
    });
    
    const honestyLine = output.find((line) =>
      line.includes('Some extracted promises were not exercised')
    );
    
    const expected = 'Some extracted promises were not exercised. SUCCESS indicates no silent failures in the observed subset.';
    assert.strictEqual(honestyLine, expected, 'Success honesty guard must use exact wording');
  });
});

test('Guard Interactions', async (suite) => {
  await suite.test('persona lock and scope truth guard can both appear', () => {
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
    const isFirstRun = true;
    const status = 'INCOMPLETE';
    
    const output = captureConsoleOutput(() => {
      printSummary(url, paths, expectations, observeData, detectData, isFirstRun, status);
    });
    
    const personaLine = output.find((line) =>
      line.includes('VERAX is designed for frontend codebases')
    );
    const scopeLine = output.find((line) =>
      line.includes('No extracted promises matched the live page')
    );
    
    assert(personaLine, 'Persona lock should appear');
    assert(scopeLine, 'Scope truth guard should appear');
  });

  await suite.test('persona lock and success honesty guard can both appear', () => {
    const url = 'https://example.com';
    const paths = createPaths();
    const expectations = [{ id: 'exp-1' }, { id: 'exp-2' }];
    const observeData = createObserveData({
      status: 'SUCCESS',
      attempted: 1,
      observed: 1,
      diagnostics: [
        { expectationId: 'exp-1', phaseOutcome: 'SUCCESS' },
      ],
    });
    const detectData = createDetectData({ silentFailures: 0 });
    const isFirstRun = true;
    const status = 'SUCCESS';
    
    const output = captureConsoleOutput(() => {
      printSummary(url, paths, expectations, observeData, detectData, isFirstRun, status);
    });
    
    const personaLine = output.find((line) =>
      line.includes('VERAX is designed for frontend codebases')
    );
    const honestyLine = output.find((line) =>
      line.includes('Some extracted promises were not exercised')
    );
    
    assert(personaLine, 'Persona lock should appear');
    assert(honestyLine, 'Success honesty guard should appear');
  });

  await suite.test('all three guards should never appear together', () => {
    // Scope truth guard requires observed=0, success honesty requires status=SUCCESS
    // These are mutually exclusive conditions
    
    // SUCCESS with partial attempts
    const url = 'https://example.com';
    const paths = createPaths();
    const expectations = [{ id: 'exp-1' }, { id: 'exp-2' }];
    const observeData = createObserveData({
      status: 'SUCCESS',
      attempted: 1,
      observed: 1,
      diagnostics: [
        { expectationId: 'exp-1', phaseOutcome: 'SUCCESS' },
      ],
    });
    const detectData = createDetectData({ silentFailures: 0 });
    const isFirstRun = true;
    const status = 'SUCCESS';
    
    const output = captureConsoleOutput(() => {
      printSummary(url, paths, expectations, observeData, detectData, isFirstRun, status);
    });
    
    const personaLine = output.find((line) =>
      line.includes('VERAX is designed for frontend codebases')
    );
    const scopeLine = output.find((line) =>
      line.includes('No extracted promises matched the live page')
    );
    const honestyLine = output.find((line) =>
      line.includes('Some extracted promises were not exercised')
    );
    
    assert(personaLine, 'Persona lock should appear');
    assert.strictEqual(scopeLine, undefined, 'Scope guard should NOT appear (observed > 0)');
    assert(honestyLine, 'Success honesty guard should appear');
  });
});

test('Guard Determinism', async (suite) => {
  await suite.test('same inputs produce same guard output', () => {
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
    const isFirstRun = true;
    const status = 'INCOMPLETE';
    
    const output1 = captureConsoleOutput(() => {
      printSummary(url, paths, expectations, observeData, detectData, isFirstRun, status);
    });
    
    const output2 = captureConsoleOutput(() => {
      printSummary(url, paths, expectations, observeData, detectData, isFirstRun, status);
    });
    
    assert.deepStrictEqual(output1, output2, 'Same inputs should produce identical output');
  });

  await suite.test('guard order is deterministic', () => {
    const url = 'https://example.com';
    const paths = createPaths();
    const expectations = [{ id: 'exp-1' }, { id: 'exp-2' }];
    const observeData = createObserveData({
      status: 'SUCCESS',
      attempted: 1,
      observed: 1,
      diagnostics: [
        { expectationId: 'exp-1', phaseOutcome: 'SUCCESS' },
      ],
    });
    const detectData = createDetectData({ silentFailures: 0 });
    const isFirstRun = true;
    const status = 'SUCCESS';
    
    const output = captureConsoleOutput(() => {
      printSummary(url, paths, expectations, observeData, detectData, isFirstRun, status);
    });
    
    const personaIndex = output.findIndex((line) =>
      line.includes('VERAX is designed for frontend codebases')
    );
    const honestyIndex = output.findIndex((line) =>
      line.includes('Some extracted promises were not exercised')
    );
    const artifactsIndex = output.findIndex((line) =>
      line.includes('Artifacts written to')
    );
    
    assert(personaIndex >= 0, 'Persona lock should be present');
    assert(honestyIndex >= 0, 'Success honesty guard should be present');
    assert(artifactsIndex >= 0, 'Artifacts line should be present');
    
    // Order: persona lock → success honesty → artifacts
    assert(personaIndex < honestyIndex, 'Persona lock should appear before success honesty guard');
    assert(honestyIndex < artifactsIndex, 'Success honesty guard should appear before artifacts line');
  });
});

test('Edge Cases', async (suite) => {
  await suite.test('should handle empty diagnostics array gracefully', () => {
    const url = 'https://example.com';
    const paths = createPaths();
    const expectations = [{ id: 'exp-1' }];
    const observeData = createObserveData({
      status: 'INCOMPLETE',
      attempted: 1,
      observed: 0,
      diagnostics: [],
    });
    const detectData = createDetectData({ unproven: 1 });
    const isFirstRun = false;
    const status = 'INCOMPLETE';
    
    const output = captureConsoleOutput(() => {
      printSummary(url, paths, expectations, observeData, detectData, isFirstRun, status);
    });
    
    const scopeLine = output.find((line) =>
      line.includes('No extracted promises matched the live page')
    );
    
    assert.strictEqual(scopeLine, undefined, 'Scope guard should not trigger with empty diagnostics');
  });

  await suite.test('should handle missing diagnostics field', () => {
    const url = 'https://example.com';
    const paths = createPaths();
    const expectations = [{ id: 'exp-1' }];
    const observeData = {
      status: 'INCOMPLETE',
      stats: { attempted: 1, observed: 0 },
      // diagnostics field missing
    };
    const detectData = createDetectData({ unproven: 1 });
    const isFirstRun = false;
    const status = 'INCOMPLETE';
    
    const output = captureConsoleOutput(() => {
      printSummary(url, paths, expectations, observeData, detectData, isFirstRun, status);
    });
    
    const scopeLine = output.find((line) =>
      line.includes('No extracted promises matched the live page')
    );
    
    assert.strictEqual(scopeLine, undefined, 'Scope guard should not trigger with missing diagnostics');
  });

  await suite.test('should handle isFirstRun=undefined as false', () => {
    const url = 'https://example.com';
    const paths = createPaths();
    const expectations = [{ id: 'exp-1' }];
    const observeData = createObserveData({
      status: 'SUCCESS',
      attempted: 1,
      observed: 1,
    });
    const detectData = createDetectData({ silentFailures: 0 });
    const isFirstRun = undefined;
    const status = 'SUCCESS';
    
    const output = captureConsoleOutput(() => {
      printSummary(url, paths, expectations, observeData, detectData, isFirstRun, status);
    });
    
    const personaLine = output.find((line) =>
      line.includes('VERAX is designed for frontend codebases')
    );
    
    assert.strictEqual(personaLine, undefined, 'Persona lock should not appear when isFirstRun is undefined');
  });

  await suite.test('should handle status=null gracefully', () => {
    const url = 'https://example.com';
    const paths = createPaths();
    const expectations = [{ id: 'exp-1' }, { id: 'exp-2' }];
    const observeData = createObserveData({
      status: 'SUCCESS',
      attempted: 1,
      observed: 1,
    });
    const detectData = createDetectData({ silentFailures: 0 });
    const isFirstRun = false;
    const status = null;
    
    const output = captureConsoleOutput(() => {
      printSummary(url, paths, expectations, observeData, detectData, isFirstRun, status);
    });
    
    const honestyLine = output.find((line) =>
      line.includes('Some extracted promises were not exercised')
    );
    
    assert.strictEqual(honestyLine, undefined, 'Success honesty guard should not trigger when status is null');
  });
});
