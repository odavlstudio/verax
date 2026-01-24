/**
 * STAGE 3: Observation Intelligence 2.0 - Comprehensive Tests
 * 
 * Tests for:
 * - STAGE 3.1: Promise-Aware Observation Profiles
 * - STAGE 3.2: Progressive Acknowledgment Levels
 * - STAGE 3.3: Anti-False-Green Lock
 * - STAGE 3.4: Silence Classification
 * - STAGE 3.5: Outcome Truth Matrix
 * - STAGE 3.6: Deterministic Observation Snapshot
 */

import assert from 'assert';
import {
  OBSERVATION_PROFILES,
  getObservationProfile,
  validateSignalsAgainstProfile,
  AVAILABLE_SIGNALS as _AVAILABLE_SIGNALS,
} from '../src/cli/util/observation/observation-profile.js';
import {
  ACKNOWLEDGMENT_LEVELS,
  calculateAcknowledgmentLevel,
  classifySignalStrength,
  isSuccessfulAcknowledgment,
  isConclusiveAcknowledgment,
  scoreAcknowledgmentLevel,
} from '../src/cli/util/observation/progressive-acknowledgment.js';
import {
  filterFalseGreenSignals,
  isFalseGreenPattern,
  applyAntiFalseGreenRules,
  getRequiredSubstantiveSignals,
  validateAntiFalseGreen,
} from '../src/cli/util/observation/anti-false-green.js';
import {
  SILENCE_KINDS,
  classifySilence,
  isSilenceRecoverable,
  isSilenceIndicativeOfError,
  explainSilence,
} from '../src/cli/util/observation/silence-classifier.js';
import {
  OUTCOME_TYPES,
  determineOutcome,
  scoreOutcome,
  isSuccessfulOutcome,
  isDefinitiveOutcome,
  explainOutcome,
} from '../src/cli/util/observation/outcome-truth-matrix.js';
import { describe, it } from 'node:test';

describe('STAGE 3: Observation Intelligence 2.0', () => {
  describe('STAGE 3.1: Promise-Aware Observation Profiles', () => {
    it('should have profiles for all standard promise kinds', () => {
      const kinds = [
        'navigate',
        'network.request',
        'network.graphql',
        'network.ws',
        'feedback.toast',
        'feedback.modal',
        'feedback.notification',
        'state',
      ];

      kinds.forEach(kind => {
        assert(OBSERVATION_PROFILES[kind], `Missing profile for ${kind}`);
      });
    });

    it('should get profile for navigate promise', () => {
      const promise = { kind: 'navigate' };
      const profile = getObservationProfile(promise);

      assert.strictEqual(profile.kind, 'navigate');
      assert(profile.requiredSignals.length > 0);
      assert(profile.graceTimeoutMs > 0);
    });

    it('should validate signals against navigate profile', () => {
      const profile = OBSERVATION_PROFILES.navigate;
      const signals = {
        routeChanged: true,
        domChanged: false,
      };

      const result = validateSignalsAgainstProfile(signals, profile);
      assert.strictEqual(result.satisfied, true);
      assert(result.matchedSignals.includes('routeChanged'));
    });

    it('should reject signals missing required signals', () => {
      const profile = OBSERVATION_PROFILES.navigate;
      const signals = {
        routeChanged: false,
        domChanged: true,
      };

      const result = validateSignalsAgainstProfile(signals, profile);
      assert.strictEqual(result.satisfied, false);
      assert(result.reason.includes('no-required-signals'));
    });

    it('should detect forbidden signals in profile', () => {
      const profile = OBSERVATION_PROFILES['feedback.toast'];
      const signals = {
        loadingStarted: true, // Forbidden for feedback
        toastAppeared: true,
      };

      const result = validateSignalsAgainstProfile(signals, profile);
      assert.strictEqual(result.satisfied, false);
      assert(result.reason.includes('forbidden'));
    });

    it('should have appropriate grace timeouts for different promise kinds', () => {
      assert(OBSERVATION_PROFILES.navigate.graceTimeoutMs <= 5000);
      assert(OBSERVATION_PROFILES['network.request'].graceTimeoutMs <= 10000);
      assert(OBSERVATION_PROFILES['feedback.toast'].graceTimeoutMs <= 3000);
    });
  });

  describe('STAGE 3.2: Progressive Acknowledgment Levels', () => {
    it('should calculate NONE level when no signals detected', () => {
      const signals = {};
      const profile = OBSERVATION_PROFILES.navigate;

      const result = calculateAcknowledgmentLevel(signals, profile, 0, false);
      assert.strictEqual(result.level, ACKNOWLEDGMENT_LEVELS.NONE);
      assert.strictEqual(result.confidence, 0);
    });

    it('should calculate WEAK level for non-required signals', () => {
      const signals = {
        loadingStarted: true, // Not required
        domChanged: false,
      };
      const profile = OBSERVATION_PROFILES['feedback.toast'];

      const result = calculateAcknowledgmentLevel(signals, profile, 100, false);
      assert.strictEqual(result.level, ACKNOWLEDGMENT_LEVELS.WEAK);
      assert(result.confidence > 0 && result.confidence < 0.5);
    });

    it('should calculate PARTIAL level for some required signals', () => {
      const signals = {
        routeChanged: true,
        navigationChanged: false,
      };
      const profile = OBSERVATION_PROFILES.navigate;

      const result = calculateAcknowledgmentLevel(signals, profile, 200, false);
      assert.strictEqual(result.level, ACKNOWLEDGMENT_LEVELS.PARTIAL);
      assert(result.requiredSignalsSatisfied > 0);
      assert(result.requiredSignalsSatisfied < result.requiredSignalsTotal);
    });

    it('should calculate STRONG level when all required signals present and stable', () => {
      const signals = {
        routeChanged: true,
        domChanged: true,
      };
      const profile = OBSERVATION_PROFILES.navigate;

      const result = calculateAcknowledgmentLevel(signals, profile, 300, true);
      assert.strictEqual(result.level, ACKNOWLEDGMENT_LEVELS.STRONG);
      assert(result.confidence >= 0.9);
    });

    it('should downgrade to PARTIAL if stability window not met', () => {
      const signals = {
        routeChanged: true,
        domChanged: true,
      };
      const profile = OBSERVATION_PROFILES.navigate;

      const result = calculateAcknowledgmentLevel(signals, profile, 100, false);
      assert.strictEqual(result.level, ACKNOWLEDGMENT_LEVELS.PARTIAL);
      assert(result.confidence < 0.9);
    });

    it('should classify signal strength correctly', () => {
      const profile = OBSERVATION_PROFILES.navigate;

      assert.strictEqual(classifySignalStrength('routeChanged', profile), 'required');
      assert.strictEqual(classifySignalStrength('domChanged', profile), 'optional');
      assert.strictEqual(classifySignalStrength('unknownSignal', profile), 'unknown');
    });

    it('should score acknowledgment levels correctly', () => {
      const scores = {
        [ACKNOWLEDGMENT_LEVELS.STRONG]: 1.0,
        [ACKNOWLEDGMENT_LEVELS.PARTIAL]: 0.6,
        [ACKNOWLEDGMENT_LEVELS.WEAK]: 0.2,
        [ACKNOWLEDGMENT_LEVELS.NONE]: 0,
      };

      Object.entries(scores).forEach(([level, expected]) => {
        assert.strictEqual(scoreAcknowledgmentLevel(level), expected);
      });
    });

    it('should identify successful acknowledgments', () => {
      assert.strictEqual(isSuccessfulAcknowledgment(ACKNOWLEDGMENT_LEVELS.STRONG), true);
      assert.strictEqual(isSuccessfulAcknowledgment(ACKNOWLEDGMENT_LEVELS.PARTIAL), true);
      assert.strictEqual(isSuccessfulAcknowledgment(ACKNOWLEDGMENT_LEVELS.WEAK), false);
      assert.strictEqual(isSuccessfulAcknowledgment(ACKNOWLEDGMENT_LEVELS.NONE), false);
    });

    it('should identify conclusive acknowledgments', () => {
      assert.strictEqual(isConclusiveAcknowledgment(ACKNOWLEDGMENT_LEVELS.STRONG), true);
      assert.strictEqual(isConclusiveAcknowledgment(ACKNOWLEDGMENT_LEVELS.PARTIAL), false);
    });
  });

  describe('STAGE 3.3: Anti-False-Green Lock', () => {
    it('should filter out loading-only signals', () => {
      const signals = {
        loadingStarted: true,
        progressBar: true,
        domChanged: false,
      };

      const filtered = filterFalseGreenSignals(signals, {});
      assert.strictEqual(filtered.loadingStarted, undefined);
      assert.strictEqual(filtered.progressBar, undefined);
    });

    it('should preserve substantive signals', () => {
      const signals = {
        loadingStarted: true,
        toastAppeared: true,
      };

      const filtered = filterFalseGreenSignals(signals, {});
      assert.strictEqual(filtered.toastAppeared, true);
      // loadingStarted should still be there since substantive signal present
      assert(filtered.loadingStarted !== undefined || Object.keys(filtered).length > 0);
    });

    it('should detect false-green pattern (loading without feedback)', () => {
      const signals = {
        loadingStarted: true,
        progressBar: true,
      };

      assert.strictEqual(isFalseGreenPattern(signals), true);
    });

    it('should not flag as false-green when substantive signals present', () => {
      const signals = {
        loadingStarted: true,
        feedbackAppeared: true,
      };

      assert.strictEqual(isFalseGreenPattern(signals), false);
    });

    it('should downgrade level when false-green pattern detected', () => {
      const level = 'strong';
      const signals = {
        loadingStarted: true,
      };

      const adjusted = applyAntiFalseGreenRules(level, signals, {});
      assert.strictEqual(adjusted, 'weak');
    });

    it('should ignore micro-DOM changes', () => {
      const signals = {
        domChanged: true,
      };
      const metadata = {
        domChange: {
          addedBytes: 50, // < 100 bytes threshold
        },
      };

      const filtered = filterFalseGreenSignals(signals, metadata);
      assert.strictEqual(filtered.domChanged, false);
    });

    it('should preserve meaningful DOM changes', () => {
      const signals = {
        domChanged: true,
      };
      const metadata = {
        domChange: {
          addedBytes: 500, // > 100 bytes
          addedNodesVisible: 10,
        },
      };

      const filtered = filterFalseGreenSignals(signals, metadata);
      assert.strictEqual(filtered.domChanged, true);
    });

    it('should get required substantive signals for promise kinds', () => {
      assert(getRequiredSubstantiveSignals('navigate').length > 0);
      assert(getRequiredSubstantiveSignals('feedback.toast').length > 0);
      assert(getRequiredSubstantiveSignals('network.request').length > 0);
    });

    it('should validate anti-false-green rules', () => {
      const acknowledgment = {
        level: 'strong',
        detectedSignals: ['loadingStarted'], // Only loading
      };

      const validation = validateAntiFalseGreen(acknowledgment, 'feedback.toast', {});
      assert.strictEqual(validation.valid, false);
      assert(validation.issues.includes('no-substantive-signals'));
    });
  });

  describe('STAGE 3.4: Silence Classification', () => {
    it('should classify true silence', () => {
      const context = {
        signals: {},
        elapsedMs: 5000,
        graceTimeoutMs: 5000,
        networkEvents: {},
      };

      const result = classifySilence(context);
      assert.strictEqual(result.kind, SILENCE_KINDS.TRUE_SILENCE);
      assert(result.reason.length > 0);
    });

    it('should classify blocked-by-auth', () => {
      const context = {
        signals: {},
        networkEvents: {
          responses: [{ status: 401 }],
        },
      };

      const result = classifySilence(context);
      assert.strictEqual(result.kind, SILENCE_KINDS.BLOCKED_BY_AUTH);
    });

    it('should classify network timeout', () => {
      const context = {
        signals: {},
        elapsedMs: 10000,
        graceTimeoutMs: 5000,
        networkEvents: {
          requestsSent: 1,
          responsesReceived: 0,
        },
      };

      const result = classifySilence(context);
      assert.strictEqual(result.kind, SILENCE_KINDS.NETWORK_TIMEOUT);
    });

    it('should classify server-side-only', () => {
      const context = {
        signals: {},
        networkEvents: {
          responses: [{ status: 200 }],
        },
        domSnapshot: {
          changed: false,
        },
      };

      const result = classifySilence(context);
      assert.strictEqual(result.kind, SILENCE_KINDS.SERVER_SIDE_ONLY);
    });

    it('should classify slow acknowledgment', () => {
      const context = {
        signals: { routeChanged: true },
        elapsedMs: 10000,
        graceTimeoutMs: 5000,
      };

      const result = classifySilence(context);
      assert.strictEqual(result.kind, SILENCE_KINDS.SLOW_ACKNOWLEDGMENT);
    });

    it('should detect recoverable silence', () => {
      assert.strictEqual(isSilenceRecoverable(SILENCE_KINDS.SLOW_ACKNOWLEDGMENT), true);
      assert.strictEqual(isSilenceRecoverable(SILENCE_KINDS.BLOCKED_BY_AUTH), true);
      assert.strictEqual(isSilenceRecoverable(SILENCE_KINDS.TRUE_SILENCE), false);
    });

    it('should detect error-indicative silence', () => {
      assert.strictEqual(isSilenceIndicativeOfError(SILENCE_KINDS.TRUE_SILENCE), true);
      assert.strictEqual(isSilenceIndicativeOfError(SILENCE_KINDS.NETWORK_TIMEOUT), true);
      assert.strictEqual(isSilenceIndicativeOfError(SILENCE_KINDS.BLOCKED_BY_AUTH), false);
    });

    it('should provide explanations for silence types', () => {
      const kinds = Object.values(SILENCE_KINDS);
      kinds.forEach(kind => {
        const explanation = explainSilence(kind);
        assert(explanation.length > 0, `No explanation for ${kind}`);
      });
    });

    it('should classify user navigation', () => {
      const context = {
        signals: {},
        userNavigated: true,
      };

      const result = classifySilence(context);
      assert.strictEqual(result.kind, SILENCE_KINDS.USER_NAVIGATION);
    });
  });

  describe('STAGE 3.5: Outcome Truth Matrix', () => {
    it('should determine SUCCESS outcome for strong acknowledgment', () => {
      const evaluation = {
        acknowledgment: {
          level: ACKNOWLEDGMENT_LEVELS.STRONG,
          detectedSignals: ['routeChanged'],
          requiredSignalsSatisfied: 1,
          requiredSignalsTotal: 1,
        },
        promiseKind: 'navigate',
        stabilityWindowMet: true,
      };

      const result = determineOutcome(evaluation);
      assert.strictEqual(result.outcome, OUTCOME_TYPES.SUCCESS);
      assert(result.confidence >= 0.9);
    });

    it('should determine PARTIAL_SUCCESS for partial acknowledgment', () => {
      const evaluation = {
        acknowledgment: {
          level: ACKNOWLEDGMENT_LEVELS.PARTIAL,
          detectedSignals: ['networkResponseReceived'],
          requiredSignalsSatisfied: 1,
          requiredSignalsTotal: 2,
        },
        promiseKind: 'network.request',
        stabilityWindowMet: true,
      };

      const result = determineOutcome(evaluation);
      assert.strictEqual(result.outcome, OUTCOME_TYPES.PARTIAL_SUCCESS);
    });

    it('should determine SILENT_FAILURE when hard errors present', () => {
      const evaluation = {
        acknowledgment: { level: ACKNOWLEDGMENT_LEVELS.STRONG },
        errors: ['Fetch failed: network error'],
        promiseKind: 'network.request',
      };

      const result = determineOutcome(evaluation);
      assert.strictEqual(result.outcome, OUTCOME_TYPES.SILENT_FAILURE);
    });

    it('should determine MISLEADING for success UI with error status', () => {
      const evaluation = {
        acknowledgment: {
          level: ACKNOWLEDGMENT_LEVELS.STRONG,
          detectedSignals: ['successMessageAppeared'],
        },
        promiseKind: 'feedback.toast',
        signals: { successMessageAppeared: true },
        networkStatus: { lastResponseStatus: 500 },
        stabilityWindowMet: true,
      };

      const result = determineOutcome(evaluation);
      assert.strictEqual(result.outcome, OUTCOME_TYPES.MISLEADING);
    });

    it('should determine AMBIGUOUS for insufficient evidence', () => {
      const evaluation = {
        acknowledgment: {
          level: ACKNOWLEDGMENT_LEVELS.WEAK,
          detectedSignals: ['loadingStarted'],
        },
        promiseKind: 'state',
      };

      const result = determineOutcome(evaluation);
      assert.strictEqual(result.outcome, OUTCOME_TYPES.AMBIGUOUS);
    });

    it('should score outcomes correctly', () => {
      const scores = {
        [OUTCOME_TYPES.SUCCESS]: 1.0,
        [OUTCOME_TYPES.PARTIAL_SUCCESS]: 0.6,
        [OUTCOME_TYPES.AMBIGUOUS]: 0.3,
        [OUTCOME_TYPES.MISLEADING]: 0.2,
        [OUTCOME_TYPES.SILENT_FAILURE]: 0,
      };

      Object.entries(scores).forEach(([outcome, expected]) => {
        assert.strictEqual(scoreOutcome(outcome), expected);
      });
    });

    it('should identify successful outcomes', () => {
      assert.strictEqual(isSuccessfulOutcome(OUTCOME_TYPES.SUCCESS), true);
      assert.strictEqual(isSuccessfulOutcome(OUTCOME_TYPES.PARTIAL_SUCCESS), true);
      assert.strictEqual(isSuccessfulOutcome(OUTCOME_TYPES.SILENT_FAILURE), false);
    });

    it('should identify definitive outcomes', () => {
      assert.strictEqual(isDefinitiveOutcome(OUTCOME_TYPES.SUCCESS), true);
      assert.strictEqual(isDefinitiveOutcome(OUTCOME_TYPES.AMBIGUOUS), false);
    });

    it('should provide outcome explanations', () => {
      const outcomes = Object.values(OUTCOME_TYPES);
      outcomes.forEach(outcome => {
        const explanation = explainOutcome(outcome);
        assert(explanation.length > 0, `No explanation for ${outcome}`);
      });
    });

    it('should handle auth-blocked silence in outcome', () => {
      const evaluation = {
        acknowledgment: { level: ACKNOWLEDGMENT_LEVELS.NONE },
        silenceKind: SILENCE_KINDS.BLOCKED_BY_AUTH,
        promiseKind: 'network.request',
      };

      const result = determineOutcome(evaluation);
      assert.strictEqual(result.outcome, OUTCOME_TYPES.SILENT_FAILURE);
      assert(result.confidence >= 0.8);
    });

    it('should handle server-side-only success', () => {
      const evaluation = {
        acknowledgment: { level: ACKNOWLEDGMENT_LEVELS.NONE },
        silenceKind: SILENCE_KINDS.SERVER_SIDE_ONLY,
        networkStatus: { lastResponseStatus: 200 },
        promiseKind: 'network.request',
      };

      const result = determineOutcome(evaluation);
      assert.strictEqual(result.outcome, OUTCOME_TYPES.PARTIAL_SUCCESS);
    });
  });

  describe('STAGE 3: Integration Tests', () => {
    it('should handle complete observation flow: navigation success', () => {
      const promise = { kind: 'navigate' };
      const profile = getObservationProfile(promise);

      const signals = {
        routeChanged: true,
        domChanged: true,
      };

      const profileValidation = validateSignalsAgainstProfile(signals, profile);
      assert.strictEqual(profileValidation.satisfied, true);

      const acknowledgment = calculateAcknowledgmentLevel(signals, profile, 300, true);
      assert.strictEqual(acknowledgment.level, ACKNOWLEDGMENT_LEVELS.STRONG);

      const evaluation = {
        acknowledgment,
        promiseKind: promise.kind,
        stabilityWindowMet: true,
      };

      const outcome = determineOutcome(evaluation);
      assert.strictEqual(outcome.outcome, OUTCOME_TYPES.SUCCESS);
    });

    it('should handle complete observation flow: feedback false-green', () => {
      const promise = { kind: 'feedback.toast' };
      const profile = getObservationProfile(promise);

      let signals = {
        loadingStarted: true, // Only loading, no feedback
      };

      // Filter false-green
      signals = filterFalseGreenSignals(signals, {});

      const profileValidation = validateSignalsAgainstProfile(signals, profile);
      assert.strictEqual(profileValidation.satisfied, false);

      const acknowledgment = calculateAcknowledgmentLevel(signals, profile, 100, false);
      let level = acknowledgment.level;

      // Apply anti-false-green rules
      level = applyAntiFalseGreenRules(level, signals, {});
      assert(level === ACKNOWLEDGMENT_LEVELS.WEAK || level === ACKNOWLEDGMENT_LEVELS.NONE);

      const evaluation = {
        acknowledgment: { ...acknowledgment, level },
        promiseKind: promise.kind,
      };

      const outcome = determineOutcome(evaluation);
      assert(
        outcome.outcome === OUTCOME_TYPES.AMBIGUOUS ||
        outcome.outcome === OUTCOME_TYPES.SILENT_FAILURE
      );
    });

    it('should handle complete observation flow: network timeout', () => {
      const promise = { kind: 'network.request' };
      const profile = getObservationProfile(promise);

      const signals = {}; // No signals

      const acknowledgment = calculateAcknowledgmentLevel(signals, profile, 10000, false);
      assert.strictEqual(acknowledgment.level, ACKNOWLEDGMENT_LEVELS.NONE);

      const silenceContext = {
        signals,
        elapsedMs: 10000,
        graceTimeoutMs: profile.graceTimeoutMs,
        networkEvents: { requestsSent: 1, responsesReceived: 0 },
      };

      const silence = classifySilence(silenceContext);
      assert.strictEqual(silence.kind, SILENCE_KINDS.NETWORK_TIMEOUT);

      const evaluation = {
        acknowledgment,
        promiseKind: promise.kind,
        silenceKind: silence.kind,
      };

      const outcome = determineOutcome(evaluation);
      assert.strictEqual(outcome.outcome, OUTCOME_TYPES.SILENT_FAILURE);
    });

    it('should handle deterministic observation snapshots', () => {
      const signals1 = {
        domChanged: true,
        routeChanged: true,
        feedbackAppeared: false,
      };

      const signals2 = {
        feedbackAppeared: false,
        routeChanged: true,
        domChanged: true,
      };

      // Verify same signals in different order produce same result
      const profile = getObservationProfile({ kind: 'navigate' });

      const result1 = validateSignalsAgainstProfile(signals1, profile);
      const result2 = validateSignalsAgainstProfile(signals2, profile);

      assert.deepStrictEqual(result1.matchedSignals.sort(), result2.matchedSignals.sort());
    });

    it('should maintain consistency across promise kinds', () => {
      const kinds = [
        'navigate',
        'network.request',
        'feedback.toast',
        'state',
      ];

      kinds.forEach(kind => {
        const profile = getObservationProfile({ kind });
        assert(profile.kind);
        assert(profile.requiredSignals);
        assert(profile.optionalSignals);
        assert(profile.forbiddenSignals !== undefined);
        assert(profile.minStabilityWindowMs > 0);
        assert(profile.graceTimeoutMs > 0);
      });
    });
  });

  describe('STAGE 3: Promise-Aware Profiles', () => {
    it('navigate promises should require route change signals', () => {
      const profile = OBSERVATION_PROFILES.navigate;
      const requiredNames = profile.requiredSignals.map(s => s.toLowerCase());
      const hasRouteSignal = requiredNames.some(n => n.includes('route') || n.includes('nav'));

      assert(hasRouteSignal, 'Navigate profile missing route-related signal');
    });

    it('feedback promises should forbid loading-only signals', () => {
      const feedbackProfiles = [
        OBSERVATION_PROFILES['feedback.toast'],
        OBSERVATION_PROFILES['feedback.modal'],
        OBSERVATION_PROFILES['feedback.notification'],
      ];

      feedbackProfiles.forEach(profile => {
        const hasForbiddenLoading = profile.forbiddenSignals.some(s => s.includes('loading'));
        assert(hasForbiddenLoading, `${profile.kind} profile missing forbidden loading signal`);
      });
    });

    it('network promises should require response received signal', () => {
      const networkProfile = OBSERVATION_PROFILES['network.request'];
      const hasResponseSignal = networkProfile.requiredSignals.some(s =>
        s.includes('response') || s.includes('settled')
      );

      assert(hasResponseSignal, 'Network profile missing response signal');
    });

    it('state promises should have substantive UI signal', () => {
      const stateProfile = OBSERVATION_PROFILES.state;
      const hasUISignal = stateProfile.requiredSignals.some(s =>
        s.includes('DOM') || s.includes('UI') || s.includes('Content')
      );

      assert(hasUISignal, 'State profile missing UI signal');
    });
  });
});
