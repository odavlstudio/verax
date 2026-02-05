import { test } from 'node:test';
import assert from 'node:assert/strict';

test('wrapper fixture: forced fail', () => {
  if (process.env.VERAX_WRAPPER_FORCE_FAIL === '1') {
    assert.fail('forced failure for wrapper exit-code contract');
  }
  assert.ok(true);
});

