import { writeFileSync, renameSync, mkdirSync } from 'fs';
import { dirname } from 'path';

/**
 * Atomic write for JSON files
 * Writes to a temp file and renames to prevent partial writes
 */
export function atomicWriteJson(filePath, data) {
  const tempPath = `${filePath}.tmp`;
  const dirPath = dirname(filePath);
  
  // Ensure directory exists
  mkdirSync(dirPath, { recursive: true });
  
  // Write to temp file
  writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
  
  // Atomic rename
  renameSync(tempPath, filePath);
}

/**
 * Atomic write for text files (JSONL, logs, etc.)
 */
export function atomicWriteText(filePath, content) {
  const tempPath = `${filePath}.tmp`;
  const dirPath = dirname(filePath);
  
  // Ensure directory exists
  mkdirSync(dirPath, { recursive: true });
  
  // Write to temp file
  writeFileSync(tempPath, content, 'utf8');
  
  // Atomic rename
  renameSync(tempPath, filePath);
}
