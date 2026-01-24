/**
 * STAGE 3: SILENT FAILURE CANON
 * Contract Tests for 6 Canonical Silent Failure Classes
 *
 * CRITICAL SEMANTIC: Silent Failure = promise + attempted + NO observable outcome + run COMPLETE
 *
 * Verifies that:
 * 1. CONFIRMED requires: attempt proof + negative outcome evidence + observation complete
 * 2. DISCONFIRMING signals (feedback, DOM change, nav) cause return null (not silent)
 * 3. Incomplete observation → SUSPECTED
 * 4. Evidence Law enforced (runComplete required for CONFIRMED)
 * 5. Confidence based on strength of negative evidence
 *
 * Classes tested:
 * A) navigation_silent_failure - Click executed, no route change, no feedback
 * B) submit_silent_failure - Submit executed, no feedback (network optional)
 * C) ui_feedback_silent_failure - Action executed, no feedback/nav/DOM
 * D) state_change_silent_failure - Mutation attempted, no DOM change, no feedback
 * E) loading_phantom_failure - Loading started, never resolved
 * F) permission_wall_silent_failure - Action attempted, silently denied
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { classifySilentFailure } from '../../src/cli/util/detection/silent-failure-classifier.js';

// ============================================================================
// CLASS A: NAVIGATION SILENT FAILURE
// ============================================================================

test('A: Navigation > CONFIRMED: click attempted, no nav change, no feedback, no DOM, run complete', () => {
  const expectation = { type: 'navigation', promise: { value: 'navigate', description: 'click link' } };
  const observation = { attempted: true, runComplete: true };
  const signals = {
    navigationChanged: false,
    feedbackSeen: false,
    ariaLiveUpdated: false,
    meaningfulDomChange: false,
    domChanged: false,
  };

  const result = classifySilentFailure(expectation, observation, signals, true);
  assert.strictEqual(result.type, 'navigation_silent_failure', 'Should CONFIRM nav silent failure');
  assert.strictEqual(result.status, 'CONFIRMED');
  assert.ok(result.confidence > 0.5);
});

test('A: Navigation > DISCONFIRM: meaningful DOM change proves something happened', () => {
  const expectation = { type: 'navigation', promise: { value: 'navigate' } };
  const observation = { attempted: true, runComplete: true };
  const signals = {
    navigationChanged: false,
    feedbackSeen: false,
    meaningfulDomChange: true, // ← DISCONFIRMING
    domChanged: false,
  };

  const result = classifySilentFailure(expectation, observation, signals, true);
  assert.strictEqual(result, null, 'DOM change should return null (not silent, something happened)');
});

test('A: Navigation > DISCONFIRM: feedback proves communication occurred', () => {
  const expectation = { type: 'navigation', promise: { value: 'navigate' } };
  const observation = { attempted: true, runComplete: true };
  const signals = {
    navigationChanged: false,
    feedbackSeen: true, // ← DISCONFIRMING
    meaningfulDomChange: false,
  };

  const result = classifySilentFailure(expectation, observation, signals, true);
  assert.strictEqual(result, null, 'Feedback should return null (not silent, user got message)');
});

test('A: Navigation > SUSPECTED: attempt but incomplete observation', () => {
  const expectation = { type: 'navigation', promise: { value: 'navigate' } };
  const observation = { attempted: true, runComplete: false }; // ← INCOMPLETE
  const signals = {
    navigationChanged: false,
    feedbackSeen: false,
    meaningfulDomChange: false,
  };

  const result = classifySilentFailure(expectation, observation, signals, true);
  assert.strictEqual(result.type, 'navigation_silent_failure');
  assert.strictEqual(result.status, 'SUSPECTED', 'Incomplete observation = SUSPECTED');
  assert.ok(result.confidence < 0.65);
});

// ============================================================================
// CLASS B: SUBMIT SILENT FAILURE
// ============================================================================

test('B: Submit > CONFIRMED: submit attempted, no feedback, no DOM, run complete', () => {
  const expectation = { type: 'submit', promise: { value: 'submit', description: 'form submission' } };
  const observation = { attempted: true, runComplete: true };
  const signals = {
    feedbackSeen: false,
    ariaLiveUpdated: false,
    meaningfulDomChange: false,
    domChanged: false,
  };

  const result = classifySilentFailure(expectation, observation, signals, true);
  assert.strictEqual(result.type, 'submit_silent_failure');
  assert.strictEqual(result.status, 'CONFIRMED');
});

test('B: Submit > CONFIRMED even with network: network present but UI silent', () => {
  const expectation = { type: 'submit', promise: { value: 'submit' } };
  const observation = { attempted: true, runComplete: true };
  const signals = {
    feedbackSeen: false,
    meaningfulDomChange: false,
    networkActivity: true, // ← Present but...
    // NO feedback despite network activity = submit went to backend but got no UI outcome
  };

  const result = classifySilentFailure(expectation, observation, signals, true);
  assert.strictEqual(result.type, 'submit_silent_failure', 'Network activity does not contradict UI silence');
  assert.strictEqual(result.status, 'CONFIRMED');
});

test('B: Submit > DISCONFIRM: feedback proves user got response', () => {
  const expectation = { type: 'submit', promise: { value: 'submit' } };
  const observation = { attempted: true, runComplete: true };
  const signals = {
    feedbackSeen: true, // ← DISCONFIRMING
    meaningfulDomChange: false,
  };

  const result = classifySilentFailure(expectation, observation, signals, true);
  assert.strictEqual(result, null, 'Feedback contradicts silence');
});

test('B: Submit > DISCONFIRM: DOM change proves something happened', () => {
  const expectation = { type: 'submit', promise: { value: 'submit' } };
  const observation = { attempted: true, runComplete: true };
  const signals = {
    feedbackSeen: false,
    meaningfulDomChange: true, // ← DISCONFIRMING
  };

  const result = classifySilentFailure(expectation, observation, signals, true);
  assert.strictEqual(result, null, 'DOM change contradicts silence');
});

test('B: Submit > SUSPECTED: incomplete observation', () => {
  const expectation = { type: 'submit', promise: { value: 'submit' } };
  const observation = { attempted: true, runComplete: false };
  const signals = {
    feedbackSeen: false,
    meaningfulDomChange: false,
  };

  const result = classifySilentFailure(expectation, observation, signals, true);
  assert.strictEqual(result.type, 'submit_silent_failure');
  assert.strictEqual(result.status, 'SUSPECTED');
});

// ============================================================================
// CLASS C: UI FEEDBACK SILENT FAILURE
// ============================================================================

test('C: UI Feedback > CONFIRMED: attempted, no feedback, no DOM, no nav, run complete', () => {
  const expectation = { type: 'ui_feedback', promise: { value: 'feedback', description: 'async action' } };
  const observation = { attempted: true, runComplete: true };
  const signals = {
    feedbackSeen: false,
    ariaLiveUpdated: false,
    meaningfulDomChange: false,
    navigationChanged: false,
    domChanged: false,
  };

  const result = classifySilentFailure(expectation, observation, signals, true);
  assert.strictEqual(result.type, 'ui_feedback_silent_failure');
  assert.strictEqual(result.status, 'CONFIRMED');
});

test('C: UI Feedback > DISCONFIRM: feedback proves user notified', () => {
  const expectation = { type: 'ui_feedback', promise: { value: 'feedback' } };
  const observation = { attempted: true, runComplete: true };
  const signals = {
    feedbackSeen: true, // ← DISCONFIRMING
    meaningfulDomChange: false,
    navigationChanged: false,
  };

  const result = classifySilentFailure(expectation, observation, signals, true);
  assert.strictEqual(result, null);
});

test('C: UI Feedback > DISCONFIRM: DOM change proves something happened', () => {
  const expectation = { type: 'ui_feedback', promise: { value: 'feedback' } };
  const observation = { attempted: true, runComplete: true };
  const signals = {
    feedbackSeen: false,
    meaningfulDomChange: true, // ← DISCONFIRMING
    navigationChanged: false,
  };

  const result = classifySilentFailure(expectation, observation, signals, true);
  assert.strictEqual(result, null);
});

test('C: UI Feedback > DISCONFIRM: navigation contradicts pure feedback silence', () => {
  const expectation = { type: 'ui_feedback', promise: { value: 'feedback' } };
  const observation = { attempted: true, runComplete: true };
  const signals = {
    feedbackSeen: false,
    meaningfulDomChange: false,
    navigationChanged: true, // ← DISCONFIRMING
  };

  const result = classifySilentFailure(expectation, observation, signals, true);
  assert.strictEqual(result, null);
});

// ============================================================================
// CLASS D: STATE CHANGE SILENT FAILURE
// ============================================================================

test('D: State Change > CONFIRMED: mutation attempted, no DOM outcome, no feedback, run complete', () => {
  const expectation = { type: 'state', promise: { value: 'state', stateKey: 'isLoading' } };
  const observation = { attempted: true, runComplete: true };
  const signals = {
    meaningfulDomChange: false, // ← CRITICAL: MUST be false
    domChanged: false,
    feedbackSeen: false,
    ariaLiveUpdated: false,
  };

  const result = classifySilentFailure(expectation, observation, signals, true);
  assert.strictEqual(result.type, 'state_change_silent_failure');
  assert.strictEqual(result.status, 'CONFIRMED');
});

test('D: State Change > DISCONFIRM: meaningful DOM change proves state reflected to UI', () => {
  const expectation = { type: 'state', promise: { value: 'state' } };
  const observation = { attempted: true, runComplete: true };
  const signals = {
    meaningfulDomChange: true, // ← DISCONFIRMING: proves state changed UI
    feedbackSeen: false,
  };

  const result = classifySilentFailure(expectation, observation, signals, true);
  assert.strictEqual(result, null, 'DOM change contradicts "no state outcome"');
});

test('D: State Change > DISCONFIRM: feedback proves notification happened', () => {
  const expectation = { type: 'state', promise: { value: 'state' } };
  const observation = { attempted: true, runComplete: true };
  const signals = {
    meaningfulDomChange: false,
    feedbackSeen: true, // ← DISCONFIRMING
  };

  const result = classifySilentFailure(expectation, observation, signals, true);
  assert.strictEqual(result, null);
});

test('D: State Change > SUSPECTED: incomplete observation', () => {
  const expectation = { type: 'state', promise: { value: 'state' } };
  const observation = { attempted: true, runComplete: false };
  const signals = {
    meaningfulDomChange: false,
    feedbackSeen: false,
  };

  const result = classifySilentFailure(expectation, observation, signals, true);
  assert.strictEqual(result.type, 'state_change_silent_failure');
  assert.strictEqual(result.status, 'SUSPECTED');
});

// ============================================================================
// CLASS E: LOADING PHANTOM FAILURE
// ============================================================================

test('E: Loading Phantom > CONFIRMED: loading started, never resolved, run complete, no outcome', () => {
  const expectation = { type: 'loading', promise: { value: 'loading', indicator: 'spinner' } };
  const observation = { runComplete: true };
  const signals = {
    loadingStarted: true,
    loadingResolved: false, // ← Key: never resolved
    feedbackSeen: false,
    navigationChanged: false,
    meaningfulDomChange: false,
  };

  const result = classifySilentFailure(expectation, observation, signals, true);
  assert.strictEqual(result.type, 'loading_phantom_failure');
  assert.strictEqual(result.status, 'CONFIRMED');
});

test('E: Loading Phantom > SUSPECTED: loading resolved but with no outcome', () => {
  const expectation = { type: 'loading', promise: { value: 'loading' } };
  const observation = { runComplete: true };
  const signals = {
    loadingStarted: true,
    loadingResolved: true, // ← Resolved but...
    feedbackSeen: false,
    navigationChanged: false,
    meaningfulDomChange: false,
    // ...no success/error feedback or navigation
  };

  const result = classifySilentFailure(expectation, observation, signals, true);
  assert.strictEqual(result.type, 'loading_phantom_failure');
  assert.strictEqual(result.status, 'SUSPECTED');
  assert.ok(result.confidence < 0.75);
});

test('E: Loading Phantom > DISCONFIRM: feedback ends silence claim', () => {
  const expectation = { type: 'loading', promise: { value: 'loading' } };
  const observation = { runComplete: true };
  const signals = {
    loadingStarted: true,
    loadingResolved: false,
    feedbackSeen: true, // ← DISCONFIRMING: user got response
    navigationChanged: false,
    meaningfulDomChange: false,
  };

  const result = classifySilentFailure(expectation, observation, signals, true);
  assert.strictEqual(result, null);
});

test('E: Loading Phantom > INCOMPLETE: observation window not complete', () => {
  const expectation = { type: 'loading', promise: { value: 'loading' } };
  const observation = { runComplete: false }; // ← Still observing
  const signals = {
    loadingStarted: true,
    loadingResolved: false,
    feedbackSeen: false,
    navigationChanged: false,
    meaningfulDomChange: false,
  };

  const result = classifySilentFailure(expectation, observation, signals, true);
  assert.strictEqual(result.type, 'loading_phantom_failure');
  assert.strictEqual(result.status, 'SUSPECTED');
});

// ============================================================================
// CLASS F: PERMISSION WALL SILENT FAILURE
// ============================================================================

test('F: Permission Wall > CONFIRMED: action attempted, silently blocked, no denial feedback, run complete', () => {
  const expectation = { type: 'permission', promise: { value: 'permission', action: 'delete-user' } };
  const observation = { attempted: true, reason: 'blocked', runComplete: true };
  const signals = {
    feedbackSeen: false,
    ariaLiveUpdated: false,
    navigationChanged: false,
  };

  const result = classifySilentFailure(expectation, observation, signals, true);
  assert.strictEqual(result.type, 'permission_wall_silent_failure');
  assert.strictEqual(result.status, 'CONFIRMED');
});

test('F: Permission Wall > CONFIRMED: 403 response with no denial message', () => {
  const expectation = { type: 'permission', promise: { value: 'permission' } };
  const observation = { attempted: true, reason: '403 Forbidden', runComplete: true };
  const signals = {
    feedbackSeen: false,
    navigationChanged: false,
  };

  const result = classifySilentFailure(expectation, observation, signals, true);
  assert.strictEqual(result.type, 'permission_wall_silent_failure');
  assert.strictEqual(result.status, 'CONFIRMED');
});

test('F: Permission Wall > DISCONFIRM: denial feedback contradicts silence', () => {
  const expectation = { type: 'permission', promise: { value: 'permission' } };
  const observation = { attempted: true, reason: 'blocked', runComplete: true };
  const signals = {
    feedbackSeen: true, // ← DISCONFIRMING: user was told about block
    navigationChanged: false,
  };

  const result = classifySilentFailure(expectation, observation, signals, true);
  assert.strictEqual(result, null, 'Denial feedback ends silence claim');
});

test('F: Permission Wall > DISCONFIRM: redirect after block ends silence', () => {
  const expectation = { type: 'permission', promise: { value: 'permission' } };
  const observation = { attempted: true, reason: 'blocked', runComplete: true };
  const signals = {
    feedbackSeen: false,
    navigationChanged: true, // ← DISCONFIRMING: user redirected
  };

  const result = classifySilentFailure(expectation, observation, signals, true);
  assert.strictEqual(result, null);
});

test('F: Permission Wall > SUSPECTED: observation incomplete', () => {
  const expectation = { type: 'permission', promise: { value: 'permission' } };
  const observation = { attempted: true, reason: 'blocked', runComplete: false };
  const signals = {
    feedbackSeen: false,
    navigationChanged: false,
  };

  const result = classifySilentFailure(expectation, observation, signals, true);
  assert.strictEqual(result.type, 'permission_wall_silent_failure');
  assert.strictEqual(result.status, 'SUSPECTED');
});

// ============================================================================
// CROSS-CLASS TESTS
// ============================================================================

test('CROSS: Evidence Law - No CONFIRMED without runComplete', () => {
  const expectation = { type: 'navigation', promise: { value: 'navigate' } };
  const observation = { attempted: true, runComplete: false }; // ← NOT COMPLETE
  const signals = {
    navigationChanged: false,
    feedbackSeen: false,
    meaningfulDomChange: false,
  };

  const result = classifySilentFailure(expectation, observation, signals, true);
  // Cannot CONFIRM without complete observation
  assert.notStrictEqual(result.status, 'CONFIRMED', 'Incomplete obs should never be CONFIRMED');
  assert.ok(['SUSPECTED', 'UNPROVEN'].includes(result.status) || result === null);
});

test('CROSS: Confidence decreases with contradicting signals', () => {
  const expectation = { type: 'navigation', promise: { value: 'navigate' } };
  const observation = { attempted: true, runComplete: true };
  
  // Base case: pure silence
  const signals1 = {
    navigationChanged: false,
    feedbackSeen: false,
    meaningfulDomChange: false,
  };
  const result1 = classifySilentFailure(expectation, observation, signals1, true);
  const baseConfidence = result1.confidence;

  // Case with weak contradiction
  const signals2 = {
    navigationChanged: false,
    feedbackSeen: false,
    meaningfulDomChange: true, // ← Should return null or very low confidence
  };
  const result2 = classifySilentFailure(expectation, observation, signals2, true);
  
  if (result2 && result2.type === 'navigation_silent_failure') {
    assert.ok(result2.confidence < baseConfidence, 'Contradiction should reduce confidence');
  } else {
    assert.strictEqual(result2, null, 'Strong contradiction should return null');
  }
});

test('DETERMINISM: Multiple invocations produce same output', () => {
  const expectation = { type: 'navigation', promise: { value: 'navigate' } };
  const observation = { attempted: true, runComplete: true };
  const signals = {
    navigationChanged: false,
    feedbackSeen: false,
    meaningfulDomChange: false,
  };

  const result1 = classifySilentFailure(expectation, observation, signals, true);
  const result2 = classifySilentFailure(expectation, observation, signals, true);
  const result3 = classifySilentFailure(expectation, observation, signals, true);

  assert.strictEqual(JSON.stringify(result1), JSON.stringify(result2));
  assert.strictEqual(JSON.stringify(result2), JSON.stringify(result3));
});




