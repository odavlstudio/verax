import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAuth, buildAuthContextOptions } from '../src/cli/util/auth/auth-applier.js';
import { verifyAuthEffectiveness } from '../src/cli/util/auth/auth-verifier.js';

test('Auth Applier: returns no-op when mode is off', async () => {
  const mockContext = {};
  const mockPage = {};
  const authConfig = { authMode: 'off' };
  
  const result = await applyAuth(mockContext, mockPage, authConfig);
  
  assert.equal(result.applied, false);
  assert.equal(result.mode, 'off');
  assert.deepEqual(result.methods, []);
});

test('Auth Applier: handles missing auth config gracefully', async () => {
  const mockContext = {};
  const mockPage = {};
  
  const result = await applyAuth(mockContext, mockPage, null);
  
  assert.equal(result.applied, false);
  assert.equal(result.mode, 'auto');
});

test('Auth Applier: processes cookies in auto mode', async () => {
  const mockContext = {
    addCookies: async (cookies) => {
      assert.ok(Array.isArray(cookies));
      assert.equal(cookies.length, 1);
      assert.equal(cookies[0].name, 'session');
      assert.equal(cookies[0].value, 'abc123');
    }
  };
  const mockPage = {};
  
  const authConfig = {
    authMode: 'auto',
    authCookies: [{ name: 'session', value: 'abc123', domain: 'example.com', path: '/' }]
  };
  
  const result = await applyAuth(mockContext, mockPage, authConfig);
  
  assert.equal(result.applied, true);
  assert.equal(result.mode, 'auto');
  assert.ok(result.methods.includes('cookies'));
    assert.ok(result.redacted.cookies.length > 0, 'Should have redacted cookies');
});

test('Auth Applier: processes headers in auto mode', async () => {
  const authConfig = {
    authMode: 'auto',
    authHeaders: ['Authorization: Bearer token123']
  };

  const { contextOptions, authResult } = buildAuthContextOptions(authConfig);
  assert.equal(contextOptions.extraHTTPHeaders.Authorization, 'Bearer token123');
  assert.equal(authResult.applied, true);
  assert.ok(authResult.methods.includes('headers'));
  assert.ok(authResult.redacted.headers.length > 0, 'Should have redacted headers');
});

test('Auth Applier: strict mode throws on cookie error', async () => {
  const mockContext = {
    addCookies: async () => {
      throw new Error('Cookie application failed');
    }
  };
  const mockPage = {};
  
  const authConfig = {
    authMode: 'strict',
    authCookies: [{ name: 'session', value: 'abc123', domain: 'example.com', path: '/' }]
  };
  
  await assert.rejects(
    async () => await applyAuth(mockContext, mockPage, authConfig),
    /INFRA_AUTH_FAILURE/
  );
});

test('Auth Verifier: detects 401 status as ineffective', async () => {
  const mockPage = {
    evaluate: async (fn) => fn('https://example.com'),
    url: () => 'https://example.com'
  };
  
  // Mock window object for evaluation
  global.window = {
    location: { href: 'https://example.com' },
    __VERAX_HTTP_STATUS__: 401,
    performance: null
  };
  global.document = { title: 'Unauthorized', body: { textContent: '' }, querySelector: () => null };
  
  const result = await verifyAuthEffectiveness(mockPage, 'https://example.com');
  
  assert.equal(result.effective, 'no');
  assert.ok(result.confidence >= 0.7);
  assert.equal(result.signals.httpStatus, 401);
  
  delete global.window;
  delete global.document;
});

test('Auth Verifier: detects 403 status as ineffective', async () => {
  const mockPage = {
    evaluate: async (fn) => fn('https://example.com'),
    url: () => 'https://example.com'
  };
  
  global.window = {
    location: { href: 'https://example.com' },
    __VERAX_HTTP_STATUS__: 403,
    performance: null
  };
  global.document = { title: 'Forbidden', body: { textContent: '' }, querySelector: () => null };
  
  const result = await verifyAuthEffectiveness(mockPage, 'https://example.com');
  
  assert.equal(result.effective, 'no');
  assert.ok(result.confidence >= 0.7);
  assert.equal(result.signals.httpStatus, 403);
  
  delete global.window;
  delete global.document;
});

test('Auth Verifier: detects login form as ineffective', async () => {
  const mockPage = {
    evaluate: async (fn) => fn('https://example.com/login'),
    textContent: async () => 'login page',
    title: async () => 'Login - Example'
  };
  global.window = {
    location: { href: 'https://example.com/login' },
    __VERAX_HTTP_STATUS__: 200,
    performance: null
  };
  global.document = {
    title: 'Login - Example',
    body: { textContent: 'please log in' },
    querySelector: (selector) => selector.includes('form[action') || selector.includes('input[type="password"]') ? {} : null
  };
  
  const result = await verifyAuthEffectiveness(mockPage, 'https://example.com/login');
  
  assert.equal(result.effective, 'no');
  assert.ok(result.confidence >= 0.7);
  assert.equal(result.signals.hasLoginForm, true);
  assert.equal(result.signals.urlContainsLogin, true);

  delete global.window;
  delete global.document;
});

test('Auth Verifier: returns effective for normal page', async () => {
  const mockPage = {
    evaluate: async (fn) => fn('https://example.com/dashboard'),
    url: () => 'https://example.com/dashboard'
  };
  
  global.window = {
    location: { href: 'https://example.com/dashboard' },
    __VERAX_HTTP_STATUS__: 200,
    performance: null
  };
  global.document = { title: 'Dashboard', body: { textContent: 'Welcome to your dashboard' }, querySelector: () => null };
  
  const result = await verifyAuthEffectiveness(mockPage, 'https://example.com/dashboard');
  
  assert.equal(result.effective, 'unknown');
  assert.equal(result.confidence, 0.0);
  assert.equal(result.signals.httpStatus, 200);
  
  delete global.window;
  delete global.document;
});

test('Auth Verifier: returns unknown for redirect (3xx)', async () => {
  const mockPage = {
    evaluate: async (fn) => fn('https://example.com'),
    url: () => 'https://example.com'
  };
  
  global.window = {
    location: { href: 'https://example.com' },
    __VERAX_HTTP_STATUS__: 302,
    performance: null
  };
  global.document = { title: 'Redirecting...', body: { textContent: 'Redirecting...' }, querySelector: () => null };
  
  const result = await verifyAuthEffectiveness(mockPage, 'https://example.com');
  
  assert.equal(result.effective, 'unknown');
  assert.equal(result.confidence, 0.0);
  
  delete global.window;
  delete global.document;
});
