/**
 * PHASE 18 — Determinism Normalization Layer
 * 
 * Normalizes artifacts for deterministic comparison by:
 * - Stripping volatile fields (timestamps, runId, absolute paths, temp dirs)
 * - Normalizing ordering (sort arrays by stable keys)
 * - Normalizing evidence paths but preserving evidence presence/absence
 * - Normalizing floating scores with fixed rounding
 */

/**
 * PHASE 18: Normalize artifact for comparison
 * 
 * @param {string} artifactName - Name of artifact (findings, runStatus, etc.)
 * @param {Object} json - Artifact JSON object
 * @returns {Object} Normalized artifact
 */
export function normalizeArtifact(artifactName, json) {
  if (!json || typeof json !== 'object') {
    return json;
  }
  
  // Deep clone to avoid mutating original
  const normalized = JSON.parse(JSON.stringify(json));
  
  // Apply artifact-specific normalization
  switch (artifactName) {
    case 'findings':
      return normalizeFindings(normalized);
    case 'runStatus':
      return normalizeRunStatus(normalized);
    case 'summary':
      return normalizeSummary(normalized);
    case 'learn':
      return normalizeLearn(normalized);
    case 'evidenceIntent':
      return normalizeEvidenceIntent(normalized);
    case 'guardrailsReport':
      return normalizeGuardrailsReport(normalized);
    case 'confidenceReport':
      return normalizeConfidenceReport(normalized);
    case 'determinismContract':
      return normalizeDeterminismContract(normalized);
    case 'runMeta':
      return normalizeRunMeta(normalized);
    case 'observe':
    case 'traces':
      return normalizeTraces(normalized);
    case 'performanceReport':
      return normalizePerformanceReport(normalized);
    case 'securityReport':
      return normalizeSecurityReport(normalized);
    case 'gaReport':
      return normalizeGAReport(normalized);
    case 'releaseReport':
      return normalizeReleaseReport(normalized);
    default:
      return normalizeGeneric(normalized);
  }
}

function normalizeDeterminismContract(artifact) {
  return normalizeGeneric(artifact);
}

function normalizeRunMeta(artifact) {
  return normalizeGeneric(artifact);
}

function normalizeTraces(artifact) {
  return normalizeGeneric(artifact);
}

function normalizePerformanceReport(artifact) {
  return normalizeGeneric(artifact);
}

function normalizeSecurityReport(artifact) {
  return normalizeGeneric(artifact);
}

function normalizeGAReport(artifact) {
  return normalizeGeneric(artifact);
}

function normalizeReleaseReport(artifact) {
  return normalizeGeneric(artifact);
}

/**
 * Normalize findings artifact
 */
function normalizeFindings(artifact) {
  const normalized = { ...artifact };
  
  // Remove volatile top-level fields
  delete normalized.detectedAt;
  delete normalized.runId;
  delete normalized.timestamp;
  
  // Normalize findings array
  if (Array.isArray(normalized.findings)) {
    normalized.findings = normalized.findings.map(f => normalizeFinding(f));
    // Sort by stable identity (if we had it, but for now sort by type + interaction)
    normalized.findings.sort((a, b) => {
      const keyA = `${a.type || ''}|${a.interaction?.selector || ''}|${a.interaction?.type || ''}`;
      const keyB = `${b.type || ''}|${b.interaction?.selector || ''}|${b.interaction?.type || ''}`;
      return keyA.localeCompare(keyB);
    });
  }
  
  // Normalize enforcement metadata (keep structure, remove timestamps)
  if (normalized.enforcement) {
    const enforcement = { ...normalized.enforcement };
    // Keep enforcement data but normalize any timestamps
    normalized.enforcement = enforcement;
  }
  
  return normalized;
}

/**
 * Normalize individual finding
 */
function normalizeFinding(finding) {
  const normalized = { ...finding };
  
  // Remove volatile fields
  delete normalized.id;
  delete normalized.findingId;
  delete normalized.timestamp;
  delete normalized.detectedAt;
  
  // Normalize confidence (round to 3 decimals)
  if (typeof normalized.confidence === 'number') {
    normalized.confidence = Math.round(normalized.confidence * 1000) / 1000;
  }
  
  // Normalize evidence paths (keep structure, normalize paths)
  if (normalized.evidence) {
    normalized.evidence = normalizeEvidence(normalized.evidence);
  }
  
  // Normalize evidencePackage
  if (normalized.evidencePackage) {
    normalized.evidencePackage = normalizeEvidencePackage(normalized.evidencePackage);
  }
  
  // Normalize guardrails (keep structure, normalize confidence deltas)
  if (normalized.guardrails) {
    const guardrails = { ...normalized.guardrails };
    if (typeof guardrails.confidenceDelta === 'number') {
      guardrails.confidenceDelta = Math.round(guardrails.confidenceDelta * 1000) / 1000;
    }
    normalized.guardrails = guardrails;
  }
  
  return normalized;
}

/**
 * Normalize evidence
 */
function normalizeEvidence(evidence) {
  const normalized = { ...evidence };
  
  // Normalize screenshot paths (keep presence, normalize path)
  if (normalized.before) {
    normalized.before = normalizePath(normalized.before);
  }
  if (normalized.after) {
    normalized.after = normalizePath(normalized.after);
  }
  
  // Normalize URLs (remove query params, hash)
  if (normalized.beforeUrl) {
    normalized.beforeUrl = normalizeUrl(normalized.beforeUrl);
  }
  if (normalized.afterUrl) {
    normalized.afterUrl = normalizeUrl(normalized.afterUrl);
  }
  
  // Normalize source paths
  if (normalized.source && typeof normalized.source === 'string') {
    normalized.source = normalizePath(normalized.source);
  }
  
  return normalized;
}

/**
 * Normalize evidencePackage
 */
function normalizeEvidencePackage(evidencePackage) {
  const normalized = { ...evidencePackage };
  
  // Normalize before/after paths
  if (normalized.before) {
    normalized.before = {
      ...normalized.before,
      screenshot: normalized.before.screenshot ? normalizePath(normalized.before.screenshot) : null,
      url: normalized.before.url ? normalizeUrl(normalized.before.url) : null,
    };
  }
  
  if (normalized.after) {
    normalized.after = {
      ...normalized.after,
      screenshot: normalized.after.screenshot ? normalizePath(normalized.after.screenshot) : null,
      url: normalized.after.url ? normalizeUrl(normalized.after.url) : null,
    };
  }
  
  // Normalize trigger source paths
  if (normalized.trigger?.source?.file) {
    normalized.trigger.source.file = normalizePath(normalized.trigger.source.file);
  }
  
  return normalized;
}

/**
 * Normalize runStatus artifact
 */
function normalizeRunStatus(artifact) {
  const normalized = { ...artifact };
  
  // Remove volatile fields
  delete normalized.startedAt;
  delete normalized.completedAt;
  delete normalized.timestamp;
  delete normalized.runId;
  
  // Keep structure but remove timestamps from nested objects
  if (normalized.verification) {
    const verification = { ...normalized.verification };
    delete verification.verifiedAt;
    normalized.verification = verification;
  }
  
  return normalized;
}

/**
 * Normalize summary artifact
 */
function normalizeSummary(artifact) {
  const normalized = { ...artifact };
  
  // Remove volatile fields
  delete normalized.timestamp;
  delete normalized.runId;
  
  // Normalize metrics (round durations)
  if (normalized.metrics) {
    const metrics = { ...normalized.metrics };
    for (const key in metrics) {
      if (typeof metrics[key] === 'number' && key.includes('Ms')) {
        metrics[key] = Math.round(metrics[key]);
      }
    }
    normalized.metrics = metrics;
  }
  
  return normalized;
}

/**
 * Normalize learn artifact
 */
function normalizeLearn(artifact) {
  const normalized = { ...artifact };
  
  // Remove volatile fields
  delete normalized.learnedAt;
  delete normalized.timestamp;
  delete normalized.runId;
  
  // Normalize routes array (sort by path)
  if (Array.isArray(normalized.routes)) {
    normalized.routes = [...normalized.routes].sort((a, b) => {
      const pathA = a.path || '';
      const pathB = b.path || '';
      return pathA.localeCompare(pathB);
    });
  }
  
  // Normalize expectations array (sort by type + target)
  if (Array.isArray(normalized.expectations)) {
    normalized.expectations = [...normalized.expectations].sort((a, b) => {
      const keyA = `${a.type || ''}|${a.targetPath || ''}`;
      const keyB = `${b.type || ''}|${b.targetPath || ''}`;
      return keyA.localeCompare(keyB);
    });
  }
  
  return normalized;
}

/**
 * PHASE 22: Normalize evidence intent ledger
 */
function normalizeEvidenceIntent(artifact) {
  const normalized = { ...artifact };
  
  // Remove volatile fields
  delete normalized.generatedAt;
  
  // Normalize entries (already sorted by findingIdentity, but normalize timestamps)
  if (Array.isArray(normalized.entries)) {
    normalized.entries = normalized.entries.map(entry => {
      const normalizedEntry = { ...entry };
      delete normalizedEntry.timestamp;
      
      // Normalize capture outcomes (preserve pass/fail, normalize failure details)
      if (normalizedEntry.captureOutcomes) {
        const outcomes = {};
        for (const [field, outcome] of Object.entries(normalizedEntry.captureOutcomes)) {
          outcomes[field] = {
            required: outcome.required,
            captured: outcome.captured,
            failure: outcome.failure ? {
              stage: outcome.failure.stage,
              reasonCode: outcome.failure.reasonCode,
              reason: outcome.failure.reason
              // Exclude stackSummary and timestamp from failure for determinism
            } : null
          };
        }
        normalizedEntry.captureOutcomes = outcomes;
      }
      
      return normalizedEntry;
    });
  }
  
  return normalized;
}

/**
 * PHASE 23: Normalize guardrails report
 */
function normalizeGuardrailsReport(artifact) {
  const normalized = { ...artifact };
  
  // Remove volatile fields
  delete normalized.generatedAt;
  
  // Normalize summary (preserve counts, normalize topRules ordering)
  if (normalized.summary && normalized.summary.topRules) {
    normalized.summary.topRules = normalized.summary.topRules.map(r => ({
      code: r.code,
      count: r.count
    }));
  }
  
  // Normalize perFinding (already sorted by findingIdentity, but normalize timestamps if any)
  if (normalized.perFinding && typeof normalized.perFinding === 'object') {
    const perFindingNormalized = {};
    const sortedKeys = Object.keys(normalized.perFinding).sort();
    for (const key of sortedKeys) {
      const entry = normalized.perFinding[key];
      perFindingNormalized[key] = {
        ...entry,
        // Remove any volatile fields from entry
      };
    }
    normalized.perFinding = perFindingNormalized;
  }
  
  return normalized;
}

/**
 * PHASE 24: Normalize confidence report
 */
function normalizeConfidenceReport(artifact) {
  const normalized = { ...artifact };
  
  // Remove volatile fields
  delete normalized.generatedAt;
  
  // Normalize summary (preserve counts)
  if (normalized.summary) {
    // Summary counts are already deterministic, no normalization needed
  }
  
  // Normalize perFinding (already sorted by findingIdentity, but normalize timestamps if any)
  if (normalized.perFinding && typeof normalized.perFinding === 'object') {
    const perFindingNormalized = {};
    const sortedKeys = Object.keys(normalized.perFinding).sort();
    for (const key of sortedKeys) {
      const entry = normalized.perFinding[key];
      perFindingNormalized[key] = {
        ...entry,
        // Remove any volatile fields from entry
        // Round confidence values to 3 decimal places for determinism
        confidenceBefore: Math.round(entry.confidenceBefore * 1000) / 1000,
        confidenceAfter: Math.round(entry.confidenceAfter * 1000) / 1000
      };
    }
    normalized.perFinding = perFindingNormalized;
  }
  
  return normalized;
}

/**
 * Normalize generic artifact
 */
function normalizeGeneric(artifact) {
  const normalized = { ...artifact };
  
  // Remove common volatile fields
  delete normalized.timestamp;
  delete normalized.runId;
  delete normalized.detectedAt;
  delete normalized.startedAt;
  delete normalized.completedAt;
  delete normalized.verifiedAt;
  delete normalized.learnedAt;
  
  // Recursively normalize nested objects
  for (const key in normalized) {
    if (normalized[key] && typeof normalized[key] === 'object') {
      if (Array.isArray(normalized[key])) {
        // Sort arrays if they contain objects with stable keys
        normalized[key] = [...normalized[key]];
      } else {
        normalized[key] = normalizeGeneric(normalized[key]);
      }
    }
  }
  
  return normalized;
}

/**
 * Normalize path (remove absolute paths, normalize separators)
 */
function normalizePath(path) {
  if (!path || typeof path !== 'string') return path;
  let normalized = path.replace(/\\/g, '/');
  // Remove absolute path prefixes
  normalized = normalized.replace(/^[A-Z]:\/[^/]+/, '');
  normalized = normalized.replace(/^\/[^/]+/, '');
  // Remove temp dirs
  normalized = normalized.replace(/\/tmp\/[^/]+/g, '/tmp/...');
  normalized = normalized.replace(/\/\.verax\/runs\/[^/]+/g, '/.verax/runs/...');
  return normalized;
}

/**
 * Normalize URL (remove query params, hash, normalize domain)
 */
function normalizeUrl(url) {
  if (!url || typeof url !== 'string') return url;
  try {
    const urlObj = new URL(url);
    // Keep only pathname for comparison
    return urlObj.pathname;
  } catch {
    return url;
  }
}

