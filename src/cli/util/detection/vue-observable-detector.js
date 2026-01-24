/**
 * Vue Observable Detector
 *
 * Detects observable Vue.js patterns in HTML before/after snapshots
 * This is a minimal implementation that returns safe defaults.
 *
 * DESIGN: Only static analysis of HTML for Vue-specific patterns
 * - Vue Router transitions (URL changes + DOM replacements)
 * - DOM replacement patterns (v-if, v-show, component swaps)
 *
 * CONSTRAINTS:
 * - No instrumentation or runtime hooks
 * - Read-only analysis (no side effects)
 * - Deterministic (same inputs = same outputs)
 */

export class VueObservableDetector {
  /**
   * Instance method: detect Vue patterns
   * Combines all detection methods for convenience
   * @param {Object} context - { beforeHtml, afterHtml, beforeUrl, afterUrl }
   * @returns {Object} Combined detection results
   */
  detect(context = {}) {
    const { beforeHtml = '', afterHtml = '', beforeUrl = '', afterUrl = '' } = context;
    return VueObservableDetector.detectAllVuePatterns(beforeHtml, afterHtml, beforeUrl, afterUrl);
  }

  /**
   * Detect Vue Router transition (URL + DOM change pattern)
   * @param {string} beforeUrl
   * @param {string} afterUrl
   * @param {string} _beforeHtml
   * @param {string} _afterHtml
   * @returns {Object} Router transition evidence
   */
  static detectRouterTransition(beforeUrl, afterUrl, _beforeHtml, _afterHtml) {
    const evidence = {};
    
    // Check for URL change
    const urlChanged = beforeUrl !== afterUrl;
    if (urlChanged) {
      evidence.urlChanged = true;
    }
    
    // Check for hash change (Vue Router common pattern)
    const beforeHash = String(beforeUrl).split('#')[1] || '';
    const afterHash = String(afterUrl).split('#')[1] || '';
    if (beforeHash !== afterHash) {
      evidence.hashChanged = true;
    }
    
    return {
      routerTransitionDetected: urlChanged || beforeHash !== afterHash,
      beforeUrl,
      afterUrl,
      evidence,
    };
  }

  /**
   * Detect Vue presence (data-v attributes, Vue-specific patterns)
   * @param {string} html
   * @returns {Object} Vue presence indicators
   */
  static detectVuePresence(html) {
    if (!html || typeof html !== 'string') {
      return { vueDetected: false, indicators: [] };
    }
    
    const indicators = [];
    
    // Check for Vue data-v-hash attributes (Vue 3 scoped styles)
    if (/data-v-[a-f0-9]{8}/.test(html)) {
      indicators.push('data-v-hash');
    }
    
    // Check for Vue app root markers
    if (/data-vueapp|data-vue-app|\bid\s*=\s*["']?app["']?\s*data-vueapp/.test(html)) {
      indicators.push('data-vue-app');
    }
    
    return {
      vueDetected: indicators.length > 0,
      indicators,
      vueVersion: indicators.length > 0 ? '3' : null,
    };
  }

  /**
   * Detect DOM replacement patterns specific to Vue
   * @param {string} beforeHtml
   * @param {string} afterHtml
   * @returns {Object} DOM replacement evidence
   */
  static detectDOMReplacementPatterns(beforeHtml, afterHtml) {
    if (!beforeHtml || !afterHtml) {
      return { domReplacementDetected: false, evidence: {} };
    }
    
    const evidence = {};
    
    // Detect v-show visibility toggles (display style changes)
    const displayPattern = /display\s*:\s*(none|block|flex|grid|inline)/gi;
    const beforeDisplays = (beforeHtml.match(displayPattern) || []).map(m => m.match(/none|block|flex|grid|inline/i)[0]);
    const afterDisplays = (afterHtml.match(displayPattern) || []).map(m => m.match(/none|block|flex|grid|inline/i)[0]);
    const visibilityChanged = JSON.stringify(beforeDisplays) !== JSON.stringify(afterDisplays);
    if (visibilityChanged) {
      evidence.visibilityToggles = true;
    }
    
    // Detect component count changes (data-v-* attribute changes)
    const beforeComponents = (beforeHtml.match(/data-v-[a-f0-9]{8}/g) || []).length;
    const afterComponents = (afterHtml.match(/data-v-[a-f0-9]{8}/g) || []).length;
    if (beforeComponents !== afterComponents) {
      evidence.componentCountChanged = true;
    }
    
    return {
      domReplacementDetected: visibilityChanged || (beforeComponents !== afterComponents),
      evidence,
    };
  }

  /**
   * Comprehensive Vue observable pattern detection
   * Combines presence, router transitions, and DOM replacement detection
   * @param {string} beforeHtml
   * @param {string} afterHtml
   * @param {string} beforeUrl
   * @param {string} afterUrl
   * @returns {Object} Combined Vue signals
   */
  static detectAllVuePatterns(beforeHtml, afterHtml, beforeUrl, afterUrl) {
    const presence = VueObservableDetector.detectVuePresence(afterHtml || beforeHtml || '');
    const routerTransition = VueObservableDetector.detectRouterTransition(beforeUrl, afterUrl, beforeHtml, afterHtml);
    const domReplacement = VueObservableDetector.detectDOMReplacementPatterns(beforeHtml, afterHtml);

    return {
      vueObservablePatternsDetected: false,
      presence,
      routerTransition,
      domReplacement,
    };
  }
}

export default VueObservableDetector;








