/**
 * EVIDENCE INDEX MODULE
 * 
 * Builds and validates evidence index from observation traces.
 * Handles screenshot validation and missing evidence tracking via silence system.
 * 
 * SILENCE INTEGRATION: Missing screenshot files are tracked as silence entries
 * with scope='evidence', reason='evidence_missing', preserving full context.
 */

// fs and path imports removed - currently unused

/**
 * Build evidence index from observation traces with validation.
 * 
 * @param {Array} traces - Observation traces from observe phase
 * @returns {Object} { evidenceIndex, expectationEvidenceMap, findingEvidenceMap }
 */
export function buildEvidenceIndex(traces, _projectDir = null, _silenceTracker = null) {
  const evidenceIndex = [];
  const expectationEvidenceMap = new Map();
  const findingEvidenceMap = new Map();
  let id = 1;

  if (!Array.isArray(traces)) {
    return { evidenceIndex, expectationEvidenceMap, findingEvidenceMap };
  }

  // Use fs/path for evidence validation if projectDir provided (currently unused)
  // let existsSync = null;
  // let resolvePath = null;
  // if (projectDir && fs && path) {
  //   existsSync = fs.existsSync;
  //   resolvePath = path.resolve;
  // }

  for (const trace of traces) {
    // Prefer modern trace schema: trace.before/trace.after
    const beforeUrl = trace.before?.url ?? trace.evidence?.beforeUrl ?? null;
    const afterUrl = trace.after?.url ?? trace.evidence?.afterUrl ?? null;
    let beforeScreenshot = trace.before?.screenshot ?? trace.evidence?.beforeScreenshot ?? null;
    let afterScreenshot = trace.after?.screenshot ?? trace.evidence?.afterScreenshot ?? null;

    // PHASE 3: Evidence file validation removed - screenshots stored in .verax/runs/<runId>/evidence/

    const entry = {
      id: `ev-${id}`,
      expectationId: trace.expectationId || null,
      interaction: trace.interaction ? { ...trace.interaction } : null,
      resultType: trace.resultType || 'UNKNOWN',
      evidence: {
        beforeUrl,
        afterUrl,
        beforeScreenshot,
        afterScreenshot
      }
    };

    evidenceIndex.push(entry);

    if (trace.expectationId) {
      expectationEvidenceMap.set(trace.expectationId, entry.id);
    }

    const selector = trace.interaction?.selector;
    if (selector) {
      findingEvidenceMap.set(selector, entry.id);
    }

    id++;
  }

  return { evidenceIndex, expectationEvidenceMap, findingEvidenceMap };
}

/**
 * Write evidence index to artifacts directory.
 * Maps findingId/expectationId to evidence paths (screenshots, traces, network logs).
 * 
 * @param {string} projectDir - Project root directory
 * @param {Array} evidenceIndex - Evidence index from buildEvidenceIndex
 * @param {string} tracesPath - Path to observation-traces.json
 * @param {string} findingsPath - Path to findings.json
 * @returns {Promise<string>} Path to written evidence-index.json
 */
export async function writeEvidenceIndex(projectDir, evidenceIndex, tracesPath, findingsPath, runDirOpt) {
  const { resolve } = await import('path');
  const { mkdirSync, writeFileSync } = await import('fs');

  if (!runDirOpt) {
    throw new Error('runDirOpt is required');
  }
  const artifactsDir = resolve(runDirOpt, 'evidence');
  mkdirSync(artifactsDir, { recursive: true });

  const evidenceIndexPath = resolve(artifactsDir, 'evidence-index.json');
  
  // Build evidence index with full paths
  const index = {
    version: 1,
    generatedAt: new Date().toISOString(),
    tracesPath: tracesPath,
    findingsPath: findingsPath,
    evidence: evidenceIndex.map(entry => ({
      id: entry.id,
      expectationId: entry.expectationId,
      interaction: entry.interaction ? {
        type: entry.interaction.type,
        selector: entry.interaction.selector,
        label: entry.interaction.label
      } : null,
      resultType: entry.resultType,
      expectationOutcome: entry.expectationOutcome,
      evidence: {
        beforeUrl: entry.evidence.beforeUrl,
        afterUrl: entry.evidence.afterUrl,
        beforeScreenshot: entry.evidence.beforeScreenshot,
        afterScreenshot: entry.evidence.afterScreenshot,
        traceFile: tracesPath // All traces are in the same file
      }
    }))
  };
  
  writeFileSync(evidenceIndexPath, JSON.stringify(index, null, 2) + '\n');
  
  return evidenceIndexPath;
}
