/**
 * Report Generator for Batch Stability
 * 
 * Responsibility: Generate and persist batch stability reports.
 * - Calls stability engine to compute batch metrics
 * - Writes report and run list JSON files
 * - Returns stability metrics for output
 */

import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { generateBatchStability } from '../../../util/stability/stability-engine.js';
import { getTimeProvider } from '../../../util/support/time-provider.js';

/**
 * Generate batch stability report and write to disk
 * @param {string} projectRoot - Project root directory
 * @param {string[]} runIds - Array of run IDs
 * @param {string} batchDir - Batch output directory
 * @returns {Object} Batch stability metrics
 */
export function generateAndPersistBatchReport(projectRoot, runIds, batchDir) {
  // Generate batch stability report
  console.log('📊 Analyzing batch stability...\n');
  
  const batchStability = generateBatchStability(projectRoot, runIds);
  
  // Write report
  const reportPath = resolve(batchDir, 'report.json');
  writeFileSync(reportPath, JSON.stringify(batchStability, null, 2));
  
  // Write run list
  const runListPath = resolve(batchDir, 'runs.json');
  const timeProvider = getTimeProvider();
  writeFileSync(runListPath, JSON.stringify({ runIds, timestamp: timeProvider.iso() }, null, 2));
  
  return { batchStability, reportPath };
}
