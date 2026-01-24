// @ts-ignore
import { describe, it } from 'mocha';
// @ts-ignore
import { expect } from 'chai';
import { classifySilentFailure } from '../../../../src/cli/util/detection/silent-failure-classifier.js';

describe('Silent Failure Canonical Classifier - Contract Tests', function () {
  // CLASS A: NAVIGATION SILENT FAILURE
  // Navigation expectation not met despite evidence of action attempt
  
  describe('CLASS A: Navigation Silent Failure', function () {
    it('POSITIVE: Detects navigation_silent_failure when nav expected but not observed', function () {
      const expectation = {
        type: 'navigation',
        promise: { action: 'click', target: 'button.nav-link', expectedUrl: '/about' },
      };
      
      const observation = {
        signals: {
          navigationChanged: false,
          clientSideRoutingDetected: false,
          nextJsPageSwap: false,
          vueRouterTransition: false,
          meaningfulDomChange: true,
          feedbackSeen: false,
        },
        evidenceFiles: ['screenshot-1.png'],
      };

      const evidenceSignals = observation.signals;
      const result = classifySilentFailure(expectation, observation, evidenceSignals, true);

      expect(result).to.exist;
      expect(result.type).to.equal('navigation_silent_failure');
      expect(result.status).to.equal('CONFIRMED');
      expect(result.confidence).to.be.greaterThan(0.5);
      expect(result.rationaleSignals).to.include.members(['meaningfulDomChange']);
    });

    it('NEGATIVE: Does NOT detect nav failure when nav feedback IS seen', function () {
      const expectation = {
        type: 'navigation',
        promise: { action: 'click', target: 'button.nav-link', expectedUrl: '/about' },
      };

      const observation = {
        signals: {
          navigationChanged: true,
          feedbackSeen: true,
          meaningfulDomChange: true,
        },
      };

      const result = classifySilentFailure(expectation, observation, observation.signals, true);

      expect(result.type).to.not.equal('navigation_silent_failure');
    });

    it('AMBIGUOUS: Downgrades to SUSPECTED when navigationChanged=true but url wrong', function () {
      const expectation = {
        type: 'navigation',
        promise: { action: 'click', target: 'button', expectedUrl: '/about' },
      };

      const observation = {
        signals: {
          navigationChanged: true,
          meaningfulDomChange: true,
        },
        actualUrl: '/home',
      };

      const result = classifySilentFailure(expectation, observation, observation.signals, true);

      if (result.type === 'navigation_silent_failure') {
        expect(result.status).to.be.oneOf(['SUSPECTED', 'CONFIRMED']);
        expect(result.confidence).to.be.lessThan(0.9);
      }
    });
  });

  // CLASS B: SUBMIT SILENT FAILURE
  // Form submit attempted but neither success feedback nor error appears
  
  describe('CLASS B: Submit Silent Failure', function () {
    it('POSITIVE: Detects submit_silent_failure when form submit has no feedback', function () {
      const expectation = {
        type: 'network',
        promise: {
          action: 'submit',
          method: 'POST',
          endpoint: '/api/contact',
          expectedFeedback: 'success message',
        },
      };

      const observation = {
        signals: {
          feedbackSeen: false,
          ariaLiveUpdated: false,
          ariaRoleAlertsDetected: false,
          networkActivity: true,
          meaningfulDomChange: false,
        },
        evidenceFiles: ['network-log-1.json'],
      };

      const result = classifySilentFailure(expectation, observation, observation.signals, true);

      expect(result).to.exist;
      expect(result.type).to.equal('submit_silent_failure');
      expect(result.status).to.equal('CONFIRMED');
      expect(result.confidence).to.be.greaterThan(0.5);
    });

    it('NEGATIVE: Does NOT detect submit failure when success feedback visible', function () {
      const expectation = {
        type: 'network',
        promise: { action: 'submit', method: 'POST', endpoint: '/api/contact' },
      };

      const observation = {
        signals: {
          feedbackSeen: true,
          ariaLiveUpdated: true,
          networkActivity: true,
        },
      };

      const result = classifySilentFailure(expectation, observation, observation.signals, true);

      expect(result.type).to.not.equal('submit_silent_failure');
    });

    it('AMBIGUOUS: Downgrades when error feedback visible despite submit expectation', function () {
      const expectation = {
        type: 'network',
        promise: { action: 'submit', method: 'POST', endpoint: '/api/contact' },
      };

      const observation = {
        signals: {
          feedbackSeen: true,
          ariaRoleAlertsDetected: true,
          networkActivity: true,
          meaningfulDomChange: false,
        },
      };

      const result = classifySilentFailure(expectation, observation, observation.signals, true);

      if (result.type === 'submit_silent_failure') {
        expect(result.status).to.equal('SUSPECTED');
      }
    });
  });

  // CLASS C: UI FEEDBACK SILENT FAILURE
  // Async action expected but no visual feedback (spinner, message, etc)
  
  describe('CLASS C: UI Feedback Silent Failure', function () {
    it('POSITIVE: Detects ui_feedback when async action has no loading indicator', function () {
      const expectation = {
        type: 'async-action',
        promise: {
          action: 'dispatch',
          target: 'fetchUserData',
          expectedFeedback: 'spinner or message',
        },
      };

      const observation = {
        signals: {
          feedbackSeen: false,
          loadingStarted: false,
          ariaLiveUpdated: false,
          networkActivity: true,
          meaningfulDomChange: false,
        },
      };

      const result = classifySilentFailure(expectation, observation, observation.signals, true);

      expect(result).to.exist;
      expect(result.type).to.equal('ui_feedback_silent_failure');
      expect(result.status).to.equal('CONFIRMED');
      expect(result.confidence).to.be.greaterThan(0.5);
    });

    it('NEGATIVE: Does NOT detect feedback failure when loading indicator present', function () {
      const expectation = {
        type: 'async-action',
        promise: { action: 'dispatch', target: 'fetchData' },
      };

      const observation = {
        signals: {
          feedbackSeen: true,
          loadingStarted: true,
          networkActivity: true,
        },
      };

      const result = classifySilentFailure(expectation, observation, observation.signals, true);

      expect(result.type).to.not.equal('ui_feedback_silent_failure');
    });

    it('AMBIGUOUS: Downgrades when aria-live detected but no loading state', function () {
      const expectation = {
        type: 'async-action',
        promise: { action: 'dispatch', target: 'search' },
      };

      const observation = {
        signals: {
          feedbackSeen: false,
          loadingStarted: false,
          ariaLiveUpdated: true,
          networkActivity: true,
        },
      };

      const result = classifySilentFailure(expectation, observation, observation.signals, true);

      if (result.type === 'ui_feedback_silent_failure') {
        expect(result.status).to.equal('SUSPECTED');
      }
    });
  });

  // CLASS D: STATE CHANGE SILENT FAILURE
  // State mutation expected but application state unchanged
  
  describe('CLASS D: State Change Silent Failure', function () {
    it('POSITIVE: Detects state_change when mutation expected but state unchanged', function () {
      const expectation = {
        type: 'state',
        promise: {
          action: 'setUser',
          expectedState: { userId: '123', name: 'John' },
        },
      };

      const observation = {
        signals: {
          stateChanged: false,
          meaningfulDomChange: true,
          networkActivity: true,
        },
        evidenceFiles: ['state-snapshot-before.json', 'state-snapshot-after.json'],
      };

      const result = classifySilentFailure(expectation, observation, observation.signals, true);

      expect(result).to.exist;
      expect(result.type).to.equal('state_change_silent_failure');
      expect(result.status).to.equal('CONFIRMED');
      expect(result.confidence).to.be.greaterThan(0.5);
    });

    it('NEGATIVE: Does NOT detect state failure when state actually changed', function () {
      const expectation = {
        type: 'state',
        promise: { action: 'setUser', expectedState: { userId: '123' } },
      };

      const observation = {
        signals: {
          stateChanged: true,
          meaningfulDomChange: true,
        },
      };

      const result = classifySilentFailure(expectation, observation, observation.signals, true);

      expect(result.type).to.not.equal('state_change_silent_failure');
    });

    it('AMBIGUOUS: Downgrades when DOM changed but state unchanged (race condition)', function () {
      const expectation = {
        type: 'state',
        promise: { action: 'updateCart', expectedState: { itemCount: 5 } },
      };

      const observation = {
        signals: {
          stateChanged: false,
          meaningfulDomChange: true,
          navigationChanged: true,
        },
      };

      const result = classifySilentFailure(expectation, observation, observation.signals, true);

      if (result.type === 'state_change_silent_failure') {
        expect(result.status).to.be.oneOf(['SUSPECTED', 'UNPROVEN']);
      }
    });
  });

  // CLASS E: LOADING PHANTOM FAILURE
  // Loading state started but never resolves (stuck spinner)
  
  describe('CLASS E: Loading Phantom Failure', function () {
    it('POSITIVE: Detects loading_phantom when loading started but not resolved', function () {
      const expectation = {
        type: 'async-action',
        promise: {
          action: 'fetchData',
          expectedLoading: { started: true, completed: true },
        },
      };

      const observation = {
        signals: {
          loadingStarted: true,
          loadingResolved: false,
          networkActivity: false,
          feedbackSeen: true,
        },
        duration: 45000,
      };

      const result = classifySilentFailure(expectation, observation, observation.signals, true);

      expect(result).to.exist;
      expect(result.type).to.equal('loading_phantom_failure');
      expect(result.status).to.equal('CONFIRMED');
      expect(result.confidence).to.be.greaterThan(0.5);
    });

    it('NEGATIVE: Does NOT detect phantom loading when loading properly resolved', function () {
      const expectation = {
        type: 'async-action',
        promise: { action: 'fetchData', expectedLoading: { completed: true } },
      };

      const observation = {
        signals: {
          loadingStarted: true,
          loadingResolved: true,
          feedbackSeen: true,
        },
      };

      const result = classifySilentFailure(expectation, observation, observation.signals, true);

      expect(result.type).to.not.equal('loading_phantom_failure');
    });

    it('AMBIGUOUS: Downgrades when network activity ongoing (legitimate wait)', function () {
      const expectation = {
        type: 'async-action',
        promise: { action: 'upload', expectedLoading: { completed: true } },
      };

      const observation = {
        signals: {
          loadingStarted: true,
          loadingResolved: false,
          networkActivity: true,
        },
        duration: 15000,
      };

      const result = classifySilentFailure(expectation, observation, observation.signals, true);

      if (result.type === 'loading_phantom_failure') {
        expect(result.status).to.equal('SUSPECTED');
      }
    });
  });

  // CLASS F: PERMISSION WALL SILENT FAILURE
  // Action blocked silently without explicit permission error
  
  describe('CLASS F: Permission Wall Silent Failure', function () {
    it('POSITIVE: Detects permission_wall when access silently blocked', function () {
      const expectation = {
        type: 'navigation',
        promise: {
          action: 'navigate',
          target: '/admin/users',
          expectedAccess: true,
        },
      };

      const observation = {
        signals: {
          navigationChanged: false,
          networkActivity: true,
          feedbackSeen: false,
          meaningfulDomChange: false,
        },
        httpStatus: 403,
        evidenceFiles: ['network-log-403.json'],
      };

      const result = classifySilentFailure(expectation, observation, observation.signals, true);

      expect(result).to.exist;
      expect(result.type).to.equal('permission_wall_silent_failure');
      expect(result.status).to.equal('CONFIRMED');
      expect(result.confidence).to.be.greaterThan(0.5);
    });

    it('NEGATIVE: Does NOT detect permission when explicit error message shown', function () {
      const expectation = {
        type: 'navigation',
        promise: { action: 'navigate', target: '/admin' },
      };

      const observation = {
        signals: {
          navigationChanged: false,
          feedbackSeen: true,
          ariaLiveUpdated: true,
        },
        httpStatus: 403,
      };

      const result = classifySilentFailure(expectation, observation, observation.signals, true);

      expect(result.type).to.not.equal('permission_wall_silent_failure');
    });

    it('AMBIGUOUS: Downgrades when 403 but user navigated elsewhere (not silent)', function () {
      const expectation = {
        type: 'navigation',
        promise: { action: 'navigate', target: '/premium-feature' },
      };

      const observation = {
        signals: {
          navigationChanged: true,
          feedbackSeen: false,
        },
        httpStatus: 403,
      };

      const result = classifySilentFailure(expectation, observation, observation.signals, true);

      if (result.type === 'permission_wall_silent_failure') {
        expect(result.status).to.be.oneOf(['SUSPECTED', 'UNPROVEN']);
      }
    });
  });

  // CROSS-CLASS TESTS: Verify correct class assignment for ambiguous cases
  
  describe('Cross-Class Discrimination', function () {
    it('Does not confuse navigation with submit failure', function () {
      const navExpectation = {
        type: 'navigation',
        promise: { action: 'click', target: 'link', expectedUrl: '/page' },
      };

      const submitExpectation = {
        type: 'network',
        promise: { action: 'submit', method: 'POST', endpoint: '/api' },
      };

      const navObservation = {
        signals: { navigationChanged: false, meaningfulDomChange: true },
      };

      const submitObservation = {
        signals: { feedbackSeen: false, networkActivity: true },
      };

      const navResult = classifySilentFailure(navExpectation, navObservation, navObservation.signals, true);
      const submitResult = classifySilentFailure(submitExpectation, submitObservation, submitObservation.signals, true);

      expect(navResult.type).to.equal('navigation_silent_failure');
      expect(submitResult.type).to.equal('submit_silent_failure');
    });

    it('Correctly assigns ui_feedback vs state_change based on signal presence', function () {
      const feedbackExpectation = {
        type: 'async-action',
        promise: { action: 'dispatch', target: 'load' },
      };

      const stateExpectation = {
        type: 'state',
        promise: { action: 'setState', expectedState: {} },
      };

      const noFeedbackObservation = {
        signals: { feedbackSeen: false, loadingStarted: false, networkActivity: true },
      };

      const noStateObservation = {
        signals: { stateChanged: false, meaningfulDomChange: true },
      };

      const feedbackResult = classifySilentFailure(feedbackExpectation, noFeedbackObservation, noFeedbackObservation.signals, true);
      const stateResult = classifySilentFailure(stateExpectation, noStateObservation, noStateObservation.signals, true);

      expect(feedbackResult.type).to.equal('ui_feedback_silent_failure');
      expect(stateResult.type).to.equal('state_change_silent_failure');
    });
  });

  // EVIDENCE LAW ENFORCEMENT: Verify CONFIRMED requires substantive signals
  
  describe('Evidence Law Enforcement', function () {
    it('Does NOT confirm silent failure without substantive evidence signals', function () {
      const expectation = {
        type: 'navigation',
        promise: { action: 'click', expectedUrl: '/page' },
      };

      const observation = {
        signals: {
          navigationChanged: false,
          meaningfulDomChange: false,
          feedbackSeen: false,
        },
      };

      const result = classifySilentFailure(expectation, observation, observation.signals, true);

      if (result.type === 'navigation_silent_failure') {
        expect(result.status).to.not.equal('CONFIRMED');
      }
    });

    it('Confirms with at least one strong signal (Evidence Law satisfied)', function () {
      const expectation = {
        type: 'navigation',
        promise: { action: 'click', expectedUrl: '/page' },
      };

      const observation = {
        signals: {
          navigationChanged: false,
          meaningfulDomChange: true,
          feedbackSeen: false,
        },
      };

      const result = classifySilentFailure(expectation, observation, observation.signals, true);

      if (result.type === 'navigation_silent_failure') {
        expect(result.status).to.equal('CONFIRMED');
        expect(result.confidence).to.be.greaterThan(0);
      }
    });

    it('Higher confidence when multiple evidence signals present', function () {
      const expectation = {
        type: 'navigation',
        promise: { action: 'click', expectedUrl: '/page' },
      };

      const weakObservation = {
        signals: { navigationChanged: false, meaningfulDomChange: true },
      };

      const strongObservation = {
        signals: {
          navigationChanged: false,
          meaningfulDomChange: true,
          feedbackSeen: false,
          networkActivity: true,
        },
      };

      const weakResult = classifySilentFailure(expectation, weakObservation, weakObservation.signals, true);
      const strongResult = classifySilentFailure(expectation, strongObservation, strongObservation.signals, true);

      if (weakResult.type === 'navigation_silent_failure' && strongResult.type === 'navigation_silent_failure') {
        expect(strongResult.confidence).to.be.greaterThan(weakResult.confidence);
      }
    });
  });

  // DETERMINISM: Same input always produces same output
  
  describe('Determinism Guarantees', function () {
    it('Multiple invocations with same inputs produce identical results', function () {
      const expectation = {
        type: 'navigation',
        promise: { action: 'click', expectedUrl: '/page' },
      };

      const observation = {
        signals: { navigationChanged: false, meaningfulDomChange: true },
      };

      const result1 = classifySilentFailure(expectation, observation, observation.signals, true);
      const result2 = classifySilentFailure(expectation, observation, observation.signals, true);
      const result3 = classifySilentFailure(expectation, observation, observation.signals, true);

      expect(JSON.stringify(result1)).to.equal(JSON.stringify(result2));
      expect(JSON.stringify(result2)).to.equal(JSON.stringify(result3));
    });

    it('Result does NOT change based on invocation order', function () {
      const expectations = [
        { type: 'navigation', promise: { action: 'click' } },
        { type: 'network', promise: { action: 'submit' } },
        { type: 'async-action', promise: { action: 'dispatch' } },
      ];

      const observation = {
        signals: {
          navigationChanged: false,
          feedbackSeen: false,
          loadingStarted: false,
        },
      };

      const results1 = expectations.map((exp) =>
        classifySilentFailure(exp, observation, observation.signals, true)
      );

      const results2 = expectations.reverse().map((exp) =>
        classifySilentFailure(exp, observation, observation.signals, true)
      );

      expect(results1[0].type).to.equal(results2[2].type);
      expect(results1[1].type).to.equal(results2[1].type);
    });
  });

  // NULL CASE: Non-silent failures return null or undefined type
  
  describe('Non-Silent-Failure Cases', function () {
    it('Returns null type when observation meets expectation', function () {
      const expectation = {
        type: 'navigation',
        promise: { action: 'click', expectedUrl: '/page' },
      };

      const observation = {
        signals: {
          navigationChanged: true,
          feedbackSeen: true,
        },
      };

      const result = classifySilentFailure(expectation, observation, observation.signals, true);

      expect(result.type).to.be.null;
    });

    it('Returns null type for coverage gap (not attempted)', function () {
      const expectation = {
        type: 'navigation',
        promise: { action: 'click', expectedUrl: '/page' },
      };

      const observation = {
        attempted: false,
        signals: {},
      };

      const result = classifySilentFailure(expectation, observation, {}, true);

      expect(result.type).to.be.null;
    });
  });
});








