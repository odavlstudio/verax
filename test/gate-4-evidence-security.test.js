import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { EvidenceSecurityPolicy, REDACTION_MODE, createSecurityPolicyFromCli } from '../src/verax/core/evidence-security-policy.js';
import { filterConsoleLog, filterTracesConsole } from '../src/verax/core/console-log-filter.js';

test('Gate 4: Evidence Security Policy Tests', async () => {
  // Test 1: Basic field detection
  await test('Field detection', () => {
    const policy = new EvidenceSecurityPolicy();
    assert.ok(policy.isSensitiveField('password'));
    assert.ok(policy.isSensitiveField('email'));
  });

  // Test 2: Input type detection
  await test('Input type detection', () => {
    const policy = new EvidenceSecurityPolicy();
    assert.ok(policy.isSensitiveInputType('password'));
    assert.ok(policy.isSensitiveInputType('email'));
  });

  // Test 3: Query param detection
  await test('Query param detection', () => {
    const policy = new EvidenceSecurityPolicy();
    assert.ok(policy.hasSensitiveQueryParams('?token=abc'));
    assert.ok(policy.hasSensitiveQueryParams('?api_key=xyz'));
  });

  // Test 4: Console log filtering
  await test('Console log filtering', () => {
    const log = 'token=secret123';
    const filtered = filterConsoleLog(log);
    assert.ok(!filtered.includes('secret123'));
  });

  // Test 5: Trace console filtering
  await test('Trace console filtering', () => {
    const traces = [{
      console: [
        { text: 'API token=secret' }
      ]
    }];
    const filtered = filterTracesConsole(traces);
    assert.ok(!filtered[0].console[0].text.includes('secret'));
  });

  // Test 6: Safe-by-default
  await test('Safe-by-default', () => {
    const policy = new EvidenceSecurityPolicy();
    assert.equal(policy.redactionMode, REDACTION_MODE.ENABLED);
  });

  // Test 7: No-redaction flag
  await test('No-redaction flag', () => {
    // Just test that policy is created with disabled redaction
    const policy = new EvidenceSecurityPolicy({ redactionMode: REDACTION_MODE.DISABLED });
    assert.equal(policy.redactionMode, REDACTION_MODE.DISABLED);
    assert.ok(!policy.screenshotRedaction.enabled);
  });

  // Test 8: Trace sanitization
  await test('Trace sanitization', () => {
    const policy = new EvidenceSecurityPolicy();
    const trace = {
      request: {
        headers: { 'Authorization': 'Bearer xyz' },
        body: { pwd: 'xyz' }
      }
    };
    const sanitized = policy.sanitizeTrace(trace);
    assert.equal(sanitized.request.headers['Authorization'], '[REDACTED]');
    assert.ok(!sanitized.request.body);
  });

  // Test 9: Diagnostics opt-in
  await test('Diagnostics opt-in', () => {
    const defaultPolicy = new EvidenceSecurityPolicy();
    assert.ok(!defaultPolicy.diagnosticsHandling.enabled);
    
    const withDiag = createSecurityPolicyFromCli({ includeDiagnostics: true });
    assert.ok(withDiag.diagnosticsHandling.enabled);
  });

  // Test 10: Retention policy
  await test('Retention policy', () => {
    const policy = new EvidenceSecurityPolicy();
    assert.equal(policy.retentionPolicy.keepLastNRuns, 5);
    
    const custom = createSecurityPolicyFromCli({ retainRuns: 10 });
    assert.equal(custom.retentionPolicy.keepLastNRuns, 10);
  });
});
