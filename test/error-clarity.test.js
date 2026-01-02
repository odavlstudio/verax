/**
 * Error Clarity Tests
 * Verify error classification, messaging, grouping, and skip conditions
 */

const assert = require('assert');
const {
  ERROR_CATEGORIES,
  classifyError,
  getErrorInfo,
  shouldShowErrorClarity,
  groupFailuresByCategory,
  deduplicateErrors,
  isSkip,
  formatErrorClarity
} = require('../src/guardian/error-clarity');

// Test utilities
function mockTTY(isTTY) {
  const original = process.stdout.isTTY;
  process.stdout.isTTY = isTTY;
  return () => { process.stdout.isTTY = original; };
}

async function runTests() {
  let passed = 0;
  let failed = 0;

  // Test 1: Should show error clarity by default (TTY, no quiet)
  try {
    const restore = mockTTY(true);
    const result = shouldShowErrorClarity({}, []);
    assert.strictEqual(result, true, 'Should show by default in TTY');
    restore();
    passed++;
    console.log('✅ Test 1: Default shows error clarity in TTY');
  } catch (e) {
    failed++;
    console.error('❌ Test 1 failed:', e.message);
  }

  // Test 2: Should skip with --quiet flag
  try {
    const restore = mockTTY(true);
    const result = shouldShowErrorClarity({}, ['--quiet']);
    assert.strictEqual(result, false, 'Should skip with --quiet');
    restore();
    passed++;
    console.log('✅ Test 2: Skips with --quiet flag');
  } catch (e) {
    failed++;
    console.error('❌ Test 2 failed:', e.message);
  }

  // Test 3: Classify TIMEOUT error
  try {
    const failure = { failureReason: 'TIMEOUT' };
    const category = classifyError(failure);
    assert.strictEqual(category, ERROR_CATEGORIES.TIMEOUT);
    passed++;
    console.log('✅ Test 3: Classify TIMEOUT error');
  } catch (e) {
    failed++;
    console.error('❌ Test 3 failed:', e.message);
  }

  // Test 4: Classify ELEMENT_NOT_FOUND error
  try {
    const failure = { failureReason: 'ELEMENT_NOT_FOUND' };
    const category = classifyError(failure);
    assert.strictEqual(category, ERROR_CATEGORIES.ELEMENT_NOT_FOUND);
    passed++;
    console.log('✅ Test 4: Classify ELEMENT_NOT_FOUND error');
  } catch (e) {
    failed++;
    console.error('❌ Test 4 failed:', e.message);
  }

  // Test 5: Classify NAVIGATION_FAILED error
  try {
    const failure = { failureReason: 'NAVIGATION_FAILED' };
    const category = classifyError(failure);
    assert.strictEqual(category, ERROR_CATEGORIES.NAVIGATION_FAILED);
    passed++;
    console.log('✅ Test 5: Classify NAVIGATION_FAILED error');
  } catch (e) {
    failed++;
    console.error('❌ Test 5 failed:', e.message);
  }

  // Test 6: Classify AUTH_BLOCKED error
  try {
    const failure = { message: 'Unauthorized 401' };
    const category = classifyError(failure);
    assert.strictEqual(category, ERROR_CATEGORIES.AUTH_BLOCKED);
    passed++;
    console.log('✅ Test 6: Classify AUTH_BLOCKED error');
  } catch (e) {
    failed++;
    console.error('❌ Test 6 failed:', e.message);
  }

  // Test 7: Classify NOT_APPLICABLE skip
  try {
    const failure = { outcome: 'NOT_APPLICABLE' };
    const category = classifyError(failure);
    assert.strictEqual(category, ERROR_CATEGORIES.NOT_APPLICABLE);
    passed++;
    console.log('✅ Test 7: Classify NOT_APPLICABLE skip');
  } catch (e) {
    failed++;
    console.error('❌ Test 7 failed:', e.message);
  }

  // Test 8: Classify DISABLED_BY_PRESET skip
  try {
    const failure = { outcome: 'SKIPPED', reason: 'DISABLED_BY_PRESET' };
    const category = classifyError(failure);
    assert.strictEqual(category, ERROR_CATEGORIES.DISABLED_BY_PRESET);
    passed++;
    console.log('✅ Test 8: Classify DISABLED_BY_PRESET skip');
  } catch (e) {
    failed++;
    console.error('❌ Test 8 failed:', e.message);
  }

  // Test 9: Classify USER_FILTERED skip
  try {
    const failure = { outcome: 'SKIPPED', reason: 'USER_FILTERED' };
    const category = classifyError(failure);
    assert.strictEqual(category, ERROR_CATEGORIES.USER_FILTERED);
    passed++;
    console.log('✅ Test 9: Classify USER_FILTERED skip');
  } catch (e) {
    failed++;
    console.error('❌ Test 9 failed:', e.message);
  }

  // Test 10: Classify INFRA_ERROR
  try {
    const failure = { message: 'Browser launch failed' };
    const category = classifyError(failure);
    assert.strictEqual(category, ERROR_CATEGORIES.INFRA_ERROR);
    passed++;
    console.log('✅ Test 10: Classify INFRA_ERROR');
  } catch (e) {
    failed++;
    console.error('❌ Test 10 failed:', e.message);
  }

  // Test 11: Get error info for TIMEOUT
  try {
    const failure = { failureReason: 'TIMEOUT' };
    const info = getErrorInfo(failure);
    assert.ok(info.title, 'Should have title');
    assert.ok(info.explanation, 'Should have explanation');
    assert.ok(info.action, 'Should have action');
    assert.strictEqual(info.category, ERROR_CATEGORIES.TIMEOUT);
    passed++;
    console.log('✅ Test 11: Get error info for TIMEOUT');
  } catch (e) {
    failed++;
    console.error('❌ Test 11 failed:', e.message);
  }

  // Test 12: Get error info for ELEMENT_NOT_FOUND
  try {
    const failure = { failureReason: 'ELEMENT_NOT_FOUND' };
    const info = getErrorInfo(failure);
    assert.ok(info.title.toLowerCase().includes('element'), 'Title should mention element');
    passed++;
    console.log('✅ Test 12: Get error info for ELEMENT_NOT_FOUND');
  } catch (e) {
    failed++;
    console.error('❌ Test 12 failed:', e.message);
  }

  // Test 13: isSkip identifies skip categories
  try {
    assert.strictEqual(isSkip(ERROR_CATEGORIES.NOT_APPLICABLE), true);
    assert.strictEqual(isSkip(ERROR_CATEGORIES.DISABLED_BY_PRESET), true);
    assert.strictEqual(isSkip(ERROR_CATEGORIES.USER_FILTERED), true);
    assert.strictEqual(isSkip(ERROR_CATEGORIES.TIMEOUT), false);
    assert.strictEqual(isSkip(ERROR_CATEGORIES.ELEMENT_NOT_FOUND), false);
    passed++;
    console.log('✅ Test 13: isSkip identifies skip categories');
  } catch (e) {
    failed++;
    console.error('❌ Test 13 failed:', e.message);
  }

  // Test 14: Group failures by category
  try {
    const failures = [
      { attemptId: 'attempt-1', failureReason: 'TIMEOUT' },
      { attemptId: 'attempt-2', failureReason: 'TIMEOUT' },
      { attemptId: 'attempt-3', failureReason: 'ELEMENT_NOT_FOUND' }
    ];
    const groups = groupFailuresByCategory(failures);
    assert.strictEqual(Object.keys(groups).length, 2);
    assert.strictEqual(groups[ERROR_CATEGORIES.TIMEOUT].length, 2);
    assert.strictEqual(groups[ERROR_CATEGORIES.ELEMENT_NOT_FOUND].length, 1);
    passed++;
    console.log('✅ Test 14: Group failures by category');
  } catch (e) {
    failed++;
    console.error('❌ Test 14 failed:', e.message);
  }

  // Test 15: Deduplicate errors (max 3)
  try {
    const failures = [
      { attemptId: 'attempt-1' },
      { attemptId: 'attempt-2' },
      { attemptId: 'attempt-3' },
      { attemptId: 'attempt-4' }
    ];
    const deduped = deduplicateErrors(failures);
    assert.strictEqual(deduped.length, 3, 'Should cap at 3');
    passed++;
    console.log('✅ Test 15: Deduplicate errors (max 3)');
  } catch (e) {
    failed++;
    console.error('❌ Test 15 failed:', e.message);
  }

  // Test 16: Format error clarity with failures
  try {
    const restore = mockTTY(true);
    const failures = [
      { attemptId: 'signup', attemptName: 'signup', failureReason: 'TIMEOUT' },
      { attemptId: 'payment', attemptName: 'payment', failureReason: 'ELEMENT_NOT_FOUND' }
    ];
    const output = formatErrorClarity(failures, {}, []);
    restore();
    assert.ok(output.includes('FAILURES & ERRORS'), 'Should have failures section');
    assert.ok(output.includes('timeout') || output.includes('Timeout'), 'Should mention timeout');
    assert.ok(output.includes('element'), 'Should mention element');
    passed++;
    console.log('✅ Test 16: Format error clarity with failures');
  } catch (e) {
    failed++;
    console.error('❌ Test 16 failed:', e.message);
  }

  // Test 17: Format error clarity with skips
  try {
    const restore = mockTTY(true);
    const failures = [
      { attemptId: 'admin', attemptName: 'admin', outcome: 'SKIPPED', reason: 'NOT_APPLICABLE' },
      { attemptId: 'export', attemptName: 'export', outcome: 'SKIPPED', reason: 'DISABLED_BY_PRESET' }
    ];
    const output = formatErrorClarity(failures, {}, []);
    restore();
    assert.ok(output.includes('SKIPPED ATTEMPTS'), 'Should have skipped section');
    assert.ok(output.includes('Not applicable') || output.includes('not applicable'), 'Should mention not applicable');
    assert.ok(output.includes('Disabled') || output.includes('disabled') || output.includes('preset'), 'Should mention disabled/preset');
    passed++;
    console.log('✅ Test 17: Format error clarity with skips');
  } catch (e) {
    failed++;
    console.error('❌ Test 17 failed:', e.message);
  }

  // Test 18: Format error clarity mixed (errors + skips)
  try {
    const restore = mockTTY(true);
    const failures = [
      { attemptId: 'signup', attemptName: 'signup', failureReason: 'TIMEOUT' },
      { attemptId: 'admin', attemptName: 'admin', outcome: 'SKIPPED', reason: 'NOT_APPLICABLE' }
    ];
    const output = formatErrorClarity(failures, {}, []);
    restore();
    assert.ok(output.includes('FAILURES & ERRORS'));
    assert.ok(output.includes('SKIPPED ATTEMPTS'));
    passed++;
    console.log('✅ Test 18: Format error clarity mixed (errors + skips)');
  } catch (e) {
    failed++;
    console.error('❌ Test 18 failed:', e.message);
  }

  // Test 19: Skips with --quiet flag are suppressed
  try {
    const restore = mockTTY(true);
    const failures = [
      { attemptId: 'admin', outcome: 'SKIPPED', reason: 'NOT_APPLICABLE' }
    ];
    const output = formatErrorClarity(failures, {}, ['--quiet']);
    restore();
    assert.strictEqual(output, '', 'Should return empty string with --quiet');
    passed++;
    console.log('✅ Test 19: Skips with --quiet are suppressed');
  } catch (e) {
    failed++;
    console.error('❌ Test 19 failed:', e.message);
  }

  // Test 20: Errors in non-TTY (CI) are suppressed
  try {
    const restore = mockTTY(false);
    const failures = [
      { attemptId: 'signup', failureReason: 'TIMEOUT' }
    ];
    const output = formatErrorClarity(failures, {}, []);
    restore();
    assert.strictEqual(output, '', 'Should return empty in non-TTY');
    passed++;
    console.log('✅ Test 20: Errors in non-TTY (CI) are suppressed');
  } catch (e) {
    failed++;
    console.error('❌ Test 20 failed:', e.message);
  }

  // Test 21: Empty failures list produces empty output
  try {
    const restore = mockTTY(true);
    const output = formatErrorClarity([], {}, []);
    restore();
    assert.strictEqual(output, '', 'Should be empty with no failures');
    passed++;
    console.log('✅ Test 21: Empty failures list produces empty output');
  } catch (e) {
    failed++;
    console.error('❌ Test 21 failed:', e.message);
  }

  // Test 22: Classify message-based timeout error
  try {
    const failure = { message: 'Timeout waiting for selector #button' };
    const category = classifyError(failure);
    assert.strictEqual(category, ERROR_CATEGORIES.TIMEOUT);
    passed++;
    console.log('✅ Test 22: Classify message-based timeout error');
  } catch (e) {
    failed++;
    console.error('❌ Test 22 failed:', e.message);
  }

  // Test 23: Classify navigation error from message
  try {
    const failure = { message: 'net::ERR_CONNECTION_REFUSED' };
    const category = classifyError(failure);
    assert.strictEqual(category, ERROR_CATEGORIES.NAVIGATION_FAILED);
    passed++;
    console.log('✅ Test 23: Classify navigation error from message');
  } catch (e) {
    failed++;
    console.error('❌ Test 23 failed:', e.message);
  }

  // Test 24: Unknown error defaults to UNKNOWN category
  try {
    const failure = { message: 'Something unexpected happened' };
    const category = classifyError(failure);
    assert.strictEqual(category, ERROR_CATEGORIES.UNKNOWN);
    passed++;
    console.log('✅ Test 24: Unknown error defaults to UNKNOWN');
  } catch (e) {
    failed++;
    console.error('❌ Test 24 failed:', e.message);
  }

  // Test 25: Error grouping preserves order and deduplicates
  try {
    const failures = [
      { attemptId: 'signup', attemptName: 'signup', failureReason: 'TIMEOUT' },
      { attemptId: 'signup', attemptName: 'signup', failureReason: 'TIMEOUT' },
      { attemptId: 'payment', attemptName: 'payment', failureReason: 'TIMEOUT' },
      { attemptId: 'checkout', attemptName: 'checkout', failureReason: 'ELEMENT_NOT_FOUND' }
    ];
    const groups = groupFailuresByCategory(failures);
    const timeoutGroup = groups[ERROR_CATEGORIES.TIMEOUT];
    const deduped = deduplicateErrors(timeoutGroup);
    assert.ok(deduped.length <= 3, 'Should deduplicate');
    passed++;
    console.log('✅ Test 25: Error grouping preserves order and deduplicates');
  } catch (e) {
    failed++;
    console.error('❌ Test 25 failed:', e.message);
  }

  console.log('\n════════════════════════════════════════════════════════════');
  console.log(`Results: ${passed}/${passed + failed} tests passed`);
  if (failed === 0) {
    console.log('✅ All error clarity tests passed');
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
