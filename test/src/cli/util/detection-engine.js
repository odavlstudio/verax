/**
 * Detection Engine
 * Compares learned expectations against observations to detect silent failures.
 * Produces exactly one finding per expectation with deterministic confidence and impact.
 */

export async function detectFindings(learnData, observeData, projectPath, onProgress, options = {}) {
  const log = options.silent ? () => {} : console.log;
  const findings = [];
  const stats = {
    total: 0,
    silentFailures: 0,
    observed: 0,
    coverageGaps: 0,
    unproven: 0,
    informational: 0,
  };

  const observationMap = indexObservations(observeData);
  const expectations = learnData?.expectations || [];

  const narration = [];

  for (let i = 0; i < expectations.length; i++) {
    const expectation = expectations[i];
    const index = i + 1;

    if (onProgress) {
      onProgress({
        event: 'detect:attempt',
        index,
        total: expectations.length,
        expectationId: expectation.id,
        type: expectation.type,
        value: expectation?.promise?.value,
      });
    }

    const observation = getObservationForExpectation(expectation, observationMap);
    const finding = classifyExpectation(expectation, observation);

    findings.push(finding);
    stats.total++;
    stats[findingStatKey(finding.classification)]++;

    const icon = classificationIcon(finding.classification);
    narration.push(`${icon} ${finding.classification.toUpperCase()} ${finding.promise?.value || ''}`.trim());

    if (onProgress) {
      onProgress({
        event: 'detect:classified',
        index,
        classification: finding.classification,
        impact: finding.impact,
        confidence: finding.confidence,
        expectationId: expectation.id,
      });
    }
  }

  // Terminal narration (one line per finding + summary)
  narration.forEach((line) => log(line));
  log(`SUMMARY findings=${findings.length} observed=${stats.observed} silent-failure=${stats.silentFailures} coverage-gap=${stats.coverageGaps} unproven=${stats.unproven}`);

  // Emit completion event
  if (onProgress) {
    onProgress({
      event: 'detect:completed',
      total: findings.length,
      stats,
    });
  }

  return {
    findings,
    stats,
    detectedAt: new Date().toISOString(),
    enforcement: {
      evidenceLawEnforced: true,
      contractVersion: 1,
      timestamp: new Date().toISOString(),
      droppedCount: 0,
      downgradedCount: 0,
      downgrades: []
    }
  };
}

function indexObservations(observeData) {
  const map = new Map();
  if (!observeData || !Array.isArray(observeData.observations)) return map;

  observeData.observations.forEach((obs) => {
    if (obs == null) return;
    const keys = [];
    if (obs.id) keys.push(obs.id);
    if (obs.expectationId) keys.push(obs.expectationId);
    keys.forEach((key) => {
      if (!map.has(key)) map.set(key, obs);
    });
  });
  return map;
}

function getObservationForExpectation(expectation, observationMap) {
  if (!expectation || !expectation.id) return null;
  return observationMap.get(expectation.id) || null;
}

function classificationIcon(classification) {
  // Handle both old format and new taxonomy format
  const baseClassification = classification.split(':')[0];
  switch (baseClassification) {
    case 'observed':
      return '✓';
    case 'silent-failure':
      return '✗';
    case 'coverage-gap':
      return '⚠';
    case 'unproven':
      return '⚠';
    default:
      return '•';
  }
}

function findingStatKey(classification) {
  // Handle both old format and new taxonomy format
  const baseClassification = classification.split(':')[0];
  switch (baseClassification) {
    case 'silent-failure':
      return 'silentFailures';
    case 'observed':
      return 'observed';
    case 'coverage-gap':
      return 'coverageGaps';
    case 'unproven':
      return 'unproven';
    default:
      return 'informational';
  }
}

/**
 * Classify a single expectation according to deterministic rules.
 * EVIDENCE GATE: silent-failure REQUIRES evidence.
 * OUTCOME BINDING: Use attempt.cause to provide precise taxonomy.
 */
function classifyExpectation(expectation, observation) {
  const finding = {
    id: expectation.id,
    type: expectation.type,
    promise: expectation.promise,
    source: expectation.source,
    classification: 'informational',
    impact: 'LOW',
    confidence: 0,
    evidence: [],
    reason: null,
  };

  const attempted = Boolean(observation?.attempted);
  const observed = observation?.observed === true;
  const reason = observation?.reason || null;
  const cause = observation?.cause || null; // NEW: precise cause from planner

  const evidence = normalizeEvidence(observation?.evidenceFiles || []);
  finding.evidence = evidence;

  const evidenceSignals = analyzeEvidenceSignals(observation, evidence);
  const hasAnyEvidence = evidence.length > 0 || evidenceSignals.hasDomChange;

  // 1) observed (success)
  if (observed) {
    finding.classification = 'observed';
    finding.reason = 'Expectation observed at runtime';
    finding.impact = getImpact(expectation);
    finding.confidence = 1.0;
    return finding;
  }

  // 2) coverage-gap (not attempted or safety skip)
  if (!attempted) {
    finding.classification = 'coverage-gap';
    finding.reason = reason || 'No observation attempt recorded';
    finding.impact = 'LOW';
    finding.confidence = 0;
    return finding;
  }

  // 3) Attempted but not observed - apply EVIDENCE GATE + OUTCOME BINDING
  if (attempted && !observed) {
    // CRITICAL: Evidence Gate - silent-failure REQUIRES evidence
    if (!hasAnyEvidence) {
      // NO EVIDENCE → cannot prove silence → coverage-gap or unproven
      if (isSafetySkip(reason)) {
        finding.classification = 'coverage-gap';
        finding.reason = reason || 'Blocked or skipped for safety';
        finding.impact = 'LOW';
        finding.confidence = 0;
      } else {
        finding.classification = 'unproven';
        finding.reason = reason || 'Attempted but no evidence captured';
        finding.impact = 'MEDIUM';
        finding.confidence = 0;
      }
      return finding;
    }

    // HAS EVIDENCE → can classify as silent-failure with PRECISE taxonomy
    let taxonomy = 'no-change'; // default
    
    if (cause) {
      // Use the cause from interaction planner (most precise)
      taxonomy = cause; // 'not-found' | 'blocked' | 'prevented-submit' | 'timeout' | 'no-change' | 'error'
    } else {
      // Fallback to signal-based detection (legacy)
      taxonomy = determineSilenceTaxonomy(reason, evidenceSignals);
    }
    
    finding.classification = `silent-failure:${taxonomy}`;
    finding.reason = reason || `Expected behavior not observed (${taxonomy})`;
    finding.impact = getImpact(expectation);
    finding.confidence = calculateConfidenceFromEvidence(evidenceSignals);
    return finding;
  }

  // 4) Fallback
  finding.classification = 'informational';
  finding.reason = reason || 'No classification rule matched';
  finding.impact = 'LOW';
  finding.confidence = 0;
  return finding;
}

function isSafetySkip(reason) {
  if (!reason) return false;
  const lower = reason.toLowerCase();
  const safetyIndicators = ['blocked', 'timeout', 'not found', 'safety', 'permission', 'denied', 'captcha', 'forbidden'];
  return safetyIndicators.some((indicator) => lower.includes(indicator));
}

/**
 * Determine silence taxonomy based on reason and evidence signals.
 * Returns: no-change | blocked | not-found | timeout | prevented-submit
 */
function determineSilenceTaxonomy(reason, evidenceSignals) {
  if (!reason) {
    // No explicit reason - check evidence
    if (evidenceSignals.hasScreenshots || evidenceSignals.hasDomChange) {
      return 'no-change'; // Evidence exists but no observed change
    }
    return 'no-change';
  }

  const lower = reason.toLowerCase();

  // Check for specific conditions
  if (lower.includes('timeout') || lower.includes('timed out')) {
    return 'timeout';
  }
  if (lower.includes('not found') || lower.includes('element not found') || lower.includes('selector not found') || lower.includes('not-found')) {
    return 'not-found';
  }
  if (lower.includes('blocked') || lower.includes('not-interactable') || lower.includes('interactable')) {
    return 'blocked';
  }
  if (lower.includes('prevented') || lower.includes('prevented-submit') || lower.includes('submit-prevented')) {
    return 'prevented-submit';
  }
  if (lower.includes('no matching event') || lower.includes('no change') || lower.includes('no-change')) {
    return 'no-change';
  }

  // Default to no-change if evidence exists
  return 'no-change';
}

/**
 * Calculate confidence from evidence ONLY.
 * No evidence = 0 confidence.
 */
function calculateConfidenceFromEvidence(evidenceSignals) {
  const { hasScreenshots, hasNetworkLogs, hasDomChange } = evidenceSignals;

  // Multiple strong signals
  if (hasScreenshots && hasNetworkLogs && hasDomChange) return 0.85;
  if (hasScreenshots && hasNetworkLogs) return 0.75;
  if (hasScreenshots && hasDomChange) return 0.7;
  
  // Single strong signal
  if (hasScreenshots) return 0.6;
  
  // Weak signals
  if (hasNetworkLogs || hasDomChange) return 0.5;
  
  // No evidence
  return 0;
}

function analyzeEvidenceSignals(observation, evidence) {
  const hasScreenshots = evidence.some((e) => e.type === 'screenshot');
  const hasNetworkLogs = evidence.some((e) => e.type === 'network-log');
  const hasDomChange = Boolean(
    observation?.domChanged ||
      observation?.domChange === true ||
      observation?.sensors?.uiSignals?.diff?.changed
  );

  return { hasScreenshots, hasNetworkLogs, hasDomChange };
}

function normalizeEvidence(evidenceFiles) {
  if (!Array.isArray(evidenceFiles)) return [];
  return evidenceFiles
    .filter(Boolean)
    .map((file) => ({
      type: getEvidenceType(file),
      path: file,
      available: true,
    }));
}

/**
 * Impact classification per product spec.
 */
function getImpact(expectation) {
  const type = expectation?.type;
  const value = expectation?.promise?.value || '';
  const valueStr = String(value).toLowerCase();

  if (type === 'navigation') {
    const primaryRoutes = ['/', '/home', '/about', '/contact', '/products', '/pricing', '/features', '/login', '/signup'];
    if (primaryRoutes.includes(value)) return 'HIGH';
    if (valueStr.includes('admin') || valueStr.includes('dashboard') || valueStr.includes('settings')) return 'MEDIUM';
    if (valueStr.includes('privacy') || valueStr.includes('terms') || valueStr.includes('footer')) return 'LOW';
    return 'MEDIUM';
  }

  if (type === 'network') {
    if (valueStr.includes('/api/auth') || valueStr.includes('/api/payment') || valueStr.includes('/api/user')) return 'HIGH';
    if (valueStr.includes('api.')) return 'MEDIUM';
    if (valueStr.includes('/api/') && !valueStr.includes('/api/analytics')) return 'MEDIUM';
    return 'LOW';
  }

  if (type === 'state') {
    return 'MEDIUM';
  }

  return 'LOW';
}

function getEvidenceType(filename) {
  if (!filename) return 'unknown';
  const lower = filename.toLowerCase();
  if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'screenshot';
  if (lower.endsWith('.json')) return 'network-log';
  if (lower.endsWith('.log') || lower.endsWith('.txt')) return 'console-log';
  return 'artifact';
}
