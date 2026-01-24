/**
 * Path Normalization for Cross-Platform Determinism
 * 
 * CRITICAL: Used for determinism across Windows/POSIX path separators.
 * All evidence paths in artifacts must use forward slashes for byte-identical
 * output regardless of platform.
 */

/**
 * Normalize path to POSIX-style forward slashes
 * @param {string} inputPath - Path with potential backslashes
 * @returns {string} - Path with forward slashes only
 */
export function normalizeToPosixPath(inputPath) {
  return String(inputPath || '').replace(/\\/g, '/');
}








