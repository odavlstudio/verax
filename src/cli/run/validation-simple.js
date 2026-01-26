/**
 * Week 8: Input Validation Module
 * Extracted from run.js
 * 
 * ZERO behavior changes from original run.js
 */

import { resolve } from 'path';
import { existsSync } from 'fs';
import { UsageError, DataError } from '../util/support/errors.js';

/**
 * Validate required URL argument
 */
export function validateUrl(url) {
  if (!url) {
    throw new UsageError('Missing required argument: --url <url>');
  }
}

/**
 * Resolve and validate source path
 * @param {string} src - Source path (can be null/undefined for auto-detection)
 * @param {boolean} allowMissing - Allow missing source (for LIMITED mode)
 * @returns {{ projectRoot: string, srcPath: string, missing: boolean }}
 */
export function resolveAndValidateSrcPath(src, allowMissing = false) {
  const projectRoot = resolve(process.cwd());
  
  // If src not provided and allowMissing is true, return projectRoot for LIMITED mode
  if (!src && allowMissing) {
    return { projectRoot, srcPath: projectRoot, missing: true };
  }
  
  const srcPath = resolve(projectRoot, src || '.');
  
  if (!existsSync(srcPath)) {
    if (allowMissing) {
      return { projectRoot, srcPath: projectRoot, missing: true };
    }
    throw new DataError(`Source directory not found: ${srcPath}`);
  }
  
  return { projectRoot, srcPath, missing: false };
}
