/**
 * PHASE 21.11 — Baseline Command
 * 
 * `verax baseline` - Shows baseline hash and drift status
 */

import { loadBaselineSnapshot, buildBaselineSnapshot } from '../../verax/core/baseline/baseline.snapshot.js';
import { compareBaselines } from '../../verax/core/baseline/baseline.enforcer.js';

/**
 * Baseline command
 * 
 * @param {string} projectDir - Project directory
 * @param {Object} options - Command options
 */
export async function baselineCommand(projectDir, options = {}) {
  const { json = false } = options;
  
  const frozen = loadBaselineSnapshot(projectDir);
  const current = buildBaselineSnapshot(projectDir);
  
  if (!frozen) {
    if (json) {
      console.log(JSON.stringify({
        status: 'NO_BASELINE',
        message: 'No baseline snapshot found (pre-GA)',
        current: {
          hash: current.baselineHash,
          version: current.veraxVersion,
          commit: current.gitCommit
        }
      }, null, 2));
    } else {
      console.log('\n=== Baseline Status ===\n');
      console.log('Status: NO_BASELINE (pre-GA)');
      console.log(`Current baseline hash: ${current.baselineHash}`);
      console.log(`Version: ${current.veraxVersion}`);
      console.log(`Commit: ${current.gitCommit}`);
      console.log(`Dirty: ${current.gitDirty ? 'YES' : 'NO'}`);
      console.log('\nNote: Baseline will be frozen when GA-READY is achieved.\n');
    }
    return;
  }
  
  const comparison = compareBaselines(current, frozen);
  const frozenStatus = frozen.frozen ? 'FROZEN' : 'NOT_FROZEN';
  
  if (json) {
    console.log(JSON.stringify({
      status: frozenStatus,
      frozen: frozen.frozen,
      drifted: comparison.drifted,
      message: comparison.message,
      frozenBaseline: {
        hash: frozen.baselineHash,
        version: frozen.veraxVersion,
        commit: frozen.gitCommit,
        timestamp: frozen.timestamp
      },
      currentBaseline: {
        hash: current.baselineHash,
        version: current.veraxVersion,
        commit: current.gitCommit
      },
      differences: comparison.differences
    }, null, 2));
  } else {
    console.log('\n=== Baseline Status ===\n');
    console.log(`Status: ${frozenStatus}`);
    console.log(`Frozen: ${frozen.frozen ? 'YES' : 'NO'}`);
    console.log(`Drifted: ${comparison.drifted ? 'YES' : 'NO'}`);
    console.log(`\nMessage: ${comparison.message}`);
    
    console.log('\nFrozen Baseline:');
    console.log(`  Hash: ${frozen.baselineHash}`);
    console.log(`  Version: ${frozen.veraxVersion}`);
    console.log(`  Commit: ${frozen.gitCommit}`);
    console.log(`  Timestamp: ${frozen.timestamp}`);
    
    console.log('\nCurrent Baseline:');
    console.log(`  Hash: ${current.baselineHash}`);
    console.log(`  Version: ${current.veraxVersion}`);
    console.log(`  Commit: ${current.gitCommit}`);
    console.log(`  Dirty: ${current.gitDirty ? 'YES' : 'NO'}`);
    
    if (comparison.drifted) {
      console.log('\n⚠️  BASELINE DRIFT DETECTED:');
      for (const diff of comparison.differences) {
        console.log(`  - ${diff.message}`);
        if (diff.component) {
          console.log(`    Component: ${diff.component}`);
        }
      }
      console.log('\n⚠️  Changes to core contracts/policies after GA require:');
      console.log('    1. MAJOR version bump');
      console.log('    2. Baseline regeneration');
      console.log('    3. GA re-evaluation\n');
    } else {
      console.log('\n✓ Baseline integrity maintained\n');
    }
  }
}

