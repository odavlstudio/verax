/**
 * PHASE 21.6 — GA Status Artifact Writer
 * 
 * Writes GA readiness status to ga.status.json
 */

import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname as _dirname } from 'path';
import { buildBaselineSnapshot, writeBaselineSnapshot } from '../baseline/baseline.snapshot.js';

/**
 * Write GA status artifact
 * 
 * @param {string} projectDir - Project directory
 * @param {string} runId - Run ID
 * @param {Object} gaResult - GA readiness result
 * @returns {string} Path to artifact
 */
export function writeGAStatus(projectDir, runId, gaResult) {
  const runsDir = resolve(projectDir, '.verax', 'runs', runId);
  mkdirSync(runsDir, { recursive: true });
  
  const artifactPath = resolve(runsDir, 'ga.status.json');
  
  const artifact = {
    gaReady: gaResult.pass,
    checkedAt: gaResult.summary.checkedAt,
    blockers: gaResult.blockers,
    warnings: gaResult.warnings,
    summary: gaResult.summary,
    inputs: gaResult.inputs
  };
  
  writeFileSync(artifactPath, JSON.stringify(artifact, null, 2), 'utf-8');
  
  // PHASE 21.11: Freeze baseline when GA-READY
  if (gaResult.pass) {
    try {
      const baseline = buildBaselineSnapshot(projectDir);
      writeBaselineSnapshot(projectDir, baseline, true); // true = GA-READY, freeze it
    } catch (error) {
      // Baseline freeze failure is not fatal, but should be logged
      console.error(`Warning: Failed to freeze baseline: ${error.message}`);
    }
  }
  
  return artifactPath;
}

