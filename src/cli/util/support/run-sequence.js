/**
 * Run Sequence Manager
 * 
 * Generates deterministic, non-colliding run IDs using sequence numbering.
 * When the same URL is tested multiple times on the same date, each run gets
 * a unique sequence number (0001, 0002, 0003, etc.), preventing artifact overwriting.
 * 
 * Structure: .verax/scans/<scanId>/runs/<runId>
 * RunId format: run-YYYY-MM-DD-NNNN (e.g., run-2026-01-24-0001)
 */

import { join } from 'path';
import { existsSync, readdirSync, mkdirSync } from 'fs';
import { getTimeProvider } from './time-provider.js';

/**
 * Compute the next sequence number for a run on a given date
 * 
 * Algorithm:
 * 1. Get the directory for this scan: .verax/scans/<scanId>/runs/
 * 2. Find all existing run directories for the current date
 * 3. Extract sequence numbers (NNNN) from run-YYYY-MM-DD-NNNN format
 * 4. Return max sequence number + 1
 * 
 * @param {string} scanBaseDir - Path to .verax/scans/<scanId>/
 * @param {string} [dateStr] - Date string (YYYY-MM-DD); if not provided, uses today
 * @returns {number} Next sequence number (1, 2, 3, etc.)
 */
export function getNextSequenceNumber(scanBaseDir, dateStr = null) {
  const tp = getTimeProvider();
  const dateToCheck = dateStr || tp.iso().split('T')[0];
  const runsDir = join(scanBaseDir, 'runs');
  
  // Debug logging
  if (process.env.DEBUG_SEQUENCE) {
    console.error(`[run-sequence] scanBaseDir: ${scanBaseDir}`);
    console.error(`[run-sequence] runsDir: ${runsDir}`);
    console.error(`[run-sequence] dateToCheck: ${dateToCheck}`);
    console.error(`[run-sequence] runsDir exists: ${existsSync(runsDir)}`);
  }
  
  // If runs directory doesn't exist yet, start with sequence 1
  if (!existsSync(runsDir)) {
    if (process.env.DEBUG_SEQUENCE) console.error(`[run-sequence] runs dir doesn't exist, returning 1`);
    return 1;
  }
  
  try {
    const rawDirents = readdirSync(runsDir, { withFileTypes: true });
    const filteredDirents = Array.isArray(rawDirents)
      ? rawDirents.filter((/** @type {any} */ e) => Boolean(e) && typeof e === 'object' && 'isDirectory' in e && typeof e.isDirectory === 'function')
      : [];
    const todaysRuns = filteredDirents
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => name.startsWith('run-') && name.startsWith(`run-${dateToCheck}`));
    
    if (process.env.DEBUG_SEQUENCE) {
      console.error(`[run-sequence] All entries: ${filteredDirents.map(e => e.name).join(', ')}`);
      console.error(`[run-sequence] Today's runs: ${todaysRuns.join(', ')}`);
    }
    
    if (todaysRuns.length === 0) {
      if (process.env.DEBUG_SEQUENCE) console.error(`[run-sequence] No runs today, returning 1`);
      return 1;
    }
    
    // Extract sequence numbers from run-YYYY-MM-DD-NNNN
    const sequences = todaysRuns
      .map(name => {
        const match = name.match(/^run-\d{4}-\d{2}-\d{2}-(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(num => num > 0);
    
    if (process.env.DEBUG_SEQUENCE) console.error(`[run-sequence] sequences: ${sequences.join(', ')}`);
    
    const maxSeq = Math.max(...sequences);
    const nextSeq = maxSeq + 1;
    if (process.env.DEBUG_SEQUENCE) console.error(`[run-sequence] maxSeq: ${maxSeq}, returning ${nextSeq}`);
    return nextSeq;
  } catch (err) {
    // If error reading directory, start fresh
    console.warn(`[run-sequence] Error reading runs directory: ${err.message}`);
    return 1;
  }
}

/**
 * Ensure scan base directory exists
 * @param {string} scanBaseDir - Path to .verax/scans/<scanId>/
 */
export function ensureScanBaseDir(scanBaseDir) {
  mkdirSync(scanBaseDir, { recursive: true });
}

