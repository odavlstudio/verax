import { getTimeProvider } from '../../cli/util/support/time-provider.js';
/**
 * Detection Engine: Core of VERAX
 * Compares learn.json and observe.json to produce evidence-backed findings
 * with deterministic classification and confidence calculation
 */

class DetectionEngine {
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * Detect findings by comparing expectations with observations
   * @param {Object} learnData - The learn.json output
   * @param {Object} observeData - The observe.json output
   * @returns {Object} Findings with classifications
   */
  detect(learnData, observeData) {
    if (!learnData || !observeData) {
      throw new Error('Both learnData and observeData are required');
    }

    const expectations = learnData.expectations || [];
    const observations = observeData.observations || [];

    // Index observations for fast lookup
    const observationMap = this._indexObservations(observations);

    // Generate one finding per expectation
    const findings = expectations.map((expectation) => {
      return this._classifyExpectation(expectation, observationMap, observations);
    });

    // Calculate stats
    const stats = this._calculateStats(findings);

    return {
      findings,
      stats,
      detectedAt: getTimeProvider().iso(),
      version: '1.0.0'
    };
  }

  /**
   * Index observations by expectation ID and promise for fast lookup
   * @private
   */
  _indexObservations(observations) {
    const map = {
      byId: {},
      byPromise: {}
    };

    observations.forEach((obs) => {
      // Index by expectation ID if available
      if (obs.expectationId) {
        if (!map.byId[obs.expectationId]) {
          map.byId[obs.expectationId] = [];
        }
        map.byId[obs.expectationId].push(obs);
      }

      // Index by promise kind for coverage gap detection
      if (obs.promise && obs.promise.kind) {
        if (!map.byPromise[obs.promise.kind]) {
          map.byPromise[obs.promise.kind] = [];
        }
        map.byPromise[obs.promise.kind].push(obs);
      }
    });

    return map;
  }

  /**
   * Classify a single expectation against observations
   * @private
   */
  _classifyExpectation(expectation, observationMap, _allObservations) {
    const expectationId = expectation.id;
    const promise = expectation.promise || {};

    // Find direct observations for this expectation
    const directObservations = observationMap.byId[expectationId] || [];

    // Determine classification
    let classification = 'informational'; // default
    let matchedObservation = null;
    let evidence = [];

    if (directObservations.length > 0) {
      // We have observations for this expectation
      const obs = directObservations[0];
      matchedObservation = obs;

      if (obs.observed === true) {
        classification = 'observed';
        evidence = obs.evidence || [];
      } else if (obs.attempted === true) {
        classification = 'silent-failure';
        evidence = obs.evidence || [];
      } else {
        classification = 'unproven';
        evidence = obs.evidence || [];
      }
    } else {
      // No direct observations - check if we attempted this type of observation
      const relevantObservations =
        observationMap.byPromise[promise.kind] || [];
      const wasAttempted = relevantObservations.some((obs) => obs.attempted);

      if (wasAttempted) {
        // We attempted this type but didn't get this specific promise
        classification = 'silent-failure';
      } else {
        // We never attempted to observe this type of promise
        classification = 'coverage-gap';
      }
    }

    // Calculate deterministic confidence
    const confidence = this._calculateConfidence(
      expectation,
      matchedObservation,
      classification
    );

    // Determine impact
    const impact = this._determineImpact(expectation, classification);

    return {
      id: expectation.id,
      expectation: expectation,
      classification,
      confidence,
      impact,
      evidence,
      matched: matchedObservation || null,
      summary: this._generateSummary(expectation, classification),
      details: {
        expectationType: expectation.type,
        promiseKind: promise.kind,
        promiseValue: promise.value,
        attemptedObservations: observationMap.byPromise[promise.kind]
          ? observationMap.byPromise[promise.kind].length
          : 0
      }
    };
  }

  /**
   * Calculate deterministic confidence score (0-1)
   * Based on: expectation confidence, observation evidence, classification
   * @private
   */
  _calculateConfidence(expectation, observation, classification) {
    const baseConfidence = expectation.confidence || 0.5;

    let multiplier = 1.0;
    switch (classification) {
      case 'observed':
        // High confidence - we saw it
        multiplier = 1.0;
        break;
      case 'silent-failure':
        // Medium-high - we looked for it but didn't see it
        multiplier = 0.75;
        break;
      case 'coverage-gap':
        // Lower - we didn't even try to look
        multiplier = 0.5;
        break;
      case 'unproven':
        // Low - we tried but evidence insufficient
        multiplier = 0.25;
        break;
      default:
        multiplier = 0.5;
    }

    // If we have evidence, boost confidence slightly
    if (observation && observation.evidence && observation.evidence.length > 0) {
      multiplier = Math.min(1.0, multiplier + 0.1);
    }

    const confidence = baseConfidence * multiplier;
    return Math.round(confidence * 100) / 100; // Round to 2 decimals
  }

  /**
   * Determine impact level based on expectation criticality
   * @private
   */
  _determineImpact(expectation, classification) {
    // If explicitly marked as critical
    if (expectation.critical === true) {
      return 'HIGH';
    }

    // If silent-failure on a navigation or network call, it's high impact
    if (
      classification === 'silent-failure' &&
      (expectation.type === 'navigation' || expectation.type === 'network')
    ) {
      return 'HIGH';
    }

    // State mutations are typically medium impact
    if (expectation.type === 'state') {
      return 'MEDIUM';
    }

    // Coverage gaps are lower impact (we didn't even try)
    if (classification === 'coverage-gap') {
      return 'LOW';
    }

    return 'MEDIUM';
  }

  /**
   * Generate human-readable summary
   * @private
   */
  _generateSummary(expectation, classification) {
    const type = expectation.type || 'unknown';
    const promise = expectation.promise || {};
    const value = promise.value || 'unknown';

    const summaries = {
      'silent-failure': `Silent failure: ${type} "${value}" was learned but never observed during testing`,
      'observed': `Success: ${type} "${value}" was verified during testing`,
      'coverage-gap': `Coverage gap: ${type} "${value}" was never attempted during testing`,
      'unproven': `Unproven: ${type} "${value}" was attempted but insufficient evidence`,
      'informational': `Info: ${type} "${value}" was analyzed`
    };

    return summaries[classification] || summaries.informational;
  }

  /**
   * Calculate statistics across all findings
   * @private
   */
  _calculateStats(findings) {
    const stats = {
      total: findings.length,
      byClassification: {},
      byImpact: {},
      averageConfidence: 0,
      highConfidence: 0,
      mediumConfidence: 0,
      lowConfidence: 0
    };

    // Initialize counters
    ['silent-failure', 'observed', 'coverage-gap', 'unproven', 'informational'].forEach(
      (c) => {
        stats.byClassification[c] = 0;
      }
    );
    ['HIGH', 'MEDIUM', 'LOW'].forEach((i) => {
      stats.byImpact[i] = 0;
    });

    // Count and aggregate
    let totalConfidence = 0;
    findings.forEach((finding) => {
      stats.byClassification[finding.classification]++;
      stats.byImpact[finding.impact]++;

      totalConfidence += finding.confidence;

      if (finding.confidence >= 0.8) {
        stats.highConfidence++;
      } else if (finding.confidence >= 0.5) {
        stats.mediumConfidence++;
      } else {
        stats.lowConfidence++;
      }
    });

    stats.averageConfidence =
      findings.length > 0
        ? Math.round((totalConfidence / findings.length) * 100) / 100
        : 0;

    return stats;
  }
}

module.exports = DetectionEngine;



