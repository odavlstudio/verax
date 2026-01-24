import test from 'node:test';
import assert from 'node:assert';
import { applyRetention } from '../../src/cli/util/support/retention.js';

test('Retention safety: activeRunId is required', () => {
  // Test 1: activeRunId = null
  const result1 = applyRetention({
    runsDir: '/tmp/runs',
    retainCount: 10,
    activeRunId: null,
    verbose: false
  });
  
  assert.strictEqual(result1.deleted, 0, 'Should delete nothing when activeRunId is null');
  assert.strictEqual(result1.errors.length, 1, 'Should return error message');
  assert.ok(result1.errors[0].includes('activeRunId is required'), 'Error message should mention activeRunId requirement');
  
  // Test 2: activeRunId = undefined
  const result2 = applyRetention({
    runsDir: '/tmp/runs',
    retainCount: 10,
    activeRunId: undefined,
    verbose: false
  });
  
  assert.strictEqual(result2.deleted, 0, 'Should delete nothing when activeRunId is undefined');
  assert.ok(result2.errors.length > 0, 'Should return error message');
  
  // Test 3: activeRunId = empty string
  const result3 = applyRetention({
    runsDir: '/tmp/runs',
    retainCount: 10,
    activeRunId: '',
    verbose: false
  });
  
  assert.strictEqual(result3.deleted, 0, 'Should delete nothing when activeRunId is empty');
  assert.ok(result3.errors.length > 0, 'Should return error message');
  
  // Test 4: activeRunId provided - should proceed (but fail gracefully if directory doesn't exist)
  const result4 = applyRetention({
    runsDir: '/nonexistent/runs',
    retainCount: 10,
    activeRunId: 'valid-run-id-123',
    verbose: false
  });
  
  // When directory doesn't exist, should return gracefully with 0 deleted (not an error about activeRunId)
  assert.strictEqual(result4.deleted, 0, 'Should handle missing directory gracefully');
  assert.ok(!result4.errors.some(e => e.includes('activeRunId')), 'Should not error on activeRunId when it is provided');
});
