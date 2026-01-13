import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'path';
import { learn } from '../src/verax/learn/index.js';

test('learn produces correct manifest for Vue Router project', async () => {
  const fixtureDir = resolve('./test/fixtures/vue-router-app');
  const manifest = await learn(fixtureDir);
  
  assert.strictEqual(manifest.projectType, 'vue_router', 'Should detect vue_router type');
  
  // Check routes are extracted
  assert.ok(Array.isArray(manifest.routes), 'Should have routes array');
  assert.ok(manifest.routes.length > 0, 'Should extract routes');
  
  const paths = manifest.routes.map(r => r.path).sort();
  assert.ok(paths.includes('/'), 'Should include /');
  assert.ok(paths.includes('/about'), 'Should include /about');
  assert.ok(paths.includes('/users'), 'Should include /users');
  assert.ok(paths.includes('/users/profile'), 'Should include /users/profile');
  
  // Check no dynamic routes
  const hasDynamic = paths.some(p => p.includes(':id'));
  assert.strictEqual(hasDynamic, false, 'Should not include dynamic routes');
});

test('learn produces expectations with sourceRef for Vue Router project', async () => {
  const fixtureDir = resolve('./test/fixtures/vue-router-app');
  const manifest = await learn(fixtureDir);
  
  assert.ok(manifest.staticExpectations, 'Should have staticExpectations');
  assert.ok(Array.isArray(manifest.staticExpectations), 'staticExpectations should be array');
  assert.ok(manifest.staticExpectations.length > 0, 'Should extract navigation expectations');
  
  // All expectations should have sourceRef
  for (const exp of manifest.staticExpectations) {
    assert.ok(exp.sourceRef, `Expectation type ${exp.type} should have sourceRef`);
  }
});

test('learn sets expectationsStatus correctly for Vue Router', async () => {
  const fixtureDir = resolve('./test/fixtures/vue-router-app');
  const manifest = await learn(fixtureDir);
  
  // With navigation promises extracted, should have proven expectations
  assert.strictEqual(
    manifest.expectationsStatus,
    'PROVEN_EXPECTATIONS_AVAILABLE',
    'Should mark expectations as available'
  );
});

test('learn includes route sourceRef in manifest', async () => {
  const fixtureDir = resolve('./test/fixtures/vue-router-app');
  const manifest = await learn(fixtureDir);
  
  // Routes should have sourceRef from router/index.ts
  const routeWithSourceRef = manifest.routes.find(r => r.sourceRef);
  assert.ok(
    routeWithSourceRef,
    'At least one route should have sourceRef'
  );
});
