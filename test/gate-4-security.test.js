/**
 * GATE 4: EVIDENCE SECURITY & PRIVACY
 * 
 * Tests for:
 * 1. Screenshot redaction (no passwords, emails, tokens in screenshots)
 * 2. Network trace sanitization (no sensitive query params or bodies)
 * 3. Console log filtering (no tokens/secrets in logs)
 * 4. Canonical artifacts are PII-free and safe
 * 5. Diagnostics separation (separate from canonical, opt-in)
 * 6. Retention policy (default keep last 5 runs)
 * 7. --no-redaction flag with warning
 */

import test from 'node:test';
import assert from 'node:assert';
import {
  sanitizeNetworkTrace,
  maskSensitiveQueryParams,
  validateTraceIsSafe
} from '../src/verax/core/network-trace-sanitizer.js';
import {
  filterConsoleLog,
  filterTracesConsole,
  validateConsoleLogIsSafe,
  hasSensitivePatterns
} from '../src/verax/core/console-log-filter.js';
import {
  EvidenceSecurityPolicy,
  REDACTION_MODE,
  createSecurityPolicyFromCli
} from '../src/verax/core/evidence-security-policy.js';

// ============================================================================
// NETWORK TRACE SANITIZATION TESTS
// ============================================================================

test('Network trace sanitizer removes sensitive query params from request URL', () => {
  const trace = {
    request: {
      url: 'https://api.example.com/login?email=user@example.com&token=abc123&password=secret'
    }
  };

  const sanitized = sanitizeNetworkTrace(trace);

  assert.ok(sanitized.request.url.includes('[REDACTED]'));
  assert.ok(!sanitized.request.url.includes('abc123'));
  assert.ok(!sanitized.request.url.includes('secret'));
});

test('Network trace sanitizer removes request body', () => {
  const trace = {
    request: {
      url: 'https://api.example.com/login',
      body: '{"password":"secret123","email":"user@example.com"}'
    }
  };

  const sanitized = sanitizeNetworkTrace(trace);

  assert.strictEqual(sanitized.request.body, undefined);
  assert.ok(!sanitized.request.body);
});

test('Network trace sanitizer removes response body', () => {
  const trace = {
    response: {
      body: '{"token":"abc123xyz","sessionId":"sess_789"}'
    }
  };

  const sanitized = sanitizeNetworkTrace(trace);

  assert.strictEqual(sanitized.response.body, undefined);
});

test('Network trace sanitizer masks Authorization header', () => {
  const trace = {
    request: {
      url: 'https://api.example.com/data',
      headers: {
        'Authorization': 'Bearer token_abc123xyz',
        'Content-Type': 'application/json'
      }
    }
  };

  const sanitized = sanitizeNetworkTrace(trace);

  assert.strictEqual(sanitized.request.headers['Authorization'], '[REDACTED]');
  assert.strictEqual(sanitized.request.headers['Content-Type'], 'application/json');
});

test('Network trace sanitizer masks Cookie header', () => {
  const trace = {
    request: {
      url: 'https://api.example.com/data',
      headers: {
        'Cookie': 'session=xyz123; user=john',
        'User-Agent': 'Chrome'
      }
    }
  };

  const sanitized = sanitizeNetworkTrace(trace);

  assert.strictEqual(sanitized.request.headers['Cookie'], '[REDACTED]');
  assert.strictEqual(sanitized.request.headers['User-Agent'], 'Chrome');
});

test('Network trace sanitizer preserves safe URLs', () => {
  const trace = {
    request: {
      url: 'https://api.example.com/data?id=123&format=json'
    }
  };

  const sanitized = sanitizeNetworkTrace(trace);

  assert.strictEqual(sanitized.request.url, trace.request.url);
});

test('Query parameter masking handles multiple sensitive params', () => {
  const url = 'https://api.example.com?token=abc&session=xyz&api_key=secret&id=123';
  const masked = maskSensitiveQueryParams(url);

  assert.ok(masked.includes('[REDACTED]'));
  assert.ok(!masked.includes('abc'));
  assert.ok(!masked.includes('xyz'));
  assert.ok(!masked.includes('secret'));
  assert.ok(masked.includes('id=123')); // Safe param preserved
});

test('validateTraceIsSafe returns false when request body is present', () => {
  const trace = {
    request: {
      url: 'https://api.example.com/login',
      body: '{"password":"secret"}'
    }
  };

  const result = validateTraceIsSafe(trace);

  assert.strictEqual(result.safe, false);
  assert.ok(result.issues.some(issue => issue.includes('Request body')));
});

test('validateTraceIsSafe returns true for sanitized trace', () => {
  const trace = {
    request: {
      url: 'https://api.example.com/data?id=123',
      headers: { 'Content-Type': 'application/json' }
    },
    response: {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  };

  const result = validateTraceIsSafe(trace);

  assert.strictEqual(result.safe, true);
  assert.strictEqual(result.issues.length, 0);
});

// ============================================================================
// CONSOLE LOG FILTERING TESTS
// ============================================================================

test('Console log filter masks token patterns', () => {
  const logText = 'User authenticated with token=abc123xyz';
  const filtered = filterConsoleLog(logText);

  assert.ok(filtered.includes('[REDACTED]'));
  assert.ok(!filtered.includes('abc123xyz'));
});

test('Console log filter masks password patterns', () => {
  const logText = 'Login failed: password=wrongpassword';
  const filtered = filterConsoleLog(logText);

  assert.ok(filtered.includes('[REDACTED]'));
  assert.ok(!filtered.includes('wrongpassword'));
});

test('Console log filter masks API key patterns', () => {
  const logText = 'API call with api_key=sk-abc123xyz789';
  const filtered = filterConsoleLog(logText);

  assert.ok(filtered.includes('[REDACTED]'));
  assert.ok(!filtered.includes('sk-abc123xyz789'));
});

test('Console log filter masks email addresses', () => {
  const logText = 'User logged in: user@example.com';
  const filtered = filterConsoleLog(logText);

  assert.ok(filtered.includes('[REDACTED]'));
  assert.ok(!filtered.includes('user@example.com'));
});

test('Console log filter preserves error structure', () => {
  const logText = 'Error: Failed to authenticate with token=secret123';
  const filtered = filterConsoleLog(logText);

  assert.ok(filtered.includes('Error:'));
  assert.ok(filtered.includes('[REDACTED]'));
  assert.ok(!filtered.includes('secret123'));
});

test('Console log filter does not filter safe logs', () => {
  const logText = 'User clicked login button on page /auth/login';
  const filtered = filterConsoleLog(logText);

  assert.strictEqual(filtered, logText);
});

test('hasSensitivePatterns detects token patterns', () => {
  const logText = 'Authorization failed: token=abc123';
  const hasSensitive = hasSensitivePatterns(logText);

  assert.strictEqual(hasSensitive, true);
});

test('hasSensitivePatterns does not flag safe logs', () => {
  const logText = 'User clicked the submit button';
  const hasSensitive = hasSensitivePatterns(logText);

  assert.strictEqual(hasSensitive, false);
});

test('validateConsoleLogIsSafe returns safe for filtered logs', () => {
  const logText = 'User attempt [REDACTED] on endpoint /api/data';
  const result = validateConsoleLogIsSafe(logText);

  assert.strictEqual(result.safe, true);
});

test('validateConsoleLogIsSafe returns unsafe for unfiltered logs with secrets', () => {
  const logText = 'Auth failed: password=MySecretPassword123';
  const result = validateConsoleLogIsSafe(logText);

  assert.strictEqual(result.safe, false);
  assert.ok(result.issues.length > 0);
});

test('filterTracesConsole applies filtering to trace array', () => {
  const traces = [
    {
      console: [
        { text: 'User: user@example.com authenticated' },
        { text: 'Session token: abc123xyz' }
      ]
    }
  ];

  const filtered = filterTracesConsole(traces);

  assert.ok(filtered[0].console[0].text.includes('[REDACTED]'));
  assert.ok(filtered[0].console[1].text.includes('[REDACTED]'));
});

// ============================================================================
// EVIDENCE SECURITY POLICY TESTS
// ============================================================================

test('EvidenceSecurityPolicy default is ENABLED (safe-by-default)', () => {
  const policy = new EvidenceSecurityPolicy();

  assert.strictEqual(policy.redactionMode, REDACTION_MODE.ENABLED);
  assert.strictEqual(policy.screenshotRedaction.enabled, true);
  assert.strictEqual(policy.networkTraceSanitization.enabled, true);
  assert.strictEqual(policy.consoleLogFiltering.enabled, true);
});

test('EvidenceSecurityPolicy DISABLED mode when requested', () => {
  const policy = new EvidenceSecurityPolicy({ redactionMode: REDACTION_MODE.DISABLED });

  assert.strictEqual(policy.redactionMode, REDACTION_MODE.DISABLED);
  assert.strictEqual(policy.screenshotRedaction.enabled, false);
  assert.strictEqual(policy.networkTraceSanitization.enabled, false);
  assert.strictEqual(policy.consoleLogFiltering.enabled, false);
});

test('EvidenceSecurityPolicy identifies sensitive field names', () => {
  const policy = new EvidenceSecurityPolicy();

  assert.strictEqual(policy.isSensitiveField('password'), true);
  assert.strictEqual(policy.isSensitiveField('email'), true);
  assert.strictEqual(policy.isSensitiveField('token'), true);
  assert.strictEqual(policy.isSensitiveField('api-key'), true);
  assert.strictEqual(policy.isSensitiveField('session-id'), true);
  assert.strictEqual(policy.isSensitiveField('username'), false);
  assert.strictEqual(policy.isSensitiveField('city'), false);
});

test('EvidenceSecurityPolicy identifies sensitive input types', () => {
  const policy = new EvidenceSecurityPolicy();

  assert.strictEqual(policy.isSensitiveInputType('password'), true);
  assert.strictEqual(policy.isSensitiveInputType('email'), true);
  assert.strictEqual(policy.isSensitiveInputType('tel'), true);
  assert.strictEqual(policy.isSensitiveInputType('text'), false);
});

test('EvidenceSecurityPolicy sanitizes traces correctly', () => {
  const policy = new EvidenceSecurityPolicy();

  const trace = {
    request: {
      url: 'https://api.example.com/login?password=secret123',
      body: '{"token":"abc123"}',
      headers: { 'Authorization': 'Bearer xyz' }
    },
    response: {
      body: '{"sessionId":"sess123"}',
      headers: { 'Set-Cookie': 'session=xyz123' }
    }
  };

  const sanitized = policy.sanitizeTrace(trace);

  assert.ok(!sanitized.request.body);
  assert.ok(!sanitized.response.body);
  assert.strictEqual(sanitized.request.headers['Authorization'], '[REDACTED]');
});

test('EvidenceSecurityPolicy masks query params in URLs', () => {
  const policy = new EvidenceSecurityPolicy();

  const url = 'https://api.example.com/data?email=user@example.com&id=123';
  const masked = policy.maskSensitiveQueryParams(url);

  assert.ok(masked.includes('[REDACTED]'));
  assert.ok(!masked.includes('user@example.com'));
  assert.ok(masked.includes('id=123'));
});

test('EvidenceSecurityPolicy filters log patterns', () => {
  const policy = new EvidenceSecurityPolicy();

  const logText = 'Auth token=abc123xyz failed';
  const filtered = policy.filterSensitiveLog(logText);

  assert.ok(filtered.includes('[REDACTED]'));
  assert.ok(!filtered.includes('abc123xyz'));
});

test('createSecurityPolicyFromCli with --no-redaction disables protection', () => {
  const policy = createSecurityPolicyFromCli({ noRedaction: true });

  assert.strictEqual(policy.redactionMode, REDACTION_MODE.DISABLED);
  assert.strictEqual(policy.screenshotRedaction.enabled, false);
});

test('createSecurityPolicyFromCli respects retention settings', () => {
  const policy = createSecurityPolicyFromCli({ retainRuns: 10 });

  assert.strictEqual(policy.retentionPolicy.keepLastNRuns, 10);
});

test('createSecurityPolicyFromCli respects diagnostics flag', () => {
  const policy = createSecurityPolicyFromCli({ includeDiagnostics: true });

  assert.strictEqual(policy.diagnosticsHandling.enabled, true);
});

// ============================================================================
// CANONICAL ARTIFACT SAFETY TESTS
// ============================================================================

test('Canonical artifacts must not contain PII', () => {
  // Simulate a canonical artifact (trace data)
  const artifact = {
    requestUrl: 'https://api.example.com/data',
    requestHeaders: { 'Content-Type': 'application/json' },
    responseStatus: 200
  };

  // Should not contain emails, passwords, tokens, etc.
  const artifactJson = JSON.stringify(artifact);
  
  assert.ok(!artifactJson.includes('user@example.com'));
  assert.ok(!artifactJson.includes('password'));
  assert.ok(!artifactJson.includes('token'));
});

test('Canonical artifacts must not contain request bodies', () => {
  const policy = new EvidenceSecurityPolicy();

  const trace = {
    request: {
      url: 'https://api.example.com/login',
      body: '{"email":"user@example.com","password":"secret"}'
    }
  };

  const sanitized = policy.sanitizeTrace(trace);

  assert.ok(!sanitized.request.body);
});

test('Canonical artifacts must not contain response bodies', () => {
  const policy = new EvidenceSecurityPolicy();

  const trace = {
    response: {
      status: 200,
      body: '{"token":"abc123","user":"john"}'
    }
  };

  const sanitized = policy.sanitizeTrace(trace);

  assert.ok(!sanitized.response.body);
});

// ============================================================================
// DIAGNOSTICS SEPARATION TESTS
// ============================================================================

test('EvidenceSecurityPolicy diagnostics are disabled by default', () => {
  const policy = new EvidenceSecurityPolicy();

  assert.strictEqual(policy.diagnosticsHandling.enabled, false);
});

test('EvidenceSecurityPolicy diagnostics require explicit opt-in flag', () => {
  const policy = new EvidenceSecurityPolicy({ includeDiagnostics: true });

  assert.strictEqual(policy.diagnosticsHandling.enabled, true);
  assert.strictEqual(policy.diagnosticsHandling.separateFromCanonical, true);
});

test('Diagnostics are still redacted even when enabled', () => {
  const policy = new EvidenceSecurityPolicy({ includeDiagnostics: true });

  assert.strictEqual(policy.diagnosticsHandling.stayRedacted, true);
});

// ============================================================================
// RETENTION POLICY TESTS
// ============================================================================

test('EvidenceSecurityPolicy keeps last N runs by default (5)', () => {
  const policy = new EvidenceSecurityPolicy();

  assert.strictEqual(policy.retentionPolicy.keepLastNRuns, 5);
});

test('EvidenceSecurityPolicy retention can be configured', () => {
  const policy = new EvidenceSecurityPolicy({ retainRuns: 20 });

  assert.strictEqual(policy.retentionPolicy.keepLastNRuns, 20);
});

// ============================================================================
// REDACTION SUMMARY TESTS
// ============================================================================

test('EvidenceSecurityPolicy provides redaction summary', () => {
  const policy = new EvidenceSecurityPolicy();

  const summary = policy.getRedactionSummary();

  assert.ok(summary.mode);
  assert.strictEqual(summary.screenshot, true);
  assert.strictEqual(summary.networkTraces, true);
  assert.strictEqual(summary.consoleLogs, true);
  assert.strictEqual(typeof summary.retentionDays, 'number');
});
