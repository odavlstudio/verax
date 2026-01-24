/**
 * Safe Src Auto-Discovery
 * 
 * Discovers source directory when --src is not provided.
 * Tries common locations in order, validates they contain code.
 * Falls back to URL-only mode if no valid src found.
 * 
 * Search order:
 * 1. cwd (project root)
 * 2. ./src
 * 3. ./app
 * 4. ./frontend
 * 
 * Validation: directory must contain at least one:
 * - package.json
 * - *.js, *.ts, *.jsx, *.tsx file
 */

import { existsSync, readdirSync, statSync } from 'fs';
import { resolve, extname } from 'path';

const CANDIDATE_DIRS = [
  '.', // cwd
  'src',
  'app',
  'frontend',
];

const _CODE_INDICATORS = [
  'package.json',
];

const CODE_EXTENSIONS = ['.js', '.ts', '.jsx', '.tsx'];

/**
 * Check if directory contains code indicators
 * @param {string} dirPath - Absolute path to directory
 * @returns {boolean} true if contains code
 */
function containsCode(dirPath) {
  try {
    const entries = readdirSync(dirPath);
    
    // Check for package.json
    if (entries.includes('package.json')) {
      return true;
    }
    
    // Check for code files (shallow scan - only top level)
    for (const entry of entries) {
      const ext = extname(entry);
      if (CODE_EXTENSIONS.includes(ext)) {
        return true;
      }
    }
    
    return false;
  } catch {
    return false;
  }
}

/**
 * Auto-discover source directory
 * @param {string} projectRoot - Absolute path to project root
 * @returns {{ srcPath: string | null, discovered: boolean, urlOnlyMode: boolean }}
 */
export function autoDiscoverSrc(projectRoot) {
  for (const candidate of CANDIDATE_DIRS) {
    const candidatePath = resolve(projectRoot, candidate);
    
    // Check if directory exists
    if (!existsSync(candidatePath)) {
      continue;
    }
    
    // Check if it's a directory
    try {
      const stat = statSync(candidatePath);
      if (!stat.isDirectory()) {
        continue;
      }
    } catch {
      continue;
    }
    
    // Check if it contains code
    if (containsCode(candidatePath)) {
      return {
        srcPath: candidatePath,
        discovered: true,
        urlOnlyMode: false,
      };
    }
  }
  
  // No valid src found → URL-only mode
  return {
    srcPath: projectRoot, // Default to cwd for safety
    discovered: false,
    urlOnlyMode: true,
  };
}
