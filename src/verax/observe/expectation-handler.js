import { getTimeProvider } from '../../cli/util/support/time-provider.js';
/**
 * EXPECTATION HANDLER
 * 
 * Manages manifest loading, snapshot comparison, and proven expectation execution.
 */

import { readFileSync as readFileSyncWithEncoding, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Load and execute proven expectations from manifest
 * NOTE: Execution is owned by expectation-executor; this guard prevents
 * silently reporting success when execution is unavailable in this module.
 *
 * @param {Object} page - Playwright page
 * @param {string} manifestPath - Path to manifest file
 * @param {string} projectDir - Project directory
 * @param {Object} silenceTracker - Silence tracker
 * @returns {Promise<{success: boolean, results: Array|null, reason: string}>}
 */
export async function loadAndExecuteProvenExpectations(page, manifestPath, projectDir, silenceTracker) {
  if (silenceTracker?.record) {
    silenceTracker.record('expectation_execution_unavailable');
  }
  return {
    success: false,
    results: null,
    reason: 'expectation_execution_unavailable_use_expectation_executor',
  };
}

/**
 * Load and compare snapshot with previous observation
 * 
 * @param {string} projectDir - Project directory
 * @param {Object} silenceTracker - Silence tracker
 * @returns {Promise<{currentSnapshot: Object|null, previousSnapshot: Object|null}>}
 */
export async function loadAndCompareSnapshot(projectDir, silenceTracker) {
  try {
    const snapshotDir = join(projectDir, '.verax', 'snapshots');
    
    if (!existsSync(snapshotDir)) {
      mkdirSync(snapshotDir, { recursive: true });
    }

    // Load previous snapshot if exists
    const previousSnapshotPath = join(snapshotDir, 'previous.json');
    let previousSnapshot = null;
    if (existsSync(previousSnapshotPath)) {
      try {
        const content = readFileSyncWithEncoding(previousSnapshotPath, 'utf8');
        previousSnapshot = JSON.parse(typeof content === 'string' ? content : content.toString());
      } catch {
        silenceTracker.record('snapshot_previous_load_error');
      }
    }

    // Load current snapshot if exists
    const currentSnapshotPath = join(snapshotDir, 'current.json');
    let currentSnapshot = null;
    if (existsSync(currentSnapshotPath)) {
      try {
        const content = readFileSyncWithEncoding(currentSnapshotPath, 'utf8');
        currentSnapshot = JSON.parse(typeof content === 'string' ? content : content.toString());
      } catch {
        silenceTracker.record('snapshot_current_load_error');
      }
    }

    return { currentSnapshot, previousSnapshot };
  } catch (error) {
    silenceTracker.record('snapshot_comparison_error');
    return { currentSnapshot: null, previousSnapshot: null };
  }
}

/**
 * Build snapshot object from observation data
 * 
 * @param {Array} traces - Array of interaction traces
 * @param {string} baseOrigin - Base origin URL
 * @returns {Object}
 */
export function buildSnapshot(traces, baseOrigin) {
  const snapshot = {
    timestamp: getTimeProvider().iso(),
    baseOrigin,
    totalTraces: traces.length,
    verifiedExpectations: traces.filter(t => t.expectationDriven).length,
    observedExpectations: traces.filter(t => t.observedExpectation).length,
    unprovable: traces.filter(t => t.unprovenResult).length
  };

  return snapshot;
}

/**
 * Save snapshot for future comparison
 * 
 * @param {Object} snapshot - Snapshot object
 * @param {string} projectDir - Project directory
 */
export function saveSnapshot(snapshot, projectDir) {
  try {
    const snapshotDir = join(projectDir, '.verax', 'snapshots');
    if (!existsSync(snapshotDir)) {
      mkdirSync(snapshotDir, { recursive: true });
    }

    const snapshotPath = join(snapshotDir, 'current.json');
    writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
  } catch (error) {
    // Silently fail on snapshot save
  }
}



