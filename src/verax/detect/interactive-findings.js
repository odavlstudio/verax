// Interactive Finding Detection Module
// Handles keyboard, hover, file_upload, login, logout, auth_guard interactions
// Plus accessibility detections: focus, ARIA, keyboard trap, feedback gap, freeze

import { hasMeaningfulUrlChange, hasDomChange } from './comparison.js';
import { computeConfidence } from '../core/confidence/index.js';
import { enrichFindingWithExplanations } from './finding-detector.js';

/**
 * Detect interactive and accessibility-related silent failures
 * Covers: keyboard, hover, file_upload, login, logout, auth_guard interactions
 * Plus focus loss, ARIA changes, keyboard traps, feedback gaps, freeze-like behavior
 * 
 * @param {Array} traces - Interaction traces to analyze
 * @param {Object} manifest - Project manifest (not used currently)
 * @param {Array} findings - Findings array to append to
 * @returns {Array} Array of detected interactive findings
 */
export function detectInteractiveFindings(traces, manifest, findings, _helpers = {}) {
  const interactiveFindings = [];

  for (const trace of traces) {
    const interaction = trace.interaction || {};
    const beforeUrl = trace.beforeUrl || '';
    const afterUrl = trace.afterUrl || '';
    const beforeScreenshot = trace.beforeScreenshot || '';
    const afterScreenshot = trace.afterScreenshot || '';
    
    // VISION 1.0: Skip post-auth contexts (403, post-auth session)
    // These are out of scope and should not produce findings
    const httpStatus = trace.httpStatus || trace.authGuard?.httpStatus || null;
    if (httpStatus === 403) {
      // 403 Forbidden: Post-auth/RBAC context, skip to post-auth detector
      continue;
    }

    // Handle specific interaction types: keyboard, hover, file_upload, login, logout, auth_guard
    if (['keyboard', 'hover', 'file_upload', 'login', 'logout', 'auth_guard'].includes(interaction.type)) {
      const sensors = trace.sensors || {};
      const uiSignals = sensors.uiSignals || {};
      const uiDiff = uiSignals.diff || uiSignals.changes || {};
      const uiChanged = uiDiff.changed === true;
      const domChanged = hasDomChange(trace);
      const urlChanged = hasMeaningfulUrlChange(beforeUrl, afterUrl);
      const network = sensors.network || {};
      const hasNetwork = (network.totalRequests || 0) > 0;

      let findingType = null;
      let reason = '';
      const evidence = {
        before: beforeScreenshot,
        after: afterScreenshot,
        beforeUrl,
        afterUrl,
        interactionType: interaction.type,
        uiChanged,
        domChanged,
        urlChanged,
        networkRequests: network.totalRequests || 0
      };

      if (interaction.type === 'keyboard') {
        const keyboardMeta = trace.keyboard || {};
        evidence.focusOrder = keyboardMeta.focusOrder || [];
        evidence.actions = keyboardMeta.actions || [];
        const noEffect = !urlChanged && !domChanged && !uiChanged && !hasNetwork;
        if (noEffect) {
          findingType = 'keyboard_silent_failure';
          reason = 'Keyboard navigation produced no visible, DOM, or network effect';
        }
      } else if (interaction.type === 'hover') {
        const hoverMeta = trace.hover || {};
        evidence.hoveredSelector = hoverMeta.selector || interaction.selector;
        const noReveal = !domChanged && !uiChanged && !urlChanged;
        if (noReveal) {
          findingType = 'hover_silent_failure';
          reason = 'Hover interaction did not reveal any observable change';
        }
      } else if (interaction.type === 'file_upload') {
        const uploadMeta = trace.fileUpload || {};
        evidence.filePath = uploadMeta.filePath || null;
        evidence.submitted = uploadMeta.submitted || false;
        const notAttached = uploadMeta && uploadMeta.attached === false;
        const noEffect = !domChanged && !uiChanged && !hasNetwork;
        if (notAttached || noEffect) {
          findingType = 'file_upload_silent_failure';
          reason = notAttached ? 'File was not attached' : 'Upload produced no network, DOM, or UI change';
        }
      } else if (interaction.type === 'login' || trace.interactionType === 'login') {
        const loginMeta = trace.login || {};
        evidence.submitted = loginMeta.submitted || false;
        evidence.found = loginMeta.found !== false; // Default to true if not set
        evidence.redirected = loginMeta.redirected || false;
        evidence.storageChanged = loginMeta.storageChanged || false;
        evidence.cookiesChanged = loginMeta.cookiesChanged || false;
        evidence.beforeStorage = loginMeta.beforeStorage || [];
        evidence.afterStorage = loginMeta.afterStorage || [];
        const noEffect = !loginMeta.redirected && !loginMeta.storageChanged && !loginMeta.cookiesChanged && !hasNetwork;
        if (loginMeta.submitted && noEffect) {
          findingType = 'auth_silent_failure';
          reason = 'Login submitted but produced no redirect, session storage change, cookies change, or network activity';
        }
      } else if (interaction.type === 'logout' || trace.interactionType === 'logout') {
        const logoutMeta = trace.logout || {};
        evidence.clicked = logoutMeta.clicked || false;
        evidence.found = logoutMeta.found !== false; // Default to true if not set
        evidence.redirected = logoutMeta.redirected || false;
        evidence.storageChanged = logoutMeta.storageChanged || false;
        evidence.cookiesChanged = logoutMeta.cookiesChanged || false;
        evidence.beforeStorage = logoutMeta.beforeStorage || [];
        evidence.afterStorage = logoutMeta.afterStorage || [];
        const noEffect = !logoutMeta.redirected && !logoutMeta.storageChanged && !logoutMeta.cookiesChanged;
        if (logoutMeta.clicked && noEffect) {
          findingType = 'logout_silent_failure';
          reason = 'Logout clicked but produced no redirect or session state change (storage/cookies unchanged)';
        }
      } else if (interaction.type === 'auth_guard' || trace.interactionType === 'auth_guard') {
        const guardMeta = trace.authGuard || {};
        evidence.url = guardMeta.url || null;
        evidence.isProtected = guardMeta.isProtected || false;
        evidence.redirectedToLogin = guardMeta.redirectedToLogin || false;
        evidence.hasAccessDenied = guardMeta.hasAccessDenied || false;
        evidence.httpStatus = guardMeta.httpStatus || null;
        
        // VISION 1.0: 401 on pre-auth gates is IN SCOPE, all other 401/403 is OUT OF SCOPE
        // Check if this is a pre-auth gate (login, signup, reset)
        const _isPreAuthGate = ['login', 'signin', 'signup', 'register', 'reset', 'forgot'].some(
          p => (evidence.url || '').toLowerCase().includes(p)
        );
        
        // Only emit findings for routes that should be protected but are accessible
        // Skip 401/403 cases - they're handled by post-auth detector
        const notProtected = !guardMeta.isProtected;
        if (guardMeta.url && notProtected && guardMeta.httpStatus !== 401 && guardMeta.httpStatus !== 403) {
          findingType = 'protected_route_silent_failure';
          reason = 'Route expected to be protected was accessible without authentication';
        }
      }

      if (findingType) {
        const finding = {
          type: findingType,
          interaction: {
            type: interaction.type,
            selector: interaction.selector,
            label: interaction.label
          },
          interactionType: interaction.type,
          reason,
          evidence
        };

        finding.confidence = computeConfidence({
          findingType: 'no_effect_silent_failure',
          expectation: { expectationStrength: 'OBSERVED' },
          sensors: {
            network,
            console: sensors.console || {},
            uiSignals: uiSignals
          },
          comparisons: {
            hasUrlChange: urlChanged,
            hasDomChange: domChanged,
            hasVisibleChange: false
          },
          attemptMeta: {},
          evidenceIntent: null,
          guardrailsOutcome: null,
          truthStatus: 'SUSPECTED',
          evidence: {},
          options: {}
        });

        enrichFindingWithExplanations(finding, trace);
        interactiveFindings.push(finding);
      }
    }

    // ASYNC INTELLIGENCE: Detect partial success, loading stuck, and async state mismatch
    // These detections apply to ALL interaction types, not just keyboard/hover/auth
    {
      const sensors = trace.sensors || {};
      const uiSignals = sensors.uiSignals || {};
      const uiDiff = uiSignals.diff || uiSignals.changes || {};
      const uiChanged = uiDiff.changed === true;
      const domChanged = hasDomChange(trace);
      const urlChanged = hasMeaningfulUrlChange(beforeUrl, afterUrl);
      const network = sensors.network || {};
      const _hasNetwork = (network.totalRequests || 0) > 0;
      const loading = sensors.loading || {};
      const stateData = sensors.state || {};

      // Detection: partial_success_silent_failure
      // Network request succeeded (2xx) but no observable effect
      const hasSuccessfulNetwork = (network.successfulRequests && network.successfulRequests > 0) || 
                                   (network.topFailedUrls && network.topFailedUrls.length === 0 && network.totalRequests > 0);
      if (hasSuccessfulNetwork && !domChanged && !uiChanged && !urlChanged) {
        const partialFinding = {
          type: 'partial_success_silent_failure',
          interaction: {
            type: interaction.type,
            selector: interaction.selector,
            label: interaction.label
          },
          reason: 'Network request succeeded (2xx) but produced no DOM, UI, or URL change',
          evidence: {
            before: beforeScreenshot,
            after: afterScreenshot,
            beforeUrl,
            afterUrl,
            networkRequests: network.totalRequests || 0,
            networkSuccessful: hasSuccessfulNetwork,
            domChanged: false,
            uiChanged: false,
            urlChanged: false
          }
        };

        partialFinding.confidence = computeConfidence({
          findingType: 'partial_success_silent_failure',
          expectation: { expectationStrength: 'OBSERVED' },
          sensors: { network, console: sensors.console || {}, uiSignals: uiSignals },
          comparisons: { hasUrlChange: false, hasDomChange: false, hasVisibleChange: false },
          attemptMeta: {},
          evidenceIntent: null,
          guardrailsOutcome: null,
          truthStatus: 'SUSPECTED',
          evidence: {},
          options: {}
        });

        enrichFindingWithExplanations(partialFinding, trace);

        interactiveFindings.push(partialFinding);
      }

      // Detection: loading_stuck_silent_failure
      // Loading indicator present but not resolved within timeout
      if (loading.unresolved === true && (loading.isLoading === true || loading.timeout === true)) {
        const loadingStuckFinding = {
          type: 'loading_stuck_silent_failure',
          interaction: {
            type: interaction.type,
            selector: interaction.selector,
            label: interaction.label
          },
          reason: 'Loading indicator detected but did not resolve within deterministic timeout (5s)',
          evidence: {
            before: beforeScreenshot,
            after: afterScreenshot,
            beforeUrl,
            afterUrl,
            loadingIndicators: loading.loadingIndicators || [],
            duration: loading.duration || 0,
            timeout: true
          }
        };

        loadingStuckFinding.confidence = computeConfidence({
          findingType: 'loading_stuck_silent_failure',
          expectation: { expectationStrength: 'OBSERVED' },
          sensors: { network, console: sensors.console || {}, uiSignals: uiSignals },
          comparisons: { hasUrlChange: false, hasDomChange: false, hasVisibleChange: false },
          attemptMeta: {},
          evidenceIntent: null,
          guardrailsOutcome: null,
          truthStatus: 'SUSPECTED',
          evidence: {},
          options: {}
        });

        enrichFindingWithExplanations(loadingStuckFinding, trace);

        interactiveFindings.push(loadingStuckFinding);
      }

      // Detection: async_state_silent_failure
      // State/storage changed but UI did not reflect it
      const stateChanged = stateData.changed && stateData.changed.length > 0;
      if (stateChanged && !uiChanged && !domChanged) {
        const asyncStateFinding = {
          type: 'async_state_silent_failure',
          interaction: {
            type: interaction.type,
            selector: interaction.selector,
            label: interaction.label
          },
          reason: 'Application state changed but no DOM or UI change was observed',
          evidence: {
            before: beforeScreenshot,
            after: afterScreenshot,
            beforeUrl,
            afterUrl,
            stateChanged: stateChanged,
            changedProperties: stateData.changed || [],
            storeType: stateData.storeType || 'unknown',
            domChanged: false,
            uiChanged: false
          }
        };

        asyncStateFinding.confidence = computeConfidence({
          findingType: 'async_state_silent_failure',
          expectation: { expectationStrength: 'OBSERVED' },
          sensors: { network, console: sensors.console || {}, uiSignals: uiSignals, state: stateData },
          comparisons: { hasUrlChange: false, hasDomChange: false, hasVisibleChange: false },
          attemptMeta: {},
          evidenceIntent: null,
          guardrailsOutcome: null,
          truthStatus: 'SUSPECTED',
          evidence: {},
          options: {}
        });

        enrichFindingWithExplanations(asyncStateFinding, trace);

        interactiveFindings.push(asyncStateFinding);
      }
    }

    // A11Y INTELLIGENCE: Detect accessibility-related silent failures
    {
      const sensors = trace.sensors || {};
      const focus = sensors.focus || {};
      const aria = sensors.aria || {};

      // Detection: focus_silent_failure
      // Focus lost (moved to body/null) after interaction
      if (focus.after && (focus.after.selector === 'body' || focus.after.selector === 'null') && 
          !['body', 'null'].includes(focus.before?.selector)) {
        const focusLossFinding = {
          type: 'focus_silent_failure',
          interaction: {
            type: interaction.type,
            selector: interaction.selector,
            label: interaction.label
          },
          reason: 'Focus was lost after interaction (moved to body or null)',
          evidence: {
            before: beforeScreenshot,
            after: afterScreenshot,
            beforeUrl,
            afterUrl,
            focusBefore: focus.before?.selector || 'unknown',
            focusAfter: focus.after?.selector || 'unknown',
            focusLost: true
          }
        };

        focusLossFinding.confidence = computeConfidence({
          findingType: 'focus_silent_failure',
          expectation: { expectationStrength: 'OBSERVED' },
          sensors: { network: sensors.network || {}, console: sensors.console || {} },
          comparisons: { hasUrlChange: false, hasDomChange: false, hasVisibleChange: false },
          attemptMeta: {},
          evidenceIntent: null,
          guardrailsOutcome: null,
          truthStatus: 'SUSPECTED',
          evidence: {},
          options: {}
        });

        enrichFindingWithExplanations(focusLossFinding, trace);

        interactiveFindings.push(focusLossFinding);
      }

      // Detection: focus_silent_failure - Modal focus failure
      // Modal/dialog opened but focus didn't move into it
      if (focus.after && focus.after.hasModal === true && focus.after.focusInModal === false) {
        // Modal is present but focus is not within it
        // Check if focus changed (modal was likely just opened)
        const focusChanged = focus.before?.selector !== focus.after?.selector;
        if (focusChanged || focus.before?.hasModal !== true) {
          // Modal opened but focus didn't move into it
          const modalFocusFinding = {
            type: 'focus_silent_failure',
            interaction: {
              type: interaction.type,
              selector: interaction.selector,
              label: interaction.label
            },
            reason: 'Modal/dialog opened but focus did not move into it',
            evidence: {
              before: beforeScreenshot,
              after: afterScreenshot,
              beforeUrl,
              afterUrl,
              focusBefore: focus.before?.selector || 'unknown',
              focusAfter: focus.after?.selector || 'unknown',
              modalOpened: true,
              focusInModal: false
            }
          };

          modalFocusFinding.confidence = computeConfidence({
            findingType: 'focus_silent_failure',
            expectation: { expectationStrength: 'OBSERVED' },
            sensors: { network: sensors.network || {}, console: sensors.console || {} },
            comparisons: { hasUrlChange: false, hasDomChange: false, hasVisibleChange: false },
            attemptMeta: {},
          evidenceIntent: null,
          guardrailsOutcome: null,
          truthStatus: 'SUSPECTED',
          evidence: {},
          options: {}
        });

          enrichFindingWithExplanations(modalFocusFinding, trace);

          interactiveFindings.push(modalFocusFinding);
        }
      }

      // Detection: aria_announce_silent_failure
      // Meaningful event occurred but ARIA state didn't change
      const network = sensors.network || {};
      const hasNetwork = (network.totalRequests || 0) > 0;
      const ariaChanged = aria.changed === true;

      // Form submission, network success, or validation should trigger ARIA
      if ((interaction.type === 'form' || hasNetwork) && !ariaChanged) {
        const missingAnnouncementFinding = {
          type: 'aria_announce_silent_failure',
          interaction: {
            type: interaction.type,
            selector: interaction.selector,
            label: interaction.label
          },
          reason: 'Meaningful event occurred but no ARIA announcement was detected',
          evidence: {
            before: beforeScreenshot,
            after: afterScreenshot,
            beforeUrl,
            afterUrl,
            eventType: interaction.type === 'form' ? 'form_submission' : 'network_activity',
            ariaChangedBefore: aria.before?.statusRoles?.length || 0,
            ariaChangedAfter: aria.after?.statusRoles?.length || 0,
            liveRegionsBefore: aria.before?.liveRegions?.length || 0,
            liveRegionsAfter: aria.after?.liveRegions?.length || 0,
            ariaChanged: false
          }
        };

        missingAnnouncementFinding.confidence = computeConfidence({
          findingType: 'aria_announce_silent_failure',
          expectation: { expectationStrength: 'OBSERVED' },
          sensors: { network, console: sensors.console || {} },
          comparisons: { hasUrlChange: false, hasDomChange: false, hasVisibleChange: false },
          attemptMeta: {},
          evidenceIntent: null,
          guardrailsOutcome: null,
          truthStatus: 'SUSPECTED',
          evidence: {},
          options: {}
        });

        enrichFindingWithExplanations(missingAnnouncementFinding, trace);

        interactiveFindings.push(missingAnnouncementFinding);
      }

      // Detection: keyboard_trap_silent_failure
      // Keyboard navigation traps focus within small set of elements
      if (interaction.type === 'keyboard' && trace.keyboard) {
        const focusSequence = trace.keyboard.focusOrder || [];
        
        // Check if focus cycles within small set (trap)
        if (focusSequence.length >= 4) {
          const uniqueElements = new Set(focusSequence);
          
          // If we have many steps but few unique elements, it's a trap
          if (uniqueElements.size <= 3 && focusSequence.length >= 6) {
            const keyboardTrapFinding = {
              type: 'keyboard_trap_silent_failure',
              interaction: {
                type: interaction.type,
                selector: interaction.selector,
                label: interaction.label
              },
              reason: 'Keyboard navigation trapped focus within small set of elements',
              evidence: {
                before: beforeScreenshot,
                after: afterScreenshot,
                beforeUrl,
                afterUrl,
                focusSequence: focusSequence,
                uniqueElements: Array.from(uniqueElements),
                sequenceLength: focusSequence.length,
                uniqueCount: uniqueElements.size
              }
            };

            keyboardTrapFinding.confidence = computeConfidence({
              findingType: 'keyboard_trap_silent_failure',
              expectation: { expectationStrength: 'OBSERVED' },
              sensors: { network: sensors.network || {}, console: sensors.console || {} },
              comparisons: { hasUrlChange: false, hasDomChange: false, hasVisibleChange: false },
              attemptMeta: {},
          evidenceIntent: null,
          guardrailsOutcome: null,
          truthStatus: 'SUSPECTED',
          evidence: {},
          options: {}
        });

            enrichFindingWithExplanations(keyboardTrapFinding, trace);

            interactiveFindings.push(keyboardTrapFinding);
          }
        }
        
        // Check for consecutive repeats (same element repeatedly)
        if (focusSequence.length >= 3) {
          let consecutiveRepeats = 0;
          for (let i = 1; i < focusSequence.length; i++) {
            if (focusSequence[i] === focusSequence[i - 1]) {
              consecutiveRepeats++;
            }
          }
          
          if (consecutiveRepeats >= 2) {
            const keyboardTrapFinding = {
              type: 'keyboard_trap_silent_failure',
              interaction: {
                type: interaction.type,
                selector: interaction.selector,
                label: interaction.label
              },
              reason: 'Keyboard navigation stuck on same element repeatedly',
              evidence: {
                before: beforeScreenshot,
                after: afterScreenshot,
                beforeUrl,
                afterUrl,
                focusSequence: focusSequence,
                consecutiveRepeats: consecutiveRepeats
              }
            };

            keyboardTrapFinding.confidence = computeConfidence({
              findingType: 'keyboard_trap_silent_failure',
              expectation: { expectationStrength: 'OBSERVED' },
              sensors: { network: sensors.network || {}, console: sensors.console || {} },
              comparisons: { hasUrlChange: false, hasDomChange: false, hasVisibleChange: false },
              attemptMeta: {},
          evidenceIntent: null,
          guardrailsOutcome: null,
          truthStatus: 'SUSPECTED',
          evidence: {},
          options: {}
        });

            enrichFindingWithExplanations(keyboardTrapFinding, trace);

            interactiveFindings.push(keyboardTrapFinding);
          }
        }
      }
    }

    // PERFORMANCE INTELLIGENCE: Detect feedback gap silent failures
    {
      const sensors = trace.sensors || {};
      const timing = sensors.timing || {};
      const network = sensors.network || {};

      // Detection: feedback_gap_silent_failure
      // Interaction triggered work (network OR loading) but no user feedback appeared within 1500ms
      // Work must have started (network or loading), and feedback must be missing or too late
      const loadingIndicators = sensors.loading || {};
      const workStarted = timing.networkActivityDetected || (loadingIndicators && loadingIndicators.hasLoadingIndicators);
      
      if (workStarted && timing.feedbackDelayMs !== undefined) {
        const hasFeedbackGap = 
          !timing.feedbackDetected || 
          timing.feedbackDelayMs > (timing.feedbackGapThreshold || 1500);

        if (hasFeedbackGap) {
          const feedbackGapFinding = {
            type: 'feedback_gap_silent_failure',
            interaction: {
              type: interaction.type,
              selector: interaction.selector,
              label: interaction.label
            },
            reason: `Interaction started work but no user feedback appeared within ${timing.feedbackGapThreshold}ms`,
            evidence: {
              before: beforeScreenshot,
              after: afterScreenshot,
              beforeUrl,
              afterUrl,
              timingBreakdown: {
                interactionStartMs: 0,
                networkStartMs: timing.workStartMs,
                feedbackStartMs: timing.feedbackDetected ? timing.feedbackDelayMs : -1,
                totalElapsedMs: timing.elapsedMs
              },
              feedbackDetected: timing.feedbackDetected,
              feedbackDelayMs: timing.feedbackDelayMs,
              networkActivityDetected: timing.networkActivityDetected,
              workStartMs: timing.workStartMs,
              feedbackGapThreshold: timing.feedbackGapThreshold,
              missingFeedback: {
                loadingIndicator: !timing.tLoadingStart,
                ariaAnnouncement: !timing.tAriaFirst,
                uiChange: !timing.tUiFirst
              }
            }
          };

          feedbackGapFinding.confidence = computeConfidence({
            findingType: 'feedback_gap_silent_failure',
            expectation: { expectationStrength: 'OBSERVED' },
            sensors: { network, console: sensors.console || {} },
            comparisons: { hasUrlChange: false, hasDomChange: false, hasVisibleChange: false },
            attemptMeta: {},
          evidenceIntent: null,
          guardrailsOutcome: null,
          truthStatus: 'SUSPECTED',
          evidence: {},
          options: {}
        });

          enrichFindingWithExplanations(feedbackGapFinding, trace);

          interactiveFindings.push(feedbackGapFinding);
        }
      }

      // Detection: freeze_like_silent_failure
      // Interaction triggered work but significant delay (>3000ms) before any feedback
      // Only detect if feedback WAS eventually detected (not missing entirely)
      if (timing.networkActivityDetected && timing.isFreezeLike && timing.feedbackDetected) {
        const freezeLikeFinding = {
          type: 'freeze_like_silent_failure',
          interaction: {
            type: interaction.type,
            selector: interaction.selector,
            label: interaction.label
          },
          reason: `Interaction caused UI freeze-like behavior: ${timing.feedbackDelayMs}ms delay before feedback`,
          evidence: {
            before: beforeScreenshot,
            after: afterScreenshot,
            beforeUrl,
            afterUrl,
            timingBreakdown: {
              interactionStartMs: 0,
              networkStartMs: timing.workStartMs,
              feedbackStartMs: timing.feedbackDetected ? timing.feedbackDelayMs : -1,
              totalElapsedMs: timing.elapsedMs
            },
            feedbackDelayMs: timing.feedbackDelayMs,
            freezeLikeThreshold: timing.freezeLikeThreshold,
            workStartMs: timing.workStartMs
          }
        };

        freezeLikeFinding.confidence = computeConfidence({
          findingType: 'freeze_like_silent_failure',
          expectation: { expectationStrength: 'OBSERVED' },
          sensors: { network, console: sensors.console || {} },
          comparisons: { hasUrlChange: false, hasDomChange: false, hasVisibleChange: false },
          attemptMeta: {},
          evidenceIntent: null,
          guardrailsOutcome: null,
          truthStatus: 'SUSPECTED',
          evidence: {},
          options: {}
        });

        enrichFindingWithExplanations(freezeLikeFinding, trace);

        interactiveFindings.push(freezeLikeFinding);
      }
    }
  }

  // Merge all detected findings into the main findings array
  findings.push(...interactiveFindings);
  
  return interactiveFindings;
}



