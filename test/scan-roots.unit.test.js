/**
 * Unit tests for scan-roots module
 * Tests framework-aware scan root detection
 */

import { strict as assert } from 'assert';
import { detectScanRoots, resolveScanConfig, rootsToGlobPatterns, HARD_EXCLUSIONS, resolveProjectBase } from '../src/verax/learn/scan-roots.js';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { generateTempDirName } from './support/test-id-provider.js';

const TEST_ROOT = join(tmpdir(), generateTempDirName('scan-roots-test'));

function setup() {
  mkdirSync(TEST_ROOT, { recursive: true });
}

function teardown() {
  try {
    rmSync(TEST_ROOT, { recursive: true, force: true });
  } catch (e) {
    // Ignore cleanup errors
  }
}

function createProjectStructure(dirs = [], files = []) {
  for (const dir of dirs) {
    mkdirSync(join(TEST_ROOT, dir), { recursive: true });
  }
  for (const file of files) {
    const filePath = join(TEST_ROOT, file);
    const dirPath = join(filePath, '..');
    mkdirSync(dirPath, { recursive: true });
    writeFileSync(filePath, '// test file', 'utf-8');
  }
}

console.log('Testing scan-roots module...');

// Test 1: Next.js app router detection
setup();
createProjectStructure(['app', 'app/dashboard'], ['app/page.tsx', 'app/dashboard/page.tsx']);
const nextAppResult = detectScanRoots(TEST_ROOT, 'nextjs');
assert.deepEqual(nextAppResult.roots, ['app']); // Only 'app' exists, not components/lib/src
assert.ok(nextAppResult.excludes.includes('node_modules/**'));
console.log('✓ Test 1: Next.js app router detection');
teardown();

// Test 2: Next.js pages router detection
setup();
createProjectStructure(['pages'], ['pages/index.tsx', 'pages/about.tsx']);
const nextPagesResult = detectScanRoots(TEST_ROOT, 'nextjs');
assert.deepEqual(nextPagesResult.roots, ['pages']); // Only 'pages' exists
console.log('✓ Test 2: Next.js pages router detection');
teardown();

// Test 3: React SPA detection
setup();
createProjectStructure(['src'], ['src/App.tsx', 'src/index.tsx']);
const reactResult = detectScanRoots(TEST_ROOT, 'react');
assert.deepEqual(reactResult.roots, ['src']);
console.log('✓ Test 3: React SPA detection');
teardown();

// Test 4: Static site detection (public/ only)
setup();
createProjectStructure(['public'], ['public/index.html', 'public/about.html']);
const staticResult = detectScanRoots(TEST_ROOT, 'static');
assert.deepEqual(staticResult.roots, ['public']);
console.log('✓ Test 4: Static site detection (public/ only)');
teardown();

// Test 5: rootsToGlobPatterns conversion
const patterns = rootsToGlobPatterns(['src', 'app'], '*.{js,ts}');
assert.deepEqual(patterns, ['src/**/*.{js,ts}', 'app/**/*.{js,ts}']);
console.log('✓ Test 5: Glob patterns conversion');

// Test 6: User override with learnPaths
const overrideResult = resolveScanConfig(TEST_ROOT, 'react', { learnPaths: ['custom', 'paths'] });
assert.deepEqual(overrideResult.roots, ['custom', 'paths']);
console.log('✓ Test 6: User override with learnPaths');

// Test 7: HARD_EXCLUSIONS includes critical paths
assert.ok(HARD_EXCLUSIONS.includes('node_modules/**'), 'Should exclude node_modules');
assert.ok(HARD_EXCLUSIONS.includes('dist/**'), 'Should exclude dist');
assert.ok(HARD_EXCLUSIONS.includes('build/**'), 'Should exclude build');
assert.ok(HARD_EXCLUSIONS.includes('.next/**'), 'Should exclude .next');
assert.ok(HARD_EXCLUSIONS.includes('.verax/**'), 'Should exclude .verax');
console.log('✓ Test 7: HARD_EXCLUSIONS coverage');

// Test 8: Unknown project type with no src/ returns empty roots
setup();
const unknownResult = detectScanRoots(TEST_ROOT, 'unknown');
assert.deepEqual(unknownResult.roots, []);
console.log('✓ Test 8: Unknown project type returns empty roots');
teardown();

// Test 9: ERROR THROWN when no roots found (default behavior)
setup();
let errorThrown = false;
try {
  resolveScanConfig(TEST_ROOT, 'unknown', {});
} catch (error) {
  errorThrown = true;
  assert.ok(error.message.includes('could not determine any source directories'));
  assert.ok(error.message.includes('--learn-paths'));
}
assert.ok(errorThrown, 'Should throw error when no roots found');
console.log('✓ Test 9: Error thrown when no roots found (default)');
teardown();

// Test 10: allowEmptyLearn bypasses error
setup();
const emptyResult = resolveScanConfig(TEST_ROOT, 'unknown', { allowEmptyLearn: true });
assert.deepEqual(emptyResult.roots, []);
console.log('✓ Test 10: allowEmptyLearn bypasses error');
teardown();

// Test 11: Static site with no public/ dir throws error
setup();
let staticErrorThrown = false;
try {
  resolveScanConfig(TEST_ROOT, 'static', {});
} catch (error) {
  staticErrorThrown = true;
  assert.ok(error.message.includes('could not determine any source directories'));
}
assert.ok(staticErrorThrown, 'Static site with no public/ should throw error');
console.log('✓ Test 11: Static site with no public/ throws error');
teardown();

// Test 12: projectSubdir must stay within root and contain marker
setup();
createProjectStructure(['apps/web'], ['apps/web/package.json']);
const baseDir = resolveProjectBase(TEST_ROOT, 'apps/web');
assert.equal(baseDir, join(TEST_ROOT, 'apps', 'web'));
console.log('✓ Test 12: projectSubdir resolves to subproject with marker');
teardown();

// Test 13: projectSubdir outside root is rejected
setup();
let outsideError = null;
try {
  resolveProjectBase(TEST_ROOT, '../other');
} catch (error) {
  outsideError = error;
}
assert.ok(outsideError, 'Should reject projectSubdir outside root');
assert.ok(outsideError.message.includes('within project root'));
console.log('✓ Test 13: projectSubdir outside root rejected');
teardown();

// Test 14: projectSubdir without marker is rejected
setup();
createProjectStructure(['packages/empty'], []);
let markerError = null;
try {
  resolveProjectBase(TEST_ROOT, 'packages/empty');
} catch (error) {
  markerError = error;
}
assert.ok(markerError, 'Should reject projectSubdir without marker');
assert.ok(markerError.message.includes('does not contain a project marker'));
console.log('✓ Test 14: projectSubdir without marker rejected');
teardown();

console.log('\n✅ All scan-roots tests passed!');
