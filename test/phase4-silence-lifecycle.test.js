/**
 * PHASE 4 - SILENCE LIFECYCLE AND IMPACT TESTING
 * 
 * Tests for:
 * 1. Silence lifecycle model (type, trigger, evaluation_status, promise association)
 * 2. Promise-silence associations
 * 3. Silence integrity validation
 * 4. Confidence impact accounting
 * 5. Impact summary generation
 */

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import SilenceTracker, { SILENCE_TYPES, EVALUATION_STATUS, SILENCE_REASONS } from '../src/verax/core/silence-model.js';
import { inferPromiseForSilence, validateSilenceIntegrity } from '../src/verax/detect/verdict-engine.js';
import { computeSilenceImpact, aggregateSilenceImpacts, createImpactSummary, categorizeSilencesByImpactSeverity } from '../src/verax/core/silence-impact.js';

describe('PHASE 4: Silence Lifecycle Model', () => {
  test('SilenceTracker infers silence_type from reason', () => {
    const tracker = new SilenceTracker();
    
    tracker.record({
      scope: 'interaction',
      reason: SILENCE_REASONS.LOAD_TIMEOUT,
      description: 'Load timed out',
      context: {},
      impact: 'blocks_nav'
    });
    
    const silence = tracker.entries[0];
    assert.equal(silence.silence_type, SILENCE_TYPES.NAVIGATION_TIMEOUT);
    assert.ok(silence.silence_type, 'silence_type inferred');
  });

  test('SilenceTracker infers trigger from reason', () => {
    const tracker = new SilenceTracker();
    
    tracker.record({
      scope: 'interaction',
      reason: SILENCE_REASONS.DESTRUCTIVE_TEXT,
      description: 'Delete button blocked',
      context: {},
      impact: 'blocks_nav'
    });
    
    const silence = tracker.entries[0];
    assert.equal(silence.trigger, 'destructive_text_block');
    assert.ok(silence.trigger, 'trigger inferred');
  });

  test('SilenceTracker infers evaluation_status from reason', () => {
    const tracker = new SilenceTracker();
    
    tracker.record({
      scope: 'interaction',
      reason: SILENCE_REASONS.NAVIGATION_TIMEOUT,
      description: 'Timeout',
      context: {},
      impact: 'blocks_nav'
    });
    
    const silence = tracker.entries[0];
    assert.equal(silence.evaluation_status, EVALUATION_STATUS.TIMED_OUT);
  });

  test('SilenceTracker infers confidence_impact from reason', () => {
    const tracker = new SilenceTracker();
    
    tracker.record({
      scope: 'interaction',
      reason: SILENCE_REASONS.SENSOR_FAILED,
      description: 'Sensor unavailable',
      context: {},
      impact: 'affects_expectations'
    });
    
    const silence = tracker.entries[0];
    assert.ok(silence.confidence_impact, 'confidence_impact computed');
    assert.ok(silence.confidence_impact.coverage !== 0, 'coverage impact nonzero for sensor failure');
    assert.ok(silence.confidence_impact.promise_verification !== 0, 'promise_verification impact nonzero');
    assert.ok(silence.confidence_impact.overall !== 0, 'overall impact nonzero');
  });

  test('SilenceTracker provides getSilencesByType query', () => {
    const tracker = new SilenceTracker();
    
    tracker.record({
      scope: 'interaction',
      reason: SILENCE_REASONS.LOAD_TIMEOUT,
      description: 'Timeout 1',
      context: {},
      impact: 'blocks_nav'
    });
    
    tracker.record({
      scope: 'interaction',
      reason: SILENCE_REASONS.INTERACTION_TIMEOUT,
      description: 'Timeout 2',
      context: {},
      impact: 'blocks_nav'
    });
    
    const navTimeouts = tracker.getSilencesByType(SILENCE_TYPES.NAVIGATION_TIMEOUT);
    assert.equal(navTimeouts.length, 1, 'Found navigation timeouts');
  });

  test('SilenceTracker provides getSilencesByEvalStatus query', () => {
    const tracker = new SilenceTracker();
    
    tracker.record({
      scope: 'interaction',
      reason: SILENCE_REASONS.NAVIGATION_TIMEOUT,
      description: 'Timeout',
      context: {},
      impact: 'blocks_nav'
    });
    
    tracker.record({
      scope: 'interaction',
      reason: SILENCE_REASONS.INCREMENTAL_UNCHANGED,
      description: 'Reused',
      context: {},
      impact: 'blocks_nav'
    });
    
    const timedOut = tracker.getSilencesByEvalStatus(EVALUATION_STATUS.TIMED_OUT);
    const skipped = tracker.getSilencesByEvalStatus(EVALUATION_STATUS.SKIPPED);
    
    assert.equal(timedOut.length, 1);
    assert.equal(skipped.length, 1);
  });

  test('SilenceTracker.getSummary includes Phase 4 metrics', () => {
    const tracker = new SilenceTracker();
    
    tracker.record({
      scope: 'interaction',
      reason: SILENCE_REASONS.LOAD_TIMEOUT,
      description: 'Timeout',
      context: {},
      impact: 'blocks_nav'
    });
    
    const summary = tracker.getSummary();
    
    assert.ok(summary.byType, 'Summary includes byType');
    assert.ok(summary.byEvaluationStatus, 'Summary includes byEvaluationStatus');
    assert.ok(summary.confidenceImpact, 'Summary includes confidenceImpact');
    assert.equal(summary.byType[SILENCE_TYPES.NAVIGATION_TIMEOUT], 1);
    assert.equal(summary.byEvaluationStatus[EVALUATION_STATUS.TIMED_OUT], 1);
  });
});

describe('PHASE 4: Promise-Silence Association', () => {
  test('inferPromiseForSilence associates navigation silences with NAVIGATION_PROMISE', () => {
    const silence = {
      silence_type: SILENCE_TYPES.NAVIGATION_TIMEOUT,
      scope: 'navigation',
      reason: SILENCE_REASONS.NAVIGATION_TIMEOUT,
      context: {}
    };
    
    const promise = inferPromiseForSilence(silence);
    assert.ok(promise);
    assert.equal(promise.type, 'NAVIGATION_PROMISE');
  });

  test('inferPromiseForSilence handles sensor failures with no promise', () => {
    const silence = {
      silence_type: SILENCE_TYPES.SENSOR_FAILURE,
      scope: 'sensor',
      reason: SILENCE_REASONS.SENSOR_FAILED,
      context: {}
    };
    
    const promise = inferPromiseForSilence(silence);
    assert.ok(promise);
    assert.equal(promise.type, null);
    assert.ok(promise.reason_no_association);
  });

  test('validateSilenceIntegrity rejects success outcomes', () => {
    const silence = {
      outcome: 'SUCCESS',
      scope: 'interaction',
      reason: SILENCE_REASONS.NAVIGATION_TIMEOUT,
      evaluation_status: EVALUATION_STATUS.TIMED_OUT
    };
    
    const result = validateSilenceIntegrity(silence);
    assert.equal(result.valid, false);
    assert.match(result.reason, /cannot have outcome/i);
  });

  test('validateSilenceIntegrity accepts valid silences', () => {
    const silence = {
      outcome: 'SILENT_FAILURE',
      scope: 'interaction',
      reason: SILENCE_REASONS.NAVIGATION_TIMEOUT,
      evaluation_status: EVALUATION_STATUS.TIMED_OUT
    };
    
    const result = validateSilenceIntegrity(silence);
    assert.equal(result.valid, true);
  });

  test('validateSilenceIntegrity requires valid evaluation_status', () => {
    const silence = {
      outcome: 'SILENT_FAILURE',
      scope: 'interaction',
      reason: SILENCE_REASONS.NAVIGATION_TIMEOUT,
      evaluation_status: 'INVALID_STATUS'
    };
    
    const result = validateSilenceIntegrity(silence);
    assert.equal(result.valid, false);
    assert.match(result.reason, /invalid evaluation_status/i);
  });
});

describe('PHASE 4: Silence Impact Accounting', () => {
  test('computeSilenceImpact returns negative values (silence reduces confidence)', () => {
    const silence = {
      silence_type: SILENCE_TYPES.NAVIGATION_TIMEOUT,
      evaluation_status: EVALUATION_STATUS.TIMED_OUT
    };
    
    const impact = computeSilenceImpact(silence);
    assert.ok(impact.coverage <= 0, 'coverage impact is non-positive');
    assert.ok(impact.promise_verification <= 0, 'promise_verification impact is non-positive');
    assert.ok(impact.overall <= 0, 'overall impact is non-positive');
  });

  test('Critical silence types have highest impact', () => {
    const sensorFailure = computeSilenceImpact({
      silence_type: SILENCE_TYPES.SENSOR_FAILURE,
      evaluation_status: EVALUATION_STATUS.INCOMPLETE
    });
    
    const noExpectation = computeSilenceImpact({
      silence_type: SILENCE_TYPES.PROMISE_NOT_EVALUATED,
      evaluation_status: EVALUATION_STATUS.AMBIGUOUS
    });
    
    // Sensor failure should have much worse overall impact
    assert.ok(sensorFailure.overall < noExpectation.overall);
  });

  test('aggregateSilenceImpacts sums impacts with clamping', () => {
    const silences = [
      {
        silence_type: SILENCE_TYPES.SENSOR_FAILURE,
        evaluation_status: EVALUATION_STATUS.INCOMPLETE
      },
      {
        silence_type: SILENCE_TYPES.NAVIGATION_TIMEOUT,
        evaluation_status: EVALUATION_STATUS.TIMED_OUT
      }
    ];
    
    const aggregated = aggregateSilenceImpacts(silences);
    
    // Should be clamped at -100
    assert.ok(aggregated.coverage >= -100);
    assert.ok(aggregated.promise_verification >= -100);
    assert.ok(aggregated.overall >= -100);
    
    // Should all be negative
    assert.ok(aggregated.coverage <= 0);
    assert.ok(aggregated.promise_verification <= 0);
    assert.ok(aggregated.overall <= 0);
  });

  test('createImpactSummary generates structured output', () => {
    const silences = [
      {
        silence_type: SILENCE_TYPES.NAVIGATION_TIMEOUT,
        evaluation_status: EVALUATION_STATUS.TIMED_OUT,
        reason: SILENCE_REASONS.NAVIGATION_TIMEOUT
      }
    ];
    
    const summary = createImpactSummary(silences);
    
    assert.equal(summary.total_silences, 1);
    assert.ok(summary.aggregated_impact);
    assert.ok(summary.confidence_interpretation);
    assert.ok(summary.by_severity);
    assert.ok(summary.most_impactful_types);
  });

  test('categorizeSilencesByImpactSeverity classifies by severity', () => {
    const silences = [
      {
        silence_type: SILENCE_TYPES.SENSOR_FAILURE,
        evaluation_status: EVALUATION_STATUS.INCOMPLETE
      },
      {
        silence_type: SILENCE_TYPES.PROMISE_NOT_EVALUATED,
        evaluation_status: EVALUATION_STATUS.AMBIGUOUS
      }
    ];
    
    const categorized = categorizeSilencesByImpactSeverity(silences);
    
    assert.ok(categorized.critical.length >= 1, 'Critical silences identified');
    assert.ok(categorized.low.length >= 1, 'Low severity silences identified');
  });
});

describe('PHASE 4: Silence Lifecycle in CLI Output', () => {
  test('Summary includes silence lifecycle breakdown', () => {
    const tracker = new SilenceTracker();
    
    tracker.record({
      scope: 'interaction',
      reason: SILENCE_REASONS.LOAD_TIMEOUT,
      description: 'Timeout',
      context: {},
      impact: 'blocks_nav'
    });
    
    tracker.record({
      scope: 'interaction',
      reason: SILENCE_REASONS.SENSOR_FAILED,
      description: 'Sensor failed',
      context: {},
      impact: 'affects_expectations'
    });
    
    const summary = tracker.getSummary();
    
    // Check byType breakdown exists and is populated
    assert.ok(summary.byType);
    assert.equal(summary.byType[SILENCE_TYPES.NAVIGATION_TIMEOUT], 1);
    assert.equal(summary.byType[SILENCE_TYPES.SENSOR_FAILURE], 1);
    
    // Check evaluation_status breakdown
    assert.ok(summary.byEvaluationStatus);
    assert.ok(summary.byEvaluationStatus[EVALUATION_STATUS.TIMED_OUT]);
    assert.ok(summary.byEvaluationStatus[EVALUATION_STATUS.INCOMPLETE]);
  });
});
