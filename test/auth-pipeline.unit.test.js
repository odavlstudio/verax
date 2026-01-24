import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildAuthContextOptions, applyAuth } from '../src/cli/util/auth/auth-applier.js';
import { enforceStrictAuth, markAuthRequiredIfNeeded } from '../src/cli/util/observation/observation-engine.js';
import { loadAuthCookiesSource } from '../src/cli/util/auth/auth-utils.js';

test('buildAuthContextOptions applies storageState to context options', () => {
  const dir = mkdtempSync(join(tmpdir(), 'verax-auth-'));
  const storagePath = join(dir, 'storage.json');
  writeFileSync(storagePath, JSON.stringify({ cookies: [{ name: 'sid', value: '123', domain: 'example.com', path: '/' }] }));

  const { contextOptions, authResult } = buildAuthContextOptions({ authStorage: storagePath });
  assert.ok(contextOptions.storageState, 'storageState should be present');
  assert.equal(authResult.applied, true);
  assert.ok(authResult.methods.includes('storageState'));
  assert.ok(authResult.redacted.storageState);
  assert.equal(authResult.redacted.cookies.length, 1);
});

test('buildAuthContextOptions redacts sensitive headers', () => {
  const { contextOptions, authResult } = buildAuthContextOptions({ authHeaders: ['Authorization: Bearer token123'] });
  assert.equal(contextOptions.extraHTTPHeaders.Authorization, 'Bearer token123');
  assert.equal(authResult.applied, true);
  assert.ok(authResult.redacted.headers.length > 0);
  assert.equal(authResult.redacted.headers[0].value, '***REDACTED***');
});

test('applyAuth accepts cookies from inline and file sources', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'verax-auth-'));
  const cookieFile = join(dir, 'cookies.json');
  writeFileSync(cookieFile, JSON.stringify([{ name: 'filecookie', value: 'abc', domain: 'example.com', path: '/' }]));

  const inline = JSON.stringify([{ name: 'inlinecookie', value: 'xyz', domain: 'example.com', path: '/' }]);
  const fileCookies = loadAuthCookiesSource(cookieFile, dir).cookies;
  const inlineCookies = loadAuthCookiesSource(inline, dir).cookies;

  let appliedCookies = [];
  const mockContext = {
    addCookies: async (cookies) => {
      appliedCookies = cookies;
    }
  };

  const authConfig = {
    authMode: 'auto',
    authCookies: [...fileCookies, ...inlineCookies],
  };

  const result = await applyAuth(mockContext, {}, authConfig);
  assert.equal(result.applied, true);
  assert.equal(appliedCookies.length, 2);
  assert.ok(result.methods.includes('cookies'));
});

test('strict auth mode throws when verification is ineffective', () => {
  assert.throws(() => enforceStrictAuth('strict', { verification: { effective: 'no', signals: { httpStatus: 401 } } }), /INFRA_AUTH_INEFFECTIVE/);
});

test('auto mode marks auth_required skip reason when auth fails', () => {
  const observation = { attempted: true, observed: false, reason: 'outcome-not-met' };
  markAuthRequiredIfNeeded(observation, { verification: { effective: 'no' } });
  assert.equal(observation.reason, 'auth_required');
});
