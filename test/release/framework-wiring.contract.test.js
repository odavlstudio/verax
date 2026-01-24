import test from 'node:test';
import assert from 'node:assert';
import { resolve } from 'path';
import { extractExpectations } from '../../src/cli/util/observation/expectation-extractor.js';
import { discoverProject } from '../../src/cli/util/config/project-discovery.js';
import { getTimeProvider } from '../../src/cli/util/support/time-provider.js';


// Test Vue Framework
test('Vue Framework - Detection and Extraction', async () => {
  const fixturePath = resolve(process.cwd(), 'test/release/fixtures/vue-framework');
  
  // 1. Detect framework
  const profile = await discoverProject(fixturePath);
  assert.strictEqual(profile.framework, 'vue', 'Should detect Vue framework');
  
  // 2. Extract expectations
  const result = await extractExpectations(profile, fixturePath);
  const navExpectations = result.expectations.filter(e => e.promise.kind === 'navigation');
  const _formExpectations = result.expectations.filter(e => e.promise.kind === 'form-submission');
  
  // Should find:
  // - <router-link to="/about">
  // - <router-link to="/contact">
  // - this.$router.push("/contact") in script
  // - <form action="/submit-form">
  
  assert.ok(navExpectations.length >= 2, `Should extract at least 2 navigation routes, got ${navExpectations.length}`);
  
  // Check for specific routes
  const routes = navExpectations.map(e => e.promise.value);
  assert.ok(routes.includes('/about'), 'Should include /about route');
  assert.ok(routes.includes('/contact'), 'Should include /contact route');
  
  // Verify deterministic IDs
  const id1 = result.expectations[0].id;
  assert.ok(id1, 'Should have deterministic ID');
  assert.strictEqual(typeof id1, 'string', 'ID should be string');
  assert.ok(id1.length > 0, 'ID should not be empty');
  
  // Verify no timestamps in IDs (for determinism)
  const year = getTimeProvider().date().getFullYear().toString();
  assert.ok(!id1.includes(year), 'ID should not contain year');
});

// Test Angular Framework
test('Angular Framework - Detection and Extraction', async () => {
  const fixturePath = resolve(process.cwd(), 'test/release/fixtures/angular-framework');
  
  // 1. Detect framework
  const profile = await discoverProject(fixturePath);
  assert.strictEqual(profile.framework, 'angular', 'Should detect Angular framework');
  
  // 2. Extract expectations
  const result = await extractExpectations(profile, fixturePath);
  const navExpectations = result.expectations.filter(e => e.promise.kind === 'navigation');
  const _formExpectations = result.expectations.filter(e => e.promise.kind === 'form-submission');
  
  // Should find:
  // - [routerLink]="'/about'"
  // - routerLink="/contact"
  // - this.router.navigate(['/about']) in component
  // - this.router.navigateByUrl('/contact') in component
  // - <form action="/submit-form">
  
  assert.ok(navExpectations.length >= 2, `Should extract at least 2 navigation routes, got ${navExpectations.length}`);
  
  // Check for specific routes
  const routes = navExpectations.map(e => e.promise.value);
  assert.ok(routes.includes('/about'), 'Should include /about route');
  assert.ok(routes.includes('/contact'), 'Should include /contact route');
});

// Test SvelteKit Framework
test('SvelteKit Framework - Detection and Extraction', async () => {
  const fixturePath = resolve(process.cwd(), 'test/release/fixtures/sveltekit-framework');
  
  // 1. Detect framework
  const profile = await discoverProject(fixturePath);
  assert.strictEqual(profile.framework, 'sveltekit', 'Should detect SvelteKit framework');
  
  // 2. Extract expectations
  const result = await extractExpectations(profile, fixturePath);
  const navExpectations = result.expectations.filter(e => e.promise.kind === 'navigation');
  
  // Should find:
  // - <a href="/about">
  // - <a href="/contact">
  // - goto('/about') in script
  // - goto('/contact') in script
  
  assert.ok(navExpectations.length >= 2, `Should extract at least 2 navigation routes, got ${navExpectations.length}`);
  
  // Check for specific routes
  const routes = navExpectations.map(e => e.promise.value);
  assert.ok(routes.includes('/about'), 'Should include /about route');
  assert.ok(routes.includes('/contact'), 'Should include /contact route');
});

// Test Determinism
test('Framework Extraction - Deterministic Output', async () => {
  const fixturePath = resolve(process.cwd(), 'test/release/fixtures/vue-framework');
  const profile = await discoverProject(fixturePath);
  
  // Extract twice
  const result1 = await extractExpectations(profile, fixturePath);
  const result2 = await extractExpectations(profile, fixturePath);
  
  // Should have same expectations count
  assert.strictEqual(result1.expectations.length, result2.expectations.length, 'Should have consistent extraction count');
  
  // Should have same IDs
  for (let i = 0; i < result1.expectations.length; i++) {
    assert.strictEqual(result1.expectations[i].id, result2.expectations[i].id, `Expectation ${i} should have stable ID`);
  }
  
  // Should have same order
  for (let i = 0; i < result1.expectations.length; i++) {
    assert.strictEqual(result1.expectations[i].promise.value, result2.expectations[i].promise.value, `Expectation ${i} should have same order`);
  }
});
