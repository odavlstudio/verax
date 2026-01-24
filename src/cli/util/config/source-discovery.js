/**
 * Stage 5: Zero-Config Source Discovery
 * 
 * Enhanced source root detection with:
 * - Monorepo shape detection (apps/*, packages/*, etc.)
 * - Deterministic scoring for app root candidates
 * - Honest reporting of ambiguous cases
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { resolve, relative } from 'path';

/**
 * Monorepo patterns to detect and their scores
 * Higher score = more likely to be the web app root
 */
const MONOREPO_PATTERNS = [
  { pattern: 'apps/*/src', label: 'app-with-src', score: 50 },
  { pattern: 'apps/*', label: 'app-directory', score: 40 },
  { pattern: 'packages/*/src', label: 'package-with-src', score: 35 },
  { pattern: 'packages/*', label: 'package-directory', score: 25 },
  { pattern: 'web/src', label: 'web-with-src', score: 48 },
  { pattern: 'web', label: 'web-directory', score: 38 },
  { pattern: 'frontend/src', label: 'frontend-with-src', score: 47 },
  { pattern: 'frontend', label: 'frontend-directory', score: 37 },
  { pattern: 'src', label: 'src-directory', score: 45 },
];

/**
 * SCORING RULES for deterministic app root selection:
 * 
 * 1. Package.json presence in directory (+15 points)
 * 2. React/Vue/Svelte deps in package.json (+20 points)
 * 3. package.json "scripts.dev" present (+10 points)
 * 4. Next.js specific files (app/ or pages/) (+25 points)
 * 5. React/Vue config files present (+10 points)
 * 6. Not backend-only (api, server, backend labels) (-50 points)
 * 7. Direct match to pattern score (see MONOREPO_PATTERNS)
 */

function scoreCandidate(candidatePath) {
  let score = 0;
  const dirName = candidatePath.split('/').pop().toLowerCase();
  
  // Rule 6: Penalize backend-only names
  if (dirName.includes('api') || dirName.includes('server') || dirName.includes('backend')) {
    return -999; // Explicitly exclude
  }
  
  // Check for package.json (Rule 1)
  const pkgJsonPath = resolve(candidatePath, 'package.json');
  let packageJson = null;
  if (existsSync(pkgJsonPath)) {
    score += 15;
    try {
      // @ts-expect-error - readFileSync with encoding returns string, not Buffer
      packageJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
    } catch {
      packageJson = null;
    }
  }
  
  // Check package.json content (Rules 2, 3)
  if (packageJson) {
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    if (deps['react'] || deps['vue'] || deps['svelte']) {
      score += 20;
    }
    if (packageJson.scripts?.dev) {
      score += 10;
    }
  }
  
  // Rule 4: Next.js specific
  if (existsSync(resolve(candidatePath, 'app')) || existsSync(resolve(candidatePath, 'pages'))) {
    score += 25;
  }
  
  // Rule 5: React/Vue configs
  const configFiles = ['vite.config.ts', 'vite.config.js', 'webpack.config.js', 'next.config.js'];
  if (configFiles.some(f => existsSync(resolve(candidatePath, f)))) {
    score += 10;
  }
  
  return score;
}

/**
 * Find all candidate web app roots in a monorepo structure
 * Returns: { candidates: [{path, score, label}], ambiguous: boolean }
 */
export function findAppRootCandidates(rootPath) {
  const candidates = [];
  const visited = new Set();
  
  // First, check root itself
  const rootScore = scoreCandidate(rootPath);
  if (rootScore > 0) {
    candidates.push({
      path: rootPath,
      score: rootScore,
      relative: '.',
      reason: 'root-directory',
    });
    visited.add(rootPath);
  }
  
  // Then check known patterns
  for (const { pattern, label } of MONOREPO_PATTERNS) {
    const parts = pattern.split('/');
    
    // Find the wildcard position
    const wildcardIndex = parts.findIndex(p => p === '*');
    if (wildcardIndex === -1) continue; // No wildcard, skip
    
    // basePath is everything before wildcard
    const basePath = parts.slice(0, wildcardIndex).join('/');
    // subDirs is everything after wildcard
    const subDirs = parts.slice(wildcardIndex + 1);
    
    const baseDir = resolve(rootPath, basePath);
    
    if (!existsSync(baseDir) || !statSync(baseDir).isDirectory()) {
      continue;
    }
    
    try {
      const entries = readdirSync(baseDir, { withFileTypes: true })
        // @ts-ignore - Dirent has name property
        .sort((a, b) => a.name.localeCompare(b.name, 'en'));
      
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        
        let candidatePath = resolve(baseDir, entry.name);
        
        // If pattern has subdirs after wildcard (e.g., apps/*/src), apply those
        for (const subDir of subDirs) {
          candidatePath = resolve(candidatePath, subDir);
        }
        
        if (visited.has(candidatePath)) continue;
        visited.add(candidatePath);
        
        if (!existsSync(candidatePath)) continue;
        
        const score = scoreCandidate(candidatePath);
        if (score > 0) {
          candidates.push({
            path: candidatePath,
            score,
            relative: relative(rootPath, candidatePath),
            reason: label,
          });
        }
      }
    } catch {
      // Skip on error reading directory
    }
  }
  
  // Sort by score descending, then by path for determinism
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.path.localeCompare(b.path);
  });
  
  // Consider ambiguous if:
  // - No candidates found
  // - Top 2 candidates have same score
  // - Top candidate score is below safe threshold (20)
  const ambiguous = (
    candidates.length === 0 ||
    (candidates.length >= 2 && candidates[0].score === candidates[1].score) ||
    (candidates.length > 0 && candidates[0].score < 20)
  );
  
  return { candidates, ambiguous };
}

/**
 * Resolve the best app root from candidates
 * Returns: { root: string, outcome: 'RESOLVED' | 'AMBIGUOUS', candidates?: array, reason?: string }
 */
export function resolveAppRoot(rootPath) {
  const { candidates, ambiguous } = findAppRootCandidates(rootPath);
  
  if (candidates.length === 0) {
    return {
      root: rootPath, // Fallback to given root
      outcome: 'AMBIGUOUS',
      reason: 'no-candidates-found',
      candidates: [],
    };
  }
  
  if (ambiguous && candidates.length >= 2 && candidates[0].score === candidates[1].score) {
    return {
      root: null,
      outcome: 'AMBIGUOUS',
      reason: 'multiple-candidates-tied',
      candidates: candidates.map(c => ({
        path: c.path,
        score: c.score,
        relative: c.relative,
      })),
    };
  }
  
  if (candidates[0].score < 20) {
    return {
      root: null,
      outcome: 'AMBIGUOUS',
      reason: 'top-candidate-below-threshold',
      candidates: candidates.slice(0, 3).map(c => ({
        path: c.path,
        score: c.score,
        relative: c.relative,
      })),
    };
  }
  
  // Successfully resolved
  return {
    root: candidates[0].path,
    outcome: 'RESOLVED',
    selectedIndex: 0,
    totalCandidates: candidates.length,
    score: candidates[0].score,
  };
}

export { scoreCandidate };








