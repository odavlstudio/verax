/*
Command: verax stability-run [ALPHA]
Purpose: Execute multiple VERAX runs and generate batch stability report.
Required: --url <url>, --repeat <N>
Optional: --mode ci|standard, --json
Outputs: Exactly one RESULT/REASON/ACTION block (JSON or text) plus batch report artifacts.
Exit Codes: 0 SUCCESS | 40 INFRA_FAILURE | 64 USAGE_ERROR
Forbidden: reusing runs; multiple RESULT blocks; interactive prompts; batch size < 2.
*/

import { mkdirSync } from 'fs';
import { resolve } from 'path';
import { UsageError, DataError } from '../util/support/errors.js';
import { buildOutcome as _buildOutcome, EXIT_CODES as _EXIT_CODES } from '../config/cli-contract.js';
import { executeMultipleRuns } from '../util/internals/stability-run/batch-executor.js';
import { generateBatchId } from '../util/internals/stability-run/batch-utils.js';
import { generateAndPersistBatchReport } from '../util/internals/stability-run/report-generator.js';
import { printBatchStabilitySummary } from '../util/internals/stability-run/output-formatter.js';

/**
 * Handler for the stability-run command
 * @param {Object} options - Command options
 * @param {string} options.projectRoot - Project root directory
 * @param {string} options.url - URL to test (required)
 * @param {number} options.repeat - Number of runs (required)
 * @param {string} options.mode - Measurement mode ('ci' or 'standard')
 * @param {boolean} options.json - Output JSON only
 * @returns {Promise<Object>} Result with code and message
 */
export async function stabilityRunCommand(options) {
  const {
    projectRoot = process.cwd(),
    url,
    repeat = 3,
    mode = 'standard',
    json = false
  } = options;
  
  if (!url) {
    throw new UsageError('stability-run: requires --url <url>\nUsage: verax stability-run --url <url> --repeat <N> [--mode ci|standard] [--json]');
  }
  
  if (!/^\d+$/.test(String(repeat)) || repeat < 2) {
    throw new UsageError('stability-run: --repeat must be >= 2');
  }
  
  if (!['ci', 'standard'].includes(mode)) {
    throw new UsageError('stability-run: --mode must be "ci" or "standard"');
  }
  
  try {
    // Create batch directory
    const batchId = generateBatchId();
    const batchDir = resolve(projectRoot, '.verax', 'stability', batchId);
    mkdirSync(batchDir, { recursive: true });
    
    // Execute multiple runs and collect IDs
    const runIds = await executeMultipleRuns(projectRoot, url, repeat);
    
    // Generate and persist batch stability report
    const { batchStability, reportPath } = generateAndPersistBatchReport(projectRoot, runIds, batchDir);
    
    // Output results
    if (json) {
      console.log(JSON.stringify(batchStability, null, 2));
    } else {
      printBatchStabilitySummary(batchStability, reportPath, batchDir);
    }
    
    return {
      batchStability,
      reportPath,
      batchDir,
    };
  } catch (error) {
    if (error instanceof DataError || error instanceof UsageError) {
      throw error;
    }
    throw error;
  }
}
