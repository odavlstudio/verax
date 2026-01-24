/**
 * Batch Utilities for Stability-Run
 * 
 * Responsibility: Provide utility functions for batch operations.
 * - Generate unique batch IDs
 * - Resolve latest run ID from runs directory
 */

import { readdirSync } from 'fs';
import { resolve } from 'path';

let batchIdCounter = 0;

/**
 * Get the latest run ID from .verax/runs/ directory
 * @param {string} projectRoot - Project root
 * @returns {string} Latest run ID
 */
export function getLatestRunId(projectRoot) {
  try {
    const runsDir = resolve(projectRoot, '.verax', 'runs');
    const runs = readdirSync(runsDir)
      .filter(f => /^\d{13}-/.test(f))
      .sort((a, b) => a.localeCompare(b, 'en'));
    return runs[runs.length - 1];
  } catch {
    throw new Error('Could not determine latest run ID');
  }
}

/**
 * Generate unique batch ID
 * @returns {string} Batch ID
 */
export function generateBatchId() {
  batchIdCounter += 1;
  return `batch-${batchIdCounter.toString().padStart(6, '0')}`;
}
