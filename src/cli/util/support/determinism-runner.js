/**
 * PHASE 18 — Determinism Runner
 * 
 * Wraps a scan execution to run it multiple times and compare results.
 */

import { resolve } from 'path';
import { readFileSync, existsSync } from 'fs';
import { runDeterminismCheck } from '../../../verax/core/determinism/engine.js';
import { verifyRun } from '../../../verax/core/artifacts/verifier.js';
import { writeDeterminismReport } from './determinism-writer.js';
import { resolveVeraxOutDir } from './default-output-dir.js';

/**
 * PHASE 18: Run scan with determinism checking
 * 
 * @param {Function} scanFn - Function that executes a scan and returns { runId }
 * @param {{runs?: number, out?: string, [key: string]: any}} [options] - Options
 * @returns {Promise<Object>} Determinism check results
 */
export async function runWithDeterminism(scanFn, options = {}) {
  const runs = Number.isFinite(options?.runs) ? options.runs : 2;
  const projectRoot = resolve(process.cwd());
  const out = resolveVeraxOutDir(projectRoot, options?.out || null);
  
  // Wrap scan function to return artifact paths
  const runFn = async (runConfig) => {
    const result = await scanFn({ ...options, ...runConfig });
    
    // Extract artifact paths from result
    const artifactPaths = {};
    if (result.runId) {
      const runDir = resolve(out, 'runs', result.runId);
      
      // Map artifact keys to paths
      const artifactMap = {
        findings: resolve(runDir, 'findings.json'),
        runStatus: resolve(runDir, 'run.status.json'),
        summary: resolve(runDir, 'summary.json'),
        learn: resolve(runDir, 'learn.json'),
        observe: resolve(runDir, 'observe.json'),
      };
      
      for (const [key, path] of Object.entries(artifactMap)) {
        if (existsSync(path)) {
          artifactPaths[key] = path;
        }
      }
    }
    
    return {
      runId: result.runId,
      artifactPaths,
    };
  };  const loadRunFingerprints = async (runMeta) => {
    if (runMeta.runId) {
      const runDir = resolve(out, 'runs', runMeta.runId);
      const metaPath = resolve(runDir, 'run.meta.json');
      if (existsSync(metaPath)) {
        try {
          const metaContent = readFileSync(metaPath, 'utf-8');
  // @ts-expect-error - readFileSync with encoding returns string
          const meta = JSON.parse(metaContent);
          return meta.runFingerprint || null;
        } catch {
          return null;
        }
      }
    }
    return null;
  };
  
  // Run determinism check
  const determinismResult = await runDeterminismCheck(runFn, {
    runs,
    config: options,
    normalize: true,
  });  for (const runMeta of determinismResult.runsMeta) {
    runMeta.runFingerprint = await loadRunFingerprints(runMeta);
  }
  
  // Verify each run
  const verificationResults = [];
  for (const runMeta of determinismResult.runsMeta) {
    if (runMeta.runId) {
      const runDir = resolve(out, 'runs', runMeta.runId);
      if (existsSync(runDir)) {
        try {
          const { getArtifactVersions } = await import('../../../verax/core/artifacts/registry.js');
          const verification = verifyRun(runDir, getArtifactVersions());
          verificationResults.push({
            runId: runMeta.runId,
            verification,
          });
        } catch (error) {
          // Verification failed
          verificationResults.push({
            runId: runMeta.runId,
            verification: { ok: false, errors: [error.message] },
          });
        }
      }
    }
  }
  
  // Write determinism report
  const reportPath = await writeDeterminismReport(
    determinismResult,
    verificationResults,
    out
  );
  
  return {
    ...determinismResult,
    verificationResults,
    reportPath,
  };
}




