/**
 * Unit Tests: Official Exit Codes
 *
 * Ensures there is only one exit-code vocabulary exposed by the CLI contract.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { EXIT_CODES, buildOutcome } from '../../src/cli/config/cli-contract.js';

test('EXIT_CODES contains only official codes', () => {
  const values = Object.values(EXIT_CODES).sort((a, b) => a - b);
  assert.deepEqual(values, [0, 20, 30, 50, 64]);
});

test('buildOutcome uses official RESULT labels', () => {
  const outcome = buildOutcome({
    command: 'run',
    exitCode: EXIT_CODES.FINDINGS,
    reason: 'x',
    action: 'x',
  });
  assert.equal(outcome.exitCode, 20);
  assert.equal(outcome.result, 'FINDINGS');
});

