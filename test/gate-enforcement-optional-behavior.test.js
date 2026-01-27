import test from 'node:test';
import assert from 'node:assert/strict';

import { enforceGateOutcome, enforceGateOutcomeForFinding, enforceGateOutcomesForFindings, isEnforcementEnabled } from '../src/verax/core/gates/enforce-gate-outcome.js';

test('Enforcement: isEnforcementEnabled returns false by default', () => {
  const wasEnforced = process.env.VERAX_ENFORCE_GATES;
  delete process.env.VERAX_ENFORCE_GATES;
  
  assert.equal(isEnforcementEnabled(), false);
  
  if (wasEnforced !== undefined) {
    process.env.VERAX_ENFORCE_GATES = wasEnforced;
  }
});

test('Enforcement: isEnforcementEnabled returns true when VERAX_ENFORCE_GATES=1', () => {
  const wasEnforced = process.env.VERAX_ENFORCE_GATES;
  process.env.VERAX_ENFORCE_GATES = '1';
  
  assert.equal(isEnforcementEnabled(), true);
  
  if (wasEnforced === undefined) {
    delete process.env.VERAX_ENFORCE_GATES;
  } else {
    process.env.VERAX_ENFORCE_GATES = wasEnforced;
  }
});

test('Enforcement: Default behavior - FAIL gate does NOT set exitCode', () => {
  const wasEnforced = process.env.VERAX_ENFORCE_GATES;
  delete process.env.VERAX_ENFORCE_GATES;
  
  const originalExitCode = process.exitCode;
  process.exitCode = undefined;
  
  enforceGateOutcome('FAIL');
  
  assert.equal(process.exitCode, undefined, 'exitCode should not be set when enforcement disabled');
  
  process.exitCode = originalExitCode;
  if (wasEnforced !== undefined) {
    process.env.VERAX_ENFORCE_GATES = wasEnforced;
  }
});

test('Enforcement: Opt-in enabled - FAIL gate sets exitCode to 1', () => {
  const wasEnforced = process.env.VERAX_ENFORCE_GATES;
  process.env.VERAX_ENFORCE_GATES = '1';
  
  const originalExitCode = process.exitCode;
  process.exitCode = undefined;
  
  enforceGateOutcome('FAIL');
  
  assert.equal(process.exitCode, 1, 'exitCode should be set to 1 when FAIL gate and enforcement enabled');
  
  process.exitCode = originalExitCode;
  if (wasEnforced === undefined) {
    delete process.env.VERAX_ENFORCE_GATES;
  } else {
    process.env.VERAX_ENFORCE_GATES = wasEnforced;
  }
});

test('Enforcement: Opt-in enabled - WARN gate does NOT set exitCode', () => {
  const wasEnforced = process.env.VERAX_ENFORCE_GATES;
  process.env.VERAX_ENFORCE_GATES = '1';
  
  const originalExitCode = process.exitCode;
  process.exitCode = undefined;
  
  enforceGateOutcome('WARN');
  
  assert.equal(process.exitCode, undefined, 'exitCode should not be set for WARN gate');
  
  process.exitCode = originalExitCode;
  if (wasEnforced === undefined) {
    delete process.env.VERAX_ENFORCE_GATES;
  } else {
    process.env.VERAX_ENFORCE_GATES = wasEnforced;
  }
});

test('Enforcement: Opt-in enabled - PASS gate does NOT set exitCode', () => {
  const wasEnforced = process.env.VERAX_ENFORCE_GATES;
  process.env.VERAX_ENFORCE_GATES = '1';
  
  const originalExitCode = process.exitCode;
  process.exitCode = undefined;
  
  enforceGateOutcome('PASS');
  
  assert.equal(process.exitCode, undefined, 'exitCode should not be set for PASS gate');
  
  process.exitCode = originalExitCode;
  if (wasEnforced === undefined) {
    delete process.env.VERAX_ENFORCE_GATES;
  } else {
    process.env.VERAX_ENFORCE_GATES = wasEnforced;
  }
});

test('Enforcement: enforceGateOutcomeForFinding with FAIL meta', () => {
  const wasEnforced = process.env.VERAX_ENFORCE_GATES;
  process.env.VERAX_ENFORCE_GATES = '1';
  
  const originalExitCode = process.exitCode;
  process.exitCode = undefined;
  
  const finding = {
    type: 'silent_failure',
    meta: { gateOutcome: 'FAIL' }
  };
  
  enforceGateOutcomeForFinding(finding);
  
  assert.equal(process.exitCode, 1, 'exitCode should be set for finding with FAIL gate');
  
  process.exitCode = originalExitCode;
  if (wasEnforced === undefined) {
    delete process.env.VERAX_ENFORCE_GATES;
  } else {
    process.env.VERAX_ENFORCE_GATES = wasEnforced;
  }
});

test('Enforcement: enforceGateOutcomesForFindings stops at first FAIL', () => {
  const wasEnforced = process.env.VERAX_ENFORCE_GATES;
  process.env.VERAX_ENFORCE_GATES = '1';
  
  const originalExitCode = process.exitCode;
  process.exitCode = undefined;
  
  const findings = [
    { type: 'silent_failure', meta: { gateOutcome: 'PASS' } },
    { type: 'silent_failure', meta: { gateOutcome: 'FAIL' } },
    { type: 'silent_failure', meta: { gateOutcome: 'FAIL' } }
  ];
  
  enforceGateOutcomesForFindings(findings);
  
  assert.equal(process.exitCode, 1, 'exitCode should be set on first FAIL');
  
  process.exitCode = originalExitCode;
  if (wasEnforced === undefined) {
    delete process.env.VERAX_ENFORCE_GATES;
  } else {
    process.env.VERAX_ENFORCE_GATES = wasEnforced;
  }
});

test('Enforcement: No exceptions thrown on invalid input', () => {
  const wasEnforced = process.env.VERAX_ENFORCE_GATES;
  process.env.VERAX_ENFORCE_GATES = '1';
  
  const originalExitCode = process.exitCode;
  process.exitCode = undefined;
  
  // Should not throw
  assert.doesNotThrow(() => {
    enforceGateOutcomeForFinding(null);
    enforceGateOutcomeForFinding(undefined);
    enforceGateOutcomeForFinding({});
    enforceGateOutcomesForFindings(null);
    enforceGateOutcomesForFindings(undefined);
    enforceGateOutcomesForFindings('not an array');
  });
  
  process.exitCode = originalExitCode;
  if (wasEnforced === undefined) {
    delete process.env.VERAX_ENFORCE_GATES;
  } else {
    process.env.VERAX_ENFORCE_GATES = wasEnforced;
  }
});
