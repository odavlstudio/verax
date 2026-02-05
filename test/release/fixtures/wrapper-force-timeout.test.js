import { test } from 'node:test';
import assert from 'node:assert/strict';

test('wrapper fixture: forced timeout', async () => {
  if (process.env.VERAX_WRAPPER_FORCE_TIMEOUT === '1') {
    await new Promise((r) => setTimeout(r, 500));
  }
  assert.ok(true);
});

