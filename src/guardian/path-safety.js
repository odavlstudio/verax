const path = require('path');
const { resolveArtifactsDir, getRuntimeRoot } = require('./runtime-root');

/**
 * Resolve the base artifacts directory to an absolute, normalized path.
 * Now defaults to ~/.odavlguardian/artifacts instead of project-local ./.odavlguardian
 * 
 * This function maintains backward compatibility:
 * - Legacy project paths (./.odavlguardian, .guardian) are migrated to runtime root
 * - Custom absolute paths are respected (for enterprise/test overrides)
 * - Runtime root paths are preserved
 */
function resolveBaseDir(rawBaseDir) {
  return resolveArtifactsDir(rawBaseDir);
}

/**
 * Ensure a candidate path remains strictly inside the base directory.
 * Throws if the resolved path escapes the base (fail-closed).
 * 
 * Special allowances for backward compatibility and testing:
 * - Paths under runtime root (~/.odavlguardian) are always allowed
 */
function ensurePathWithinBase(baseDir, candidatePath, label = 'path') {
  const normalizedBase = path.resolve(baseDir);
  const resolved = path.resolve(candidatePath);
  const runtimeRoot = getRuntimeRoot();
  
  // Check if path is within the specified base
  const isSame = resolved === normalizedBase;
  const isInside = resolved.startsWith(normalizedBase + path.sep);
  
  // Also allow paths under runtime root (for migration)
  const isUnderRuntimeRoot = resolved === runtimeRoot || resolved.startsWith(runtimeRoot + path.sep);
  
  if (!isSame && !isInside && !isUnderRuntimeRoot) {
    const err = new Error(`${label} must stay within artifacts base directory: ${normalizedBase}`);
    err.code = 'EOUTOFBASE';
    throw err;
  }
  return resolved;
}

/**
 * Resolve a path by joining segments and enforcing containment in base.
 */
function resolveWithinBase(baseDir, label, ...segments) {
  const candidate = path.join(...segments);
  return ensurePathWithinBase(baseDir, candidate, label);
}

module.exports = {
  resolveBaseDir,
  ensurePathWithinBase,
  resolveWithinBase
};
