import test from 'node:test';
import assert from 'node:assert/strict';
import { retryOperation } from '../src/verax/shared/retry-policy.js';

// Contract: retries must be visible (metadata + console note) without changing outcomes.
test('Retry transparency records metadata and emits console note', async () => {
  const events = [];
  const recorder = {
    record: () => {},
    recordBatch: (batch) => events.push(...batch)
  };

  // Capture console output for retry note
  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => {
    logs.push(args.join(' '));
    originalLog(...args);
  };

  let attempt = 0;
  const { result, retriesUsed } = await retryOperation(() => {
    attempt += 1;
    if (attempt === 1) {
      const err = new Error('element is not attached to the DOM'); // retryable
      throw err;
    }
    return 'ok';
  }, 'operation', recorder);

  console.log = originalLog;

  // Final outcome unchanged
  assert.equal(result, 'ok');

  // Retries happened and were counted
  assert.equal(retriesUsed, 1, 'retry count should match retries used');

  // Metadata recorded in decision recorder
  const retryEvents = events.filter(e => e.category === 'RETRY');
  assert.ok(retryEvents.length >= 2, 'retry metadata must be recorded');
  assert.ok(retryEvents.some(e => String(e.reason || '').includes('Retry attempt 1')));

  // Console note emitted for transparency
  assert.ok(logs.some(line => line.includes('Retrying operation') && line.includes('attempt 2/3')),
    'console note for retry should be emitted');
});




