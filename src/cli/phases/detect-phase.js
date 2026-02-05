import { detectSilentFailures } from '../util/detection-engine.js';
import { batchValidateFindings } from '../../verax/detect/constitution-validator.js';
import { existsSync, readdirSync, statSync } from 'fs';
import { resolve } from 'path';

function buildEvidenceFileIndex(evidenceDir) {
  /** @type {Set<string>} */
  const index = new Set();
  const root = typeof evidenceDir === 'string' ? evidenceDir : null;
  if (!root || !existsSync(root)) return index;

  const stack = [{ abs: root, rel: '' }];
  const MAX_FILES = 5000;
  while (stack.length > 0 && index.size < MAX_FILES) {
    const { abs, rel } = stack.pop();
    let entries = [];
    try {
      entries = readdirSync(abs);
    } catch {
      continue;
    }
    entries.sort((a, b) => a.localeCompare(b, 'en'));
    for (const name of entries) {
      if (index.size >= MAX_FILES) break;
      const childAbs = resolve(abs, name);
      const childRel = rel ? `${rel}/${name}` : name;
      try {
        const st = statSync(childAbs);
        if (st.isDirectory()) {
          stack.push({ abs: childAbs, rel: childRel });
        } else if (st.isFile()) {
          index.add(childRel.replace(/\\/g, '/'));
        }
      } catch {
        // ignore unreadable entries
      }
    }
  }

  return index;
}

function buildObserveEvidenceByExpNum(observations) {
  /** @type {Map<number, Set<string>>} */
  const map = new Map();
  const list = Array.isArray(observations) ? observations : [];

  for (const obs of list) {
    const evidenceFiles = Array.isArray(obs?.evidenceFiles) ? obs.evidenceFiles : [];
    // Determine expNum deterministically from evidence file names (exp_<N>_ prefix).
    let expNum = null;
    for (const f of evidenceFiles) {
      if (typeof f !== 'string') continue;
      const m = /(?:^|\/)exp_(\d+)_/i.exec(f);
      if (!m) continue;
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > 0) {
        expNum = n;
        break;
      }
    }
    if (!Number.isFinite(expNum) || expNum === null) continue;

    const normalized = evidenceFiles
      .filter((f) => typeof f === 'string' && f.length > 0)
      .map((f) => String(f).trim().replace(/\\/g, '/'))
      .filter((f) => !f.includes('..') && !/^[a-zA-Z]:\//.test(f) && !f.startsWith('/'))
      .map((f) => (f.startsWith('./') ? f.slice(2) : f));

    if (!map.has(expNum)) map.set(expNum, new Set());
    const set = map.get(expNum);
    for (const f of normalized) set.add(f);
  }

  return map;
}

/**
 * Real detection engine that converts learned promises + observed evidence
 * into constitutional findings.
 * 
 * @param {Object} learnData - { expectations, ... }
 * @param {Object} observeData - { observations, ... }
 * @param {string} _projectRoot 
 * @param {Function} _onProgress 
 * @returns {Promise<Object>}
 */
async function detectFindings(learnData, observeData, _projectRoot, _onProgress) {
  // Detect silent failures using real detection logic
  const findings = await detectSilentFailures(learnData, observeData);
  
  // All findings are already validated by detectSilentFailures,
  // but double-check through constitutional validator
  const { valid: validatedFindings, dropped, downgraded } = batchValidateFindings(findings);
  
  // Compute statistics
  const stats = {
    total: validatedFindings.length,
    silentFailures: validatedFindings.filter(f => f.type === 'dead_interaction_silent_failure').length,
    brokenNavigation: validatedFindings.filter(f => f.type === 'broken_navigation_promise').length,
    silentSubmissions: validatedFindings.filter(f => f.type === 'silent_submission').length,
    bySeverity: {
      HIGH: validatedFindings.filter(f => f.severity === 'HIGH').length,
      MEDIUM: validatedFindings.filter(f => f.severity === 'MEDIUM').length,
      LOW: validatedFindings.filter(f => f.severity === 'LOW').length,
    },
    byStatus: {
      CONFIRMED: validatedFindings.filter(f => f.status === 'CONFIRMED').length,
      SUSPECTED: validatedFindings.filter(f => f.status === 'SUSPECTED').length,
      INFORMATIONAL: validatedFindings.filter(f => f.status === 'INFORMATIONAL').length,
    },
    // SCOPE AWARENESS v1.0: Count out-of-scope feedback
    outOfScope: validatedFindings.filter(f => f.enrichment?.scopeClassification === 'out-of-scope').length,
    enforcement: {
      dropped,
      downgraded
    }
  };
  
  return {
    findings: validatedFindings,
    stats,
    enforcement: stats.enforcement,  // Also export at top level for writeFindingsJson
  };
}

/**
 * Detect Phase
 * 
 * PHASE 1 Constitutional Locking:
 * - All findings must pass validateFindingConstitution()
 * - Invalid findings are dropped safely (not propagated)
 * - Process continues even if findings are dropped
 * 
 * @param {Object} params - { learnData, observeData, projectRoot, events }
 * @returns {Promise<Object>} detectData
 */
export async function detectPhase(params) {
  const { learnData, observeData, projectRoot, events, evidenceDir } = params;
  
  try {
    const detectData = await detectFindings(
      learnData,
      observeData,
      projectRoot,
      (progress) => {
        events.emit(progress.event, progress);
      }
    );

    // Evidence File Existence Law: validate CONFIRMED silent failures against real evidence on disk.
    // Only enforce when an evidenceDir is explicitly provided and exists.
    const shouldEnforceEvidenceFileLaw = typeof evidenceDir === 'string' && evidenceDir.length > 0 && existsSync(evidenceDir);
    if (!shouldEnforceEvidenceFileLaw) {
      return detectData;
    }

    const evidenceFileIndex = buildEvidenceFileIndex(evidenceDir);
    const observeEvidenceByExpNum = buildObserveEvidenceByExpNum(observeData?.observations);
    const { valid: enforcedFindings, dropped, downgraded } = batchValidateFindings(
      detectData.findings,
      { evidenceFileIndex, observeEvidenceByExpNum }
    );

    // Merge enforcement counts (deterministic)
    const enforcement = { ...(detectData.enforcement || {}), evidenceFileLaw: { dropped, downgraded } };

    return {
      ...detectData,
      findings: enforcedFindings,
      enforcement,
      stats: {
        ...(detectData.stats || {}),
        total: enforcedFindings.length,
        silentFailures: enforcedFindings.filter(f => f.type === 'dead_interaction_silent_failure').length,
        brokenNavigation: enforcedFindings.filter(f => f.type === 'broken_navigation_promise').length,
        silentSubmissions: enforcedFindings.filter(f => f.type === 'silent_submission').length,
        bySeverity: {
          HIGH: enforcedFindings.filter(f => f.severity === 'HIGH').length,
          MEDIUM: enforcedFindings.filter(f => f.severity === 'MEDIUM').length,
          LOW: enforcedFindings.filter(f => f.severity === 'LOW').length,
        },
        byStatus: {
          CONFIRMED: enforcedFindings.filter(f => f.status === 'CONFIRMED').length,
          SUSPECTED: enforcedFindings.filter(f => f.status === 'SUSPECTED').length,
          INFORMATIONAL: enforcedFindings.filter(f => f.status === 'INFORMATIONAL').length,
        },
      },
    };
  } catch (error) {
    // Constitution violations must not crash the process
    // Drop findings safely and continue
    console.warn('Warning: Constitution check failed during detection:', error.message);
    return {
      findings: [],
      stats: { 
        total: 0, 
        bySeverity: {},
        enforcement: { dropped: 0, downgraded: 0, error: error.message }
      },
    };
  }
}
