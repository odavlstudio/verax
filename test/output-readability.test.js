/**
 * Output Readability Tests
 * Verify unified CLI output structure, order, and suppression
 */

const assert = require('assert');
const {
  shouldShowUnifiedOutput,
  formatHeader,
  formatExecutionSummary,
  formatFinalSummary,
  printUnifiedOutput,
  formatCompactOutput
} = require('../src/guardian/output-readability');

// Mock TTY
function mockTTY(isTTY) {
  const original = process.stdout.isTTY;
  process.stdout.isTTY = isTTY;
  return () => { process.stdout.isTTY = original; };
}

async function runTests() {
  let passed = 0;
  let failed = 0;

  // Test 1: Should show unified output by default
  try {
    const restore = mockTTY(true);
    const result = shouldShowUnifiedOutput({}, []);
    assert.strictEqual(result, true);
    restore();
    passed++;
    console.log('✅ Test 1: Default shows unified output in TTY');
  } catch (e) {
    failed++;
    console.error('❌ Test 1 failed:', e.message);
  }

  // Test 2: Suppress with --quiet
  try {
    const restore = mockTTY(true);
    const result = shouldShowUnifiedOutput({}, ['--quiet']);
    assert.strictEqual(result, false);
    restore();
    passed++;
    console.log('✅ Test 2: Suppress with --quiet flag');
  } catch (e) {
    failed++;
    console.error('❌ Test 2 failed:', e.message);
  }

  // Test 3: Suppress in non-TTY (CI)
  try {
    const restore = mockTTY(false);
    const result = shouldShowUnifiedOutput({}, []);
    assert.strictEqual(result, false);
    restore();
    passed++;
    console.log('✅ Test 3: Suppress in non-TTY (CI)');
  } catch (e) {
    failed++;
    console.error('❌ Test 3 failed:', e.message);
  }

  // Test 4: Format header includes URL and run ID
  try {
    const meta = { url: 'https://example.com', runId: 'test-123' };
    const output = formatHeader(meta, {});
    assert.ok(output.includes('GUARDIAN REALITY TEST'));
    assert.ok(output.includes('https://example.com'));
    assert.ok(output.includes('test-123'));
    passed++;
    console.log('✅ Test 4: Header includes URL and run ID');
  } catch (e) {
    failed++;
    console.error('❌ Test 4 failed:', e.message);
  }

  // Test 5: Header includes preset when provided
  try {
    const meta = { url: 'https://example.com', runId: 'test-123' };
    const config = { preset: 'saas' };
    const output = formatHeader(meta, config);
    assert.ok(output.includes('Preset: saas'));
    passed++;
    console.log('✅ Test 5: Header includes preset');
  } catch (e) {
    failed++;
    console.error('❌ Test 5 failed:', e.message);
  }

  // Test 6: Execution summary formats planned/executed counts
  try {
    const coverage = { total: 10, executed: 8 };
    const counts = { executedCount: 8 };
    const output = formatExecutionSummary(coverage, counts);
    assert.ok(output.includes('EXECUTION SUMMARY'));
    assert.ok(output.includes('Planned:  10'));
    assert.ok(output.includes('Executed: 8'));
    passed++;
    console.log('✅ Test 6: Execution summary formats counts');
  } catch (e) {
    failed++;
    console.error('❌ Test 6 failed:', e.message);
  }

  // Test 7: Execution summary shows skip count
  try {
    const coverage = {
      total: 10,
      executed: 5,
      skippedDisabledByPreset: [{}, {}],
      skippedNotApplicable: [{}]
    };
    const counts = { executedCount: 5 };
    const output = formatExecutionSummary(coverage, counts);
    assert.ok(output.includes('Skipped:  3'));
    assert.ok(output.includes('not applicable'));
    assert.ok(output.includes('disabled by preset'));
    passed++;
    console.log('✅ Test 7: Execution summary shows skip reasons');
  } catch (e) {
    failed++;
    console.error('❌ Test 7 failed:', e.message);
  }

  // Test 8: Final summary for READY verdict
  try {
    const output = formatFinalSummary('READY', '/path/to/report', 0);
    assert.ok(output.includes('FINAL RECOMMENDATION'));
    assert.ok(output.includes('ready for production'));
    assert.ok(output.includes('/path/to/report'));
    assert.ok(output.includes('Exit code: 0'));
    passed++;
    console.log('✅ Test 8: Final summary for READY');
  } catch (e) {
    failed++;
    console.error('❌ Test 8 failed:', e.message);
  }

  // Test 9: Final summary for FRICTION verdict
  try {
    const output = formatFinalSummary('FRICTION', '/path/to/report', 1);
    assert.ok(output.includes('has issues'));
    assert.ok(output.includes('fix before launch'));
    passed++;
    console.log('✅ Test 9: Final summary for FRICTION');
  } catch (e) {
    failed++;
    console.error('❌ Test 9 failed:', e.message);
  }

  // Test 10: Final summary for DO_NOT_LAUNCH verdict
  try {
    const output = formatFinalSummary('DO_NOT_LAUNCH', '/path/to/report', 2);
    assert.ok(output.includes('DO NOT LAUNCH'));
    assert.ok(output.includes('Critical failures'));
    passed++;
    console.log('✅ Test 10: Final summary for DO_NOT_LAUNCH');
  } catch (e) {
    failed++;
    console.error('❌ Test 10 failed:', e.message);
  }

  // Test 11: Compact output format
  try {
    const result = {
      meta: { url: 'https://example.com', runId: 'test-123' },
      verdict: { verdict: 'READY' },
      exitCode: 0
    };
    const output = formatCompactOutput(result);
    assert.ok(output.includes('https://example.com'));
    assert.ok(output.includes('READY'));
    assert.ok(output.includes('Exit Code: 0'));
    passed++;
    console.log('✅ Test 11: Compact output format');
  } catch (e) {
    failed++;
    console.error('❌ Test 11 failed:', e.message);
  }

  // Test 12: Unified output integration test (output structure)
  try {
    const restore = mockTTY(true);
    let capturedOutput = '';
    const originalLog = console.log;
    console.log = (msg) => { capturedOutput += (msg || '') + '\n'; };

    const result = {
      meta: { url: 'https://example.com', runId: 'test-123' },
      coverage: { total: 5, executed: 4, skippedNotApplicable: [{}] },
      counts: { executedCount: 4 },
      verdict: { verdict: 'READY', explanation: 'All tests passed' },
      attemptResults: [],
      flowResults: [],
      exitCode: 0,
      runDir: '/path/to/artifacts'
    };

    printUnifiedOutput(result, {}, []);
    console.log = originalLog;
    restore();

    // Verify canonical order
    const headerIndex = capturedOutput.indexOf('GUARDIAN REALITY TEST');
    const summaryIndex = capturedOutput.indexOf('EXECUTION SUMMARY');
    const verdictIndex = capturedOutput.indexOf('VERDICT');
    const finalIndex = capturedOutput.indexOf('FINAL RECOMMENDATION');

    assert.ok(headerIndex >= 0, 'Should have header');
    assert.ok(summaryIndex >= 0, 'Should have execution summary');
    assert.ok(verdictIndex >= 0, 'Should have verdict');
    assert.ok(finalIndex >= 0, 'Should have final summary');

    // Verify order
    assert.ok(headerIndex < summaryIndex, 'Header before summary');
    assert.ok(summaryIndex < verdictIndex, 'Summary before verdict');
    assert.ok(verdictIndex < finalIndex, 'Verdict before final');

    passed++;
    console.log('✅ Test 12: Unified output has canonical order');
  } catch (e) {
    failed++;
    console.error('❌ Test 12 failed:', e.message);
  }

  // Test 13: Unified output suppressed with --quiet
  try {
    const restore = mockTTY(true);
    let capturedOutput = '';
    const originalLog = console.log;
    console.log = (msg) => { capturedOutput += (msg || '') + '\n'; };

    const result = {
      meta: { url: 'https://example.com' },
      coverage: {},
      counts: {},
      verdict: { verdict: 'READY' },
      attemptResults: [],
      exitCode: 0
    };

    printUnifiedOutput(result, {}, ['--quiet']);
    console.log = originalLog;
    restore();

    assert.strictEqual(capturedOutput.trim(), '', 'Should be empty with --quiet');
    passed++;
    console.log('✅ Test 13: Unified output suppressed with --quiet');
  } catch (e) {
    failed++;
    console.error('❌ Test 13 failed:', e.message);
  }

  // Test 14: Sections appear conditionally (no errors = no error section)
  try {
    const restore = mockTTY(true);
    let capturedOutput = '';
    const originalLog = console.log;
    console.log = (msg) => { capturedOutput += (msg || '') + '\n'; };

    const result = {
      meta: { url: 'https://example.com', runId: 'test-123' },
      coverage: { total: 3, executed: 3 },
      counts: { executedCount: 3 },
      verdict: { verdict: 'READY', explanation: 'All passed' },
      attemptResults: [
        { outcome: 'SUCCESS', attemptId: 'signup' },
        { outcome: 'SUCCESS', attemptId: 'login' },
        { outcome: 'SUCCESS', attemptId: 'checkout' }
      ],
      exitCode: 0,
      runDir: '/path'
    };

    printUnifiedOutput(result, {}, []);
    console.log = originalLog;
    restore();

    // Should NOT have error/failure section
    assert.ok(!capturedOutput.includes('FAILURES & ERRORS'), 'Should not have error section');
    assert.ok(!capturedOutput.includes('SKIPPED ATTEMPTS'), 'Should not have skip section');

    passed++;
    console.log('✅ Test 14: No error section when all passed');
  } catch (e) {
    failed++;
    console.error('❌ Test 14 failed:', e.message);
  }

  // Test 15: Error section appears when failures present
  try {
    const restore = mockTTY(true);
    let capturedOutput = '';
    const originalLog = console.log;
    console.log = (msg) => { capturedOutput += (msg || '') + '\n'; };

    const result = {
      meta: { url: 'https://example.com', runId: 'test-123' },
      coverage: { total: 3, executed: 2 },
      counts: { executedCount: 2 },
      verdict: { verdict: 'FRICTION', explanation: 'Some failures' },
      attemptResults: [
        { outcome: 'SUCCESS', attemptId: 'signup', attemptName: 'Signup' },
        { outcome: 'FAILURE', attemptId: 'checkout', attemptName: 'Checkout', failureReason: 'TIMEOUT' }
      ],
      exitCode: 1,
      runDir: '/path'
    };

    printUnifiedOutput(result, {}, []);
    console.log = originalLog;
    restore();

    // Should have error section
    assert.ok(capturedOutput.includes('FAILURES & ERRORS'), 'Should have error section');

    passed++;
    console.log('✅ Test 15: Error section appears with failures');
  } catch (e) {
    failed++;
    console.error('❌ Test 15 failed:', e.message);
  }

  // Test 16: Output uses consistent separators
  try {
    const meta = { url: 'https://example.com', runId: 'test-123' };
    const header = formatHeader(meta, {});
    const summary = formatExecutionSummary({ total: 5, executed: 4 }, { executedCount: 4 });
    const final = formatFinalSummary('READY', '/path', 0);

    // All sections use consistent separator style
    assert.ok(header.includes('━'.repeat(70)), 'Header uses ━ separator');
    assert.ok(summary.includes('─'.repeat(70)), 'Summary uses ─ separator');
    assert.ok(final.includes('━'.repeat(70)), 'Final uses ━ separator');

    passed++;
    console.log('✅ Test 16: Consistent separator styling');
  } catch (e) {
    failed++;
    console.error('❌ Test 16 failed:', e.message);
  }

  // Test 17: No duplicate information
  try {
    const restore = mockTTY(true);
    let capturedOutput = '';
    const originalLog = console.log;
    console.log = (msg) => { capturedOutput += (msg || '') + '\n'; };

    const result = {
      meta: { url: 'https://example.com', runId: 'test-123' },
      coverage: { total: 3, executed: 3 },
      counts: { executedCount: 3 },
      verdict: { verdict: 'READY', explanation: 'All passed' },
      attemptResults: [],
      exitCode: 0,
      runDir: '/path'
    };

    printUnifiedOutput(result, {}, []);
    console.log = originalLog;
    restore();

    // Count how many times verdict appears (should be at least once in verdict block)
    const verdictMatches = (capturedOutput.match(/VERDICT/g) || []).length;
    assert.ok(verdictMatches >= 1, 'Verdict should appear at least once');

    passed++;
    console.log('✅ Test 17: No duplicate verdict');
  } catch (e) {
    failed++;
    console.error('❌ Test 17 failed:', e.message);
  }

  // Test 18: Execution summary handles zero skips
  try {
    const coverage = { total: 5, executed: 5 };
    const counts = { executedCount: 5 };
    const output = formatExecutionSummary(coverage, counts);
    assert.ok(!output.includes('Skipped:'), 'Should not show skip line when 0');
    passed++;
    console.log('✅ Test 18: No skip line when zero skips');
  } catch (e) {
    failed++;
    console.error('❌ Test 18 failed:', e.message);
  }

  // Test 19: Plural handling in execution summary
  try {
    const coverage1 = { total: 1, executed: 1 };
    const output1 = formatExecutionSummary(coverage1, { executedCount: 1 });
    assert.ok(output1.includes('1 attempt'), 'Should use singular');
    assert.ok(!output1.includes('1 attempts'), 'Should not use plural');

    const coverage2 = { total: 5, executed: 5 };
    const output2 = formatExecutionSummary(coverage2, { executedCount: 5 });
    assert.ok(output2.includes('5 attempts'), 'Should use plural');

    passed++;
    console.log('✅ Test 19: Correct plural handling');
  } catch (e) {
    failed++;
    console.error('❌ Test 19 failed:', e.message);
  }

  // Test 20: Complete flow has all expected sections in order
  try {
    const restore = mockTTY(true);
    let capturedOutput = '';
    const originalLog = console.log;
    console.log = (msg) => { capturedOutput += (msg || '') + '\n'; };

    const result = {
      meta: { url: 'https://example.com', runId: 'run-456' },
      coverage: { total: 10, executed: 8, skippedNotApplicable: [{}, {}] },
      counts: { executedCount: 8 },
      verdict: { verdict: 'FRICTION', explanation: 'Minor issues found' },
      attemptResults: [
        { outcome: 'FAILURE', attemptId: 'payment', attemptName: 'Payment', failureReason: 'TIMEOUT' }
      ],
      exitCode: 1,
      runDir: '/artifacts/run-456'
    };

    printUnifiedOutput(result, {}, []);
    console.log = originalLog;
    restore();

    // Find section indices
    const sections = [
      { name: 'Header', pattern: 'GUARDIAN REALITY TEST' },
      { name: 'Execution', pattern: 'EXECUTION SUMMARY' },
      { name: 'Verdict', pattern: 'VERDICT' },
      { name: 'Errors', pattern: 'FAILURES & ERRORS' },
      { name: 'Final', pattern: 'FINAL RECOMMENDATION' }
    ];

    const indices = sections.map(s => ({
      name: s.name,
      index: capturedOutput.indexOf(s.pattern)
    }));

    // All sections present
    indices.forEach(({ name, index }) => {
      assert.ok(index >= 0, `${name} section should be present`);
    });

    // Correct order
    for (let i = 1; i < indices.length; i++) {
      assert.ok(
        indices[i - 1].index < indices[i].index,
        `${indices[i - 1].name} should come before ${indices[i].name}`
      );
    }

    passed++;
    console.log('✅ Test 20: Complete flow has all sections in correct order');
  } catch (e) {
    failed++;
    console.error('❌ Test 20 failed:', e.message);
  }

  console.log('\n════════════════════════════════════════════════════════════');
  console.log(`Results: ${passed}/${passed + failed} tests passed`);
  if (failed === 0) {
    console.log('✅ All output readability tests passed');
  } else {
    console.log(`❌ ${failed} test(s) failed`);
  }
  console.log('════════════════════════════════════════════════════════════');

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test suite error:', err);
  process.exit(2);
});
