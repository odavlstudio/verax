/**
 * Batch Executor for Stability-Run
 * 
 * Responsibility: Execute multiple stability runs and collect run IDs.
 * - Runs verax run command N times
 * - Extracts and returns run IDs
 * - Handles run failures with clear error reporting
 */

import { execSync } from 'child_process';
import { getLatestRunId } from './batch-utils.js';

/**
 * Execute N stability runs and return array of run IDs
 * @param {string} projectRoot - Project root directory
 * @param {string} url - URL to test
 * @param {number} repeat - Number of runs to execute
 * @returns {Promise<string[]>} Array of run IDs
 */
export async function executeMultipleRuns(projectRoot, url, repeat) {
  console.log(`\n🔄 Executing ${repeat} stability runs for ${url}...\n`);
  
  const runIds = [];
  for (let i = 1; i <= repeat; i++) {
    process.stdout.write(`  [${i}/${repeat}] Running... `);
    
    try {
      // Execute: verax run --url <url>
      execSync(`node bin/verax.js run --url "${url}"`, {
        cwd: projectRoot,
        stdio: 'pipe'
      });
      
      // Parse latest runId from .verax/runs/ directory
      const latestRunId = getLatestRunId(projectRoot);
      runIds.push(latestRunId);
      
      console.log(`✓ ${latestRunId}`);
    } catch (error) {
      console.log(`✗ Failed`);
      throw new Error(`Run ${i}/${repeat} failed: ${error.message}`);
    }
  }
  
  console.log('');
  return runIds;
}
