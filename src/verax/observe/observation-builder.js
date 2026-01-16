/**
 * OBSERVATION BUILDER
 * 
 * Constructs observation object from traces, calculates coverage, and generates warnings.
 */

/**
 * Build observation object from collected traces
 * 
 * @param {Array} traces - Array of interaction traces
 * @param {Array} coverage - Coverage information
 * @param {Array} warnings - Warning messages
 * @param {Object} safetyStats - Safety mode statistics
 * @returns {Object}
 */
export function buildObservation(traces, coverage, warnings, safetyStats) {
  const observation = {
    timestamp: new Date().toISOString(),
    traces: traces,
    coverage: coverage || [],
    warnings: warnings || [],
    safetyStats: safetyStats || {}
  };

  return observation;
}

/**
 * Calculate coverage gaps from traces
 * 
 * @param {Array} traces - Array of interaction traces
 * @param {Array} discoveredInteractions - All interactions discovered during scan
 * @returns {Array}
 */
export function calculateCoverageGaps(traces, discoveredInteractions) {
  if (!discoveredInteractions || discoveredInteractions.length === 0) {
    return [];
  }

  const executedSelectors = new Set(
    traces
      .filter(t => t.interaction && t.interaction.selector)
      .map(t => t.interaction.selector)
  );

  const gaps = discoveredInteractions
    .filter(interaction => !executedSelectors.has(interaction.selector))
    .map(interaction => ({
      selector: interaction.selector,
      type: interaction.type,
      reason: 'budget_exhausted_or_skipped'
    }));

  return gaps;
}

/**
 * Generate warnings from observation data
 * 
 * @param {Object} frontier - Page frontier
 * @param {Array} coverage - Coverage data
 * @param {Object} safetyStats - Safety statistics
 * @returns {Array}
 */
export function generateWarnings(frontier, coverage, safetyStats) {
  const warnings = [];

  // Warn if frontier has unexplored pages
  if (frontier && frontier.queue && frontier.queue.length > 0) {
    warnings.push({
      type: 'unexplored_pages',
      count: frontier.queue.length,
      message: `${frontier.queue.length} pages in queue were not explored due to budget constraints`
    });
  }

  // Warn if safety mode blocked actions
  if (safetyStats && safetyStats.blockedNetworkWrites > 0) {
    warnings.push({
      type: 'safety_mode_active',
      blockedWrites: safetyStats.blockedNetworkWrites,
      message: `Safety mode prevented ${safetyStats.blockedNetworkWrites} write operations`
    });
  }

  if (safetyStats && safetyStats.blockedCrossOrigin > 0) {
    warnings.push({
      type: 'cross_origin_blocked',
      count: safetyStats.blockedCrossOrigin,
      message: `${safetyStats.blockedCrossOrigin} cross-origin requests were blocked`
    });
  }

  return warnings;
}

/**
 * Build safety statistics object
 * 
 * @param {number} blockedNetworkWrites - Number of blocked write operations
 * @param {number} blockedCrossOrigin - Number of blocked cross-origin requests
 * @param {Array} skippedInteractions - Interactions that were skipped
 * @returns {Object}
 */
export function buildSafetyStatistics(blockedNetworkWrites, blockedCrossOrigin, skippedInteractions) {
  return {
    safetyModeEnabled: true,
    blockedNetworkWrites: blockedNetworkWrites || 0,
    blockedCrossOrigin: blockedCrossOrigin || 0,
    skippedInteractions: skippedInteractions ? skippedInteractions.length : 0,
    skippedReasons: skippedInteractions ? countSkipReasons(skippedInteractions) : {}
  };
}

/**
 * Count reasons for skipped interactions
 * 
 * @param {Array} skippedInteractions - Skipped interactions
 * @returns {Object}
 */
function countSkipReasons(skippedInteractions) {
  const reasons = {};
  for (const skip of skippedInteractions) {
    const reason = skip.reason || 'unknown';
    reasons[reason] = (reasons[reason] || 0) + 1;
  }
  return reasons;
}

/**
 * Extract observedExpectations from traces
 * 
 * @param {Array} traces - Array of interaction traces
 * @returns {Array}
 */
export function extractObservedExpectations(traces) {
  const expectations = [];
  
  for (const trace of traces) {
    if (trace.observedExpectation) {
      expectations.push({
        ...trace.observedExpectation,
        traceId: trace.id,
        executionTimestamp: trace.timestamp
      });
    }
  }

  return expectations;
}

/**
 * Build skipped interactions summary
 * 
 * @param {Array} interactions - Skipped interactions
 * @returns {Array}
 */
export function buildSkippedInteractionsSummary(interactions) {
  if (!interactions || interactions.length === 0) {
    return [];
  }

  return interactions.map(skip => ({
    selector: skip.selector,
    type: skip.type,
    reason: skip.reason,
    element: skip.element
  }));
}
