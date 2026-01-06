import { existsSync, readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Determines if a path looks like the verax repository root
 * (contains src/verax directory)
 */
function isVeraxRepoRoot(dir) {
  try {
    const veraxPath = join(dir, 'src', 'verax');
    const indexPath = join(veraxPath, 'index.js');
    return existsSync(indexPath);
  } catch {
    return false;
  }
}

/**
 * Detects project type by looking for marker files/directories
 */
function detectProjectMarker(dir) {
  const markers = [
    { file: 'package.json', check: (content) => {
      try {
        const pkg = JSON.parse(content);
        if (pkg.private === false && pkg.homepage) return true;
        if (pkg.scripts && pkg.scripts.start && (pkg.dependencies?.react || pkg.dependencies?.next)) return true;
        if (pkg.scripts && pkg.scripts.dev) return true;
        return !!pkg.name && pkg.name !== '@verax/verax';
      } catch {
        return false;
      }
    }},
    { file: 'index.html', check: () => true },
    { file: 'next.config.js', check: () => true },
    { file: 'next.config.mjs', check: () => true },
    { file: 'next.config.ts', check: () => true },
    { file: 'vite.config.js', check: () => true },
    { file: 'vite.config.ts', check: () => true },
    { file: 'app.js', check: () => true },
    { file: 'App.tsx', check: () => true },
    { file: 'App.jsx', check: () => true },
    { dir: 'src', check: () => true }
  ];

  for (const marker of markers) {
    const markerPath = join(dir, marker.file || marker.dir);
    if (existsSync(markerPath)) {
      if (marker.file) {
        try {
          const content = readFileSync(markerPath, 'utf-8');
          if (marker.check(content)) {
            return true;
          }
        } catch {
          // Continue if we can't read the file
          continue;
        }
      } else {
        // Directory marker
        if (marker.check()) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Resolves the workspace root (project directory) for verax scanning.
 *
 * Priority:
 * 1. If --project-dir is provided → use it (absolute path)
 * 2. Else → auto-detect nearest parent directory containing project markers
 * 3. If no project marker found and cwd is not repo root → return cwd
 * 4. If no project marker found and cwd IS repo root → raise error
 *
 * @param {string} projectDirArg - The value of --project-dir if provided
 * @param {string} currentWorkingDir - Current working directory (defaults to process.cwd())
 * @returns {object} { workspaceRoot, autoDetected, isRepoRoot }
 * @throws {Error} If unable to resolve a valid workspace root
 */
export function resolveWorkspaceRoot(projectDirArg = null, currentWorkingDir = process.cwd()) {
  const cwd = resolve(currentWorkingDir);

  // 1. If --project-dir is provided, use it
  if (projectDirArg) {
    const projectDir = resolve(projectDirArg);
    if (!existsSync(projectDir)) {
      throw new Error(`Project directory does not exist: ${projectDir}`);
    }
    return {
      workspaceRoot: projectDir,
      autoDetected: false,
      isRepoRoot: isVeraxRepoRoot(projectDir)
    };
  }

  // 2. Auto-detect: search upward from cwd for project markers
  let searchDir = cwd;
  const repoRootPath = isVeraxRepoRoot(cwd) ? cwd : null;

  // Search upward from cwd, but stop at repo root if we find it
  while (searchDir !== dirname(searchDir)) {
    // If we detect a project marker, use this directory
    if (detectProjectMarker(searchDir)) {
      const isRepoRoot = isVeraxRepoRoot(searchDir);
      
      // CRITICAL GUARD: If this is the repo root AND we found a marker (e.g., shared test artifact),
      // refuse to use repo root as workspace root
      if (isRepoRoot && searchDir === repoRootPath) {
        throw new Error(
          'verax verax: Refusing to write artifacts in repository root. ' +
          'Use --project-dir to specify the target project directory.'
        );
      }

      return {
        workspaceRoot: searchDir,
        autoDetected: true,
        isRepoRoot: false
      };
    }

    searchDir = dirname(searchDir);

    // If we hit the repo root during search, stop (don't use repo root implicitly)
    if (isVeraxRepoRoot(searchDir) && searchDir !== cwd) {
      break;
    }
  }

  // 3. Fallback: if we found repo root in upward search, refuse it
  if (isVeraxRepoRoot(cwd)) {
    throw new Error(
      'verax verax: Refusing to write artifacts in repository root. ' +
      'Use --project-dir to specify the target project directory.'
    );
  }

  // 4. Use cwd if no markers found (last resort for edge cases)
  return {
    workspaceRoot: cwd,
    autoDetected: false,
    isRepoRoot: false
  };
}

/**
 * Validates that an artifact path is within the workspace root
 * @throws {Error} If artifact path is outside workspace root
 */
export function assertArtifactPathInWorkspace(artifactPath, workspaceRoot) {
  const resolvedArtifact = resolve(artifactPath);
  const resolvedWorkspace = resolve(workspaceRoot);

  // Normalize paths for comparison
  const artifactNorm = resolvedArtifact.replace(/\\/g, '/');
  const workspaceNorm = resolvedWorkspace.replace(/\\/g, '/');

  if (!artifactNorm.startsWith(workspaceNorm + '/') && artifactNorm !== workspaceNorm) {
    throw new Error(
      `verax verax: Artifact path outside workspace root.\n` +
      `Workspace: ${workspaceRoot}\n` +
      `Artifact: ${artifactPath}`
    );
  }
}
