/**
 * Contract Lock Test: Official Exit Codes + Truth Boundary
 *
 * This repository MUST expose exactly one official exit-code set:
 * - SUCCESS = 0
 * - FINDINGS = 20
 * - INCOMPLETE = 30
 * - INVARIANT_VIOLATION = 50
 * - USAGE_ERROR = 64
 *
 * No legacy mode, no alternate sets.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { EXIT_CODES, buildOutcome } from '../../src/cli/config/cli-contract.js';
import { UsageError, DataError, CrashError, IncompleteError } from '../../src/cli/util/support/errors.js';

const OFFICIAL = Object.freeze({
  SUCCESS: 0,
  FINDINGS: 20,
  INCOMPLETE: 30,
  INVARIANT_VIOLATION: 50,
  USAGE_ERROR: 64,
});

test('EXIT_CODES matches official contract exactly', () => {
  assert.deepEqual(EXIT_CODES, OFFICIAL);
  assert.deepEqual(Object.values(EXIT_CODES).sort((a, b) => a - b), [0, 20, 30, 50, 64]);
});

test('EXIT_CODES is unaffected by VERAX_EXIT_CODE_COMPAT', () => {
  const saved = process.env.VERAX_EXIT_CODE_COMPAT;
  try {
    process.env.VERAX_EXIT_CODE_COMPAT = '1';
    assert.deepEqual(EXIT_CODES, OFFICIAL);
  } finally {
    if (saved === undefined) delete process.env.VERAX_EXIT_CODE_COMPAT;
    else process.env.VERAX_EXIT_CODE_COMPAT = saved;
  }
});

test('Error classes map to official exit codes', () => {
  assert.equal(new UsageError('x').exitCode, EXIT_CODES.USAGE_ERROR);
  assert.equal(new DataError('x').exitCode, EXIT_CODES.INVARIANT_VIOLATION);
  assert.equal(new CrashError('x').exitCode, EXIT_CODES.INVARIANT_VIOLATION);
  assert.equal(new IncompleteError('x').exitCode, EXIT_CODES.INCOMPLETE);
});

test('buildOutcome normalizes unknown exit codes to INCOMPLETE', () => {
  const outcome = buildOutcome({
    command: 'run',
    exitCode: 999,
    reason: 'test',
    action: 'test',
  });
  assert.equal(outcome.exitCode, EXIT_CODES.INCOMPLETE);
  assert.equal(outcome.result, 'INCOMPLETE');
});

