import { join, isAbsolute } from 'path';
import { mkdirSync } from 'fs';

/**
 * Build run artifact paths
 */
export function getRunPaths(projectRoot, outDir, runId) {
  const outBase = isAbsolute(outDir) ? outDir : join(projectRoot, outDir);
  const baseDir = join(outBase, 'runs', runId);
  
  return {
    baseDir,
    runStatusJson: join(baseDir, 'run.status.json'),
    runMetaJson: join(baseDir, 'run.meta.json'),
    summaryJson: join(baseDir, 'summary.json'),
    findingsJson: join(baseDir, 'findings.json'),
    tracesJsonl: join(baseDir, 'traces.jsonl'),
    evidenceDir: join(baseDir, 'evidence'),
    learnJson: join(baseDir, 'learn.json'),
    observeJson: join(baseDir, 'observe.json'),
  };
}

/**
 * Ensure all required directories exist
 */
export function ensureRunDirectories(paths) {
  mkdirSync(paths.baseDir, { recursive: true });
  mkdirSync(paths.evidenceDir, { recursive: true });
}
