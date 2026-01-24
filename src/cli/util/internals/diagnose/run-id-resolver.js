/**
 * VERAX Diagnose - Run ID Resolution
 * 
 * Resolves run identifier (ID or path) into canonical runId and projectRoot.
 */

import { resolve, basename } from 'path';
import { existsSync } from 'fs';
// @ts-ignore - Module path resolution issue
import { DataError } from '../support/errors.js';

/**
 * Resolve run identifier to canonical runId and projectRoot
 * @param {string} runId - Run identifier or path to run directory
 * @param {string} projectRoot - Initial project root
 * @returns {{resolvedRunId: string, resolvedProjectRoot: string}}
 */
export function resolveRunId(runId, projectRoot) {
  let resolvedRunId = runId;
  let resolvedProjectRoot = projectRoot;
  
  // If runId looks like a path (contains / or \), extract runId from it
  if (runId.includes('/') || runId.includes('\\')) {
    const runPath = resolve(runId);
    if (!existsSync(runPath)) {
      throw new DataError(`Run directory not found: ${runPath}`);
    }
    
    // Extract runId from path: .verax/runs/<runId>
    resolvedRunId = basename(runPath);
    
    // Extract project root: parent of .verax
    const parts = runPath.split(/[/\\]/);
    const veraxIndex = parts.lastIndexOf('.verax');
    if (veraxIndex > 0) {
      resolvedProjectRoot = parts.slice(0, veraxIndex).join('/');
    }
  }
  
  return { resolvedRunId, resolvedProjectRoot };
}
