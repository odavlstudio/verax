import { test } from 'node:test';
import assert from 'node:assert/strict';

function nonStdHandles() {
  // eslint-disable-next-line no-underscore-dangle
  return process._getActiveHandles().filter((handle) => {
    const name = handle?.constructor?.name;
    return name !== 'WriteStream' && name !== 'ReadStream';
  });
}

process.once('beforeExit', () => {
  const extras = nonStdHandles();
  if (extras.length > 0) {
    const names = extras.map((h) => h?.constructor?.name || typeof h).join(', ');
    assert.fail(`Active handles remain at shutdown: ${names}`);
  }
});

test('active handle sentinel', () => {
  // Sentinel test registers beforeExit checker above
});
