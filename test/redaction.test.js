/**
 * Redaction (Phase 8.2) Tests
 * Verify sensitive data is redacted before writing to disk
 */

import { test } from 'node:test';
import assert from 'node:assert';
import {
  redactHeaders,
  redactUrl,
  redactBody,
  redactConsole,
  redactTokensInText,
  getRedactionCounters,
  REDACTION_PLACEHOLDER,
} from '../src/cli/util/redact.js';

test('redaction: redacts authorization headers', () => {
  const counters = { headersRedacted: 0, tokensRedacted: 0 };
  const headers = {
    'Content-Type': 'application/json',
    Authorization: 'Bearer abc123xyz',
    'X-API-Key': 'secret-key-12345',
  };

  const redacted = redactHeaders(headers, counters);

  assert.strictEqual(redacted['Content-Type'], 'application/json');
  assert.strictEqual(redacted.Authorization, REDACTION_PLACEHOLDER);
  assert.strictEqual(redacted['X-API-Key'], REDACTION_PLACEHOLDER);
  assert.strictEqual(counters.headersRedacted, 2);
});

test('redaction: redacts cookie headers', () => {
  const counters = { headersRedacted: 0, tokensRedacted: 0 };
  const headers = {
    Cookie: 'session=abc123; user=john',
    'Set-Cookie': 'token=xyz789',
  };

  const redacted = redactHeaders(headers, counters);

  assert.strictEqual(redacted.Cookie, REDACTION_PLACEHOLDER);
  assert.strictEqual(redacted['Set-Cookie'], REDACTION_PLACEHOLDER);
  assert.strictEqual(counters.headersRedacted, 2);
});

test('redaction: redacts bearer tokens in text', () => {
  const counters = { headersRedacted: 0, tokensRedacted: 0 };
  const text = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';

  const redacted = redactTokensInText(text, counters);

  assert.ok(redacted.includes(REDACTION_PLACEHOLDER));
  assert.ok(!redacted.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'));
  assert.strictEqual(counters.tokensRedacted, 1);
});

test('redaction: redacts jwt-like strings', () => {
  const counters = { headersRedacted: 0, tokensRedacted: 0 };
  const text = 'Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';

  const redacted = redactTokensInText(text, counters);

  assert.ok(redacted.includes(REDACTION_PLACEHOLDER));
  assert.ok(!redacted.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'));
  assert.strictEqual(counters.tokensRedacted, 1);
});

test('redaction: redacts query parameters', () => {
  const counters = { headersRedacted: 0, tokensRedacted: 0 };
  const url = 'https://api.example.com/data?api_key=secret123&access_token=token456&filter=active';

  const redacted = redactUrl(url, counters);

  assert.ok(redacted.includes('api_key=' + REDACTION_PLACEHOLDER));
  assert.ok(redacted.includes('access_token=' + REDACTION_PLACEHOLDER));
  assert.ok(redacted.includes('filter=active'));
  assert.strictEqual(counters.tokensRedacted, 2);
});

test('redaction: redacts body content', () => {
  const counters = { headersRedacted: 0, tokensRedacted: 0 };
  const body = {
    user: 'john',
    token: 'secret_token_xyz',
    data: 'normal data',
  };

  const redacted = redactBody(body, counters);

  assert.strictEqual(redacted.user, 'john');
  assert.strictEqual(redacted.token, REDACTION_PLACEHOLDER);
  assert.strictEqual(redacted.data, 'normal data');
  assert.strictEqual(counters.tokensRedacted, 1);
});

test('redaction: redacts console messages', () => {
  const counters = { headersRedacted: 0, tokensRedacted: 0 };
  const message = 'Login successful with token: Bearer abc123xyz';

  const redacted = redactConsole(message, counters);

  assert.ok(redacted.includes(REDACTION_PLACEHOLDER));
  assert.ok(!redacted.includes('abc123xyz'));
  assert.strictEqual(counters.tokensRedacted, 1);
});

test('redaction: tracks redaction counts correctly', () => {
  const counters = { headersRedacted: 0, tokensRedacted: 0 };

  // Redact headers
  redactHeaders({ Authorization: 'Bearer token123', Cookie: 'session=abc' }, counters);
  assert.strictEqual(counters.headersRedacted, 2);

  // Redact tokens in text
  redactTokensInText('api_key=secret&access_token=token', counters);
  assert.strictEqual(counters.tokensRedacted, 2);

  const finalCounts = getRedactionCounters(counters);
  assert.strictEqual(finalCounts.headersRedacted, 2);
  assert.strictEqual(finalCounts.tokensRedacted, 2);
});

test('redaction: handles null/undefined gracefully', () => {
  const counters = { headersRedacted: 0, tokensRedacted: 0 };

  assert.strictEqual(redactBody(null, counters), null);
  assert.strictEqual(redactBody(undefined, counters), undefined);
  assert.strictEqual(redactUrl(null, counters), '');
  assert.strictEqual(redactUrl(undefined, counters), '');
  assert.strictEqual(redactConsole(null, counters), '');
});

test('redaction: preserves case-insensitive header matching', () => {
  const counters1 = { headersRedacted: 0, tokensRedacted: 0 };
  const counters2 = { headersRedacted: 0, tokensRedacted: 0 };
  const counters3 = { headersRedacted: 0, tokensRedacted: 0 };

  redactHeaders({ authorization: 'Bearer abc' }, counters1);
  redactHeaders({ Authorization: 'Bearer abc' }, counters2);
  redactHeaders({ AUTHORIZATION: 'Bearer abc' }, counters3);

  assert.strictEqual(counters1.headersRedacted, 1);
  assert.strictEqual(counters2.headersRedacted, 1);
  assert.strictEqual(counters3.headersRedacted, 1);
});

test('redaction: does not redact non-sensitive query params', () => {
  const counters = { headersRedacted: 0, tokensRedacted: 0 };
  const url = 'https://api.example.com/search?q=hello&page=2&sort=desc';

  const redacted = redactUrl(url, counters);

  assert.ok(redacted.includes('q=hello'));
  assert.ok(redacted.includes('page=2'));
  assert.ok(redacted.includes('sort=desc'));
  assert.strictEqual(counters.tokensRedacted, 0);
});

test('redaction: redacts multiple tokens in same text', () => {
  const counters = { headersRedacted: 0, tokensRedacted: 0 };
  const text =
    'Bearer token1 and Bearer token2 and api_key=secret1 and access_token=secret2';

  const redacted = redactTokensInText(text, counters);

  // Escape the REDACTION_PLACEHOLDER for regex matching
  const escapedPlaceholder = REDACTION_PLACEHOLDER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert.strictEqual((redacted.match(new RegExp(escapedPlaceholder, 'g')) || []).length, 4);
  assert.strictEqual(counters.tokensRedacted, 4);
});
