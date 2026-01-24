/**
 * CONTRACT TEST: Vue Navigation Extractor Glob Safety
 * 
 * Ensures vue-navigation-extractor.js uses HARD_EXCLUSIONS to prevent
 * unbounded glob scanning (Stage 1 scan boundary contract).
 */

import { strict as assert } from 'assert';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Testing vue-navigation-extractor glob safety...');

// Test 1: Source code imports HARD_EXCLUSIONS
const vueExtractorPath = resolve(__dirname, '../src/verax/intel/vue-navigation-extractor.js');
const sourceCode = readFileSync(vueExtractorPath, 'utf-8');

assert.ok(
  sourceCode.includes("import { HARD_EXCLUSIONS } from '../learn/scan-roots.js'"),
  'vue-navigation-extractor.js must import HARD_EXCLUSIONS'
);
console.log('✓ Test 1: HARD_EXCLUSIONS imported');

// Test 2: globSync call includes ignore option with HARD_EXCLUSIONS
const globSyncPattern = /globSync\s*\(\s*['"`]\*\*\/\*\.vue['"`]\s*,\s*\{[^}]*ignore\s*:\s*HARD_EXCLUSIONS/s;
assert.ok(
  globSyncPattern.test(sourceCode),
  'globSync call for .vue files must include ignore: HARD_EXCLUSIONS'
);
console.log('✓ Test 2: globSync uses ignore: HARD_EXCLUSIONS');

// Test 3: No unbounded globs without ignore
const unboundedGlobPattern = /globSync\s*\(\s*['"`]\*\*\/[^'"`]+['"`]\s*,\s*\{(?![^}]*ignore)[^}]*\}/;
const hasUnboundedGlob = unboundedGlobPattern.test(sourceCode);
assert.ok(
  !hasUnboundedGlob,
  'vue-navigation-extractor.js must not have unbounded globs without ignore parameter'
);
console.log('✓ Test 3: No unbounded globs detected');

console.log('\n✅ Vue navigation extractor glob safety: ALL TESTS PASSED\n');
