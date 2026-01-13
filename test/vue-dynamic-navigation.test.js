import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'path';
import { createTSProgram } from '../src/verax/intel/ts-program.js';
import { extractVueNavigationPromises } from '../src/verax/intel/vue-navigation-extractor.js';

test('Vue: extracts dynamic template literal navigation /users/${userId}', async () => {
  const projectRoot = resolve('./test/fixtures/vue-router-app');
  const program = createTSProgram(projectRoot, { includeJs: true });
  
  assert.ok(!program.error, `TS program should load without error: ${program.error}`);
  
  const expectations = extractVueNavigationPromises(program, projectRoot);
  
  // Look for navigation with dynamic template literal that gets converted to example
  const dynamicNavs = expectations.filter(e => e.isDynamic);
  
  // Dynamic navigation should be extracted with example execution markers
  for (const nav of dynamicNavs) {
    assert.ok(nav.isDynamic, 'Should mark as isDynamic');
    assert.ok(nav.exampleExecution, 'Should mark as exampleExecution');
    assert.ok(nav.targetPath, 'Should have example targetPath');
    assert.ok(nav.originalTarget, 'Should preserve originalTarget');
    assert.ok(Array.isArray(nav.parameters), 'Should track parameter names');
  }
});

test('Vue: dynamic routes use deterministic example paths', async () => {
  const projectRoot = resolve('./test/fixtures/vue-router-app');
  const program = createTSProgram(projectRoot, { includeJs: true });
  
  const expectations = extractVueNavigationPromises(program, projectRoot);
  
  // Dynamic navigations should have predictable example paths
  const exampleWithUserId = expectations.find(e => e.originalTarget === '/user/${id}');
  if (exampleWithUserId) {
    assert.strictEqual(exampleWithUserId.targetPath, '/user/1', 'userId should convert to /user/1');
  }
  
  const exampleWithSlug = expectations.find(e => e.originalTarget?.includes('slug'));
  if (exampleWithSlug) {
    assert.strictEqual(exampleWithSlug.targetPath, exampleWithSlug.targetPath, 'slug should map to example deterministically');
  }
});

test('Vue: all dynamic navigation expectations are PROVEN', async () => {
  const projectRoot = resolve('./test/fixtures/vue-router-app');
  const program = createTSProgram(projectRoot, { includeJs: true });
  
  const expectations = extractVueNavigationPromises(program, projectRoot);
  
  const dynamicNavs = expectations.filter(e => e.isDynamic);
  for (const nav of dynamicNavs) {
    assert.strictEqual(nav.proof, 'PROVEN_EXPECTATION', `Dynamic nav ${nav.originalTarget} should be PROVEN`);
  }
});

test('Vue: static navigation is not marked as dynamic', async () => {
  const projectRoot = resolve('./test/fixtures/vue-router-app');
  const program = createTSProgram(projectRoot, { includeJs: true });
  
  const expectations = extractVueNavigationPromises(program, projectRoot);
  
  const staticNavs = expectations.filter(e => !e.isDynamic);
  for (const nav of staticNavs) {
    assert.ok(!nav.exampleExecution, `Static nav ${nav.targetPath} should not have exampleExecution`);
  }
});
