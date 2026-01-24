/**
 * Phase F3.2.1 – Evidence Stream Writer
 * 
 * Streams high-volume evidence (network + console events) to disk
 * incrementally to reduce memory footprint while maintaining determinism.
 * 
 * CRITICAL: All output must be deterministic and reproducible.
 * 
 * @module evidence-stream-writer
 */

import { writeFileSync, appendFileSync, mkdirSync } from 'fs';

/**
 * Deterministically serialize an object to JSON string.
 * Keys are sorted alphabetically to ensure reproducibility.
 * 
 * Phase F3.2.1 – Deterministic serialization for streaming.
 * 
 * @param {*} obj - Object to serialize
 * @returns {string} Deterministic JSON string
 */
function deterministicStringify(obj) {
  try {
    // Recursively sort all object keys
    const sorted = sortKeys(obj);
    return JSON.stringify(sorted);
  } catch (error) {
    // Phase F3.2.1 – Never throw, return empty JSON object
    return '{}';
  }
}

/**
 * Recursively sort all object keys for deterministic output.
 * 
 * Phase F3.2.1 – Deterministic key ordering.
 * 
 * @param {*} obj - Object to sort
 * @returns {*} Object with all keys sorted recursively
 */
function sortKeys(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortKeys);
  }

  const sorted = {};
  const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b, 'en'));

  for (const key of keys) {
    const value = obj[key];
    sorted[key] = typeof value === 'object' ? sortKeys(value) : value;
  }

  return sorted;
}

/**
 * Create a streaming writer for JSONL (JSON Lines) files.
 * 
 * Phase F3.2.1 – Stream high-volume evidence to disk.
 * CRITICAL: Maintains determinism and fail-safe behavior.
 * 
 * @param {string} runDir - Base directory for run
 * @param {string} name - Stream name (e.g., 'network-events', 'console-events')
 * @returns {Object} Stream writer interface with append, close, getPath, getCount methods
 */
export function createStreamWriter(runDir, name) {
  try {
    // Phase F3.2.1 – Ensure EVIDENCE directory exists
    const evidenceDir = `${runDir}/EVIDENCE`;
    mkdirSync(evidenceDir, { recursive: true });

    const filePath = `${evidenceDir}/${name}.jsonl`;
    
    // Phase F3.2.1 – Initialize file with empty state
    try {
      writeFileSync(filePath, '', { flag: 'w' });
    } catch (writeError) {
      // Phase F3.2.1 – If write fails, disable streaming gracefully
      return createFailsafeStreamWriter(name);
    }

    let eventCount = 0;
    let failedToWrite = false;

    return {
      /**
       * Append a single event to the JSONL stream.
       * 
       * Phase F3.2.1 – Deterministic append (one JSON per line).
       * Never throws; fails gracefully if write fails.
       * 
       * @param {*} obj - Event object to append
       * @returns {boolean} True if written, false if error
       */
      append(obj) {
        try {
          if (failedToWrite) {
            // Phase F3.2.1 – Already failed, don't retry
            return false;
          }

          // Phase F3.2.1 – Deterministically serialize
          const line = deterministicStringify(obj);
          
          // Phase F3.2.1 – Append with newline
          appendFileSync(filePath, `${line}\n`);
          
          eventCount += 1;
          return true;
        } catch (error) {
          // Phase F3.2.1 – Mark failed and stop trying
          failedToWrite = true;
          return false;
        }
      },

      /**
       * Close stream and flush all data.
       * 
       * Phase F3.2.1 – Idempotent close (safe to call multiple times).
       */
      close() {
        try {
          // Phase F3.2.1 – No-op for file-based streaming (already flushed)
          // This is here for future use with buffered streams
        } catch (error) {
          // Phase F3.2.1 – Never throw on close
        }
      },

      /**
       * Get the full path to the streamed evidence file.
       * 
       * @returns {string} File path
       */
      getPath() {
        return filePath;
      },

      /**
       * Get count of events written to stream.
       * 
       * @returns {number} Event count
       */
      getCount() {
        return eventCount;
      },

      /**
       * Check if stream experienced write failures.
       * 
       * Phase F3.2.1 – Used for metadata reporting.
       * 
       * @returns {boolean} True if any write failed
       */
      hasFailures() {
        return failedToWrite;
      },
    };
  } catch (error) {
    // Phase F3.2.1 – If initialization fails, return failsafe writer
    return createFailsafeStreamWriter(name);
  }
}

/**
 * Create a no-op failsafe stream writer for when actual streaming fails.
 * 
 * Phase F3.2.1 – Fail-safe fallback (never throws, counts in memory).
 * 
 * @param {string} name - Stream name
 * @returns {Object} Failsafe stream writer interface
 */
function createFailsafeStreamWriter(name) {
  let eventCount = 0;

  return {
    append(_obj) {
      try {
        eventCount += 1;
        return false; // Indicate write failed
      } catch (error) {
        return false;
      }
    },

    close() {
      // No-op
    },

    getPath() {
      return `[failsafe:${name}]`;
    },

    getCount() {
      return eventCount;
    },

    hasFailures() {
      return true;
    },
  };
}








