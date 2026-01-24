/**
 * VERAX Diagnose - Artifact Writer
 * 
 * Writes diagnostics.json to run directory.
 */

import { resolve } from 'path';
import { writeFileSync } from 'fs';

/**
 * Write diagnostics report to run directory
 * @param {string} projectRoot - Project root directory
 * @param {string} runId - Run identifier
 * @param {Object} diagnostics - Diagnostics report object
 * @returns {string} Path to written diagnostics.json
 */
export function writeDiagnosticsArtifact(projectRoot, runId, diagnostics) {
  const runDir = resolve(projectRoot, '.verax', 'runs', runId);
  const diagnosticsPath = resolve(runDir, 'diagnostics.json');
  writeFileSync(diagnosticsPath, JSON.stringify(diagnostics, null, 2) + '\n');
  return diagnosticsPath;
}
