/**
 * Invisible State Failure Detection
 * 
 * Detects interactions where:
 * - Network activity occurs (request sent/completed)
 * - AND no DOM change (no re-render)
 * - AND no visible UI feedback (no toast, modal, highlight)
 * - AND no navigation (URL unchanged)
 * 
 * This represents state changes that happen silently without any
 * user-visible confirmation that the change occurred.
 * 
 * CONFIDENCE: MEDIUM-HIGH (network + absence of UI signals)
 * SEVERITY: MEDIUM (Silent Failure Taxonomy - affects user awareness)
 */

import { hasMeaningfulUrlChange, hasDomChange } from './comparison.js';
import { enrichFindingWithExplanations } from './finding-detector.js';

export function detectInvisibleStateFailures(traces, manifest, findings) {
  // Parameters:
  // traces - array of interaction traces from observation
  // manifest - project manifest (contains expectations)
  // findings - array to append new findings to (mutated in-place)

  for (const trace of traces) {
    const interaction = trace.interaction || {};
    
    // Analyze all interaction types except navigation
    if (interaction.type === 'navigation' || interaction.type === 'link') {
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
    
    // Check for network activity (any requests)
    const hasNetworkActivity = (network.totalRequests || 0) > 0;
    const networkRequests = network.requests || [];

    // Detection logic:
    // Network request occurred but:
    // 1. No navigation (URL unchanged)
    // 2. No DOM change (no re-render)
    // 3. No UI feedback (no visual confirmation)
    //
    // This indicates a state change happened silently
    if (hasNetworkActivity && !urlChanged && !domChanged && !uiChanged) {
      const evidence = {
        before: trace.before?.screenshot || trace.beforeScreenshot || '',
        after: trace.after?.screenshot || trace.afterScreenshot || '',
        beforeUrl,
        afterUrl,
        networkRequests: networkRequests.map(req => ({
          url: req.url,
          method: req.method,
          status: req.status || req.statusCode
        })),
        totalRequests: network.totalRequests || 0,
        uiChanged,
        domChanged,
        urlChanged,
        reason: 'Network activity occurred but no user-visible change resulted'
      };

      const finding = {
        type: 'invisible_state_failure',
        description: `Action triggered network activity but provided no visual feedback`,
        summary: `Network request completed but no UI update, DOM change, or feedback occurred`,
        explanation: `The user action triggered network activity (${network.totalRequests} request(s)), suggesting a state change was initiated. However, the application provided no visual feedback—no DOM update, no toast/modal, and no page change. The user cannot verify whether the action succeeded or failed.`,
        evidence,
        confidence: {
          level: 0.75, // MEDIUM-HIGH - network present, UI signals absent
          reasons: [
            `Network activity detected (${network.totalRequests} request(s))`,
            'No UI feedback (no toast, modal, or message)',
            'No DOM change (no re-render)',
            'No navigation (URL unchanged)'
          ]
        },
        promise: {
          type: 'state_change',
          expected: 'Perform action and display result',
          actual: 'Action completed silently without visible confirmation'
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
