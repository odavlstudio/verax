import { readFileSync as fsReadFileSync } from 'fs';
import { atomicWriteFileSync, atomicWriteJsonSync } from '../atomic-write.js';

/**
 * Type-safe readFileSync wrapper for TypeScript
 * Ensures string return type when encoding is specified
 * @param {string} path - File path
 * @param {string} encoding - Encoding (e.g., 'utf8', 'utf-8')
 * @returns {string} File content as string
 */
export function readFileSync(path, encoding) {
  return String(fsReadFileSync(path, encoding));
}

/**
 * Atomic write for JSON files
 * Writes to a temp file and renames to prevent partial writes
 */
export function atomicWriteJson(filePath, data) {
  atomicWriteJsonSync(filePath, data);
}

/**
 * Atomic write for text files (JSONL, logs, etc.)
 */
export function atomicWriteText(filePath, content) {
  atomicWriteFileSync(filePath, content, { encoding: 'utf-8' });
}

/**
 * Safe JSON parse with validation
 * Returns null if file is missing, unreadable, or malformed
 * Prevents consumption of partial/corrupt artifacts
 */
export function safeParseJsonFile(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return null; // Empty file
    }
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object') {
      return null; // Not an object
    }
    return parsed;
  } catch (e) {
    // Malformed JSON or file read error
    return null;
  }
}

