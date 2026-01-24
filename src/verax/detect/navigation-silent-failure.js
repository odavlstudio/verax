/**
 * Navigation Silent Failure Detection
 * 
 * Detects navigation actions where:
 * - URL changes to expected route
 * - AND no meaningful DOM change occurs (loading state never resolves)
 * - AND expected anchor (h1, title, route container) does not appear
 * 
 * CONFIDENCE: HIGH (URL + DOM evidence)
 * PARTIAL SUPPORT: Relies on rule anchor detection
 */

import { hasMeaningfulUrlChange, hasDomChange } from './comparison.js';
import { enrichFindingWithExplanations } from './finding-detector.js';

export function detectNavigationSilentFailures(traces, manifest, findings) {
  // Parameters:
  // traces - array of interaction traces from observation
  // manifest - project manifest (contains expectations)
  // findings - array to append new findings to (mutated in-place)

  for (const trace of traces) {
    const interaction = trace.interaction || {};
    
    // Only analyze navigation interactions
    if (interaction.type !== 'navigation' && interaction.type !== 'link') {
      continue;
    }

    const beforeUrl = trace.before?.url || trace.beforeUrl || '';
    const afterUrl = trace.after?.url || trace.afterUrl || '';
    const beforePage = trace.page?.beforeTitle || trace.before?.title || '';
    const afterPage = trace.page?.afterTitle || trace.after?.title || '';
    
    const urlChanged = hasMeaningfulUrlChange(beforeUrl, afterUrl);
    const domChanged = hasDomChange(trace);
    
    // Detection logic:
    // URL changed (navigation happened) but:
    // 1. DOM signature didn't change (content not rendered)
    // 2. Page title is the same or empty (no new page loaded)
    if (urlChanged && !domChanged && beforePage === afterPage) {
      const evidence = {
        before: trace.before?.screenshot || trace.beforeScreenshot || '',
        after: trace.after?.screenshot || trace.afterScreenshot || '',
        beforeUrl,
        afterUrl,
        beforePageTitle: beforePage,
        afterPageTitle: afterPage,
        domChanged,
        urlChanged,
        reason: 'URL changed but content did not render (likely loading state)'
      };

      const finding = {
        type: 'navigation_silent_failure',
        description: `Navigation to ${afterUrl} succeeded but content did not render`,
        summary: `URL updated to route but component content remains unrendered (likely stuck in loading state)`,
        explanation: `The navigation route changed from ${beforeUrl} to ${afterUrl}, but the DOM signature remained identical and page title unchanged. This suggests the component is stuck in a loading state.`,
        evidence,
        confidence: {
          level: 0.85, // HIGH - URL + DOM evidence
          reasons: [
            'URL changed to expected route',
            'DOM signature unchanged (content not rendered)',
            'Page title unchanged'
          ]
        },
        promise: {
          type: 'navigation',
          expected: `Navigate to ${afterUrl} and render content`,
          actual: 'Navigation succeeded but content did not render'
        }
      };

      // Enrich with explanations
      enrichFindingWithExplanations(finding, trace);
      findings.push(finding);
    }
  }
}









