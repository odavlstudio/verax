/**
 * GA Enforcer (Future Feature)
 *
 * Moved to internal/future-gates to isolate non-core release gating.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { createInternalFailure } from '../../../verax/core/failures/failure.factory.js';
import { FAILURE_CODE } from '../../../verax/core/failures/failure.types.js';

export function checkGAStatus(projectDir, runId) {
  const statusPath = resolve(projectDir, '.verax', 'runs', runId, 'ga.status.json');
  if (!existsSync(statusPath)) {
    return { exists: false, ready: false, status: null };
  }
  try {
    const content = /** @type {string} */ (readFileSync(statusPath, 'utf-8'));
    const status = JSON.parse(content);
    return { exists: true, ready: status.gaReady === true, status };
  } catch (error) {
    return { exists: false, ready: false, status: null, error: error.message };
  }
}

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
