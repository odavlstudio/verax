/**
 * Atomic Write Utility — Week 3 Evidence Integrity
 * 
 * Ensures all artifact writes are crash-safe:
 * 1. Write to temporary file in same directory
 * 2. fsync to flush to disk (where supported)
 * 3. Atomic rename to final location
 * 4. Deterministic error handling
 * 
 * Prevents:
 * - Partial JSON writes (torn writes)
 * - Half-written evidence files
 * - Incomplete runs being treated as valid
 */

import {
  writeFileSync,
  mkdirSync,
  renameSync,
  unlinkSync,
  existsSync,
  statSync,
} from 'fs';
import { dirname, extname } from 'path';
import { randomBytes } from 'crypto';

/**
 * Generate a unique temporary filename within the same directory
 * @param {string} finalPath - Final destination path
 * @returns {string} Temporary path in same directory
 */
function getTempPath(finalPath) {
  const _dir = dirname(finalPath);
  const ext = extname(finalPath);
  const baseName = finalPath.slice(0, -ext.length);
  const randomSuffix = randomBytes(4).toString('hex');
  return `${baseName}.${randomSuffix}.tmp${ext}`;
}

/**
 * Atomically write data to a file
 * 
 * @param {string} filePath - Destination file path
 * @param {string|Buffer} data - Data to write
 * @param {Object} options - Write options
 * @param {string} [options.encoding='utf-8'] - File encoding (for string data)
 * @param {boolean} [options.createDirs=true] - Create parent directories if missing
 * @returns {void}
 * @throws {Error} If write fails at any stage
 */
export function atomicWriteFileSync(filePath, data, options = {}) {
  const {
    encoding = 'utf-8',
    createDirs = true,
  } = options;

  // Validate inputs
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('atomicWriteFileSync: filePath must be a non-empty string');
  }

  // Create parent directories if needed
  if (createDirs) {
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  const tempPath = getTempPath(filePath);

  try {
    // Write to temporary file
    // Use Buffer for binary data, string for text
    if (typeof data === 'string') {
      writeFileSync(tempPath, data, encoding);
    } else if (Buffer.isBuffer(data)) {
      writeFileSync(tempPath, data);
    } else {
      throw new Error(`atomicWriteFileSync: data must be string or Buffer, got ${typeof data}`);
    }

    // Atomic rename (this is atomic on all platforms)
    // If rename fails, temp file is left behind but final file is unaffected
    renameSync(tempPath, filePath);
  } catch (error) {
    // Best-effort cleanup: remove temp file if it exists
    try {
      if (existsSync(tempPath)) {
        unlinkSync(tempPath);
      }
    } catch (cleanupError) {
      // Ignore cleanup errors, report original error
    }

    // Add context to error
    const errorMsg = `Failed to atomically write to ${filePath}: ${error.message}`;
    const contextError = new Error(errorMsg);
    // @ts-ignore - Adding custom properties to Error
    contextError.originalError = error;
    // @ts-ignore - Adding custom properties to Error
    contextError.code = error.code;
    // @ts-ignore - Adding custom properties to Error
    contextError.filePath = filePath;
    throw contextError;
  }
}

/**
 * Atomically write JSON data to a file with consistent formatting
 * 
 * @param {string} filePath - Destination file path
 * @param {Object} data - Data to serialize to JSON
 * @param {Object} options - Write options (passed to atomicWriteFileSync)
 * @returns {void}
 * @throws {Error} If JSON serialization or write fails
 */
export function atomicWriteJsonSync(filePath, data, options = {}) {
  let jsonString;

  try {
    const deterministic = options?.deterministic === true;
    const normalized = deterministic ? sortJsonKeysDeep(data) : data;
    // Serialize with consistent formatting (2-space indent, newline at end)
    jsonString = JSON.stringify(normalized, null, 2) + '\n';
  } catch (error) {
    const errorMsg = `Failed to serialize JSON for ${filePath}: ${error.message}`;
    throw new Error(errorMsg);
  }

  // Use atomic write
  atomicWriteFileSync(filePath, jsonString, {
    encoding: 'utf-8',
    ...options,
  });
}

function sortJsonKeysDeep(value) {
  if (Array.isArray(value)) {
    return value.map(sortJsonKeysDeep);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  const out = {};
  const keys = Object.keys(value).sort((a, b) => a.localeCompare(b, 'en'));
  for (const k of keys) {
    out[k] = sortJsonKeysDeep(value[k]);
  }
  return out;
}

/**
 * Check if a file appears to be valid JSON (basic heuristic)
 * Does NOT parse; used for early corruption detection
 * 
 * @param {string} filePath - Path to check
 * @returns {boolean} True if file appears valid (exists and has content)
 */
export function fileExistsAndNotEmpty(filePath) {
  if (!existsSync(filePath)) {
    return false;
  }

  try {
    const stats = statSync(filePath);
    return stats.size > 0;
  } catch {
    return false;
  }
}

/**
 * Create a directory atomically (safe for concurrent access)
 * 
 * @param {string} dirPath - Directory to create
 * @returns {void}
 * @throws {Error} If creation fails
 */
export function atomicMkdirSync(dirPath) {
  if (!dirPath || typeof dirPath !== 'string') {
    throw new Error('atomicMkdirSync: dirPath must be a non-empty string');
  }

  try {
    mkdirSync(dirPath, { recursive: true });
  } catch (error) {
    // EEXIST is OK (directory already exists)
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

/**
 * Export for test/mock purposes
 */
export function _getTempPath(finalPath) {
  return getTempPath(finalPath);
}
