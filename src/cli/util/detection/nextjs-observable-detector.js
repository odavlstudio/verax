/**
 * Next.js Observable Pattern Detector
 * 
 * Detects observable runtime patterns in Next.js applications:
 * - App Router navigation effects (URL changes, layout transitions)
 * - Layout/page component swap signals
 * - Data attribute patterns (data-nextjs-router, data-nextjs-scroll)
 * 
 * Observable only; no framework semantics assumed.
 * Degrades gracefully when Next.js not present.
 */

import BaseDetector from './base-detector.js';

export class NextJsObservableDetector extends BaseDetector {
  constructor() {
    super({ name: 'nextjs-observable', framework: 'nextjs', type: 'observable' });
  }

  /**
   * Detect Next.js-specific data attributes that indicate router presence
   * @param {string} html - HTML content
   * @returns {Object} Next.js presence signals
   */
  detectNextJsPresence(html) {
    if (!html) {
      return { nextJsDetected: false, indicators: [] };
    }

    const indicators = [];
    
    // Check for Next.js router data attributes
    if (html.match(/data-nextjs-router/i)) {
      indicators.push('data-nextjs-router');
    }
    
    // Check for Next.js scroll restoration
    if (html.match(/data-nextjs-scroll/i)) {
      indicators.push('data-nextjs-scroll');
    }
    
    // Check for __next script tag
    if (html.match(/<script[^>]*src\s*=\s*["'][^"']*\/_next\//i)) {
      indicators.push('_next-script');
    }
    
    // Check for __NEXT_DATA__ script
    if (html.match(/__NEXT_DATA__/)) {
      indicators.push('__NEXT_DATA__');
    }

    const nextJsDetected = indicators.length > 0;
    return { nextJsDetected, indicators };
  }

  /**
   * Detect App Router layout transitions (observable DOM structure changes)
   * @param {string} beforeHtml - HTML before
   * @param {string} afterHtml - HTML after
   * @returns {Object} Layout transition signals
   */
  detectAppRouterLayoutTransition(beforeHtml, afterHtml) {
    if (!beforeHtml || !afterHtml) {
      return { layoutTransitionDetected: false, evidence: {} };
    }

    const evidence = {};

    // Check for layout component replacement patterns
    // Next.js App Router uses specific DOM structure for layouts
    const layoutPattern = /data-(?:nextjs-)?(?:layout|route)/gi;
    const beforeLayoutMatches = (beforeHtml.match(layoutPattern) || []).length;
    const afterLayoutMatches = (afterHtml.match(layoutPattern) || []).length;

    if (beforeLayoutMatches !== afterLayoutMatches) {
      evidence.layoutAttributeChange = true;
      evidence.beforeCount = beforeLayoutMatches;
      evidence.afterCount = afterLayoutMatches;
    }

    // Check for nested route segments changing
    const segmentPattern = /data-(?:nextjs-)?segment/gi;
    const beforeSegments = (beforeHtml.match(segmentPattern) || []).length;
    const afterSegments = (afterHtml.match(segmentPattern) || []).length;

    if (beforeSegments !== afterSegments) {
      evidence.segmentChange = true;
    }

    const layoutTransitionDetected = Object.keys(evidence).length > 0;
    return { layoutTransitionDetected, evidence };
  }

  /**
   * Detect page component swap (observable content replacement)
   * @param {string} beforeHtml - HTML before
   * @param {string} afterHtml - HTML after
   * @returns {Object} Page swap signals
   */
  detectPageComponentSwap(beforeHtml, afterHtml) {
    if (!beforeHtml || !afterHtml) {
      return { pageSwapDetected: false, evidence: {} };
    }

    const evidence = {};

    // Check for main content area replacement
    // Next.js often wraps page content in specific divs
    const mainPattern = /<main[^>]*>.*?<\/main>/is;
    const beforeMain = beforeHtml.match(mainPattern);
    const afterMain = afterHtml.match(mainPattern);

    if (beforeMain && afterMain && beforeMain[0] !== afterMain[0]) {
      evidence.mainContentChanged = true;
      evidence.beforeLength = beforeMain[0].length;
      evidence.afterLength = afterMain[0].length;
    }

    // Check for template/layout nesting changes
    const templatePattern = /data-(?:nextjs-)?(?:template|page)/gi;
    const beforeTemplates = (beforeHtml.match(templatePattern) || []).length;
    const afterTemplates = (afterHtml.match(templatePattern) || []).length;

    if (beforeTemplates !== afterTemplates) {
      evidence.templateStructureChanged = true;
    }

    const pageSwapDetected = Object.keys(evidence).length > 0;
    return { pageSwapDetected, evidence };
  }

  /**
   * Comprehensive Next.js observable pattern detection
   * @param {string} beforeHtml - HTML before
   * @param {string} afterHtml - HTML after
   * @returns {Object} Combined Next.js signals
   */
  detect(beforeHtml, afterHtml) {
    const presence = this.detectNextJsPresence(afterHtml || beforeHtml || '');
    const layoutTransition = this.detectAppRouterLayoutTransition(beforeHtml, afterHtml);
    const pageSwap = this.detectPageComponentSwap(beforeHtml, afterHtml);

    const anyNextJsPattern = presence.nextJsDetected && (layoutTransition.layoutTransitionDetected || pageSwap.pageSwapDetected);

    return {
      nextJsObservablePatternsDetected: anyNextJsPattern,
      presence,
      layoutTransition,
      pageSwap
    };
  }

  // Legacy static method wrappers for backward compatibility with evidence-engine.js
  static detectNextJsPresence(html) {
    return new NextJsObservableDetector().detectNextJsPresence(html);
  }

  static detectAppRouterLayoutTransition(beforeHtml, afterHtml) {
    return new NextJsObservableDetector().detectAppRouterLayoutTransition(beforeHtml, afterHtml);
  }

  static detectPageComponentSwap(beforeHtml, afterHtml) {
    return new NextJsObservableDetector().detectPageComponentSwap(beforeHtml, afterHtml);
  }

  static detectAllNextJsPatterns(beforeHtml, afterHtml) {
    return new NextJsObservableDetector().detect(beforeHtml, afterHtml);
  }
}

export default NextJsObservableDetector;








