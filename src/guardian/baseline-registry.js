/**
 * Baseline Registry
 * 
 * Stores and retrieves baseline snapshots for Watchdog Mode.
 * Baselines capture stable, minimal state for comparison.
 * 
 * Now stores baselines in ~/.odavlguardian/baselines/watchdog
 * instead of project-local .guardian directory.
 */

const fs = require('fs');
const path = require('path');
const { getWatchdogBaselineDir, findLegacyProjectArtifacts } = require('./runtime-root');

/**
 * Normalize baseUrl to a stable site key
 */
function normalizeSiteKey(baseUrl, slug = null) {
  if (slug) return slug;
  
  // Remove protocol, port, query params, fragments, trailing slashes
  const normalized = baseUrl
    .replace(/^https?:\/\//, '')      // Remove protocol
    .replace(/:\d+/, '')               // Remove port
    .replace(/\?.*$/, '')              // Remove query params
    .replace(/#.*$/, '')               // Remove fragments
    .replace(/\/+$/, '')               // Remove trailing slashes
    .replace(/[^a-zA-Z0-9.\/-]/g, '_'); // Replace special chars except . / -
  
  return normalized || 'default';
}

/**
 * Get baseline storage directory
 * Now returns ~/.odavlguardian/baselines/watchdog
 */
function getBaselineDir() {
  const dir = getWatchdogBaselineDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Get baseline file path for a site key
 */
function getBaselinePath(siteKey) {
  return path.join(getBaselineDir(), `${siteKey}.baseline.json`);
}

/**
 * Create minimal baseline snapshot from run result
 */
function createBaseline(runResult) {
  const { finalDecision, attemptResults = [], flowResults = [], verdictCard, coverageSignal, determinismHash } = runResult;
  
  if (!finalDecision) {
    throw new Error('Cannot create baseline: finalDecision missing');
  }

  // Extract human path summary
  const humanPathSummary = {
    primary: finalDecision.humanPath || [],
    attempts: attemptResults.map(a => ({
      attemptId: a.attemptId,
      outcome: a.outcome
    })),
    flows: flowResults.map(f => ({
      flowId: f.flowId,
      outcome: f.outcome
    }))
  };

  // Coverage summary
  const coverageSummary = {
    percent: coverageSignal?.percent || 0,
    executed: coverageSignal?.executed || 0,
    total: coverageSignal?.total || 0
  };

  // Selector confidence summary
  const selectorConfidenceSummary = {
    avgConfidence: finalDecision.coverageInfo?.avgConfidence || 0
  };

  return {
    version: 1,
    timestamp: new Date().toISOString(),
    finalVerdict: finalDecision.finalVerdict,
    verdictCard: verdictCard ? {
      headline: verdictCard.headline,
      severity: verdictCard.severity,
      impactType: verdictCard.impact?.type
    } : null,
    humanPath: humanPathSummary,
    coverage: coverageSummary,
    selectorConfidence: selectorConfidenceSummary,
    determinismHash: determinismHash || null
  };
}

/**
 * Save baseline to disk
 */
function saveBaseline(siteKey, baseline) {
  const baselinePath = getBaselinePath(siteKey);
  fs.writeFileSync(baselinePath, JSON.stringify(baseline, null, 2), 'utf8');
  return baselinePath;
}

/**
 * Load baseline from disk
 * Checks new runtime location first, then legacy project location for backward compatibility
 */
function loadBaseline(siteKey) {
  const baselinePath = getBaselinePath(siteKey);
  
  // Try new runtime location first
  if (fs.existsSync(baselinePath)) {
    try {
      const content = fs.readFileSync(baselinePath, 'utf8');
      return JSON.parse(content);
    } catch (err) {
      console.error(`Failed to load baseline for ${siteKey}: ${err.message}`);
      return null;
    }
  }
  
  // Check legacy project location for backward compatibility (read-only)
  const legacyRoot = findLegacyProjectArtifacts();
  if (legacyRoot) {
    const legacyPath = path.join(legacyRoot, 'watchdog-baselines', `${siteKey}.baseline.json`);
    if (fs.existsSync(legacyPath)) {
      try {
        const content = fs.readFileSync(legacyPath, 'utf8');
        return JSON.parse(content);
      } catch (err) {
        console.error(`Failed to load legacy baseline for ${siteKey}: ${err.message}`);
      }
    }
  }
  
  return null;
}

/**
 * Update baseline (only if current verdict is READY)
 */
function updateBaseline(siteKey, runResult) {
  const { finalDecision } = runResult;
  
  if (!finalDecision || finalDecision.finalVerdict !== 'READY') {
    throw new Error('Cannot update baseline: only READY verdicts can become new baseline');
  }

  const baseline = createBaseline(runResult);
  return saveBaseline(siteKey, baseline);
}

/**
 * Check if baseline exists
 */
function baselineExists(siteKey) {
  return fs.existsSync(getBaselinePath(siteKey));
}

module.exports = {
  normalizeSiteKey,
  createBaseline,
  saveBaseline,
  loadBaseline,
  updateBaseline,
  baselineExists,
  getBaselineDir,
  getBaselinePath
};
