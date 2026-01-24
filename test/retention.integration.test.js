#!/usr/bin/env node

/**
 * Retention Integration Test
 * Verifies that retention is actually called during a run
 * 
 * This test creates a fixture with old runs and verifies they get cleaned up
 */

import { mkdirSync, rmSync, existsSync, writeFileSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';
import { tmpdir } from 'os';
import { generateTempDirName } from './support/test-id-provider.js';

const testDir = resolve(tmpdir(), generateTempDirName('retention-integration'));
const runsDir = join(testDir, '.verax', 'runs');

console.log('Retention Integration Test\n');
console.log(`Test directory: ${testDir}\n`);

try {
  // Setup: Create test directory with old runs
  mkdirSync(runsDir, { recursive: true });
  
  console.log('Creating 15 old run directories...');
  for (let i = 0; i < 15; i++) {
    const runId = `old-run-${String(i).padStart(2, '0')}`;
    const runPath = join(runsDir, runId);
    mkdirSync(runPath, { recursive: true });
    writeFileSync(join(runPath, 'run.status.json'), JSON.stringify({
      status: 'COMPLETE',
      runId
    }));
  }
  
  // Verify 15 runs exist
  let runsBefore = readdirSync(runsDir).filter(f => {
    const stat = statSync(join(runsDir, f));
    return stat.isDirectory();
  });
  
  console.log(`✓ Created ${runsBefore.length} old runs\n`);
  
  if (runsBefore.length !== 15) {
    throw new Error(`Expected 15 runs, found ${runsBefore.length}`);
  }
  
  // Simulate what run.js does: call applyRetention
  console.log('Applying retention policy (retain=10)...');
  const { applyRetention } = await import('../src/cli/util/support/retention.js');
  
  const result = applyRetention({
    runsDir,
    retainCount: 10,
    disableRetention: false,
    activeRunId: null,
    verbose: true
  });
  
  console.log(`\nRetention result:`);
  console.log(`  Deleted: ${result.deleted}`);
  console.log(`  Kept: ${result.kept}`);
  console.log(`  Errors: ${result.errors.length}`);
  
  // Verify 10 runs remain
  let runsAfter = readdirSync(runsDir).filter(f => {
    const stat = statSync(join(runsDir, f));
    return stat.isDirectory();
  });
  
  console.log(`\n✓ Remaining runs: ${runsAfter.length}`);
  
  if (runsAfter.length !== 10) {
    throw new Error(`Expected 10 runs after retention, found ${runsAfter.length}`);
  }
  
  if (result.deleted !== 5) {
    throw new Error(`Expected 5 deletions, got ${result.deleted}`);
  }
  
  console.log('\n✅ Integration test passed: Retention working correctly\n');
  
} catch (error) {
  console.error(`\n❌ Integration test failed: ${error.message}\n`);
  process.exit(1);
} finally {
  // Cleanup
  try {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
      console.log(`Cleaned up test directory: ${testDir}`);
    }
  } catch (cleanupError) {
    console.error(`Warning: Failed to cleanup ${testDir}: ${cleanupError.message}`);
  }
}
