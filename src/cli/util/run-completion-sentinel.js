/**
 * Run Completion Sentinel — Week 3 Integrity
 * 
 * A completeness marker written LAST after all run artifacts.
 * Presence of this file = run completed successfully to finalization.
 * Absence = INCOMPLETE classification (deterministic).
 * 
 * This prevents accepting partial runs as valid.
 */

import { atomicWriteJsonSync } from './atomic-write.js';
import { getTimeProvider } from './support/time-provider.js';
import { existsSync } from 'fs';
import { resolve } from 'path';

const SENTINEL_FILENAME = '.run-complete';
const SENTINEL_STARTED = '.run-started';
const SENTINEL_FINALIZED = '.run-finalized';

/**
 * Write the completion sentinel for a run
 * MUST be called LAST after all artifacts are written
 * 
 * @param {string} runDir - Run directory path (e.g., .verax/runs/<runId>/)
 * @throws {Error} If sentinel write fails
 */
export function writeCompletionSentinel(runDir) {
  if (!runDir || typeof runDir !== 'string') {
    throw new Error('writeCompletionSentinel: runDir must be a non-empty string');
  }

  const sentinelPath = resolve(runDir, SENTINEL_FILENAME);
  const timeProvider = getTimeProvider();

  const sentinel = {
    version: '1',
    completedAt: timeProvider.iso(),
    timestamp: timeProvider.now(),
  };

  try {
    atomicWriteJsonSync(sentinelPath, sentinel, { createDirs: false });
  } catch (error) {
    const contextError = new Error(
      `Failed to write completion sentinel to ${runDir}: ${error.message}`
    );
    // @ts-ignore - Adding custom properties to Error
    contextError.originalError = error;
    throw contextError;
  }
}

/**
 * Write a 'run started' sentinel as early marker
 * @param {string} runDir
 */
export function writeRunStarted(runDir) {
  if (!runDir || typeof runDir !== 'string') return;
  const timeProvider = getTimeProvider();
  const startedPath = resolve(runDir, SENTINEL_STARTED);
  const payload = {
    version: '1',
    startedAt: timeProvider.iso(),
    timestamp: timeProvider.now(),
  };
  try {
    atomicWriteJsonSync(startedPath, payload, { createDirs: false });
  } catch {
    // best effort, do not throw
  }
}

/**
 * Write a 'finalization attempted' sentinel even on errors/timeouts
 * @param {string} runDir
 */
export function writeRunFinalized(runDir) {
  if (!runDir || typeof runDir !== 'string') return;
  const timeProvider = getTimeProvider();
  const finalizedPath = resolve(runDir, SENTINEL_FINALIZED);
  const payload = {
    version: '1',
    finalizedAt: timeProvider.iso(),
    timestamp: timeProvider.now(),
  };
  try {
    atomicWriteJsonSync(finalizedPath, payload, { createDirs: false });
  } catch {
    // best effort, do not throw
  }
}

/**
 * Check if a run is marked as complete
 * 
 * @param {string} runDir - Run directory path
 * @returns {boolean} True if sentinel exists
 */
export function isRunComplete(runDir) {
  if (!runDir || typeof runDir !== 'string') {
    return false;
  }

  const sentinelPath = resolve(runDir, SENTINEL_FILENAME);
  return existsSync(sentinelPath);
}

/**
 * Read the completion sentinel to verify timing
 * 
 * @param {string} runDir - Run directory path
 * @returns {Object|null} Sentinel data or null if not found
 */
export function readCompletionSentinel(runDir) {
  if (!runDir || typeof runDir !== 'string') {
    return null;
  }

  const sentinelPath = resolve(runDir, SENTINEL_FILENAME);
  
  if (!existsSync(sentinelPath)) {
    return null;
  }

  try {
    const fs = require('fs');
    const content = /** @type {string} */ (fs.readFileSync(sentinelPath, 'utf-8'));
    return JSON.parse(content);
  } catch {
    // Sentinel file corrupted
    return null;
  }
}

/**
 * Export sentinel filename for tests/debugging
 */
export function getSentinelFilename() {
  return SENTINEL_FILENAME;
}

export function getStartedSentinelName() {
  return SENTINEL_STARTED;
}

export function getFinalizedSentinelName() {
  return SENTINEL_FINALIZED;
}
