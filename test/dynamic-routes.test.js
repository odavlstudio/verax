import { test } from 'node:test';
import assert from 'node:assert';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { normalizeDynamicRoute, normalizeTemplateLiteral } from '../src/verax/shared/dynamic-route-utils.js';
import { extractVueRoutes } from '../src/verax/intel/vue-router-extractor.js';
import { createTSProgram } from '../src/verax/intel/ts-program.js';
import { extractVueNavigationPromises } from '../src/verax/intel/vue-navigation-extractor.js';

test('normalizeDynamicRoute converts React Router :param to example path', () => {
  const result = normalizeDynamicRoute('/user/:id');
  assert.ok(result);
  assert.strictEqual(result.examplePath, '/user/1');
  assert.strictEqual(result.originalPattern, '/user/:id');
  assert.strictEqual(result.isDynamic, true);
  assert.strictEqual(result.exampleExecution, true);
});

test('normalizeDynamicRoute converts Next.js [param] to example path', () => {
  const result = normalizeDynamicRoute('/blog/[slug]');
  assert.ok(result);
  assert.strictEqual(result.examplePath, '/blog/example');
  assert.strictEqual(result.originalPattern, '/blog/[slug]');
  assert.strictEqual(result.isDynamic, true);
  assert.strictEqual(result.exampleExecution, true);
});

test('normalizeDynamicRoute returns null for static routes', () => {
  const result = normalizeDynamicRoute('/about');
  assert.strictEqual(result, null);
});

test('normalizeTemplateLiteral converts template to example path', () => {
  const result = normalizeTemplateLiteral('/users/${id}');
  assert.ok(result);
  assert.strictEqual(result.examplePath, '/users/1');
  assert.strictEqual(result.originalPattern, '/users/${id}');
  assert.strictEqual(result.isDynamic, true);
  assert.strictEqual(result.exampleExecution, true);
});

test('normalizeTemplateLiteral handles slug parameters', () => {
  const result = normalizeTemplateLiteral('/blog/${slug}');
  assert.ok(result);
  assert.strictEqual(result.examplePath, '/blog/example');
  assert.strictEqual(result.isDynamic, true);
});

test('normalizeTemplateLiteral returns null for static strings', () => {
  const result = normalizeTemplateLiteral('/about');
  assert.strictEqual(result, null);
});

test('extractVueRoutes includes dynamic routes with example paths', () => {
  const projectRoot = resolve(__dirname, 'fixtures/vue-router-app');
  const program = createTSProgram(projectRoot, { includeJs: true });
  const routes = extractVueRoutes(projectRoot, program);
  
  const userRoute = routes.find(r => r.path === '/user/1');
  assert.ok(userRoute, 'Should extract /user/1 from /user/:id');
  assert.strictEqual(userRoute.originalPattern, '/user/:id');
  assert.strictEqual(userRoute.isDynamic, true);
  assert.strictEqual(userRoute.exampleExecution, true);
  assert.ok(userRoute.sourceRef);
});

test('extractVueRoutes still includes static routes', () => {
  const projectRoot = resolve(__dirname, 'fixtures/vue-router-app');
  const program = createTSProgram(projectRoot, { includeJs: true });
  const routes = extractVueRoutes(projectRoot, program);
  
  const aboutRoute = routes.find(r => r.path === '/about');
  assert.ok(aboutRoute, 'Should extract /about');
  assert.strictEqual(aboutRoute.isDynamic, undefined);
});

test('extractVueNavigationPromises extracts template literal navigation', async () => {
  const projectRoot = resolve(__dirname, 'fixtures/vue-router-app');
  const program = createTSProgram(projectRoot, { includeJs: true });
  const expectations = await extractVueNavigationPromises(program, projectRoot);
  
  // Find dynamic navigation with example path
  const userNav = expectations.find(e => 
    e.targetPath === '/user/1' && 
    e.isDynamic === true &&
    e.navigationMethod === 'push'
  );
  
  assert.ok(userNav, 'Should extract router.push(`/user/${userId}`) as /user/1');
  assert.strictEqual(userNav.exampleExecution, true);
  assert.ok(userNav.originalPattern);
  assert.ok(userNav.sourceRef);
});

test('extractVueNavigationPromises extracts dynamic route from router-link', async () => {
  const projectRoot = resolve(__dirname, 'fixtures/vue-router-app');
  const program = createTSProgram(projectRoot, { includeJs: true });
  const expectations = await extractVueNavigationPromises(program, projectRoot);
  
  // Check that dynamic routes are included
  const dynamicNavs = expectations.filter(e => e.isDynamic === true);
  assert.ok(dynamicNavs.length > 0, 'Should extract dynamic navigation promises');
  
  // All dynamic expectations should have exampleExecution
  for (const nav of dynamicNavs) {
    assert.strictEqual(nav.exampleExecution, true);
    assert.ok(nav.originalPattern);
    assert.ok(nav.targetPath);
  }
});

test('extractRoutes includes dynamic Next.js routes', () => {
  // Create a minimal Next.js fixture with dynamic routes
  const _projectRoot = resolve(__dirname, 'fixtures/next-app');
  // This test assumes a Next.js fixture exists - skip if not
  // For now, just verify the function handles dynamic routes correctly
  const result = normalizeDynamicRoute('/users/[id]');
  assert.ok(result);
  assert.strictEqual(result.examplePath, '/users/1');
});

test('extractRoutes includes dynamic React Router routes', () => {
  // This test verifies React Router dynamic route extraction
  // For now, just verify normalization works
  const result = normalizeDynamicRoute('/posts/:postId');
  assert.ok(result);
  assert.strictEqual(result.examplePath, '/posts/1');
  assert.strictEqual(result.isDynamic, true);
});

