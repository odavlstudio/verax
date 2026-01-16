/**
 * PHASE 21.6 — GA Enforcer
 * 
 * Hard enforcement that blocks shipping without GA-READY status.
 * This is not advisory. This is hard enforcement.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { createInternalFailure } from '../failures/failure.factory.js';
import { FAILURE_CODE } from '../failures/failure.types.js';

/**
 * Check if GA status exists and is READY
 * 
 * @param {string} projectDir - Project directory
 * @param {string} runId - Run ID
 * @returns {Object} { exists: boolean, ready: boolean, status: Object|null }
 */
export function checkGAStatus(projectDir, runId) {
  const statusPath = resolve(projectDir, '.verax', 'runs', runId, 'ga.status.json');
  
  if (!existsSync(statusPath)) {
    return {
      exists: false,
      ready: false,
      status: null
    };
  }
  
  try {
    const content = readFileSync(statusPath, 'utf-8');
  // @ts-expect-error - readFileSync with encoding returns string
    const status = JSON.parse(content);
    
    return {
      exists: true,
      ready: status.gaReady === true,
      status
    };
  } catch (error) {
    return {
      exists: false,
      ready: false,
      status: null,
      error: error.message
    };
  }
}

/**
 * Enforce GA readiness before release operations
 * 
 * @param {string} projectDir - Project directory
 * @param {string} runId - Run ID
 * @param {string} operation - Operation name (publish, release, tag)
 * @throws {Error} If GA not ready
 */
export function enforceGAReadiness(projectDir, runId, operation) {
  const check = checkGAStatus(projectDir, runId);
  
  if (!check.exists) {
    const failure = createInternalFailure(
      FAILURE_CODE.INTERNAL_UNEXPECTED_ERROR,
      `Cannot ${operation}: GA status not found. Run 'verax ga' first.`,
      'ga.enforcer',
      { operation, runId },
      null
    );
    throw failure;
  }
  
  if (!check.ready) {
    const blockers = check.status?.blockers || [];
    const blockerMessages = blockers.map(b => b.message).join('; ');
    
    const failure = createInternalFailure(
      FAILURE_CODE.INTERNAL_UNEXPECTED_ERROR,
      `Cannot ${operation}: GA-BLOCKED. Blockers: ${blockerMessages}`,
      'ga.enforcer',
      { operation, runId, blockers },
      null
    );
    throw failure;
  }
}

