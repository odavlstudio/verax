/**
 * Loading Hang Detector
 * 
 * Detects interactions where:
 * - Loading indicator appears (spinner, skeleton, progress bar)
 * - AND loading indicator persists without resolving
 * - AND no error message appears
 * - AND no content loads
 * 
 * This represents unresolved loading states where the UI
 * indicates activity but never completes or provides resolution.
 * 
 * CONFIDENCE: MEDIUM-HIGH (UI signal presence + time-based)
 * SEVERITY: LOW (Silent Failure Taxonomy - degrades UX but not critical)
 */

import { hasMeaningfulUrlChange, hasDomChange } from './comparison.js';
import { enrichFindingWithExplanations } from './finding-detector.js';

export function detectStuckOrPhantomLoading(traces, manifest, findings) {
  // Parameters:
  // traces - array of interaction traces from observation
  // manifest - project manifest (contains expectations)
  // findings - array to append new findings to (mutated in-place)

  for (const trace of traces) {
    const _interaction = trace.interaction || {};
    
    const beforeUrl = trace.before?.url || trace.beforeUrl || '';
    const afterUrl = trace.after?.url || trace.afterUrl || '';
    const sensors = trace.sensors || {};
    const uiSignals = sensors.uiSignals || {};
    const after = uiSignals.after || {};
    
    const urlChanged = hasMeaningfulUrlChange(beforeUrl, afterUrl);
    const domChanged = hasDomChange(trace);
    
    // Check for loading indicators in post-action state
    const loadingDetected = after.loadingIndicatorDetected === true;
    const errorMessageDetected = after.errorMessageDetected === true;
    
    // Check if content appeared (meaningful DOM change)
    const contentLoaded = domChanged;

    // Detection logic:
    // Loading indicator visible after action but:
    // 1. No content loaded (no meaningful DOM change)
    // 2. No error message (no failure indication)
    // 3. No navigation (stuck in loading state)
    //
    // This indicates loading never resolved
    if (loadingDetected && !contentLoaded && !errorMessageDetected && !urlChanged) {
      const evidence = {
        before: trace.before?.screenshot || trace.beforeScreenshot || '',
        after: trace.after?.screenshot || trace.afterScreenshot || '',
        beforeUrl,
        afterUrl,
        loadingIndicatorDetected: loadingDetected,
        errorMessageDetected: errorMessageDetected,
        contentLoaded: contentLoaded,
        domChanged: domChanged,
        urlChanged: urlChanged,
        reason: 'Loading indicator persists without resolution or error'
      };

      const finding = {
        type: 'stuck_or_phantom_loading',
        description: `Loading indicator appeared but never resolved`,
        summary: `Loading state persists without content appearing or error message`,
        explanation: `The user action triggered a loading indicator (spinner, skeleton, or progress bar), but the loading state never resolved. No content was loaded, no error message appeared, and the UI remains stuck in the loading state. This creates uncertainty about whether the action is still processing or has failed.`,
        evidence,
        confidence: {
          level: 0.80, // MEDIUM-HIGH - loading signal present, resolution absent
          reasons: [
            'Loading indicator detected after action',
            'No content loaded (no meaningful DOM change)',
            'No error message appeared',
            'Loading state persists without resolution'
          ]
        },
        promise: {
          type: 'content_loading',
          expected: 'Display loading indicator, then show content or error',
          actual: 'Loading indicator persists without resolution'
        },
        impact: 'LOW',
        severity: 'LOW'
      };

      // Enrich with explanations
      enrichFindingWithExplanations(finding, trace);
      findings.push(finding);
    }
  }
}
