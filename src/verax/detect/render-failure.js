/**
 * Render Failure Detection
 * 
 * Detects interactions where:
 * - State mutation occurs (network activity or state change signal)
 * - AND no DOM re-render occurs (visual representation unchanged)
 * - AND no error feedback
 * 
 * This represents rendering failures where application state changes
 * but the UI does not update to reflect the new state.
 * 
 * CONFIDENCE: HIGH (state signal + absence of render)
 * SEVERITY: MEDIUM (Silent Failure Taxonomy - state/UI desync)
 */

import { hasMeaningfulUrlChange, hasDomChange } from './comparison.js';
import { enrichFindingWithExplanations } from './finding-detector.js';

export function detectRenderFailures(traces, manifest, findings) {
  // Parameters:
  // traces - array of interaction traces from observation
  // manifest - project manifest (contains expectations)
  // findings - array to append new findings to (mutated in-place)

  for (const trace of traces) {
    const _interaction = trace.interaction || {};
    
    const beforeUrl = trace.before?.url || trace.beforeUrl || '';
    const afterUrl = trace.after?.url || trace.afterUrl || '';
    const sensors = trace.sensors || {};
    const network = sensors.network || {};
    const state = sensors.state || {};
    const uiSignals = sensors.uiSignals || {};
    const after = uiSignals.after || {};
    
    const urlChanged = hasMeaningfulUrlChange(beforeUrl, afterUrl);
    const domChanged = hasDomChange(trace);
    
    // Check for state change signals
    const hasNetworkActivity = (network.totalRequests || 0) > 0;
    const stateChanged = (state.changed || []).length > 0;
    const hasStateSignal = hasNetworkActivity || stateChanged;
    
    // Check for successful network responses (suggests state mutation)
    const hasSuccessResponse = (network.requests || []).some(req => {
      const status = req.status || req.statusCode || 0;
      return status >= 200 && status < 300;
    });
    
    // Check for error feedback
    const errorMessageDetected = after.errorMessageDetected === true;

    // Detection logic:
    // State mutation signal present but:
    // 1. No DOM change (no re-render)
    // 2. No navigation
    // 3. No error message (not a failure case)
    //
    // This indicates a render failure—state changed but UI didn't update
    if (hasStateSignal && !domChanged && !urlChanged && !errorMessageDetected) {
      const evidence = {
        before: trace.before?.screenshot || trace.beforeScreenshot || '',
        after: trace.after?.screenshot || trace.afterScreenshot || '',
        beforeUrl,
        afterUrl,
        networkActivity: hasNetworkActivity,
        totalRequests: network.totalRequests || 0,
        successfulRequests: hasSuccessResponse,
        stateChanged,
        stateKeysChanged: state.changed || [],
        domChanged,
        urlChanged,
        errorMessageDetected,
        reason: 'State mutation occurred without corresponding DOM update'
      };

      const finding = {
        type: 'render_failure',
        description: `State changed but UI did not update`,
        summary: `Application state mutated without corresponding DOM re-render`,
        explanation: `The user action triggered a state change (${hasNetworkActivity ? 'network request completed' : 'state mutation detected'}), but the DOM did not update to reflect the new state. This creates a desynchronization between application state and the UI, where the internal state has changed but the user still sees the old visual representation.`,
        evidence,
        confidence: {
          level: 0.85, // HIGH - state signal present, render absent
          reasons: [
            hasNetworkActivity ? `Network activity detected (${network.totalRequests} request(s))` : 'State mutation detected',
            hasSuccessResponse ? 'Successful network response (suggests state update)' : null,
            stateChanged ? `State keys changed: ${(state.changed || []).join(', ')}` : null,
            'No DOM change (no re-render occurred)',
            'No error message (not a failure case)'
          ].filter(Boolean)
        },
        promise: {
          type: 'state_render',
          expected: 'Update state and re-render UI to reflect change',
          actual: 'State updated but UI did not re-render'
        },
        impact: 'MEDIUM',
        severity: 'MEDIUM'
      };

      // Enrich with explanations
      enrichFindingWithExplanations(finding, trace);
      findings.push(finding);
    }
  }
}
