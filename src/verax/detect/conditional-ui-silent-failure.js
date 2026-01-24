/**
 * Conditional UI Stale State Detection
 * 
 * Detects UI elements that should update/disappear when state changes but don't:
 * - State mutation observed (via state sensor or console logs)
 * - Dependent UI element remains unchanged
 * - Expected element missing or still visible
 * 
 * CONFIDENCE: MEDIUM (rule-based)
 * PARTIAL SUPPORT: rule detection, not semantic analysis
 * 
 * Note: Does NOT detect async race conditions (UNSUPPORTED - too many false positives)
 */

import { hasDomChange } from './comparison.js';
import { enrichFindingWithExplanations } from './finding-detector.js';

export function detectConditionalUiSilentFailures(traces, manifest, findings) {
  // Parameters:
  // traces - array of interaction traces from observation
  // manifest - project manifest (contains expectations)
  // findings - array to append new findings to (mutated in-place)

  for (const trace of traces) {
    const sensors = trace.sensors || {};
    const stateSignals = sensors.state || {};
    const uiSignals = sensors.uiSignals || {};
    const uiDiff = uiSignals.diff || {};
    const domChanged = hasDomChange(trace);

    // rule: State changed but UI didn't
    // This suggests a stale UI or conditional rendering bug
    const stateChanged = stateSignals.changed === true || 
                        (stateSignals.changed && stateSignals.changed.length > 0);
    const uiChanged = uiDiff.changed === true;

    // Detection logic:
    // State changed but UI did not
    // This is a common pattern for stale UI bugs in React/Vue
    if (stateChanged && !uiChanged && !domChanged) {
      const interaction = trace.interaction || {};
      
      // Skip if it's a form input (expected state-only change)
      if (interaction.type === 'interaction' && interaction.category === 'button') {
        const evidence = {
          before: trace.before?.screenshot || trace.beforeScreenshot || '',
          after: trace.after?.screenshot || trace.afterScreenshot || '',
          beforeUrl: trace.before?.url || trace.beforeUrl || '',
          afterUrl: trace.after?.url || trace.afterUrl || '',
          stateChanged,
          uiChanged,
          domChanged,
          reason: 'State updated but UI did not reflect the change (stale UI)'
        };

        const finding = {
          type: 'conditional_ui_silent_failure',
          description: `Conditional UI element did not update when state changed`,
          summary: `Button/interaction caused state change but UI did not update (stale UI pattern)`,
          explanation: `State mutation was detected but the UI elements dependent on that state did not update. This is a common pattern in React/Vue applications where conditional rendering or dynamic classes don't update properly.`,
          evidence,
          confidence: {
            level: 0.60, // MEDIUM - rule-based
            reasons: [
              'State mutation observed',
              'UI elements did not update to reflect new state',
              'Likely stale UI or conditional rendering bug'
            ]
          },
          promise: {
            type: 'conditional_ui_update',
            expected: 'State change triggers UI update (conditional render, class change, etc.)',
            actual: 'State changed but UI remained unchanged'
          },
          capabilityNote: 'PARTIAL SUPPORT: Detection based on state sensor data and rules. Does not perform semantic analysis of UI logic. Async race conditions are UNSUPPORTED due to high false positive rate.'
        };

        // Enrich with explanations
        enrichFindingWithExplanations(finding, trace);
        findings.push(finding);
      }
    }
  }
}








