/**
 * Market Reality Snapshot v1 Schema Definition
 * 
 * A snapshot captures a complete market reality test run:
 * - what was discovered (crawl)
 * - what was attempted (attempts)
 * - what was observed (evidence: screenshots, traces, reports)
 * - what signals were detected (friction, failures, regressions)
 * - what the baseline was and how current differs
 * 
 * NOTE: Type definitions are now in src/guardian/truth/snapshot.contract.js
 * This file provides the implementation functions.
 */

/**
 * @typedef {import('./truth/snapshot.contract.js').MarketRealitySnapshot} MarketRealitySnapshot
 * @typedef {import('./truth/snapshot.contract.js').SnapshotMeta} SnapshotMeta
 * @typedef {import('./truth/snapshot.contract.js').CrawlResult} CrawlResult
 * @typedef {import('./truth/snapshot.contract.js').SnapshotAttemptEntry} SnapshotAttemptEntry
 * @typedef {import('./truth/snapshot.contract.js').FlowResult} FlowResult
 * @typedef {import('./truth/snapshot.contract.js').Signal} Signal
 * @typedef {import('./truth/snapshot.contract.js').BaselineInfo} BaselineInfo
 * @typedef {import('./truth/snapshot.contract.js').SnapshotEvidence} SnapshotEvidence
 * @typedef {import('./truth/snapshot.contract.js').RiskSummary} RiskSummary
 * @typedef {import('./truth/snapshot.contract.js').MarketImpactSummary} MarketImpactSummary
 * @typedef {import('./truth/snapshot.contract.js').DiscoverySummary} DiscoverySummary
 * @typedef {import('./truth/snapshot.contract.js').IntelligenceData} IntelligenceData
 */

const SNAPSHOT_SCHEMA_VERSION = 'v1';

/**
 * Create an empty snapshot with default structure
 * @param {string} baseUrl - Base URL tested
 * @param {string} runId - Unique run identifier
 * @param {string} toolVersion - Guardian tool version
 * @returns {MarketRealitySnapshot}
 */

function createEmptySnapshot(baseUrl, runId, toolVersion) {
  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    meta: {
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      createdAt: new Date().toISOString(),
      toolVersion,
      url: baseUrl,
      runId,
      environment: process.env.GUARDIAN_ENV || 'production'
    },
    crawl: {
      discoveredUrls: [],
      visitedCount: 0,
      failedCount: 0,
      safetyBlockedCount: 0,
      httpFailures: [],
      notes: ''
    },
    attempts: [],
    flows: [],
    signals: [],
    verdict: null,
    riskSummary: {
      totalSoftFailures: 0,
      totalFriction: 0,
      failuresByCategory: {},
      topRisks: []
    },
    marketImpactSummary: {
      highestSeverity: 'INFO',
      totalRiskCount: 0,
      countsBySeverity: {
        CRITICAL: 0,
        WARNING: 0,
        INFO: 0
      },
      topRisks: []
    },
    discovery: {
      pagesVisited: [],
      pagesVisitedCount: 0,
      interactionsDiscovered: 0,
      interactionsExecuted: 0,
      interactionsByType: {
        NAVIGATE: 0,
        CLICK: 0,
        FORM_FILL: 0
      },
      interactionsByRisk: {
        safe: 0,
        risky: 0
      },
      results: [],
      summary: ''
    },
    evidence: {
      artifactDir: '',
      attemptArtifacts: {},
      flowArtifacts: {}
    },
    intelligence: {
      totalFailures: 0,
      failures: [],
      byDomain: {},
      bySeverity: {},
      escalationSignals: [],
      summary: ''
    },
    baseline: {
      baselineFound: false,
      baselineCreatedThisRun: false,
      baselineCreatedAt: null,
      baselinePath: null,
      diff: null
    }
  };
}

/**
 * Validate snapshot structure
 * @param {MarketRealitySnapshot} snapshot - Snapshot to validate
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateSnapshot(snapshot) {
  const errors = [];

  if (!snapshot.schemaVersion || snapshot.schemaVersion !== SNAPSHOT_SCHEMA_VERSION) {
    errors.push('Missing or invalid schemaVersion');
  }

  if (!snapshot.meta || !snapshot.meta.createdAt || !snapshot.meta.url || !snapshot.meta.runId) {
    errors.push('Missing required meta fields: createdAt, url, runId');
  }

  if (!Array.isArray(snapshot.attempts)) {
    errors.push('attempts must be an array');
  }

  if (!Array.isArray(snapshot.signals)) {
    errors.push('signals must be an array');
  }

  if (!Array.isArray(snapshot.flows)) {
    errors.push('flows must be an array');
  }

  if (!snapshot.evidence || !snapshot.evidence.artifactDir) {
    errors.push('Missing evidence.artifactDir');
  }

  if (!snapshot.baseline) {
    errors.push('Missing baseline section');
  }

  // Basic verdict validation (if present)
  if (snapshot.verdict) {
    const v = snapshot.verdict;
    const allowed = ['READY', 'DO_NOT_LAUNCH', 'FRICTION'];
    if (!v.verdict || !allowed.includes(v.verdict)) {
      errors.push('Invalid verdict.verdict');
    }
    if (!v.confidence || typeof v.confidence.score !== 'number' || v.confidence.score < 0 || v.confidence.score > 1) {
      errors.push('Invalid verdict.confidence.score');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  SNAPSHOT_SCHEMA_VERSION,
  createEmptySnapshot,
  validateSnapshot
};
