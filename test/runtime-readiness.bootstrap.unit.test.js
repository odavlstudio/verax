import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureRuntimeReady } from '../src/cli/util/observation/runtime-readiness.js';

test('ensureRuntimeReady opt-in triggers installer and succeeds after retry', async () => {
  let checks = 0;
  const readinessCheck = async () => {
    checks += 1;
    if (checks === 1) {
      return { ready: false, reason: 'browser_executable_not_found', message: 'missing' };
    }
    return { ready: true };
  };
  let installerCalled = 0;
  const installer = () => {
    installerCalled += 1;
    return { ok: true };
  };

  const result = await ensureRuntimeReady({ bootstrapBrowser: true, readinessCheck, installer });

  assert.equal(installerCalled, 1, 'installer should be called once');
  assert.equal(result.ready, true, 'runtime should be ready after bootstrap');
  assert.equal(result.attemptedBootstrap, true, 'bootstrap attempt should be recorded');
});

test('ensureRuntimeReady opt-out does not trigger installer', async () => {
  let installerCalled = 0;
  const installer = () => {
    installerCalled += 1;
    return { ok: true };
  };
  const readinessCheck = async () => ({ ready: false, reason: 'browser_executable_not_found' });

  const result = await ensureRuntimeReady({ bootstrapBrowser: false, readinessCheck, installer });

  assert.equal(installerCalled, 0, 'installer should not be called without opt-in');
  assert.equal(result.ready, false, 'runtime remains not ready');
  assert.equal(result.attemptedBootstrap, false, 'no bootstrap attempt recorded');
});
