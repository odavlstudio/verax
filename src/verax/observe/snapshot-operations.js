/**
 * SNAPSHOT OPERATIONS MODULE
 * 
 * Encapsulates snapshot loading, comparison, building, and saving logic.
 * Extracted from observe/index.js (STAGE D2.1).
 * 
 * Preserves 100% of original behavior:
 * - Same incremental mode conditions
 * - Same snapshot JSON shape
 * - Same load/save timing
 * - Same trace filtering
 */

import {
  loadPreviousSnapshot,
  buildSnapshot,
  compareSnapshots,
  saveSnapshot
} from '../core/incremental-store.js';

/**
 * Initialize snapshot operations at the beginning of observation
 * 
 * Loads previous snapshot, compares with baseline, determines incremental mode.
 * Extracted from lines 108-111 of observe/index.js
 * 
 * @param {string} projectDir - Project directory
 * @param {Object} manifest - Loaded manifest object
 * @returns {Promise<{oldSnapshot: Object|null, snapshotDiff: Object|null, incrementalMode: boolean}>}
 */
export async function initializeSnapshot(projectDir, manifest) {
  let oldSnapshot = null;
  let snapshotDiff = null;
  let incrementalMode = false;

  // SCALE INTELLIGENCE: Load previous snapshot for incremental mode
  oldSnapshot = loadPreviousSnapshot(projectDir);
  if (oldSnapshot) {
    const currentSnapshot = buildSnapshot(manifest, []);
    snapshotDiff = compareSnapshots(oldSnapshot, currentSnapshot);
    incrementalMode = !snapshotDiff.hasChanges; // Use incremental if nothing changed
  }

  return {
    oldSnapshot,
    snapshotDiff,
    incrementalMode
  };
}

/**
 * Finalize snapshot operations at the end of observation
 * 
 * Builds current snapshot from observed interactions, saves for next run,
 * and creates incremental metadata for observation object.
 * Extracted from lines 789-811 of observe/index.js
 * 
 * @param {Object} manifest - Loaded manifest object (or null if not provided)
 * @param {Array} traces - All collected traces
 * @param {Array} skippedInteractions - Array of skipped interactions
 * @param {boolean} incrementalMode - Whether incremental mode was enabled
 * @param {Object} snapshotDiff - Snapshot diff from initialization (or null)
 * @param {string} projectDir - Project directory
 * @param {string} runId - Run identifier
 * @param {string} url - Initial URL (fallback for trace.before.url)
 * @returns {Promise<{enabled: boolean, snapshotDiff: Object, skippedInteractionsCount: number}|null>}
 */
export async function finalizeSnapshot(manifest, traces, skippedInteractions, incrementalMode, snapshotDiff, projectDir, runId, url) {
  let incrementalMetadata = null;

  // SCALE INTELLIGENCE: Save snapshot for next incremental run
  if (manifest) {
    // Build snapshot from current run (extract interactions from traces)
    const observedInteractions = traces
      .filter(t => t.interaction && !t.incremental)
      .map(t => ({
        type: t.interaction?.type,
        selector: t.interaction?.selector,
        url: t.before?.url || url
      }));

    const currentSnapshot = buildSnapshot(manifest, observedInteractions);
    saveSnapshot(projectDir, currentSnapshot, runId);

    // Add incremental mode metadata to observation
    incrementalMetadata = {
      enabled: incrementalMode,
      snapshotDiff: snapshotDiff,
      skippedInteractionsCount: skippedInteractions.filter(s => s.reason === 'incremental_unchanged').length
    };
  }

  return incrementalMetadata;
}



