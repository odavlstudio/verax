/**
 * Silent Permission Wall Detection
 * 
 * Detects interactions where:
 * - User action attempts to proceed
 * - AND action is blocked (no navigation, no state change, no network)
 * - AND no user feedback explains the block (no error, no message)
 * - AND action appears valid (not disabled, not loading)
 * 
 * This represents permission/authorization walls that block actions
 * silently without explaining why the action cannot proceed.
 * 
 * CONFIDENCE: HIGH (absence of all expected signals)
 * SEVERITY: HIGH (Silent Failure Taxonomy - blocks user progress)
 */

import { hasMeaningfulUrlChange, hasDomChange } from './comparison.js';
import { enrichFindingWithExplanations } from './finding-detector.js';

export function detectSilentPermissionWalls(traces, manifest, findings) {
  // Parameters:
  // traces - array of interaction traces from observation
  // manifest - project manifest (contains expectations)
  // findings - array to append new findings to (mutated in-place)

  for (const trace of traces) {
    const interaction = trace.interaction || {};
    
    // Analyze button/link clicks and form submissions
    if (!['button', 'link', 'form', 'click'].includes(interaction.type)) {
      continue;
    }

    const beforeUrl = trace.before?.url || trace.beforeUrl || '';
    const afterUrl = trace.after?.url || trace.afterUrl || '';
    const sensors = trace.sensors || {};
    const network = sensors.network || {};
    const uiSignals = sensors.uiSignals || {};
    const after = uiSignals.after || {};
    const uiDiff = uiSignals.diff || {};
    
    const urlChanged = hasMeaningfulUrlChange(beforeUrl, afterUrl);
    const domChanged = hasDomChange(trace);
    const uiChanged = uiDiff.changed === true;
    const hasNetworkActivity = (network.totalRequests || 0) > 0;
    
    // Check for error/validation feedback
    const errorMessageDetected = after.errorMessageDetected === true;
    const validationFeedbackDetected = after.validationFeedbackDetected === true;
    
    // Check if element is disabled or loading
    const elementDisabled = interaction.disabled === true;
    const loadingIndicatorDetected = after.loadingIndicatorDetected === true;

    // Detection logic:
    // Action executed but NOTHING happened:
    // 1. No navigation
    // 2. No network activity
    // 3. No DOM change
    // 4. No UI feedback
    // 5. No error/validation message
    // 6. Element not disabled or loading
    //
    // This suggests a silent permission/authorization block
    if (!urlChanged && 
        !hasNetworkActivity && 
        !domChanged && 
        !uiChanged && 
        !errorMessageDetected && 
        !validationFeedbackDetected &&
        !elementDisabled &&
        !loadingIndicatorDetected) {
      
      const evidence = {
        before: trace.before?.screenshot || trace.beforeScreenshot || '',
        after: trace.after?.screenshot || trace.afterScreenshot || '',
        beforeUrl,
        afterUrl,
        networkActivity: hasNetworkActivity,
        totalRequests: network.totalRequests || 0,
        uiChanged,
        domChanged,
        urlChanged,
        errorMessageDetected,
        validationFeedbackDetected,
        elementDisabled,
        loadingIndicatorDetected,
        reason: 'Action blocked silently without feedback'
      };

      const finding = {
        type: 'silent_permission_wall',
        description: `Action blocked without explanation or feedback`,
        summary: `User action produced no result and no feedback explaining why`,
        explanation: `The user attempted an action (${interaction.type} on "${interaction.label || interaction.selector}"), but nothing happened. No navigation occurred, no network request was sent, no UI feedback appeared, and no error message explained why the action was blocked. This suggests a silent permission or authorization wall that prevents the action without informing the user.`,
        evidence,
        confidence: {
          level: 0.85, // HIGH - comprehensive absence of all signals
          reasons: [
            'Action executed but produced no result',
            'No navigation occurred',
            'No network activity',
            'No DOM change',
            'No UI feedback or error message',
            'Element not disabled or loading (action appeared valid)'
          ]
        },
        promise: {
          type: 'action_execution',
          expected: 'Execute action or display error/permission message',
          actual: 'Action blocked silently without explanation'
        },
        impact: 'HIGH',
        severity: 'HIGH'
      };

      // Enrich with explanations
      enrichFindingWithExplanations(finding, trace);
      findings.push(finding);
    }
  }
}
