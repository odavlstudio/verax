/**
 * Test: Unbounded glob patterns are fixed in project-detector.js
 * Verifies that discovery globs have explicit ignore patterns
 */

import { strictEqual } from 'assert';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectDetectorPath = resolve(__dirname, '../../src/verax/learn/project-detector.js');
const content = readFileSync(projectDetectorPath, 'utf-8');

// Test: Ensure HARD_EXCLUSIONS is imported
strictEqual(
  content.includes('import { HARD_EXCLUSIONS }'),
  true,
  'project-detector.js must import HARD_EXCLUSIONS from scan-roots.js'
);

// Test: Ensure all glob calls have ignore parameter
const globCalls = content.match(/glob\([^)]+\)/g) || [];
console.log(`Found ${globCalls.length} glob calls`);

for (const call of globCalls) {
  if (!call.includes('ignore: HARD_EXCLUSIONS')) {
    throw new Error(`Glob not using HARD_EXCLUSIONS: ${call}`);
  }
}

// Test: Verify HARD_EXCLUSIONS constant is used consistently
const hardExclusionsUsage = (content.match(/HARD_EXCLUSIONS/g) || []).length;
strictEqual(
  hardExclusionsUsage >= 4,
  true,
  `HARD_EXCLUSIONS must be used at least 4 times (import + 3 globs), found ${hardExclusionsUsage}`
);

console.log('✅ All glob patterns use HARD_EXCLUSIONS constant');
console.log('✅ Single source of truth for ignore patterns');
console.log(`✅ HARD_EXCLUSIONS used ${hardExclusionsUsage} times`);
