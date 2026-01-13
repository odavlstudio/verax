import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { resolve, join } from 'path';
import { tmpdir } from 'os';
import { learn } from '../src/verax/learn/index.js';
import { detectProjectType } from '../src/verax/learn/project-detector.js';
import { extractVueRoutes } from '../src/verax/intel/vue-router-extractor.js';
import { extractVueNavigationPromises } from '../src/verax/intel/vue-navigation-extractor.js';
import { createTSProgram } from '../src/verax/intel/ts-program.js';
import { isProvenExpectation } from '../src/verax/shared/expectation-prover.js';

function createTempDir() {
  const tempDir = resolve(tmpdir(), `verax-vue-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

function cleanupTempDir(dir) {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('detectProjectType recognizes Vue + Vue Router project', async () => {
  const tempDir = createTempDir();
  try {
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify({
      dependencies: {
        vue: '^3.0.0',
        'vue-router': '^4.0.0'
      }
    }));
    
    const projectType = await detectProjectType(tempDir);
    
    assert.strictEqual(projectType, 'vue_router');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('detectProjectType recognizes Vue without router', async () => {
  const tempDir = createTempDir();
  try {
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify({
      dependencies: {
        vue: '^3.0.0'
      }
    }));
    
    const projectType = await detectProjectType(tempDir);
    
    assert.strictEqual(projectType, 'vue_spa');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('extractVueRouterRoutes extracts static routes correctly', async () => {
  const fixtureDir = resolve(process.cwd(), 'test', 'fixtures', 'vue-router-app');
  
  if (!existsSync(fixtureDir)) {
    // Skip if fixture doesn't exist
    return;
  }
  
  const program = createTSProgram(fixtureDir, { includeJs: true });
  
  if (program.error) {
    // Skip if program creation fails
    return;
  }
  
  const routes = extractVueRoutes(fixtureDir, program);
  
  // Should extract /, /about, /users, /users/profile
  // Should NOT extract /user/:id (dynamic)
  const paths = routes.map(r => r.path).sort();
  
  assert.ok(paths.includes('/'), 'Should include root route');
  assert.ok(paths.includes('/about'), 'Should include /about route');
  assert.ok(paths.includes('/users'), 'Should include /users route');
  assert.ok(paths.includes('/users/profile'), 'Should include /users/profile nested route');
  assert.ok(!paths.includes('/user/:id'), 'Should NOT include dynamic route /user/:id');
  
  // Check sourceRef exists
  const aboutRoute = routes.find(r => r.path === '/about');
  assert.ok(aboutRoute, 'About route should exist');
  assert.ok(aboutRoute.sourceRef, 'About route should have sourceRef');
  assert.ok(aboutRoute.sourceRef.includes(':'), 'sourceRef should include line number');
});

test('extractVueNavigationPromises extracts navigation from templates and code', async () => {
  const fixtureDir = resolve(process.cwd(), 'test', 'fixtures', 'vue-router-app');
  
  if (!existsSync(fixtureDir)) {
    return;
  }
  
  const program = createTSProgram(fixtureDir, { includeJs: true });
  
  if (program.error) {
    return;
  }
  
  const expectations = await extractVueNavigationPromises(fixtureDir, program);
  
  // Should extract:
  // - <router-link to="/about"> from Home.vue
  // - router.push('/users/profile') from Home.vue script
  // - <RouterLink :to="{ path: '/users/profile' }"> from Users.vue
  
  const targetPaths = expectations.map(e => e.targetPath).sort();
  
  assert.ok(targetPaths.includes('/about'), 'Should extract /about from router-link');
  assert.ok(targetPaths.includes('/users/profile'), 'Should extract /users/profile from router.push and RouterLink');
  
  // All should be PROVEN
  for (const exp of expectations) {
    assert.ok(isProvenExpectation(exp), `Expectation ${exp.targetPath} should be PROVEN`);
    assert.ok(exp.sourceRef, `Expectation ${exp.targetPath} should have sourceRef`);
  }
});

test('learn generates manifest with Vue routes and expectations', async () => {
  const fixtureDir = resolve(process.cwd(), 'test', 'fixtures', 'vue-router-app');
  
  if (!existsSync(fixtureDir)) {
    return;
  }
  
  const manifest = await learn(fixtureDir);
  
  assert.strictEqual(manifest.projectType, 'vue_router');
  assert.ok(manifest.routes.length >= 3, 'Should have at least 3 routes');
  
  const paths = manifest.routes.map(r => r.path).sort();
  assert.ok(paths.includes('/'), 'Should include root route');
  assert.ok(paths.includes('/about'), 'Should include /about route');
  assert.ok(paths.includes('/users'), 'Should include /users route');
  assert.ok(paths.includes('/users/profile'), 'Should include /users/profile nested route');
  
  // Check expectations
  if (manifest.staticExpectations && manifest.staticExpectations.length > 0) {
    const navExpectations = manifest.staticExpectations.filter(e => e.type === 'spa_navigation');
    assert.ok(navExpectations.length > 0, 'Should have navigation expectations');
    
    const targetPaths = navExpectations.map(e => e.targetPath);
    assert.ok(targetPaths.includes('/about') || targetPaths.includes('/users/profile'), 
      'Should have at least one navigation expectation');
    
    // All should be PROVEN
    for (const exp of navExpectations) {
      assert.ok(isProvenExpectation(exp), `Expectation ${exp.targetPath} should be PROVEN`);
    }
  }
  
  assert.ok(existsSync(manifest.manifestPath), 'Manifest file should exist');
  
  const manifestContent = JSON.parse(readFileSync(manifest.manifestPath, 'utf-8'));
  assert.strictEqual(manifestContent.projectType, 'vue_router');
  assert.ok(Array.isArray(manifestContent.routes));
});

test('learn excludes dynamic routes from manifest', async () => {
  const fixtureDir = resolve(process.cwd(), 'test', 'fixtures', 'vue-router-app');
  
  if (!existsSync(fixtureDir)) {
    return;
  }
  
  const manifest = await learn(fixtureDir);
  
  const paths = manifest.routes.map(r => r.path);
  const hasDynamicRoute = paths.some(p => p.includes(':') || p.includes('*'));
  
  assert.strictEqual(hasDynamicRoute, false, 'Should not include dynamic routes in manifest');
});

