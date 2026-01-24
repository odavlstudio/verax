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
 */
export function resolveAndValidateSrcPath(src) {
  const projectRoot = resolve(process.cwd());
  const srcPath = resolve(projectRoot, src);
  
  if (!existsSync(srcPath)) {
    throw new DataError(`Source directory not found: ${srcPath}`);
  }
  
  return { projectRoot, srcPath };
}
