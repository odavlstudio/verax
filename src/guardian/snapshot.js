/**
 * Market Reality Snapshot Builder
 * Assembles crawl results, attempt results, evidence, and signals into a snapshot
 * 
 * @typedef {import('./truth/attempt.contract.js').AttemptResult} AttemptResult
 */

const fs = require('fs');
const path = require('path');
const { createEmptySnapshot, validateSnapshot } = require('./snapshot-schema');

class SnapshotBuilder {
  constructor(baseUrl, runId, toolVersion) {
    this.snapshot = createEmptySnapshot(baseUrl, runId, toolVersion);
  }

  /**
   * Add crawl results to snapshot
   */
  addCrawlResults(crawlResult) {
    if (!crawlResult) return;

    this.snapshot.crawl = {
      discoveredUrls: (crawlResult.visited || []).map(p => p.url),
      visitedCount: crawlResult.totalVisited || 0,
      failedCount: (crawlResult.visited || []).filter(p => p.error).length,
      safetyBlockedCount: crawlResult.safetyStats?.urlsBlocked || 0,
      httpFailures: (crawlResult.visited || [])
        .filter(p => p.error)
        .map(p => ({
          url: p.url,
          error: p.error,
          timestamp: p.timestamp
        })),
      notes: `Discovered ${crawlResult.totalDiscovered || 0} URLs, visited ${crawlResult.totalVisited || 0}`
    };
  }

  /**
   * Set unified verdict object
   */
  setVerdict(verdict) {
    if (!verdict) return;
    this.snapshot.verdict = {
      verdict: verdict.verdict,
      confidence: verdict.confidence,
      why: verdict.why || '',
      keyFindings: Array.isArray(verdict.keyFindings) ? verdict.keyFindings.slice(0, 7) : [],
      evidence: verdict.evidence || {},
      limits: Array.isArray(verdict.limits) ? verdict.limits.slice(0, 6) : []
    };
  }

  /**
   * Add attempt result to snapshot
   * @param {AttemptResult} attemptResult - Attempt execution result
   * @param {string} artifactDir - Artifact directory path
   */
  addAttempt(attemptResult, artifactDir) {
    // Handle NOT_APPLICABLE and DISCOVERY_FAILED attempts
    if (attemptResult.outcome === 'NOT_APPLICABLE' || attemptResult.outcome === 'DISCOVERY_FAILED') {
      this.snapshot.attempts.push({
        attemptId: attemptResult.attemptId,
        attemptName: attemptResult.attemptName,
        goal: attemptResult.goal,
        outcome: attemptResult.outcome,
        executed: false,
        skipReason: attemptResult.skipReason || (attemptResult.outcome === 'NOT_APPLICABLE' ? 'Feature not present' : 'Element discovery failed'),
        skipReasonCode: attemptResult.skipReason || 'NOT_APPLICABLE',
        discoverySignals: attemptResult.discoverySignals || {},
        totalDurationMs: attemptResult.totalDurationMs || 0,
        stepCount: (attemptResult.steps || []).length,
        failedStepIndex: -1,
        friction: null
      });
      return; // Don't create signals for non-applicable attempts
    }

    // Phase 7.4: Handle SKIPPED attempts (don't add as signal)
    if (attemptResult.outcome === 'SKIPPED') {
      this.snapshot.attempts.push({
        attemptId: attemptResult.attemptId,
        attemptName: attemptResult.attemptName,
        goal: attemptResult.goal,
        outcome: 'SKIPPED',
        executed: false,
        skipReason: attemptResult.skipReason || 'Prerequisites not met',
        skipReasonCode: attemptResult.skipReason || 'NOT_APPLICABLE',
        totalDurationMs: 0,
        stepCount: 0,
        failedStepIndex: -1,
        friction: null
      });
      return; // Don't create signals for skipped attempts
    }

    const signal = {
      id: `attempt_${attemptResult.attemptId}`,
      severity: attemptResult.outcome === 'FAILURE' ? 'high' : 'medium',
      type: attemptResult.outcome === 'FAILURE' ? 'failure' : 'friction',
      description: `${attemptResult.attemptName}: ${attemptResult.outcome}`,
      affectedAttemptId: attemptResult.attemptId
    };

    if (attemptResult.outcome === 'FAILURE' && attemptResult.error) {
      signal.details = attemptResult.error;
    }

      this.snapshot.attempts.push({
        attemptId: attemptResult.attemptId || 'unknown',
        attemptName: attemptResult.attemptName || 'Unknown Attempt',
        goal: attemptResult.goal || 'Unknown goal',
        outcome: attemptResult.outcome,
        executed: true,
        discoverySignals: attemptResult.discoverySignals || {},
        totalDurationMs: attemptResult.totalDurationMs || 0,
        stepCount: (attemptResult.steps || []).length,
        failedStepIndex: (attemptResult.steps || []).findIndex(s => s.status === 'failed'),
        friction: attemptResult.friction || null,
        evidenceSummary: {
          screenshots: (attemptResult.steps || []).reduce((sum, s) => sum + (Array.isArray(s.screenshots) ? s.screenshots.length : 0), 0),
          validators: Array.isArray(attemptResult.validators) ? attemptResult.validators.length : 0,
          tracesCaptured: (attemptResult.artifacts?.tracePath) ? 1 : 0
        }
      });

    // Track artifacts
    if (artifactDir) {
      this.snapshot.evidence.attemptArtifacts[attemptResult.attemptId || 'unknown'] = {
        reportJson: path.join(attemptResult.attemptId || 'unknown', 'attempt-report.json'),
        reportHtml: path.join(attemptResult.attemptId || 'unknown', 'attempt-report.html'),
        screenshotDir: path.join(attemptResult.attemptId || 'unknown', 'attempt-screenshots'),
        attemptJson: attemptResult.artifacts?.attemptJsonPath ? path.relative(artifactDir, attemptResult.artifacts.attemptJsonPath) : undefined
      };
    }

    // Add signal
    this.snapshot.signals.push(signal);
  }

  /**
   * Add market reality results (from executeReality)
   */
  addMarketResults(marketResults, runDir) {
    if (!marketResults || !marketResults.attemptResults) return;

    // Add individual attempt results
    for (const result of marketResults.attemptResults) {
      if (!result || !result.attemptId) {
        console.warn('⚠️  Attempt result missing attemptId; skipping in snapshot');
        continue;
      }
      this.addAttempt(result, runDir);
    }

    // Add intent flow results
    if (marketResults.flowResults && Array.isArray(marketResults.flowResults)) {
      for (const flow of marketResults.flowResults) {
        this.addFlow(flow, runDir);
      }
    }

    // Track market report files
    if (marketResults.marketJsonPath) {
      this.snapshot.evidence.marketReportJson = path.relative(runDir, marketResults.marketJsonPath);
    }
    if (marketResults.marketHtmlPath) {
      this.snapshot.evidence.marketReportHtml = path.relative(runDir, marketResults.marketHtmlPath);
    }
  }

  /**
   * Set artifact directory
   */
  setArtifactDir(artifactDir) {
    this.snapshot.evidence.artifactDir = artifactDir;
  }

  /**
   * Add flow results to snapshot
   */
  addFlow(flowResult, runDir) {
    if (!flowResult) return;

    this.snapshot.flows.push({
      flowId: flowResult.flowId,
      flowName: flowResult.flowName,
      outcome: flowResult.outcome,
      riskCategory: flowResult.riskCategory || 'TRUST/UX',
      stepsExecuted: flowResult.stepsExecuted || 0,
      stepsTotal: flowResult.stepsTotal || 0,
      durationMs: flowResult.durationMs || 0,
      failedStep: flowResult.failedStep || null,
      error: flowResult.error || null,
      successEval: flowResult.successEval ? {
        status: flowResult.successEval.status,
        confidence: flowResult.successEval.confidence,
        reasons: (flowResult.successEval.reasons || []).slice(0, 3),
        evidence: flowResult.successEval.evidence || {}
      } : null
    });

    if (runDir) {
      this.snapshot.evidence.flowArtifacts[flowResult.flowId] = {
        screenshots: flowResult.screenshots || [],
        artifactDir: path.join('flows', flowResult.flowId)
      };
    }

    if (flowResult.outcome === 'FAILURE') {
      this.snapshot.signals.push({
        id: `flow_${flowResult.flowId}_failed`,
        severity: 'high',
        type: 'failure',
        description: `Flow ${flowResult.flowName} failed`,
        affectedAttemptId: flowResult.flowId
      });
    }
  }

  /**
   * Add trace path if available
   */
  setTracePath(tracePath) {
    if (tracePath) {
      this.snapshot.evidence.traceZip = tracePath;
    }
  }

  /**
   * Set baseline information
   */
  setBaseline(baselineInfo) {
    if (!baselineInfo) return;

    this.snapshot.baseline = {
      ...this.snapshot.baseline,
      ...baselineInfo
    };
  }

  /**
   * Set market impact summary (Phase 3)
   */
  setMarketImpactSummary(marketImpactSummary) {
    if (!marketImpactSummary) return;

    this.snapshot.marketImpactSummary = {
      highestSeverity: marketImpactSummary.highestSeverity || 'INFO',
      totalRiskCount: marketImpactSummary.totalRiskCount || 0,
      countsBySeverity: marketImpactSummary.countsBySeverity || { CRITICAL: 0, WARNING: 0, INFO: 0 },
      topRisks: (marketImpactSummary.topRisks || []).slice(0, 10)
    };
  }

  /**
   * Set discovery results (Phase 4)
   */
  setDiscoveryResults(discoveryResult) {
    if (!discoveryResult) return;

    this.snapshot.discovery = {
      pagesVisited: discoveryResult.pagesVisited || [],
      pagesVisitedCount: discoveryResult.pagesVisitedCount || 0,
      interactionsDiscovered: discoveryResult.interactionsDiscovered || 0,
      interactionsExecuted: discoveryResult.interactionsExecuted || 0,
      interactionsByType: discoveryResult.interactionsByType || { NAVIGATE: 0, CLICK: 0, FORM_FILL: 0 },
      interactionsByRisk: discoveryResult.interactionsByRisk || { safe: 0, risky: 0 },
      results: (discoveryResult.results || []).slice(0, 20), // Top 20 results
      summary: discoveryResult.summary || ''
    };
  }

  /**
   * Add breakage intelligence (Phase 4)
   */
  addIntelligence(intelligence) {
    if (!intelligence) return;

    this.snapshot.intelligence = {
      totalFailures: intelligence.totalFailures || 0,
      failures: (intelligence.failures || []).slice(0, 50), // Top 50 failures
      byDomain: intelligence.byDomain || {},
      bySeverity: intelligence.bySeverity || {},
      escalationSignals: intelligence.escalationSignals || [],
      summary: intelligence.summary || ''
    };
  }

  /**
   * Add regression detection results
   */
  addDiff(diffResult) {
    if (!diffResult) return;

    this.snapshot.baseline.diff = {
      regressions: diffResult.regressions || [],
      improvements: diffResult.improvements || [],
      attemptsDriftCount: diffResult.attemptsDriftCount || 0
    };

    // Add regression signals
    if (diffResult.regressions && Object.keys(diffResult.regressions).length > 0) {
      for (const [attemptId, regression] of Object.entries(diffResult.regressions)) {
        this.snapshot.signals.push({
          id: `regression_${attemptId}`,
          severity: 'high',
          type: 'regression',
          description: `Regression in ${attemptId}: ${regression.reason}`,
          affectedAttemptId: attemptId,
          details: regression
        });
      }
    }
  }

  /**
   * Set market impact summary (Phase 3)
   */
  setMarketImpactSummary(marketImpactSummary) {
    if (!marketImpactSummary) return;

    this.snapshot.marketImpactSummary = {
      highestSeverity: marketImpactSummary.highestSeverity || 'INFO',
      totalRiskCount: marketImpactSummary.totalRiskCount || 0,
      countsBySeverity: marketImpactSummary.countsBySeverity || {
        CRITICAL: 0,
        WARNING: 0,
        INFO: 0
      },
      topRisks: (marketImpactSummary.topRisks || []).slice(0, 10) // Keep top 10
    };
  }

  /**
   * Set human intent resolution
   */
  setHumanIntent(humanIntentResolution) {
    if (!humanIntentResolution) return;

    this.snapshot.humanIntent = {
      enabled: humanIntentResolution.enabled || false,
      blockedCount: humanIntentResolution.blockedCount || 0,
      allowedCount: humanIntentResolution.allowedCount || 0,
      blockedAttempts: humanIntentResolution.blockedAttempts || []
    };
  }

  /**
   * Set journey summary
   */
  setJourney(journeySummary) {
    if (!journeySummary) return;

    this.snapshot.journey = {
      stage: journeySummary.stage || 'unknown',
      path: journeySummary.path || [],
      goalReached: journeySummary.goalReached || false,
      frustrationScore: journeySummary.frustrationScore || 0,
      confidence: journeySummary.confidence || 0
    };
  }

  /**
   * Get the built snapshot
   */
  getSnapshot() {
    return this.snapshot;
  }

  /**
   * Validate snapshot and return validation result
   */
  validate() {
    return validateSnapshot(this.snapshot);
  }

  /**
   * Convert to JSON
   */
  toJSON() {
    return JSON.stringify(this.snapshot, null, 2);
  }
}

/**
 * Save snapshot to file atomically (write temp, rename)
 */
async function saveSnapshot(snapshot, filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const tempPath = `${filePath}.tmp`;
  const json = typeof snapshot === 'string' ? snapshot : JSON.stringify(snapshot, null, 2);

  return new Promise((resolve, reject) => {
    fs.writeFile(tempPath, json, 'utf8', (err) => {
      if (err) return reject(err);

      fs.rename(tempPath, filePath, (err) => {
        if (err) return reject(err);
        resolve(filePath);
      });
    });
  });
}

/**
 * Load snapshot from file
 */
function loadSnapshot(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const json = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(json);
  } catch (err) {
    throw new Error(`Failed to load snapshot from ${filePath}: ${err.message}`);
  }
}

module.exports = {
  SnapshotBuilder,
  saveSnapshot,
  loadSnapshot
};
