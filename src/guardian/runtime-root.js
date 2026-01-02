/**
 * Runtime Root Path Manager
 * 
 * Centralizes all Guardian runtime artifact paths to ~/.odavlguardian
 * ensuring zero footprint in user project directories.
 * 
 * MANDATORY DESIGN:
 * - All runtime output MUST go under ~/.odavlguardian/
 * - User project directories MUST remain clean (no .tmp-*, .guardian, etc.)
 * - Backward compatibility: read from legacy locations, never write to them
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Get the runtime root directory for Guardian
 * Default: ~/.odavlguardian
 * Can be overridden via GUARDIAN_RUNTIME_ROOT env var
 */
function getRuntimeRoot() {
  const envRoot = process.env.GUARDIAN_RUNTIME_ROOT;
  if (envRoot && envRoot.trim().length > 0) {
    return path.resolve(envRoot.trim());
  }
  return path.join(os.homedir(), '.odavlguardian');
}

/**
 * Get subdirectory paths under runtime root
 */
function getRuntimePaths() {
  const root = getRuntimeRoot();
  return {
    root,
    runs: path.join(root, 'runs'),
    artifacts: path.join(root, 'artifacts'),
    baselines: path.join(root, 'baselines'),
    logs: path.join(root, 'logs'),
    tmp: path.join(root, 'tmp'),
    state: path.join(root, 'state'),
    watchdog: path.join(root, 'baselines', 'watchdog'),
  };
}

/**
 * Ensure runtime directory structure exists
 * Creates all necessary subdirectories with secure permissions
 */
function ensureRuntimeStructure() {
  const paths = getRuntimePaths();
  const dirs = [
    paths.root,
    paths.runs,
    paths.artifacts,
    paths.baselines,
    paths.logs,
    paths.tmp,
    paths.state,
    paths.watchdog,
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
  }

  return paths;
}

/**
 * Get default artifacts directory (for backward compatibility)
 * This replaces the old './.odavlguardian' default
 */
function getDefaultArtifactsDir() {
  return getRuntimePaths().artifacts;
}

/**
 * Check if a path is a legacy project-local artifacts directory
 * (e.g., ./.odavlguardian, .guardian, project-relative paths)
 */
function isLegacyProjectPath(artifactsDir) {
  if (!artifactsDir) return false;
  
  const normalized = path.resolve(artifactsDir);
  const runtimeRoot = getRuntimeRoot();
  
  // If it's under runtime root, it's not legacy
  if (normalized.startsWith(runtimeRoot)) {
    return false;
  }
  
  // Check for common legacy patterns
  const dirname = path.basename(normalized);
  const legacyNames = ['.odavlguardian', '.guardian', '.test-artifacts'];
  
  return legacyNames.includes(dirname) || dirname.startsWith('.tmp-');
}

/**
 * Migrate artifacts directory path to runtime root if needed
 * - If null/undefined: return runtime artifacts directory
 * - If legacy project path (./.odavlguardian, .guardian): return runtime artifacts directory
 * - If custom path under runtime root: keep it
 * - If custom absolute path elsewhere: keep it (user override)
 * 
 * Special case: If path is relative (like './custom'), resolve from cwd and keep it
 * This allows test frameworks and explicit user paths to work as expected
 */
function resolveArtifactsDir(rawArtifactsDir) {
  // No directory specified: use runtime default
  if (!rawArtifactsDir || String(rawArtifactsDir).trim().length === 0) {
    return getDefaultArtifactsDir();
  }

  const normalized = path.resolve(rawArtifactsDir);
  const runtimeRoot = getRuntimeRoot();

  // Already under runtime root: keep it
  if (normalized.startsWith(runtimeRoot)) {
    return normalized;
  }

  // Check if this is a legacy project path that should be migrated
  // Only migrate if it's the EXACT default pattern (./.odavlguardian or .guardian)
  const basename = path.basename(normalized);
  const isDefaultPattern = (basename === '.odavlguardian' || basename === '.guardian') && 
                          rawArtifactsDir === `./${basename}`;
  
  if (isDefaultPattern) {
    // This is a default pattern - migrate to runtime root
    return getDefaultArtifactsDir();
  }

  // Custom path (absolute or explicitly specified relative path like './myartifacts')
  // Respect user's choice
  return normalized;
}

/**
 * Get run-specific directory under runtime artifacts
 * Creates a unique run directory for this execution
 */
function getRunDir(runId, artifactsDir = null) {
  const baseDir = resolveArtifactsDir(artifactsDir);
  const runDir = path.join(baseDir, 'runs', runId);
  
  if (!fs.existsSync(runDir)) {
    fs.mkdirSync(runDir, { recursive: true, mode: 0o700 });
  }
  
  return runDir;
}

/**
 * Get log directory (always under runtime root)
 */
function getLogDir() {
  const paths = getRuntimePaths();
  if (!fs.existsSync(paths.logs)) {
    fs.mkdirSync(paths.logs, { recursive: true, mode: 0o700 });
  }
  return paths.logs;
}

/**
 * Get temp directory (always under runtime root)
 */
function getTempDir() {
  const paths = getRuntimePaths();
  if (!fs.existsSync(paths.tmp)) {
    fs.mkdirSync(paths.tmp, { recursive: true, mode: 0o700 });
  }
  return paths.tmp;
}

/**
 * Get state directory (always under runtime root)
 */
function getStateDir() {
  const paths = getRuntimePaths();
  if (!fs.existsSync(paths.state)) {
    fs.mkdirSync(paths.state, { recursive: true, mode: 0o700 });
  }
  return paths.state;
}

/**
 * Get baseline storage directory (always under runtime root)
 */
function getBaselineDir() {
  const paths = getRuntimePaths();
  if (!fs.existsSync(paths.baselines)) {
    fs.mkdirSync(paths.baselines, { recursive: true, mode: 0o700 });
  }
  return paths.baselines;
}

/**
 * Get watchdog baseline directory (always under runtime root)
 */
function getWatchdogBaselineDir() {
  const paths = getRuntimePaths();
  if (!fs.existsSync(paths.watchdog)) {
    fs.mkdirSync(paths.watchdog, { recursive: true, mode: 0o700 });
  }
  return paths.watchdog;
}

/**
 * Check if legacy project artifacts exist (for backward compatibility reads)
 * Returns path if exists, null otherwise
 */
function findLegacyProjectArtifacts(projectRoot = process.cwd()) {
  const legacyPaths = [
    path.join(projectRoot, '.odavlguardian'),
    path.join(projectRoot, '.guardian'),
  ];

  for (const legacyPath of legacyPaths) {
    if (fs.existsSync(legacyPath)) {
      return legacyPath;
    }
  }

  return null;
}

module.exports = {
  getRuntimeRoot,
  getRuntimePaths,
  ensureRuntimeStructure,
  getDefaultArtifactsDir,
  resolveArtifactsDir,
  isLegacyProjectPath,
  getRunDir,
  getLogDir,
  getTempDir,
  getStateDir,
  getBaselineDir,
  getWatchdogBaselineDir,
  findLegacyProjectArtifacts,
};
