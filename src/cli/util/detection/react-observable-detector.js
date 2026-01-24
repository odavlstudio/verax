/**
 * React Observable Pattern Detector
 * 
 * Detects observable runtime patterns in React applications:
 * - Navigation triggered via React effects (window.location, history changes)
 * - State-driven re-render evidence (data attributes, component keys)
 * - Conditional rendering patterns
 * 
 * Observable only; no React semantics assumed.
 * Degrades gracefully when React not present.
 */

import BaseDetector from './base-detector.js';

export class ReactObservableDetector extends BaseDetector {
  constructor() {
    super({ name: 'react-observable', framework: 'react', type: 'observable' });
  }

  /**
   * Detect React presence indicators in HTML
   * @param {string} html - HTML content
   * @returns {Object} React presence signals
   */
  detectReactPresence(html) {
    if (!html) {
      return { reactDetected: false, indicators: [] };
    }

    const indicators = [];

    // Check for React root data attributes
    if (html.match(/data-react(?:root|id)/i)) {
      indicators.push('data-react-root');
    }

    // Check for React DevTools hook
    if (html.match(/__REACT_DEVTOOLS/)) {
      indicators.push('react-devtools');
    }

    // Check for common React bundle patterns
    if (html.match(/react.*\.js/i)) {
      indicators.push('react-bundle');
    }

    // Check for React-specific data attributes
    if (html.match(/data-reactid/i)) {
      indicators.push('data-reactid');
    }

    const reactDetected = indicators.length > 0;
    return { reactDetected, indicators };
  }

  /**
   * Detect navigation patterns triggered by React effects
   * Observable via history API mutations or location changes
   * @param {string} beforeUrl - URL before
   * @param {string} afterUrl - URL after
   * @param {Object} historyState - History state changes
   * @returns {Object} Effect-based navigation signals
   */
  detectEffectBasedNavigation(beforeUrl, afterUrl, historyState) {
    if (!beforeUrl || !afterUrl) {
      return { effectNavigationDetected: false, evidence: {} };
    }

    const evidence = {};

    // Detect URL change (could be from useEffect with router.push/navigate)
    if (beforeUrl !== afterUrl) {
      evidence.urlChanged = true;

      try {
        const beforeU = new URL(beforeUrl);
        const afterU = new URL(afterUrl);

        // Check if path changed (common in React Router/effect-based nav)
        if (beforeU.pathname !== afterU.pathname) {
          evidence.pathChanged = true;
        }

        // Check if search params changed (common in useSearchParams effects)
        if (beforeU.search !== afterU.search) {
          evidence.searchParamsChanged = true;
        }
      } catch (e) {
        // URL parsing error; graceful fallback
      }
    }

    // Check history state changes (pushState/replaceState from effects)
    if (historyState && historyState.historyStateChanged) {
      evidence.historyStateChanged = true;
      evidence.historyDiff = historyState.historyStateDiff;
    }

    const effectNavigationDetected = Object.keys(evidence).length > 0;
    return { effectNavigationDetected, evidence };
  }

  /**
   * Detect state-driven re-render evidence
   * Observable via component key changes, conditional rendering patterns
   * @param {string} beforeHtml - HTML before
   * @param {string} afterHtml - HTML after
   * @returns {Object} Re-render evidence signals
   */
  detectStateReRenderEvidence(beforeHtml, afterHtml) {
    if (!beforeHtml || !afterHtml) {
      return { reRenderEvidenceDetected: false, evidence: {} };
    }

    const evidence = {};

    // Check for component key attribute changes (React keys for list rendering)
    const keyPattern = /data-(?:react)?key\s*=\s*["']([^"']+)["']/gi;
    const beforeKeys = [];
    const afterKeys = [];

    let match;
    while ((match = keyPattern.exec(beforeHtml)) !== null) {
      beforeKeys.push(match[1]);
    }
    keyPattern.lastIndex = 0;
    while ((match = keyPattern.exec(afterHtml)) !== null) {
      afterKeys.push(match[1]);
    }

    if (beforeKeys.length !== afterKeys.length || beforeKeys.some((k, i) => k !== afterKeys[i])) {
      evidence.componentKeysChanged = true;
      evidence.beforeKeyCount = beforeKeys.length;
      evidence.afterKeyCount = afterKeys.length;
    }

    // Check for conditional rendering patterns (data-visible, hidden, display:none changes)
    const visibilityPattern = /(?:data-visible|hidden|display\s*:\s*none)/gi;
    const beforeVisibility = (beforeHtml.match(visibilityPattern) || []).length;
    const afterVisibility = (afterHtml.match(visibilityPattern) || []).length;

    if (beforeVisibility !== afterVisibility) {
      evidence.visibilityPatternsChanged = true;
      evidence.beforeCount = beforeVisibility;
      evidence.afterCount = afterVisibility;
    }

    // Check for suspense/loading boundaries (common React pattern)
    const suspensePattern = /data-(?:react)?(?:suspense|loading)/gi;
    const beforeSuspense = (beforeHtml.match(suspensePattern) || []).length;
    const afterSuspense = (afterHtml.match(suspensePattern) || []).length;

    if (beforeSuspense !== afterSuspense) {
      evidence.suspenseBoundaryChanged = true;
    }

    const reRenderEvidenceDetected = Object.keys(evidence).length > 0;
    return { reRenderEvidenceDetected, evidence };
  }

  /**
   * Comprehensive React observable pattern detection
   * @param {string} beforeHtml - HTML before
   * @param {string} afterHtml - HTML after
   * @param {string} beforeUrl - URL before
   * @param {string} afterUrl - URL after
   * @param {Object} historyState - History state changes
   * @returns {Object} Combined React signals
   */
  detect(beforeHtml, afterHtml, beforeUrl, afterUrl, historyState) {
    const presence = this.detectReactPresence(afterHtml || beforeHtml || '');
    const effectNavigation = this.detectEffectBasedNavigation(beforeUrl, afterUrl, historyState);
    const reRenderEvidence = this.detectStateReRenderEvidence(beforeHtml, afterHtml);

    const anyReactPattern = presence.reactDetected && (effectNavigation.effectNavigationDetected || reRenderEvidence.reRenderEvidenceDetected);

    return {
      reactObservablePatternsDetected: anyReactPattern,
      presence,
      effectNavigation,
      reRenderEvidence
    };
  }

  // Legacy static method wrappers for backward compatibility with evidence-engine.js
  static detectReactPresence(html) {
    return new ReactObservableDetector().detectReactPresence(html);
  }

  static detectEffectBasedNavigation(beforeUrl, afterUrl, historyState) {
    return new ReactObservableDetector().detectEffectBasedNavigation(beforeUrl, afterUrl, historyState);
  }

  static detectStateReRenderEvidence(beforeHtml, afterHtml) {
    return new ReactObservableDetector().detectStateReRenderEvidence(beforeHtml, afterHtml);
  }

  static detectAllReactPatterns(beforeHtml, afterHtml, beforeUrl, afterUrl, historyState) {
    return new ReactObservableDetector().detect(beforeHtml, afterHtml, beforeUrl, afterUrl, historyState);
  }
}

export default ReactObservableDetector;








