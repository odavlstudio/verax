/**
 * Error Clarity Integration Tests
 * Verify error clarity output in realistic execution scenarios
 */

const assert = require('assert');
const { printErrorClarity, formatErrorClarity } = require('../src/guardian/error-clarity');

async function runTests() {
  let passed = 0;
  let failed = 0;

  // Mock console.log to capture output
  let capturedOutput = '';
  const originalLog = console.log;
  const mockLog = (output) => {
    capturedOutput += (output || '') + '\n';
  };

  // Test 1: Full integration - realistic failure scenario
  try {
    process.stdout.isTTY = true;
    capturedOutput = '';
    console.log = mockLog;

    const failures = [
      {
        attemptId: 'signup-form',
        attemptName: 'User Signup Form',
        outcome: 'FAILURE',
        failureReason: 'TIMEOUT',
        message: 'Timeout waiting for form to load'
      },
      {
        attemptId: 'payment-flow',
        attemptName: 'Payment Processing',
        outcome: 'FAILURE',
        failureReason: 'ELEMENT_NOT_FOUND',
        message: 'Payment button not found on checkout page'
      }
    ];

    printErrorClarity(failures, {}, []);
    console.log = originalLog;

    assert.ok(capturedOutput.includes('FAILURES & ERRORS'), 'Should include failures section');
    assert.ok(capturedOutput.includes('Timeout'), 'Should mention timeout');
    assert.ok(capturedOutput.includes('element'), 'Should mention element');
    passed++;
    console.log('✅ Test 1: Full integration - realistic failure scenario');
  } catch (e) {
    console.log = originalLog;
    failed++;
    console.error('❌ Test 1 failed:', e.message);
  }

  // Test 2: Integration - skip notification scenario
  try {
    process.stdout.isTTY = true;
    capturedOutput = '';
    console.log = mockLog;

    const failures = [
      {
        attemptId: 'admin-area',
        attemptName: 'Admin Dashboard',
        outcome: 'SKIPPED',
        reason: 'NOT_APPLICABLE',
        message: 'Admin features not applicable to test environment'
      },
      {
        attemptId: 'export-report',
        attemptName: 'Export Report',
        outcome: 'SKIPPED',
        reason: 'DISABLED_BY_PRESET',
        message: 'Export feature disabled by test preset'
      }
    ];

    printErrorClarity(failures, {}, []);
    console.log = originalLog;

    assert.ok(capturedOutput.includes('SKIPPED ATTEMPTS'), 'Should include skipped section');
    assert.ok(capturedOutput.includes('Not applicable'), 'Should explain not applicable');
    assert.ok(capturedOutput.includes('preset'), 'Should mention preset');
    passed++;
    console.log('✅ Test 2: Integration - skip notification scenario');
  } catch (e) {
    console.log = originalLog;
    failed++;
    console.error('❌ Test 2 failed:', e.message);
  }

  // Test 3: Integration - mixed errors and skips
  try {
    process.stdout.isTTY = true;
    capturedOutput = '';
    console.log = mockLog;

    const failures = [
      {
        attemptId: 'checkout',
        attemptName: 'Checkout Flow',
        outcome: 'FAILURE',
        failureReason: 'NAVIGATION_FAILED',
        message: 'Failed to navigate to payment gateway'
      },
      {
        attemptId: 'mobile-view',
        attemptName: 'Mobile View Test',
        outcome: 'SKIPPED',
        reason: 'USER_FILTERED',
        message: 'Mobile testing disabled in this run'
      }
    ];

    printErrorClarity(failures, {}, []);
    console.log = originalLog;

    assert.ok(capturedOutput.includes('FAILURES & ERRORS'), 'Should have errors');
    assert.ok(capturedOutput.includes('SKIPPED ATTEMPTS'), 'Should have skips');
    assert.ok(capturedOutput.includes('Navigation'), 'Should explain navigation error');
    passed++;
    console.log('✅ Test 3: Integration - mixed errors and skips');
  } catch (e) {
    console.log = originalLog;
    failed++;
    console.error('❌ Test 3 failed:', e.message);
  }

  // Test 4: Integration - deduplication with count
  try {
    process.stdout.isTTY = true;
    capturedOutput = '';
    console.log = mockLog;

    const failures = [
      { attemptId: 'step1', attemptName: 'Step 1', outcome: 'FAILURE', failureReason: 'TIMEOUT' },
      { attemptId: 'step2', attemptName: 'Step 2', outcome: 'FAILURE', failureReason: 'TIMEOUT' },
      { attemptId: 'step3', attemptName: 'Step 3', outcome: 'FAILURE', failureReason: 'TIMEOUT' },
      { attemptId: 'step4', attemptName: 'Step 4', outcome: 'FAILURE', failureReason: 'TIMEOUT' },
      { attemptId: 'step5', attemptName: 'Step 5', outcome: 'FAILURE', failureReason: 'TIMEOUT' }
    ];

    printErrorClarity(failures, {}, []);
    console.log = originalLog;

    assert.ok(capturedOutput.includes('Step 1'), 'Should show first example');
    assert.ok(capturedOutput.includes('Step 3'), 'Should show third example');
    assert.ok(!capturedOutput.includes('Step 5'), 'Should not show all 5 steps');
    assert.ok(capturedOutput.includes('Step 4') || capturedOutput.includes('+2 more') || capturedOutput.includes('(+2 more)'), 'Should either show step 4 or indicate +2 more');
    passed++;
    console.log('✅ Test 4: Integration - deduplication with count');
  } catch (e) {
    console.log = originalLog;
    failed++;
    console.error('❌ Test 4 failed:', e.message);
  }

  // Test 5: Integration - quiet mode suppression
  try {
    process.stdout.isTTY = true;
    capturedOutput = '';
    console.log = mockLog;

    const failures = [
      {
        attemptId: 'checkout',
        attemptName: 'Checkout',
        outcome: 'FAILURE',
        failureReason: 'TIMEOUT'
      }
    ];

    printErrorClarity(failures, {}, ['--quiet']);
    console.log = originalLog;

    assert.strictEqual(capturedOutput.trim(), '', 'Should suppress output with --quiet');
    passed++;
    console.log('✅ Test 5: Integration - quiet mode suppression');
  } catch (e) {
    console.log = originalLog;
    failed++;
    console.error('❌ Test 5 failed:', e.message);
  }

  console.log('\n════════════════════════════════════════════════════════════');
  console.log(`Results: ${passed}/${passed + failed} integration tests passed`);
  if (failed === 0) {
    console.log('✅ All error clarity integration tests passed');
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
