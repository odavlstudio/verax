import { resolve } from 'path';
import { existsSync } from 'fs';
import { UsageError, DataError } from '../util/support/errors.js';

/**
 * Extracted from runCommand Phase 1 (Validation) for readability. No behavior change.
 * Validates required inputs and checks that source directory exists.
 */
export function validateRunInputs(url, src) {
  if (!url) {
    throw new UsageError('Missing required argument: --url <url>');
  }
  
  const projectRoot = resolve(process.cwd());
  const srcPath = resolve(projectRoot, src);
  
  if (!existsSync(srcPath)) {
    throw new DataError(`Source directory not found: ${srcPath}`);
  }
  
  return { projectRoot, srcPath };
}








