/**
 * CI Exit Code Contract Lock (Final)
 * 
 * Permanent contract for exit codes in CI environments.
 * Any violation of these rules is a breaking change.
 * 
 * EXIT CODE CONTRACT:
 * - 0:  SUCCESS
 * - 20: FINDINGS
 * - 30: INCOMPLETE
 * - 50: INVARIANT_VIOLATION
 * - 64: USAGE_ERROR
 */

import test from 'node:test';
import assert from 'assert';
import { execSync } from 'child_process';
import { resolve } from 'path';
import { tmpdir } from 'os';
import { getTimeProvider } from '../../src/cli/util/support/time-provider.js';
import { computeGateDecision } from '../../src/verax/gate-engine.js';
import { EXIT_CODES } from '../../src/cli/config/cli-contract.js';


function runVerax(args, _expectExit) {
  try {
    execSync(`node bin/verax.js ${args}`, {
      cwd: process.cwd(),
      stdio: 'pipe',
      env: { ...process.env, VERAX_TEST_MODE: '1' }
    });
    return 0;
  } catch (err) {
    if (err.status !== undefined) {
      return err.status;
    }
    throw err;
  }
}

test('Exit 0: COMPLETE with zero findings', () => {
  const decision = computeGateDecision({
    runExitCode: EXIT_CODES.SUCCESS,
    findingsCounts: { HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 },
    _stabilityClassification: 'UNKNOWN',
    failOnIncomplete: true,
    _summary: null,
  });

  assert.strictEqual(decision.exitCode, EXIT_CODES.SUCCESS, 'Zero findings must exit 0');
  assert.strictEqual(decision.outcome, 'SUCCESS');
});

test('Exit 20: CONFIRMED findings present in balanced/strict modes', () => {
  const decision = computeGateDecision({
    runExitCode: EXIT_CODES.SUCCESS,
    findingsCounts: { HIGH: 1, MEDIUM: 0, LOW: 0, UNKNOWN: 0 },
    _stabilityClassification: 'UNKNOWN',
    failOnIncomplete: true,
    _summary: null,
  });

  assert.strictEqual(decision.exitCode, EXIT_CODES.FINDINGS, 'Findings must yield exit 20');
  assert.strictEqual(decision.outcome, 'FINDINGS');
});

test('Exit 64: Usage error (missing --url)', () => {
  const exitCode = runVerax('run', 64);
  assert.strictEqual(exitCode, 64, 'Missing --url must exit 64');
});

test('Exit 50: Data error (non-existent directory)', () => {
  const nonExistentPath = resolve(tmpdir(), 'verax-nonexistent-' + getTimeProvider().now());
  const bundleDir = resolve(tmpdir(), 'verax-bundle-' + getTimeProvider().now());
  const exitCode = runVerax(`bundle "${nonExistentPath}" "${bundleDir}"`, 50);
  assert.strictEqual(exitCode, 50, 'Non-existent path must exit 50');
});

test('Exit 30: INCOMPLETE run (observation timeout)', () => {
  const decision = computeGateDecision({
    runExitCode: EXIT_CODES.INCOMPLETE,
    findingsCounts: { HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 },
    _stabilityClassification: 'UNKNOWN',
    failOnIncomplete: true,
    _summary: null,
  });

  assert.strictEqual(decision.exitCode, EXIT_CODES.INCOMPLETE, 'Incomplete runs must exit 30');
  assert.strictEqual(decision.outcome, 'INCOMPLETE');
});

test('Exit 50: INVARIANT_VIOLATION (internal crash / invariant)', () => {
  const decision = computeGateDecision({
    runExitCode: EXIT_CODES.INVARIANT_VIOLATION,
    findingsCounts: { HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 },
    _stabilityClassification: 'UNKNOWN',
    failOnIncomplete: true,
    _summary: null,
  });

  assert.strictEqual(decision.exitCode, EXIT_CODES.INVARIANT_VIOLATION, 'Infra failures must override other states');
  assert.strictEqual(decision.outcome, 'INVARIANT_VIOLATION');
});

test('Exit code precedence: INCOMPLETE (30) overrides findings (20)', () => {
  const decision = computeGateDecision({
    runExitCode: EXIT_CODES.INCOMPLETE,
    findingsCounts: { HIGH: 2, MEDIUM: 1, LOW: 0, UNKNOWN: 0 },
    _stabilityClassification: 'UNKNOWN',
    failOnIncomplete: true,
    _summary: null,
  });

  assert.strictEqual(decision.exitCode, EXIT_CODES.INCOMPLETE, 'Incomplete status must override findings');
});

test('Exit code precedence: INVARIANT_VIOLATION (50) overrides all', () => {
  const decision = computeGateDecision({
    runExitCode: EXIT_CODES.INVARIANT_VIOLATION,
    findingsCounts: { HIGH: 5, MEDIUM: 0, LOW: 0, UNKNOWN: 0 },
    _stabilityClassification: 'UNKNOWN',
    failOnIncomplete: true,
    _summary: null,
  });

  assert.strictEqual(decision.exitCode, EXIT_CODES.INVARIANT_VIOLATION, 'Invariant violations must override findings and incompleteness');
});
