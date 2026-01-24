/**
 * Policy engine integration tests (PHASE 5.5)
 *
 * Tests: policy loading, validation, application to findings, and exit code behavior
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { loadPolicy, validatePolicy, isIgnored, findDowngradeRule, applyPolicy, filterSuppressed, countNonSuppressedFindings } from '../src/cli/util/policy/policy-loader.js';
import { UsageError } from '../src/cli/util/support/errors.js';

function setupProject() {
  const root = mkdtempSync(join(tmpdir(), 'verax-policy-'));
  mkdirSync(resolve(root, '.verax'), { recursive: true });
  return root;
}

function createFinding(id, type = 'broken_navigation_promise', selector = 'button.submit', severity = 'HIGH') {
  return {
    id,
    type,
    selector,
    severity,
    status: 'CONFIRMED',
    confidence: 0.9
  };
}

test('Policy loader: no policy file returns null', () => {
  const root = setupProject();
  const policy = loadPolicy(root);
  assert.strictEqual(policy, null);
  rmSync(root, { recursive: true, force: true });
});

test('Policy validation: valid policy passes', () => {
  const policy = {
    version: 1,
    ignore: { findingIds: [], types: [], selectorContains: [] },
    downgrade: []
  };
  assert.doesNotThrow(() => validatePolicy(policy));
});

test('Policy validation: invalid version throws UsageError', () => {
  const policy = { version: 2 };
  assert.throws(() => validatePolicy(policy), UsageError);
});

test('Policy validation: invalid ignore types throws UsageError', () => {
  const policy = {
    version: 1,
    ignore: { findingIds: [123] } // Should be strings
  };
  assert.throws(() => validatePolicy(policy), UsageError);
});

test('Policy validation: invalid downgrade array throws UsageError', () => {
  const policy = {
    version: 1,
    downgrade: 'not an array'
  };
  assert.throws(() => validatePolicy(policy), UsageError);
});

test('Policy matching: ignore by findingId', () => {
  const policy = {
    version: 1,
    ignore: { findingIds: ['finding-1'], types: [], selectorContains: [] },
    downgrade: []
  };
  const finding = createFinding('finding-1');
  assert.strictEqual(isIgnored(finding, policy), true);
});

test('Policy matching: ignore by type', () => {
  const policy = {
    version: 1,
    ignore: { findingIds: [], types: ['silent_submission'], selectorContains: [] },
    downgrade: []
  };
  const finding = createFinding('f1', 'silent_submission');
  assert.strictEqual(isIgnored(finding, policy), true);
});

test('Policy matching: ignore by selectorContains', () => {
  const policy = {
    version: 1,
    ignore: { findingIds: [], types: [], selectorContains: ['footer'] },
    downgrade: []
  };
  const finding = createFinding('f1', 'broken_navigation_promise', 'a.link.in.footer');
  assert.strictEqual(isIgnored(finding, policy), true);
});

test('Policy matching: downgrade by type', () => {
  const policy = {
    version: 1,
    ignore: { findingIds: [], types: [], selectorContains: [] },
    downgrade: [
      { type: 'broken_navigation_promise', toStatus: 'SUSPECTED', reason: 'edge case' }
    ]
  };
  const finding = createFinding('f1', 'broken_navigation_promise');
  const rule = findDowngradeRule(finding, policy);
  assert.ok(rule);
  assert.strictEqual(rule.toStatus, 'SUSPECTED');
});

test('Policy matching: downgrade by selectorContains', () => {
  const policy = {
    version: 1,
    ignore: { findingIds: [], types: [], selectorContains: [] },
    downgrade: [
      { type: 'broken_navigation_promise', selectorContains: 'footer', toStatus: 'SUSPECTED', reason: 'footer nav is optional' }
    ]
  };
  const finding = createFinding('f1', 'broken_navigation_promise', 'footer a');
  const rule = findDowngradeRule(finding, policy);
  assert.ok(rule);
  assert.strictEqual(rule.toStatus, 'SUSPECTED');
});

test('Policy application: suppressed finding has suppressed flag and policy metadata', () => {
  const policy = {
    version: 1,
    ignore: { findingIds: ['f1'], types: [], selectorContains: [] },
    downgrade: []
  };
  const finding = createFinding('f1');
  const findings = [finding];
  const result = applyPolicy(findings, policy);
  
  assert.strictEqual(result[0].suppressed, true);
  assert.ok(result[0].policy);
  assert.strictEqual(result[0].policy.suppressed, true);
  assert.strictEqual(result[0].policy.rule.kind, 'ignore');
});

test('Policy application: downgraded finding has downgraded flag and status changed', () => {
  const policy = {
    version: 1,
    ignore: { findingIds: [], types: [], selectorContains: [] },
    downgrade: [
      { type: 'broken_navigation_promise', toStatus: 'SUSPECTED', reason: 'edge case' }
    ]
  };
  const finding = createFinding('f1', 'broken_navigation_promise');
  const findings = [finding];
  const result = applyPolicy(findings, policy);
  
  assert.strictEqual(result[0].downgraded, true);
  assert.strictEqual(result[0].status, 'SUSPECTED');
  assert.ok(result[0].policy);
  assert.strictEqual(result[0].policy.downgraded, true);
  assert.strictEqual(result[0].policy.rule.kind, 'downgrade');
});

test('Policy application: no matching rules => no suppression/downgrade', () => {
  const policy = {
    version: 1,
    ignore: { findingIds: [], types: [], selectorContains: [] },
    downgrade: []
  };
  const finding = createFinding('f1');
  const findings = [finding];
  const result = applyPolicy(findings, policy);
  
  assert.strictEqual(result[0].suppressed, false);
  assert.strictEqual(result[0].downgraded, false);
});

test('Policy filtering: filterSuppressed removes suppressed findings', () => {
  const findings = [
    { id: 'f1', suppressed: true },
    { id: 'f2', suppressed: false },
    { id: 'f3', suppressed: true }
  ];
  const result = filterSuppressed(findings);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].id, 'f2');
});

test('Policy counting: countNonSuppressedFindings counts by severity excluding suppressed', () => {
  const findings = [
    { id: 'f1', severity: 'HIGH', suppressed: true },
    { id: 'f2', severity: 'HIGH', suppressed: false },
    { id: 'f3', severity: 'MEDIUM', suppressed: false },
    { id: 'f4', severity: 'MEDIUM', suppressed: true }
  ];
  const counts = countNonSuppressedFindings(findings);
  assert.deepStrictEqual(counts, { HIGH: 1, MEDIUM: 1, LOW: 0, UNKNOWN: 0 });
});

test('Policy file load: reads and normalizes .verax/policy.json', () => {
  const root = setupProject();
  const policyPath = resolve(root, '.verax', 'policy.json');
  const policyData = {
    version: 1,
    ignore: {
      types: ['silent_submission']
    },
    downgrade: [
      { type: 'broken_navigation_promise', toStatus: 'SUSPECTED', reason: 'edge' }
    ]
  };
  writeFileSync(policyPath, JSON.stringify(policyData));
  
  const loaded = loadPolicy(root);
  assert.ok(loaded);
  assert.strictEqual(loaded.version, 1);
  assert.ok(Array.isArray(loaded.ignore.findingIds));
  assert.strictEqual(loaded.ignore.types.length, 1);
  assert.strictEqual(loaded.downgrade.length, 1);
  
  rmSync(root, { recursive: true, force: true });
});

test('Determinism: same policy + same findings => identical output', () => {
  const policy = {
    version: 1,
    ignore: { findingIds: ['f2'], types: [], selectorContains: [] },
    downgrade: [{ type: 'broken_navigation_promise', toStatus: 'SUSPECTED', reason: 'test' }]
  };
  const findings = [
    createFinding('f1'),
    createFinding('f2'),
    createFinding('f3')
  ];
  
  const result1 = JSON.stringify(applyPolicy([...findings], policy));
  const result2 = JSON.stringify(applyPolicy([...findings], policy));
  
  assert.strictEqual(result1, result2);
});

test('Cleanup: remove temporary directories', () => {
  const root = setupProject();
  rmSync(root, { recursive: true, force: true });
  assert.ok(true); // Cleanup successful
});
