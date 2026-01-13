/**
 * SILENCE TRACKING INTEGRATION TESTS
 * 
 * Demonstrates the unified silence tracking system that makes all
 * observation gaps (timeouts, budget limits, safety skips, etc.) explicit.
 */

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import SilenceTracker, { SILENCE_REASONS, SILENCE_CATEGORIES } from '../src/verax/core/silence-model.js';

describe('Silence Model', () => {
  test('SilenceTracker initializes empty', () => {
    const tracker = new SilenceTracker();
    
    assert.deepEqual(tracker.entries, []);
    assert.equal(tracker.getSummary().totalSilences, 0);
  });

  test('Records single silence entry', () => {
    const tracker = new SilenceTracker();
    
    tracker.record({
      scope: 'interaction',
      reason: SILENCE_REASONS.INTERACTION_LIMIT_EXCEEDED,
      description: 'Reached max 50 interactions',
      context: { executed: 50, max: 50 },
      impact: 'blocks_nav'
    });
    
    assert.equal(tracker.entries.length, 1);
    assert.equal(tracker.entries[0].reason, SILENCE_REASONS.INTERACTION_LIMIT_EXCEEDED);
  });

  test('Records batch of silences', () => {
    const tracker = new SilenceTracker();
    
    const entries = [
      {
        scope: 'interaction',
        reason: SILENCE_REASONS.INTERACTION_LIMIT_EXCEEDED,
        description: 'Limit 1',
        context: {},
        impact: 'blocks_nav'
      },
      {
        scope: 'interaction',
        reason: SILENCE_REASONS.NAVIGATION_TIMEOUT,
        description: 'Timeout 1',
        context: {},
        impact: 'blocks_nav'
      }
    ];
    
    tracker.recordBatch(entries);
    
    assert.equal(tracker.entries.length, 2);
  });

  test('Categorizes silences automatically', () => {
    const tracker = new SilenceTracker();
    
    tracker.record({
      scope: 'interaction',
      reason: SILENCE_REASONS.INTERACTION_LIMIT_EXCEEDED,
      description: 'Budget exceeded',
      context: {},
      impact: 'blocks_nav'
    });
    
    tracker.record({
      scope: 'interaction',
      reason: SILENCE_REASONS.NAVIGATION_TIMEOUT,
      description: 'Timeout',
      context: {},
      impact: 'blocks_nav'
    });
    
    // Use the tracker's byCategory directly (not summary which only counts non-empty)
    assert.ok(tracker.byCategory[SILENCE_CATEGORIES.BUDGET].length >= 1);
    assert.ok(tracker.byCategory[SILENCE_CATEGORIES.TIMEOUT].length >= 1);
  });

  test('Groups silences by reason', () => {
    const tracker = new SilenceTracker();
    
    for (let i = 0; i < 3; i++) {
      tracker.record({
        scope: 'interaction',
        reason: SILENCE_REASONS.INTERACTION_LIMIT_EXCEEDED,
        description: `Limit exceeded ${i}`,
        context: {},
        impact: 'blocks_nav'
      });
    }
    
    const byReason = tracker.getReason(SILENCE_REASONS.INTERACTION_LIMIT_EXCEEDED);
    assert.equal(byReason.length, 3);
  });

  test('Generates detailed summary for output', () => {
    const tracker = new SilenceTracker();
    
    tracker.record({
      scope: 'interaction',
      reason: SILENCE_REASONS.INTERACTION_LIMIT_EXCEEDED,
      description: 'Reached max 50 interactions',
      context: { executed: 50, max: 50 },
      impact: 'blocks_nav'
    });
    
    const detailed = tracker.getDetailedSummary();
    
    assert.equal(detailed.total, 1);
    assert.equal(detailed.entries.length, 1);
    assert.equal(detailed.summary.totalSilences, 1);
  });

  test('Validates required fields', () => {
    const tracker = new SilenceTracker();
    
    assert.throws(() => {
      tracker.record({
        // Missing required fields
        scope: 'interaction'
        // No reason, description, impact
      });
    });
  });

  test('Handles multiple categories and reasons', () => {
    const tracker = new SilenceTracker();
    
    // Budget
    tracker.record({
      scope: 'page',
      reason: SILENCE_REASONS.PAGE_LIMIT_EXCEEDED,
      description: 'Page limit',
      context: {},
      impact: 'blocks_nav'
    });
    
    // Timeout
    tracker.record({
      scope: 'navigation',
      reason: SILENCE_REASONS.NAVIGATION_TIMEOUT,
      description: 'Nav timeout',
      context: {},
      impact: 'blocks_nav'
    });
    
    // Safety
    tracker.record({
      scope: 'interaction',
      reason: SILENCE_REASONS.DESTRUCTIVE_TEXT,
      description: 'Logout detected',
      context: {},
      impact: 'unknown_behavior'
    });
    
    // Expectation
    tracker.record({
      scope: 'expectation',
      reason: SILENCE_REASONS.NO_EXPECTATION,
      description: 'No expectation',
      context: {},
      impact: 'affects_expectations'
    });
    
    // Incremental
    tracker.record({
      scope: 'interaction',
      reason: SILENCE_REASONS.INCREMENTAL_UNCHANGED,
      description: 'Reused',
      context: {},
      impact: 'affects_expectations'
    });
    
    const summary = tracker.getSummary();
    
    assert.equal(summary.totalSilences, 5);
    assert.ok(Object.keys(summary.byCategory).length > 0);
    assert.ok(Object.keys(summary.byReason).length > 0);
  });

  test('Counts multiple items affected by single silence', () => {
    const tracker = new SilenceTracker();
    
    tracker.record({
      scope: 'interaction',
      reason: SILENCE_REASONS.INTERACTION_LIMIT_EXCEEDED,
      description: 'Reached interaction limit',
      context: { executed: 50, max: 50, remaining: 15 },
      impact: 'blocks_nav',
      count: 15  // 15 interactions weren't checked
    });
    
    const detailed = tracker.getDetailedSummary();
    assert.equal(detailed.entries[0].count, 15);
  });

  test('Includes evidence URL when provided', () => {
    const tracker = new SilenceTracker();
    
    tracker.record({
      scope: 'navigation',
      reason: SILENCE_REASONS.NAVIGATION_TIMEOUT,
      description: 'Timeout on /dashboard',
      context: {},
      impact: 'blocks_nav',
      evidenceUrl: 'http://example.com/dashboard'
    });
    
    const detailed = tracker.getDetailedSummary();
    assert.equal(detailed.entries[0].evidenceUrl, 'http://example.com/dashboard');
  });
});

describe('Silence Categories', () => {
  test('BUDGET category includes budget-related reasons', () => {
    const tracker = new SilenceTracker();
    
    tracker.record({
      scope: 'interaction',
      reason: SILENCE_REASONS.INTERACTION_LIMIT_EXCEEDED,
      description: 'Limit',
      context: {},
      impact: 'blocks_nav'
    });
    
    const budgetSilences = tracker.getCategory(SILENCE_CATEGORIES.BUDGET);
    assert.ok(budgetSilences.length > 0);
  });

  test('TIMEOUT category includes timeout reasons', () => {
    const tracker = new SilenceTracker();
    
    tracker.record({
      scope: 'navigation',
      reason: SILENCE_REASONS.NAVIGATION_TIMEOUT,
      description: 'Timeout',
      context: {},
      impact: 'blocks_nav'
    });
    
    const timeoutSilences = tracker.getCategory(SILENCE_CATEGORIES.TIMEOUT);
    assert.ok(timeoutSilences.length > 0);
  });

  test('SAFETY category includes safety skip reasons', () => {
    const tracker = new SilenceTracker();
    
    tracker.record({
      scope: 'interaction',
      reason: SILENCE_REASONS.DESTRUCTIVE_TEXT,
      description: 'Logout',
      context: {},
      impact: 'unknown_behavior'
    });
    
    const safetySilences = tracker.getCategory(SILENCE_CATEGORIES.SAFETY);
    assert.ok(safetySilences.length > 0);
  });

  test('EXPECTATION category includes unverified reasons', () => {
    const tracker = new SilenceTracker();
    
    tracker.record({
      scope: 'expectation',
      reason: SILENCE_REASONS.NO_EXPECTATION,
      description: 'No expectation',
      context: {},
      impact: 'affects_expectations'
    });
    
    const expectationSilences = tracker.getCategory(SILENCE_CATEGORIES.EXPECTATION);
    assert.ok(expectationSilences.length > 0);
  });

  test('INCREMENTAL category tracks reused observations', () => {
    const tracker = new SilenceTracker();
    
    tracker.record({
      scope: 'interaction',
      reason: SILENCE_REASONS.INCREMENTAL_UNCHANGED,
      description: 'Reused from previous',
      context: {},
      impact: 'affects_expectations'
    });
    
    const incrementalSilences = tracker.getCategory(SILENCE_CATEGORIES.INCREMENTAL);
    assert.ok(incrementalSilences.length > 0);
  });
});

describe('Silence Scopes', () => {
  test('Tracks page-level silences', () => {
    const tracker = new SilenceTracker();
    
    tracker.record({
      scope: 'page',
      reason: SILENCE_REASONS.PAGE_LIMIT_EXCEEDED,
      description: 'Page limit',
      context: {},
      impact: 'blocks_nav'
    });
    
    const summary = tracker.getSummary();
    assert.equal(summary.scopes.page, 1);
  });

  test('Tracks interaction-level silences', () => {
    const tracker = new SilenceTracker();
    
    tracker.record({
      scope: 'interaction',
      reason: SILENCE_REASONS.INTERACTION_LIMIT_EXCEEDED,
      description: 'Interaction limit',
      context: {},
      impact: 'blocks_nav'
    });
    
    const summary = tracker.getSummary();
    assert.equal(summary.scopes.interaction, 1);
  });

  test('Tracks expectation-level silences', () => {
    const tracker = new SilenceTracker();
    
    tracker.record({
      scope: 'expectation',
      reason: SILENCE_REASONS.NO_EXPECTATION,
      description: 'No expectation',
      context: {},
      impact: 'affects_expectations'
    });
    
    const summary = tracker.getSummary();
    assert.equal(summary.scopes.expectation, 1);
  });
});

describe('Silence Output Format', () => {
  test('Detailed summary matches expected structure', () => {
    const tracker = new SilenceTracker();
    
    tracker.record({
      scope: 'interaction',
      reason: SILENCE_REASONS.INTERACTION_LIMIT_EXCEEDED,
      description: 'Limit',
      context: { executed: 50, max: 50 },
      impact: 'blocks_nav',
      count: 10
    });
    
    const detailed = tracker.getDetailedSummary();
    
    // Check structure
    assert.ok(Object.prototype.hasOwnProperty.call(detailed, 'total'));
    assert.ok(Object.prototype.hasOwnProperty.call(detailed, 'entries'));
    assert.ok(Object.prototype.hasOwnProperty.call(detailed, 'summary'));
    
    // Check entries structure
    assert.ok(Object.prototype.hasOwnProperty.call(detailed.entries[0], 'scope'));
    assert.ok(Object.prototype.hasOwnProperty.call(detailed.entries[0], 'reason'));
    assert.ok(Object.prototype.hasOwnProperty.call(detailed.entries[0], 'description'));
    assert.ok(Object.prototype.hasOwnProperty.call(detailed.entries[0], 'context'));
    assert.ok(Object.prototype.hasOwnProperty.call(detailed.entries[0], 'impact'));
    
    // Check summary structure
    assert.ok(Object.prototype.hasOwnProperty.call(detailed.summary, 'totalSilences'));
    assert.ok(Object.prototype.hasOwnProperty.call(detailed.summary, 'byCategory'));
    assert.ok(Object.prototype.hasOwnProperty.call(detailed.summary, 'byReason'));
  });
});
