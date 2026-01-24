/**
 * Evidence De-duplication Module
 * 
 * PURPOSE:
 * Ensure identical evidence signals are not double-counted and repeated
 * DOM/network/loading signals are normalized.
 * 
 * CONSTRAINTS:
 * - Does NOT modify detection logic
 * - Does NOT change confidence or severity
 * - Write-time only, fully additive
 * - Deterministic normalization
 * 
 * OPERATIONS:
 * 1. Deduplicate signal arrays (network events, console errors)
 * 2. Normalize repeated patterns (same URL changes, DOM patterns)
 * 3. Mark deduplicated vs. unique signals
 * 4. Preserve original signal state for truth
 */

/**
 * Deduplicate network events by (method, url, status) tuple
 * 
 * @param {Array} networkEvents - Array of network events from evidence
 * @returns {Object} { unique: Array, duplicates: Array, deduplicatedCount: number }
 */
export function deduplicateNetworkEvents(networkEvents = []) {
  if (!Array.isArray(networkEvents) || networkEvents.length === 0) {
    return { unique: [], duplicates: [], deduplicatedCount: 0 };
  }

  const seen = new Map(); // Key: "METHOD::URL::STATUS"
  const unique = [];
  const duplicates = [];

  for (const event of networkEvents) {
    // Normalize to make tuple key
    const method = (event.method || 'GET').toUpperCase();
    const url = (event.url || '').trim();
    const status = event.status || 0;
    const key = `${method}::${url}::${status}`;

    if (seen.has(key)) {
      duplicates.push(event);
    } else {
      seen.set(key, true);
      unique.push({
        ...event,
        isDeduplicatedUnique: true, // Mark as unique after dedup
      });
    }
  }

  return {
    unique,
    duplicates,
    deduplicatedCount: duplicates.length,
  };
}

/**
 * Deduplicate console errors by message (ignoring stack/timestamp)
 * 
 * @param {Array} consoleErrors - Array of console error objects
 * @returns {Object} { unique: Array, duplicates: Array, deduplicatedCount: number }
 */
export function deduplicateConsoleErrors(consoleErrors = []) {
  if (!Array.isArray(consoleErrors) || consoleErrors.length === 0) {
    return { unique: [], duplicates: [], deduplicatedCount: 0 };
  }

  const seen = new Map(); // Key: normalized error message
  const unique = [];
  const duplicates = [];

  for (const error of consoleErrors) {
    // Normalize: take first 100 chars of message to avoid false negatives
    const message = ((error.message || error) || '').substring(0, 100).trim();
    
    if (seen.has(message)) {
      duplicates.push(error);
    } else {
      seen.set(message, true);
      unique.push({
        ...error,
        isDeduplicatedUnique: true,
      });
    }
  }

  return {
    unique,
    duplicates,
    deduplicatedCount: duplicates.length,
  };
}

/**
 * Normalize URL change signals (reduce multiple changes to single signal)
 * 
 * If URL changed multiple times OR in repeated patterns, normalize to:
 * - urlChanged: true (signal exists)
 * - urlChangeCount: N (how many times)
 * - uniqueUrls: Set of unique URLs visited
 * 
 * @param {Object} evidence - Evidence bundle with urlChanged signal
 * @returns {Object} { normalized: boolean, urlChangeData: Object }
 */
export function normalizeUrlChangeSignals(evidence = {}) {
  const urlChanged = evidence.urlChanged === true;
  const beforeUrl = evidence.beforeUrl || '';
  const afterUrl = evidence.afterUrl || '';

  if (!urlChanged || !beforeUrl || !afterUrl) {
    return {
      normalized: false,
      urlChangeData: {
        urlChanged: false,
        uniqueUrls: [],
        isRepeatedChange: false,
      },
    };
  }

  // Extract unique URLs
  const uniqueUrls = new Set();
  if (beforeUrl) uniqueUrls.add(beforeUrl);
  if (afterUrl) uniqueUrls.add(afterUrl);

  const isRepeatedChange = beforeUrl === afterUrl; // URL changed and came back

  return {
    normalized: true,
    urlChangeData: {
      urlChanged: true,
      uniqueUrls: Array.from(uniqueUrls),
      isRepeatedChange,
      beforeUrl,
      afterUrl,
    },
  };
}

/**
 * Normalize DOM change signals (reduce multiple small changes to overall signal)
 * 
 * If DOM changed, report:
 * - domChanged: true
 * - hasStructuralChange: boolean (nodes added/removed)
 * - hasAttributeChange: boolean (attributes only changed)
 * - hasContentChange: boolean (text content changed)
 * 
 * @param {Object} domDiff - DOM diff object from evidence
 * @returns {Object} Normalized DOM change representation
 */
export function normalizeDOMChangeSignals(domDiff = {}) {
  if (!domDiff || !domDiff.changed) {
    return {
      domChanged: false,
      changeTypes: [],
    };
  }

  const changeTypes = [];

  // Detect change types from diff structure
  if (domDiff.addedNodes?.length > 0 || domDiff.removedNodes?.length > 0) {
    changeTypes.push('structural');
  }

  if (domDiff.changedAttributes?.length > 0) {
    changeTypes.push('attribute');
  }

  if (domDiff.changedText?.length > 0) {
    changeTypes.push('content');
  }

  return {
    domChanged: true,
    changeTypes,
    nodeCount: {
      added: (domDiff.addedNodes || []).length,
      removed: (domDiff.removedNodes || []).length,
      changed: (domDiff.changedAttributes || []).length,
    },
  };
}

/**
 * Normalize loading signals to prevent double-counting
 * 
 * If both loadingStarted AND loadingResolved, mark as resolved.
 * If loadingStarted WITHOUT resolution, mark as stalled.
 * 
 * @param {Object} signals - Evidence signals object
 * @returns {Object} Normalized loading state
 */
export function normalizeLoadingSignals(signals = {}) {
  const loadingStarted = signals.loadingStarted === true;
  const loadingResolved = signals.loadingResolved === true;
  const loadingStalled = signals.loadingStalled === true;

  // Reconcile contradictory signals
  let loadingState = 'none';
  if (loadingStarted && loadingResolved) {
    loadingState = 'resolved'; // Resolved takes precedence
  } else if (loadingStarted && !loadingResolved && loadingStalled) {
    loadingState = 'stalled'; // Stalled with no resolution
  } else if (loadingStarted && !loadingResolved) {
    loadingState = 'pending'; // Still loading
  } else if (loadingResolved && !loadingStarted) {
    loadingState = 'resolved'; // Resolved without explicit start (edge case)
  }

  return {
    loadingState, // 'none' | 'pending' | 'resolved' | 'stalled'
    hasLoadingSignals: loadingStarted || loadingResolved || loadingStalled,
    originalSignals: {
      loadingStarted,
      loadingResolved,
      loadingStalled,
    },
  };
}

/**
 * De-duplicate and normalize all evidence signals in a finding
 * 
 * @param {Object} finding - Finding object with evidence
 * @returns {Object} Finding with deduplicated evidence added
 */
export function deduplicateAndNormalizeEvidence(finding = {}) {
  if (!finding || typeof finding !== 'object') {
    return finding;
  }

  const evidence = finding.evidence || {};

  // Apply deduplication and normalization
  const networkDedup = deduplicateNetworkEvents(evidence.networkRequests);
  const consoleDedup = deduplicateConsoleErrors(evidence.consoleErrors);
  const urlNorm = normalizeUrlChangeSignals(evidence);
  const domNorm = normalizeDOMChangeSignals(evidence.domDiff);
  const loadingNorm = normalizeLoadingSignals(finding.signals || {});

  // Attach quality metrics (write-time only, non-semantic)
  return {
    ...finding,
    evidenceQuality: {
      networkDeduplication: {
        uniqueCount: networkDedup.unique.length,
        duplicateCount: networkDedup.deduplicatedCount,
        deduplicationRatio: networkDedup.deduplicatedCount > 0 ? 
          (networkDedup.deduplicatedCount / (networkDedup.unique.length + networkDedup.deduplicatedCount)).toFixed(2) :
          '0.00',
      },
      consoleDeduplication: {
        uniqueCount: consoleDedup.unique.length,
        duplicateCount: consoleDedup.deduplicatedCount,
        deduplicationRatio: consoleDedup.deduplicatedCount > 0 ?
          (consoleDedup.deduplicatedCount / (consoleDedup.unique.length + consoleDedup.deduplicatedCount)).toFixed(2) :
          '0.00',
      },
      urlNormalization: urlNorm.urlChangeData,
      domNormalization: domNorm,
      loadingNormalization: loadingNorm,
    },
  };
}

/**
 * Check if evidence has been over-counted (multiple identical signals)
 * 
 * @param {Object} finding - Finding with evidence and signals
 * @returns {boolean} True if evidence appears over-counted
 */
export function hasOvercountedEvidence(finding = {}) {
  const evidence = finding.evidence || {};
  const signals = finding.signals || {};

  // Signal: urlChanged = true AND beforeUrl === afterUrl (same URL)
  if (signals.urlChanged === true && evidence.beforeUrl === evidence.afterUrl) {
    return true;
  }

  // Signal: networkActivity = true but all network events are identical
  if (signals.networkActivity === true && Array.isArray(evidence.networkRequests)) {
    const events = evidence.networkRequests;
    if (events.length > 1) {
      // All events identical (same method, URL, status)?
      const first = events[0];
      const allIdentical = events.every(e =>
        e.method === first.method &&
        e.url === first.url &&
        e.status === first.status
      );
      if (allIdentical) {
        return true; // Over-counted network activity
      }
    }
  }

  // Signal: consoleErrors = true but all messages identical
  if (signals.consoleErrors === true && Array.isArray(evidence.consoleErrors)) {
    const errors = evidence.consoleErrors;
    if (errors.length > 1) {
      const first = (errors[0]?.message || errors[0] || '').substring(0, 100);
      const allIdentical = errors.every(e =>
        ((e?.message || e || '').substring(0, 100)) === first
      );
      if (allIdentical) {
        return true; // Over-counted console errors
      }
    }
  }

  // Signal: both loadingStarted AND loadingResolved but no content changed
  if (signals.loadingStarted === true && signals.loadingResolved === true) {
    if (!signals.domChanged && !signals.navigationChanged) {
      return true; // Loading signals without actual change
    }
  }

  return false;
}

/**
 * Export evidence quality report for artifact
 * 
 * @param {Array} findings - Array of findings to analyze
 * @returns {Object} Quality summary
 */
export function generateEvidenceQualityReport(findings = []) {
  let totalFindings = 0;
  let findingsWithDuplicates = 0;
  let findingsWithOvercount = 0;
  const deduplicationStats = {
    networkDedupsApplied: 0,
    consoleDedupsApplied: 0,
  };

  for (const finding of findings) {
    totalFindings++;

    const quality = finding.evidenceQuality || {};
    if ((quality.networkDeduplication?.duplicateCount || 0) > 0) {
      deduplicationStats.networkDedupsApplied++;
      findingsWithDuplicates++;
    }
    if ((quality.consoleDeduplication?.duplicateCount || 0) > 0) {
      deduplicationStats.consoleDedupsApplied++;
      findingsWithDuplicates++;
    }

    if (hasOvercountedEvidence(finding)) {
      findingsWithOvercount++;
    }
  }

  return {
    totalFindings,
    findingsWithDeduplicatedEvidence: findingsWithDuplicates,
    findingsWithPotentialOvercount: findingsWithOvercount,
    deduplicationStats,
    qualityScore: totalFindings > 0 ?
      (((totalFindings - findingsWithOvercount) / totalFindings) * 100).toFixed(1) + '%' :
      'N/A',
  };
}








