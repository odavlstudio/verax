/**
 * Form Silent Failure Detection
 * 
 * Detects form submissions where:
 * - Form submit handler executes
 * - Network request completes with 2xx status
 * - AND no success UI feedback appears (no toast, modal, or DOM change)
 * - AND no navigation occurs
 * 
 * CONFIDENCE: HIGH (network + UI evidence)
 * Note: Does NOT attempt to parse response content (unsupported)
 */

import { hasMeaningfulUrlChange, hasDomChange } from './comparison.js';
import { enrichFindingWithExplanations } from './finding-detector.js';

export function detectFormSilentFailures(traces, manifest, findings) {
  // Parameters:
  // traces - array of interaction traces from observation
  // manifest - project manifest (contains expectations)
  // findings - array to append new findings to (mutated in-place)

  for (const trace of traces) {
    const interaction = trace.interaction || {};
    
    // Only analyze form interactions
    if (interaction.type !== 'form' && interaction.category !== 'form') {
      continue;
    }

    const beforeUrl = trace.before?.url || trace.beforeUrl || '';
    const afterUrl = trace.after?.url || trace.afterUrl || '';
    const sensors = trace.sensors || {};
    const network = sensors.network || {};
    const uiSignals = sensors.uiSignals || {};
    const uiDiff = uiSignals.diff || {};
    
    const urlChanged = hasMeaningfulUrlChange(beforeUrl, afterUrl);
    const domChanged = hasDomChange(trace);
    const uiChanged = uiDiff.changed === true;
    
    // Check for successful network requests (2xx)
    const successNetworkRequest = (network.requests || []).some(req => {
      const status = req.status || req.statusCode || 0;
      return status >= 200 && status < 300;
    });

    // Detection logic:
    // Form submitted with successful network response but:
    // 1. No navigation (URL unchanged)
    // 2. No DOM change (no new content loaded)
    // 3. No UI feedback (no toast, modal, highlight, etc.)
    if (successNetworkRequest && !urlChanged && !domChanged && !uiChanged) {
      const evidence = {
        before: trace.before?.screenshot || trace.beforeScreenshot || '',
        after: trace.after?.screenshot || trace.afterScreenshot || '',
        beforeUrl,
        afterUrl,
        networkRequests: network.requests || [],
        successRequests: (network.requests || []).filter(r => {
          const status = r.status || r.statusCode || 0;
          return status >= 200 && status < 300;
        }).length,
        uiChanged,
        domChanged,
        urlChanged,
        reason: 'Form submitted successfully but provided no visual feedback'
      };

      const finding = {
        type: 'form_silent_failure',
        description: `Form submission succeeded with no success feedback to user`,
        summary: `Form submitted successfully (2xx response) but no UI feedback (no toast, message, or redirect)`,
        explanation: `The form submission was completed by the server (2xx status code received), but the application provided no visual feedback to the user. The page remained unchanged, with no success message, toast notification, or redirect.`,
        evidence,
        confidence: {
          level: 0.90, // HIGH - network + UI evidence
          reasons: [
            'Form submitted and network request returned 2xx (success)',
            'No UI feedback appeared (no toast, modal, or message)',
            'No page navigation (user stayed on same page)',
            'No DOM change (no new content loaded)'
          ]
        },
        promise: {
          type: 'form_submission',
          expected: 'Submit form and display success feedback',
          actual: 'Form submitted successfully but no feedback provided'
        },
        capabilityNote: 'Detection based on network status and visual feedback only. Does not parse response body or validate success semantics (UNSUPPORTED).'
      };

      // Enrich with explanations
      enrichFindingWithExplanations(finding, trace);
      findings.push(finding);
    }
  }
}








