/**
 * Confidence Signals Tests
 * Stage 5 of DX BOOST
 * 
 * Tests confidence level calculation, formatting, and integration.
 */

const { 
  calculateConfidence, 
  formatConfidenceBlock, 
  shouldShowConfidence,
  printConfidenceSignals
} = require('../src/guardian/confidence-signals');

let passCount = 0;
let failCount = 0;

function assert(condition, testName) {
  if (condition) {
    passCount++;
    console.log(`✓ ${testName}`);
  } else {
    failCount++;
    console.log(`✗ ${testName}`);
  }
}

function captureOutput(fn) {
  const originalLog = console.log;
  let output = '';
  console.log = (...args) => {
    output += args.join(' ') + '\n';
  };
  fn();
  console.log = originalLog;
  return output;
}

console.log('Running Confidence Signals Tests...\n');

// ============================================================================
// TEST GROUP 1: Confidence Calculation - HIGH Confidence
// ============================================================================

console.log('GROUP 1: HIGH Confidence Calculation');
console.log('─'.repeat(70));

// Test 1: HIGH confidence with full coverage and no issues
{
  const data = {
    coverage: {
      total: 10,
      executed: 10,
      skippedMissing: [],
      skippedNotApplicable: [],
      skippedDisabledByPreset: [],
      skippedUserFiltered: []
    },
    counts: { executedCount: 10 },
    attemptResults: [
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' }
    ],
    flowResults: [],
    verdict: { verdict: 'READY' }
  };
  
  const confidence = calculateConfidence(data);
  assert(confidence.level === 'HIGH', 'Test 1: Full coverage with no issues = HIGH confidence');
  assert(confidence.reasons.length === 0, 'Test 1: No reasons when everything is perfect');
}

// Test 2: HIGH confidence with minor not-applicable skips (doesn't lower confidence)
{
  const data = {
    coverage: {
      total: 10,
      executed: 8,
      skippedMissing: [],
      skippedNotApplicable: ['login', 'signup'],
      skippedDisabledByPreset: [],
      skippedUserFiltered: []
    },
    counts: { executedCount: 8 },
    attemptResults: [
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' }
    ],
    flowResults: [],
    verdict: { verdict: 'READY' }
  };
  
  const confidence = calculateConfidence(data);
  assert(confidence.level === 'HIGH', 'Test 2: Not-applicable skips do not lower confidence');
  assert(confidence.limits.some(l => l.includes('not applicable')), 'Test 2: Not-applicable skips appear in limits');
}

// ============================================================================
// TEST GROUP 2: Confidence Calculation - MEDIUM Confidence
// ============================================================================

console.log('\nGROUP 2: MEDIUM Confidence Calculation');
console.log('─'.repeat(70));

// Test 3: MEDIUM confidence with partial coverage (70%)
{
  const data = {
    coverage: {
      total: 10,
      executed: 7,
      skippedMissing: [],
      skippedNotApplicable: [],
      skippedDisabledByPreset: [],
      skippedUserFiltered: []
    },
    counts: { executedCount: 7 },
    attemptResults: [
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' }
    ],
    flowResults: [],
    verdict: { verdict: 'READY' }
  };
  
  const confidence = calculateConfidence(data);
  assert(confidence.level === 'MEDIUM', 'Test 3: 70% coverage = MEDIUM confidence');
  assert(confidence.reasons.some(r => r.includes('70%')), 'Test 3: Coverage percentage in reasons');
}

// Test 4: MEDIUM confidence with 1-2 missing critical flows
{
  const data = {
    coverage: {
      total: 10,
      executed: 8,
      skippedMissing: ['checkout', 'payment'],
      skippedNotApplicable: [],
      skippedDisabledByPreset: [],
      skippedUserFiltered: []
    },
    counts: { executedCount: 8 },
    attemptResults: [
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' }
    ],
    flowResults: [],
    verdict: { verdict: 'READY' }
  };
  
  const confidence = calculateConfidence(data);
  assert(confidence.level === 'MEDIUM', 'Test 4: 1-2 missing critical flows = MEDIUM confidence');
  assert(confidence.reasons.some(r => r.includes('critical flow')), 'Test 4: Missing flows mentioned in reasons');
  assert(confidence.limits.some(l => l.includes('missing elements')), 'Test 4: Missing flows in limits');
}

// Test 5: MEDIUM confidence with 1 infrastructure error
{
  const data = {
    coverage: {
      total: 10,
      executed: 9,
      skippedMissing: [],
      skippedNotApplicable: [],
      skippedDisabledByPreset: [],
      skippedUserFiltered: []
    },
    counts: { executedCount: 9 },
    attemptResults: [
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { 
        outcome: 'FAILURE', 
        classification: { category: 'infrastructure' },
        error: 'timeout after 30s'
      }
    ],
    flowResults: [],
    verdict: { verdict: 'FRICTION' }
  };
  
  const confidence = calculateConfidence(data);
  assert(confidence.level === 'MEDIUM', 'Test 5: 1 infrastructure error = MEDIUM confidence');
  assert(confidence.reasons.some(r => r.includes('infrastructure')), 'Test 5: Infra error in reasons');
}

// ============================================================================
// TEST GROUP 3: Confidence Calculation - LOW Confidence
// ============================================================================

console.log('\nGROUP 3: LOW Confidence Calculation');
console.log('─'.repeat(70));

// Test 6: LOW confidence with low coverage (<50%)
{
  const data = {
    coverage: {
      total: 10,
      executed: 4,
      skippedMissing: [],
      skippedNotApplicable: [],
      skippedDisabledByPreset: [],
      skippedUserFiltered: []
    },
    counts: { executedCount: 4 },
    attemptResults: [
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' }
    ],
    flowResults: [],
    verdict: { verdict: 'READY' }
  };
  
  const confidence = calculateConfidence(data);
  assert(confidence.level === 'LOW', 'Test 6: <50% coverage = LOW confidence');
  assert(confidence.reasons.some(r => r.includes('40%')), 'Test 6: Low coverage percentage in reasons');
}

// Test 7: LOW confidence with 3+ missing critical flows
{
  const data = {
    coverage: {
      total: 10,
      executed: 6,
      skippedMissing: ['checkout', 'payment', 'cart', 'shipping'],
      skippedNotApplicable: [],
      skippedDisabledByPreset: [],
      skippedUserFiltered: []
    },
    counts: { executedCount: 6 },
    attemptResults: [
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' }
    ],
    flowResults: [],
    verdict: { verdict: 'READY' }
  };
  
  const confidence = calculateConfidence(data);
  assert(confidence.level === 'LOW', 'Test 7: 3+ missing critical flows = LOW confidence');
  assert(confidence.reasons.some(r => r.includes('4 critical flows')), 'Test 7: Count of missing flows in reasons');
}

// Test 8: LOW confidence with multiple infrastructure errors
{
  const data = {
    coverage: {
      total: 10,
      executed: 8,
      skippedMissing: [],
      skippedNotApplicable: [],
      skippedDisabledByPreset: [],
      skippedUserFiltered: []
    },
    counts: { executedCount: 8 },
    attemptResults: [
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { 
        outcome: 'FAILURE',
        error: 'ETIMEDOUT'
      },
      { 
        outcome: 'FAILURE',
        error: 'network timeout'
      }
    ],
    flowResults: [],
    verdict: { verdict: 'FRICTION' }
  };
  
  const confidence = calculateConfidence(data);
  assert(confidence.level === 'LOW', 'Test 8: 2+ infrastructure errors = LOW confidence');
  assert(confidence.reasons.some(r => r.includes('infrastructure')), 'Test 8: Infra errors in reasons');
}

// Test 9: LOW confidence with critical failures
{
  const data = {
    coverage: {
      total: 10,
      executed: 9,
      skippedMissing: [],
      skippedNotApplicable: [],
      skippedDisabledByPreset: [],
      skippedUserFiltered: []
    },
    counts: { executedCount: 9 },
    attemptResults: [
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { 
        outcome: 'FAILURE',
        classification: { severity: 'critical' }
      }
    ],
    flowResults: [],
    verdict: { verdict: 'DO_NOT_LAUNCH' }
  };
  
  const confidence = calculateConfidence(data);
  assert(confidence.level === 'LOW', 'Test 9: Critical failures = LOW confidence');
  assert(confidence.reasons.some(r => r.includes('critical failure')), 'Test 9: Critical failures in reasons');
}

// ============================================================================
// TEST GROUP 4: Reason Capping
// ============================================================================

console.log('\nGROUP 4: Reason and Limit Capping');
console.log('─'.repeat(70));

// Test 10: Reasons capped at 3
{
  const data = {
    coverage: {
      total: 10,
      executed: 3,
      skippedMissing: ['a', 'b', 'c', 'd', 'e'],
      skippedNotApplicable: [],
      skippedDisabledByPreset: [],
      skippedUserFiltered: []
    },
    counts: { executedCount: 3 },
    attemptResults: [
      { outcome: 'SUCCESS' },
      { outcome: 'SUCCESS' },
      { 
        outcome: 'FAILURE',
        classification: { severity: 'critical' }
      }
    ],
    flowResults: [],
    verdict: { verdict: 'DO_NOT_LAUNCH' }
  };
  
  const confidence = calculateConfidence(data);
  assert(confidence.reasons.length <= 3, 'Test 10: Reasons capped at 3');
}

// Test 11: Limits capped at 5
{
  const data = {
    coverage: {
      total: 20,
      executed: 10,
      skippedMissing: ['m1', 'm2', 'm3'],
      skippedNotApplicable: ['na1', 'na2', 'na3', 'na4', 'na5', 'na6'],
      skippedDisabledByPreset: ['d1', 'd2'],
      skippedUserFiltered: ['f1', 'f2']
    },
    counts: { executedCount: 10 },
    attemptResults: Array(10).fill({ outcome: 'SUCCESS' }),
    flowResults: [],
    verdict: { verdict: 'READY' }
  };
  
  const confidence = calculateConfidence(data);
  assert(confidence.limits.length <= 5, 'Test 11: Limits capped at 5');
}

// ============================================================================
// TEST GROUP 5: Formatting
// ============================================================================

console.log('\nGROUP 5: Confidence Block Formatting');
console.log('─'.repeat(70));

// Test 12: Formatted output contains all key sections
{
  const confidence = {
    level: 'MEDIUM',
    reasons: ['70% coverage - some flows not tested'],
    limits: ['checkout was not tested (missing elements)']
  };
  
  const formatted = formatConfidenceBlock(confidence, 'READY');
  assert(formatted.includes('CONFIDENCE ASSESSMENT'), 'Test 12: Header present');
  assert(formatted.includes('Confidence Level: MEDIUM'), 'Test 12: Level displayed');
  assert(formatted.includes('Confidence Factors:'), 'Test 12: Reasons section present');
  assert(formatted.includes('Testing Limits:'), 'Test 12: Limits section present');
  assert(formatted.includes('70% coverage'), 'Test 12: Specific reason displayed');
  assert(formatted.includes('checkout was not tested'), 'Test 12: Specific limit displayed');
}

// Test 13: HIGH confidence with READY verdict - optimistic tone
{
  const confidence = {
    level: 'HIGH',
    reasons: [],
    limits: []
  };
  
  const formatted = formatConfidenceBlock(confidence, 'READY');
  assert(formatted.includes('comprehensive execution coverage'), 'Test 13: HIGH+READY has confident tone');
}

// Test 14: LOW confidence with DO_NOT_LAUNCH verdict - protective tone
{
  const confidence = {
    level: 'LOW',
    reasons: ['2 critical failures observed'],
    limits: []
  };
  
  const formatted = formatConfidenceBlock(confidence, 'DO_NOT_LAUNCH');
  assert(formatted.includes('Critical failures AND test coverage limitations'), 'Test 14: LOW+DO_NOT_LAUNCH has protective tone');
}

// Test 15: MEDIUM confidence with FRICTION - balanced tone
{
  const confidence = {
    level: 'MEDIUM',
    reasons: ['1 infrastructure error detected (timeouts, network issues)'],
    limits: []
  };
  
  const formatted = formatConfidenceBlock(confidence, 'FRICTION');
  assert(formatted.includes('Issues detected, but test coverage had some limitations'), 'Test 15: MEDIUM+FRICTION has balanced tone');
}

// ============================================================================
// TEST GROUP 6: Skip Conditions
// ============================================================================

console.log('\nGROUP 6: Skip Conditions');
console.log('─'.repeat(70));

// Test 16: Should show confidence by default (TTY assumed)
{
  const result = shouldShowConfidence([]);
  assert(result === true, 'Test 16: Shows confidence by default');
}

// Test 17: Should NOT show with --quiet
{
  const result = shouldShowConfidence(['--quiet']);
  assert(result === false, 'Test 17: Suppressed with --quiet');
}

// Test 18: Should NOT show with -q
{
  const result = shouldShowConfidence(['-q']);
  assert(result === false, 'Test 18: Suppressed with -q');
}

// Test 19: Should NOT show in non-TTY (CI mode)
{
  const originalIsTTY = process.stdout.isTTY;
  process.stdout.isTTY = false;
  const result = shouldShowConfidence([]);
  process.stdout.isTTY = originalIsTTY;
  assert(result === false, 'Test 19: Suppressed in non-TTY (CI)');
}

// ============================================================================
// TEST GROUP 7: Integration with printConfidenceSignals
// ============================================================================

console.log('\nGROUP 7: Print Function Integration');
console.log('─'.repeat(70));

// Test 20: printConfidenceSignals outputs formatted block
{
  const data = {
    coverage: {
      total: 10,
      executed: 10,
      skippedMissing: [],
      skippedNotApplicable: [],
      skippedDisabledByPreset: [],
      skippedUserFiltered: []
    },
    counts: { executedCount: 10 },
    attemptResults: Array(10).fill({ outcome: 'SUCCESS' }),
    flowResults: [],
    verdict: { verdict: 'READY' }
  };
  
  const output = captureOutput(() => {
    printConfidenceSignals(data, {}, []);
  });
  
  assert(output.includes('CONFIDENCE ASSESSMENT'), 'Test 20: Print function outputs formatted block');
  assert(output.includes('HIGH'), 'Test 20: Confidence level appears in output');
}

// Test 21: printConfidenceSignals respects quiet mode
{
  const data = {
    coverage: { total: 10, executed: 10 },
    counts: { executedCount: 10 },
    attemptResults: Array(10).fill({ outcome: 'SUCCESS' }),
    verdict: { verdict: 'READY' }
  };
  
  const output = captureOutput(() => {
    printConfidenceSignals(data, {}, ['--quiet']);
  });
  
  assert(output.trim() === '', 'Test 21: No output in quiet mode');
}

// ============================================================================
// TEST GROUP 8: Edge Cases
// ============================================================================

console.log('\nGROUP 8: Edge Cases');
console.log('─'.repeat(70));

// Test 22: Empty data defaults to MEDIUM with reasons
{
  const confidence = calculateConfidence({});
  assert(confidence.level !== undefined, 'Test 22: Returns a confidence level even with empty data');
  assert(Array.isArray(confidence.reasons), 'Test 22: Reasons is always an array');
  assert(Array.isArray(confidence.limits), 'Test 22: Limits is always an array');
}

// Test 23: Zero planned attempts
{
  const data = {
    coverage: { total: 0, executed: 0 },
    counts: { executedCount: 0 },
    attemptResults: [],
    verdict: { verdict: 'UNKNOWN' }
  };
  
  const confidence = calculateConfidence(data);
  assert(confidence.level === 'LOW', 'Test 23: Zero attempts = LOW confidence');
}

// Test 24: Formatting with empty confidence
{
  const formatted = formatConfidenceBlock({}, 'READY');
  assert(formatted.includes('CONFIDENCE ASSESSMENT'), 'Test 24: Still formats with empty data');
  assert(formatted.includes('MEDIUM'), 'Test 24: Defaults to MEDIUM when level missing');
}

// Test 25: Multiple skip types in limits
{
  const data = {
    coverage: {
      total: 20,
      executed: 15,
      skippedMissing: ['checkout'],
      skippedNotApplicable: ['login'],
      skippedDisabledByPreset: ['admin-flow'],
      skippedUserFiltered: ['debug-test']
    },
    counts: { executedCount: 15 },
    attemptResults: Array(15).fill({ outcome: 'SUCCESS' }),
    verdict: { verdict: 'READY' }
  };
  
  const confidence = calculateConfidence(data);
  assert(confidence.limits.length > 0, 'Test 25: Multiple skip types create limits');
  assert(confidence.limits.some(l => l.includes('missing elements') || l.includes('not applicable') || l.includes('disabled') || l.includes('excluded')), 'Test 25: Different skip types represented');
}

// ============================================================================
// RESULTS
// ============================================================================

console.log('\n' + '='.repeat(70));
console.log('TEST RESULTS');
console.log('='.repeat(70));
console.log(`Passed: ${passCount}`);
console.log(`Failed: ${failCount}`);
console.log(`Total:  ${passCount + failCount}`);

if (failCount === 0) {
  console.log('\n✓ All tests passed!');
  process.exit(0);
} else {
  console.log(`\n✗ ${failCount} test(s) failed`);
  process.exit(1);
}
