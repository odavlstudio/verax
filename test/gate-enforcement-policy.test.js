import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { resolve } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

import { loadGatePolicy, matchesPolicyScope, DEFAULT_GATE_POLICY } from '../src/verax/core/gates/load-gate-policy.js';
import { enforceGateOutcome, enforceGateOutcomeForFinding, enforceGateOutcomesForFindings } from '../src/verax/core/gates/enforce-gate-outcome.js';

test('Policy loader: returns defaults when file does not exist', () => {
  const tmpDir = resolve(tmpdir(), `verax-test-${randomUUID()}`);
  mkdirSync(tmpDir, { recursive: true });

  const policy = loadGatePolicy(tmpDir);

  assert.deepEqual(policy, DEFAULT_GATE_POLICY);
  assert.equal(policy.enforcement.enabled, false);

  rmSync(tmpDir, { recursive: true });
});

test('Policy loader: loads valid policy from .verax/gates.policy.json', () => {
  const tmpDir = resolve(tmpdir(), `verax-test-${randomUUID()}`);
  mkdirSync(tmpDir, { recursive: true });
  mkdirSync(resolve(tmpDir, '.verax'), { recursive: true });

  const policy = {
    enforcement: {
      enabled: true,
      failOn: ['FAIL', 'WARN'],
      scope: {
        truthStatus: ['CONFIRMED', 'SUSPECTED'],
        decisionUsefulness: ['FIX', 'BLOCK']
      }
    }
  };

  writeFileSync(resolve(tmpDir, '.verax', 'gates.policy.json'), JSON.stringify(policy));

  const loaded = loadGatePolicy(tmpDir);

  assert.deepEqual(loaded, policy);

  rmSync(tmpDir, { recursive: true });
});

test('Policy loader: handles invalid JSON gracefully', () => {
  const tmpDir = resolve(tmpdir(), `verax-test-${randomUUID()}`);
  mkdirSync(tmpDir, { recursive: true });
  mkdirSync(resolve(tmpDir, '.verax'), { recursive: true });

  writeFileSync(resolve(tmpDir, '.verax', 'gates.policy.json'), 'not valid json');

  const policy = loadGatePolicy(tmpDir);

  assert.deepEqual(policy, DEFAULT_GATE_POLICY);

  rmSync(tmpDir, { recursive: true });
});

test('Policy loader: rejects invalid policy structure', () => {
  const tmpDir = resolve(tmpdir(), `verax-test-${randomUUID()}`);
  mkdirSync(tmpDir, { recursive: true });
  mkdirSync(resolve(tmpDir, '.verax'), { recursive: true });

  // Invalid: enabled is not boolean
  const invalidPolicy = {
    enforcement: {
      enabled: 'yes',
      failOn: ['FAIL']
    }
  };

  writeFileSync(resolve(tmpDir, '.verax', 'gates.policy.json'), JSON.stringify(invalidPolicy));

  const policy = loadGatePolicy(tmpDir);

  assert.deepEqual(policy, DEFAULT_GATE_POLICY);

  rmSync(tmpDir, { recursive: true });
});

test('Policy scope matching: matches when scope is empty', () => {
  const scope = {};
  assert.equal(matchesPolicyScope(scope, 'CONFIRMED', 'FIX'), true);
});

test('Policy scope matching: matches truthStatus when specified', () => {
  const scope = { truthStatus: ['CONFIRMED', 'SUSPECTED'] };
  assert.equal(matchesPolicyScope(scope, 'CONFIRMED', 'FIX'), true);
  assert.equal(matchesPolicyScope(scope, 'INFORMATIONAL', 'FIX'), false);
});

test('Policy scope matching: matches decisionUsefulness when specified', () => {
  const scope = { decisionUsefulness: ['FIX', 'BLOCK'] };
  assert.equal(matchesPolicyScope(scope, 'CONFIRMED', 'FIX'), true);
  assert.equal(matchesPolicyScope(scope, 'CONFIRMED', 'IGNORE'), false);
});

test('Policy scope matching: both filters must match', () => {
  const scope = {
    truthStatus: ['CONFIRMED'],
    decisionUsefulness: ['FIX']
  };
  assert.equal(matchesPolicyScope(scope, 'CONFIRMED', 'FIX'), true);
  assert.equal(matchesPolicyScope(scope, 'CONFIRMED', 'INVESTIGATE'), false);
  assert.equal(matchesPolicyScope(scope, 'SUSPECTED', 'FIX'), false);
});

test('Enforcement with policy: FAIL gate enforces when policy enabled', () => {
  const wasEnforced = process.env.VERAX_ENFORCE_GATES;
  process.env.VERAX_ENFORCE_GATES = '1';

  const originalExitCode = process.exitCode;
  process.exitCode = undefined;

  const policy = {
    enforcement: {
      enabled: true,
      failOn: ['FAIL']
    }
  };

  enforceGateOutcome('FAIL', policy);

  assert.equal(process.exitCode, 1);

  process.exitCode = originalExitCode;
  if (wasEnforced === undefined) {
    delete process.env.VERAX_ENFORCE_GATES;
  } else {
    process.env.VERAX_ENFORCE_GATES = wasEnforced;
  }
});

test('Enforcement with policy: WARN gate enforces when in failOn list', () => {
  const wasEnforced = process.env.VERAX_ENFORCE_GATES;
  process.env.VERAX_ENFORCE_GATES = '1';

  const originalExitCode = process.exitCode;
  process.exitCode = undefined;

  const policy = {
    enforcement: {
      enabled: true,
      failOn: ['WARN', 'FAIL']
    }
  };

  enforceGateOutcome('WARN', policy);

  assert.equal(process.exitCode, 1);

  process.exitCode = originalExitCode;
  if (wasEnforced === undefined) {
    delete process.env.VERAX_ENFORCE_GATES;
  } else {
    process.env.VERAX_ENFORCE_GATES = wasEnforced;
  }
});

test('Enforcement with policy: WARN gate does NOT enforce when not in failOn', () => {
  const wasEnforced = process.env.VERAX_ENFORCE_GATES;
  process.env.VERAX_ENFORCE_GATES = '1';

  const originalExitCode = process.exitCode;
  process.exitCode = undefined;

  const policy = {
    enforcement: {
      enabled: true,
      failOn: ['FAIL']
    }
  };

  enforceGateOutcome('WARN', policy);

  assert.equal(process.exitCode, undefined);

  process.exitCode = originalExitCode;
  if (wasEnforced === undefined) {
    delete process.env.VERAX_ENFORCE_GATES;
  } else {
    process.env.VERAX_ENFORCE_GATES = wasEnforced;
  }
});

test('Enforcement with policy: scope filtering prevents enforcement', () => {
  const wasEnforced = process.env.VERAX_ENFORCE_GATES;
  process.env.VERAX_ENFORCE_GATES = '1';

  const originalExitCode = process.exitCode;
  process.exitCode = undefined;

  const policy = {
    enforcement: {
      enabled: true,
      failOn: ['FAIL'],
      scope: {
        truthStatus: ['CONFIRMED']
      }
    }
  };

  // Gate is FAIL, but truthStatus is SUSPECTED (not in scope)
  enforceGateOutcome('FAIL', policy, 'SUSPECTED', null);

  assert.equal(process.exitCode, undefined);

  process.exitCode = originalExitCode;
  if (wasEnforced === undefined) {
    delete process.env.VERAX_ENFORCE_GATES;
  } else {
    process.env.VERAX_ENFORCE_GATES = wasEnforced;
  }
});

test('Enforcement with finding: uses finding metadata for scope', () => {
  const wasEnforced = process.env.VERAX_ENFORCE_GATES;
  process.env.VERAX_ENFORCE_GATES = '1';

  const originalExitCode = process.exitCode;
  process.exitCode = undefined;

  const policy = {
    enforcement: {
      enabled: true,
      failOn: ['FAIL'],
      scope: {
        truthStatus: ['CONFIRMED']
      }
    }
  };

  const finding = {
    status: 'CONFIRMED',
    meta: {
      gateOutcome: 'FAIL',
      decisionUsefulness: 'FIX'
    }
  };

  enforceGateOutcomeForFinding(finding, policy);

  assert.equal(process.exitCode, 1);

  process.exitCode = originalExitCode;
  if (wasEnforced === undefined) {
    delete process.env.VERAX_ENFORCE_GATES;
  } else {
    process.env.VERAX_ENFORCE_GATES = wasEnforced;
  }
});

test('Enforcement with batch: respects policy for each finding', () => {
  const wasEnforced = process.env.VERAX_ENFORCE_GATES;
  process.env.VERAX_ENFORCE_GATES = '1';

  const originalExitCode = process.exitCode;
  process.exitCode = undefined;

  const policy = {
    enforcement: {
      enabled: true,
      failOn: ['FAIL'],
      scope: {
        decisionUsefulness: ['FIX', 'BLOCK']
      }
    }
  };

  const findings = [
    {
      status: 'CONFIRMED',
      meta: { gateOutcome: 'FAIL', decisionUsefulness: 'INVESTIGATE' }
    }, // doesn't match scope
    {
      status: 'CONFIRMED',
      meta: { gateOutcome: 'FAIL', decisionUsefulness: 'FIX' }
    } // matches scope
  ];

  enforceGateOutcomesForFindings(findings, policy);

  assert.equal(process.exitCode, 1);

  process.exitCode = originalExitCode;
  if (wasEnforced === undefined) {
    delete process.env.VERAX_ENFORCE_GATES;
  } else {
    process.env.VERAX_ENFORCE_GATES = wasEnforced;
  }
});

test('Default behavior preserved: enforcement disabled by default without env var', () => {
  const wasEnforced = process.env.VERAX_ENFORCE_GATES;
  delete process.env.VERAX_ENFORCE_GATES;

  const originalExitCode = process.exitCode;
  process.exitCode = undefined;

  const policy = {
    enforcement: {
      enabled: true,
      failOn: ['FAIL']
    }
  };

  enforceGateOutcome('FAIL', policy);

  assert.equal(process.exitCode, undefined);

  process.exitCode = originalExitCode;
  if (wasEnforced !== undefined) {
    process.env.VERAX_ENFORCE_GATES = wasEnforced;
  }
});

test('Default behavior preserved: policy disabled=false disables enforcement', () => {
  const wasEnforced = process.env.VERAX_ENFORCE_GATES;
  process.env.VERAX_ENFORCE_GATES = '1';

  const originalExitCode = process.exitCode;
  process.exitCode = undefined;

  const policy = {
    enforcement: {
      enabled: false,
      failOn: ['FAIL']
    }
  };

  enforceGateOutcome('FAIL', policy);

  assert.equal(process.exitCode, undefined);

  process.exitCode = originalExitCode;
  if (wasEnforced === undefined) {
    delete process.env.VERAX_ENFORCE_GATES;
  } else {
    process.env.VERAX_ENFORCE_GATES = wasEnforced;
  }
});
