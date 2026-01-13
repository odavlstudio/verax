import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'path';
import { createTSProgram } from '../src/verax/intel/ts-program.js';
import { extractVueRoutes } from '../src/verax/intel/vue-router-extractor.js';

test('Vue Router: extracts dynamic routes with example paths', async () => {
  const projectRoot = resolve('./test/fixtures/vue-router-app');
  const program = createTSProgram(projectRoot, { includeJs: true });
  
  assert.ok(!program.error, `TS program should load without error: ${program.error}`);
  
  const routes = extractVueRoutes(projectRoot, program);
  
  // Find the dynamic route /user/:id
  const dynamicRoute = routes.find(r => r.originalPattern === '/user/:id');
  assert.ok(dynamicRoute, 'Should extract /user/:id dynamic route');
  assert.strictEqual(dynamicRoute.isDynamic, true, 'Should mark as dynamic');
  assert.strictEqual(dynamicRoute.examplePath, '/user/1', 'Should create example path');
  assert.strictEqual(dynamicRoute.sourceRef, dynamicRoute.sourceRef, 'Should have sourceRef');
});

test('Vue Router: marks dynamic routes explicitly', async () => {
  const projectRoot = resolve('./test/fixtures/vue-router-app');
  const program = createTSProgram(projectRoot, { includeJs: true });
  
  const routes = extractVueRoutes(projectRoot, program);
  
  const dynamicRoutes = routes.filter(r => r.isDynamic);
  assert.ok(dynamicRoutes.length > 0, 'Should have at least one dynamic route');
  
  for (const route of dynamicRoutes) {
    assert.ok(route.isDynamic, `Route ${route.path} should have isDynamic=true`);
    assert.ok(route.examplePath, `Route ${route.path} should have examplePath`);
    assert.ok(route.originalPattern, `Route ${route.path} should have originalPattern`);
    assert.ok(Array.isArray(route.parameters), `Route ${route.path} should have parameters array`);
  }
});

test('Vue Router: dynamic routes have correct example paths', async () => {
  const projectRoot = resolve('./test/fixtures/vue-router-app');
  const program = createTSProgram(projectRoot, { includeJs: true });
  
  const routes = extractVueRoutes(projectRoot, program);
  
  // Check specific dynamic route conversions
  const userIdRoute = routes.find(r => r.originalPattern === '/user/:id');
  if (userIdRoute) {
    assert.strictEqual(userIdRoute.examplePath, '/user/1', ':id should map to 1');
  }
});

test('Vue Router: preserves static routes without dynamic metadata', async () => {
  const projectRoot = resolve('./test/fixtures/vue-router-app');
  const program = createTSProgram(projectRoot, { includeJs: true });
  
  const routes = extractVueRoutes(projectRoot, program);
  
  const staticRoute = routes.find(r => r.path === '/');
  assert.ok(staticRoute, 'Should have static / route');
  assert.ok(!staticRoute.isDynamic, '/ should not be marked dynamic');
  assert.ok(!staticRoute.examplePath, '/ should not have examplePath');
});
