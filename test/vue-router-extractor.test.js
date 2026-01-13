import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'path';
import { createTSProgram } from '../src/verax/intel/ts-program.js';
import { extractVueRoutes } from '../src/verax/intel/vue-router-extractor.js';

test('extractVueRoutes extracts static routes from Vue Router config', async () => {
  const projectRoot = resolve('./test/fixtures/vue-router-app');
  const program = createTSProgram(projectRoot, { includeJs: true });
  
  assert.ok(!program.error, `TS program should load without error: ${program.error}`);
  
  const routes = extractVueRoutes(projectRoot, program);
  
  assert.ok(Array.isArray(routes), 'Routes should be an array');
  assert.ok(routes.length > 0, 'Should extract at least some routes');
  
  const paths = routes.map(r => r.path).sort();
  
  // Should include static routes
  assert.ok(paths.includes('/'), 'Should include root route /');
  assert.ok(paths.includes('/about'), 'Should include /about route');
  assert.ok(paths.includes('/users'), 'Should include /users route');
  assert.ok(paths.includes('/users/profile'), 'Should include /users/profile nested route');
  
  // Should NOT include dynamic routes
  const hasDynamicRoute = paths.some(p => p.includes(':id'));
  assert.strictEqual(hasDynamicRoute, false, 'Should skip dynamic routes with :id');
});

test('extractVueRoutes includes sourceRef for each route', async () => {
  const projectRoot = resolve('./test/fixtures/vue-router-app');
  const program = createTSProgram(projectRoot, { includeJs: true });
  
  const routes = extractVueRoutes(projectRoot, program);
  
  for (const route of routes) {
    assert.ok(route.sourceRef, `Route ${route.path} should have sourceRef`);
    assert.ok(typeof route.sourceRef === 'string', `sourceRef should be string for ${route.path}`);
    assert.ok(route.sourceRef.includes(':'), `sourceRef should include line number for ${route.path}`);
  }
});

test('extractVueRoutes marks routes as public when not internal patterns', async () => {
  const projectRoot = resolve('./test/fixtures/vue-router-app');
  const program = createTSProgram(projectRoot, { includeJs: true });
  
  const routes = extractVueRoutes(projectRoot, program);
  const publicRoutes = routes.filter(r => r.public);
  
  assert.ok(publicRoutes.length > 0, 'Should have public routes');
  assert.ok(publicRoutes.some(r => r.path === '/'), 'Root should be public');
  assert.ok(publicRoutes.some(r => r.path === '/about'), 'About should be public');
});
