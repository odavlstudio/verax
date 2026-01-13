import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'path';
import { createTSProgram } from '../src/verax/intel/ts-program.js';
import { extractVueNavigationPromises } from '../src/verax/intel/vue-navigation-extractor.js';
import { isProvenExpectation } from '../src/verax/shared/expectation-prover.js';

test('extractVueNavigationPromises extracts <router-link to="/path"> promises', async () => {
  const projectRoot = resolve('./test/fixtures/vue-router-app');
  const program = createTSProgram(projectRoot, { includeJs: true });
  
  assert.ok(!program.error, `TS program should load without error: ${program.error}`);
  
  const expectations = await extractVueNavigationPromises(projectRoot, program);
  
  assert.ok(Array.isArray(expectations), 'Should return array of expectations');
  assert.ok(expectations.length > 0, 'Should extract at least some navigation promises');
  
  // Check for /about navigation (from router-link in Home.vue)
  const aboutNav = expectations.find(e => e.targetPath === '/about');
  assert.ok(aboutNav, 'Should extract /about navigation promise from router-link');
  assert.strictEqual(aboutNav.type, 'spa_navigation', 'Should be spa_navigation type');
  assert.strictEqual(aboutNav.proof, 'PROVEN_EXPECTATION', 'Should be PROVEN');
});

test('extractVueNavigationPromises extracts router.push() calls', async () => {
  const projectRoot = resolve('./test/fixtures/vue-router-app');
  const program = createTSProgram(projectRoot, { includeJs: true });
  
  const expectations = await extractVueNavigationPromises(projectRoot, program);
  
  // Check for /users/profile navigation (from router.push in Home.vue)
  const usersProfileNav = expectations.find(e => e.targetPath === '/users/profile');
  assert.ok(usersProfileNav, 'Should extract /users/profile navigation from router.push()');
});

test('extractVueNavigationPromises skips dynamic route targets', async () => {
  const projectRoot = resolve('./test/fixtures/vue-router-app');
  const program = createTSProgram(projectRoot, { includeJs: true });
  
  const expectations = await extractVueNavigationPromises(projectRoot, program);
  
  // Should NOT include any expectations with dynamic parts
  const hasDynamic = expectations.some(e => e.targetPath.includes(':') || e.targetPath.includes('{'));
  assert.strictEqual(hasDynamic, false, 'Should skip dynamic routes');
});

test('extractVueNavigationPromises all expectations are PROVEN', async () => {
  const projectRoot = resolve('./test/fixtures/vue-router-app');
  const program = createTSProgram(projectRoot, { includeJs: true });
  
  const expectations = await extractVueNavigationPromises(projectRoot, program);
  
  for (const exp of expectations) {
    assert.ok(
      isProvenExpectation(exp),
      `Expectation for ${exp.targetPath} should be proven: ${JSON.stringify(exp)}`
    );
  }
});

test('extractVueNavigationPromises includes sourceRef metadata', async () => {
  const projectRoot = resolve('./test/fixtures/vue-router-app');
  const program = createTSProgram(projectRoot, { includeJs: true });
  
  const expectations = await extractVueNavigationPromises(projectRoot, program);
  
  for (const exp of expectations) {
    assert.ok(exp.sourceRef, `Expectation ${exp.targetPath} should have sourceRef`);
    assert.strictEqual(
      typeof exp.sourceRef,
      'string',
      `sourceRef should be string for ${exp.targetPath}`
    );
    assert.ok(
      exp.sourceRef.includes(':'),
      `sourceRef should include line number for ${exp.targetPath}`
    );
  }
});

test('extractVueNavigationPromises includes navigation method for programmatic calls', async () => {
  const projectRoot = resolve('./test/fixtures/vue-router-app');
  const program = createTSProgram(projectRoot, { includeJs: true });
  
  const expectations = await extractVueNavigationPromises(projectRoot, program);
  
  // router.push/replace calls should have navigationMethod
  const programmaticNavs = expectations.filter(e => e.metadata?.handlerName?.includes('router.'));
  for (const exp of programmaticNavs) {
    assert.ok(
      exp.navigationMethod === 'push' || exp.navigationMethod === 'replace',
      `Programmatic navigation ${exp.targetPath} should have navigationMethod push or replace`
    );
  }
});
