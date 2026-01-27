/**
 * Framework Observable Pattern Detection Tests
 * 
 * PURPOSE:
 * Verify that framework-specific observable pattern detectors:
 * 1. Extract patterns deterministically
 * 2. Degrade gracefully when framework not present
 * 3. Do not produce false positives on non-framework HTML
 * 4. Do not introduce detection logic changes
 * 
 * CONSTRAINTS:
 * - No framework lock-in (patterns degrade gracefully)
 * - No framework semantics assumed
 * - Observable runtime patterns only
 * - Deterministic output required
 * 
 * SCOPE:
 * - Next.js observable patterns (App Router, layout/page swaps)
 * - React observable patterns (effect navigation, state re-renders)
 * - Vue observable patterns (router transitions, DOM replacements)
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import NextJsObservableDetector from '../../src/cli/util/detection/nextjs-observable-detector.js';
import ReactObservableDetector from '../../src/cli/util/detection/react-observable-detector.js';
import VueObservableDetector from '../../src/cli/util/detection/vue-observable-detector.js';

describe('Framework Observable Pattern Detection - Contracts', () => {
  
  // ============================================================================
  // NEXT.JS OBSERVABLE PATTERNS
  // ============================================================================
  
  describe('Next.js Observable Patterns', () => {
    
    it('detectNextJsPresence: should detect Next.js via data-nextjs-router attribute', () => {
      const html = '<div id="__next" data-nextjs-router="app"></div>';
      const result = NextJsObservableDetector.detectNextJsPresence(html);
      assert.strictEqual(result.nextJsDetected, true);
      assert.ok(result.indicators.includes('data-nextjs-router'));
    });
    
    it('detectNextJsPresence: should detect Next.js via __NEXT_DATA__ script', () => {
      const html = '<script id="__NEXT_DATA__" type="application/json">{}</script>';
      const result = NextJsObservableDetector.detectNextJsPresence(html);
      assert.strictEqual(result.nextJsDetected, true);
      assert.ok(result.indicators.includes('__NEXT_DATA__'));
    });
    
    it('detectNextJsPresence: should return false when Next.js not present', () => {
      const html = '<div>Regular HTML</div>';
      const result = NextJsObservableDetector.detectNextJsPresence(html);
      assert.strictEqual(result.nextJsDetected, false);
    });
    
    it('detectNextJsPresence: should handle null HTML gracefully', () => {
      const result = NextJsObservableDetector.detectNextJsPresence(null);
      assert.strictEqual(result.nextJsDetected, false);
    });
    
    it('detectAppRouterLayoutTransition: should detect layout component swap', () => {
      const oldHtml = '<div data-nextjs-layout="root"><p>Old</p></div>';
      const newHtml = '<div data-nextjs-layout="root"><div data-nextjs-layout="nested"><p>New</p></div></div>';
      const result = NextJsObservableDetector.detectAppRouterLayoutTransition(oldHtml, newHtml);
      assert.strictEqual(result.layoutTransitionDetected, true);
      assert.strictEqual(result.evidence.layoutAttributeChange, true);
    });
    
    it('detectAppRouterLayoutTransition: should return false when no layout change', () => {
      const oldHtml = '<main data-nextjs-layout="same">Content</main>';
      const newHtml = '<main data-nextjs-layout="same">Updated</main>';
      const result = NextJsObservableDetector.detectAppRouterLayoutTransition(oldHtml, newHtml);
      assert.strictEqual(result.layoutTransitionDetected, false);
    });
    
    it('detectPageComponentSwap: should detect page component replacement', () => {
      const oldHtml = '<main><div data-nextjs-page="home">Page 1</div></main>';
      const newHtml = '<main><div data-nextjs-page="about">Page 2</div></main>';
      const result = NextJsObservableDetector.detectPageComponentSwap(oldHtml, newHtml);
      assert.strictEqual(result.pageSwapDetected, true);
      assert.strictEqual(result.evidence.mainContentChanged, true);
    });
    
    it('detectPageComponentSwap: should handle null HTML gracefully', () => {
      const result = NextJsObservableDetector.detectPageComponentSwap(null, null);
      assert.strictEqual(result.pageSwapDetected, false);
    });
    
    it('detectAllNextJsPatterns: should aggregate all Next.js patterns', () => {
      const oldHtml = '<div data-nextjs-router="app"><main><div data-nextjs-page="home">Page 1</div></main></div>';
      const newHtml = '<div data-nextjs-router="app"><main><div data-nextjs-page="about">Page 2</div></main></div>';
      const result = NextJsObservableDetector.detectAllNextJsPatterns(oldHtml, newHtml);
      
      assert.strictEqual(result.presence.nextJsDetected, true);
      assert.strictEqual(result.pageSwap.pageSwapDetected, true);
    });
    
    it('detectAllNextJsPatterns: should return all false when Next.js not present', () => {
      const html = '<div>Regular HTML</div>';
      const result = NextJsObservableDetector.detectAllNextJsPatterns(html, html);
      
      assert.strictEqual(result.presence.nextJsDetected, false);
      assert.strictEqual(result.layoutTransition.layoutTransitionDetected, false);
      assert.strictEqual(result.pageSwap.pageSwapDetected, false);
    });
  });
  
  // ============================================================================
  // REACT OBSERVABLE PATTERNS
  // ============================================================================
  
  describe('React Observable Patterns', () => {
    
    it('detectReactPresence: should detect React via data-react-root', () => {
      const html = '<div id="root" data-reactroot="true"></div>';
      const result = ReactObservableDetector.detectReactPresence(html);
      assert.strictEqual(result.reactDetected, true);
      assert.ok(result.indicators.includes('data-react-root'));
    });
    
    it('detectReactPresence: should detect React via data-reactroot', () => {
      const html = '<div id="root" data-reactroot=""></div>';
      const result = ReactObservableDetector.detectReactPresence(html);
      assert.strictEqual(result.reactDetected, true);
    });
    
    it('detectReactPresence: should return false when React not present', () => {
      const html = '<div>Regular HTML</div>';
      const result = ReactObservableDetector.detectReactPresence(html);
      assert.strictEqual(result.reactDetected, false);
    });
    
    it('detectReactPresence: should handle null HTML gracefully', () => {
      const result = ReactObservableDetector.detectReactPresence(null);
      assert.strictEqual(result.reactDetected, false);
    });
    
    it('detectEffectBasedNavigation: should detect URL change', () => {
      const beforeUrl = 'http://example.com/page1';
      const afterUrl = 'http://example.com/page2';
      const result = ReactObservableDetector.detectEffectBasedNavigation(beforeUrl, afterUrl);
      assert.strictEqual(result.effectNavigationDetected, true);
      assert.strictEqual(result.evidence.urlChanged, true);
      assert.strictEqual(result.evidence.pathChanged, true);
    });
    
    it('detectEffectBasedNavigation: should detect search params change', () => {
      const beforeUrl = 'http://example.com/page?a=1';
      const afterUrl = 'http://example.com/page?a=2';
      const result = ReactObservableDetector.detectEffectBasedNavigation(beforeUrl, afterUrl);
      assert.strictEqual(result.effectNavigationDetected, true);
      assert.strictEqual(result.evidence.searchParamsChanged, true);
    });
    
    it('detectEffectBasedNavigation: should return false when no navigation', () => {
      const url = 'http://example.com/page';
      const result = ReactObservableDetector.detectEffectBasedNavigation(url, url);
      assert.strictEqual(result.effectNavigationDetected, false);
    });
    
    it('detectStateReRenderEvidence: should detect component key changes', () => {
      const oldHtml = '<div data-reactkey="comp-1">Content</div>';
      const newHtml = '<div data-reactkey="comp-2">Content</div>';
      const result = ReactObservableDetector.detectStateReRenderEvidence(oldHtml, newHtml);
      assert.strictEqual(result.reRenderEvidenceDetected, true);
      assert.strictEqual(result.evidence.componentKeysChanged, true);
    });
    
    it('detectStateReRenderEvidence: should detect visibility pattern changes', () => {
      const oldHtml = '<div style="display: none">Hidden</div>';
      const newHtml = '<div style="display: block">Visible</div>';
      const result = ReactObservableDetector.detectStateReRenderEvidence(oldHtml, newHtml);
      assert.strictEqual(result.reRenderEvidenceDetected, true);
      assert.strictEqual(result.evidence.visibilityPatternsChanged, true);
    });
    
    it('detectStateReRenderEvidence: should handle null HTML gracefully', () => {
      const result = ReactObservableDetector.detectStateReRenderEvidence(null, null);
      assert.strictEqual(result.reRenderEvidenceDetected, false);
    });
    
    it('detectAllReactPatterns: should aggregate all React patterns', () => {
      const oldHtml = '<div data-reactroot="" data-reactkey="k1">C</div>';
      const newHtml = '<div data-reactroot="" data-reactkey="k2">C</div>';
      const beforeUrl = 'http://example.com/page1';
      const afterUrl = 'http://example.com/page2';
      const result = ReactObservableDetector.detectAllReactPatterns(oldHtml, newHtml, beforeUrl, afterUrl);
      
      assert.strictEqual(result.presence.reactDetected, true);
      assert.strictEqual(result.effectNavigation.effectNavigationDetected, true);
      assert.strictEqual(result.reRenderEvidence.reRenderEvidenceDetected, true);
    });
    
    it('detectAllReactPatterns: should return all false when React not present', () => {
      const html = '<div>Regular HTML</div>';
      const url = 'http://example.com/page';
      const result = ReactObservableDetector.detectAllReactPatterns(html, html, url, url);
      
      assert.strictEqual(result.presence.reactDetected, false);
      assert.strictEqual(result.effectNavigation.effectNavigationDetected, false);
      assert.strictEqual(result.reRenderEvidence.reRenderEvidenceDetected, false);
    });
  });
  
  // ============================================================================
  // VUE OBSERVABLE PATTERNS
  // ============================================================================
  
  describe('Vue Observable Patterns', () => {
    
    it('detectVuePresence: should detect Vue via data-v-hash', () => {
      const html = '<div data-v-abc12345>Content</div>';
      const result = VueObservableDetector.detectVuePresence(html);
      assert.strictEqual(result.vueDetected, true);
      assert.ok(result.indicators.includes('data-v-hash'));
    });
    
    it('detectVuePresence: should detect Vue via data-v-app', () => {
      const html = '<div id="app" data-vueapp="">Content</div>';
      const result = VueObservableDetector.detectVuePresence(html);
      assert.strictEqual(result.vueDetected, true);
      assert.ok(result.indicators.includes('data-vue-app'));
    });
    
    it('detectVuePresence: should return false when Vue not present', () => {
      const html = '<div>Regular HTML</div>';
      const result = VueObservableDetector.detectVuePresence(html);
      assert.strictEqual(result.vueDetected, false);
    });
    
    it('detectVuePresence: should handle null HTML gracefully', () => {
      const result = VueObservableDetector.detectVuePresence(null);
      assert.strictEqual(result.vueDetected, false);
    });
    
    it('detectRouterTransition: should detect Vue router hash change', () => {
      const beforeUrl = 'http://example.com/#/page1';
      const afterUrl = 'http://example.com/#/page2';
      const html = '<div data-v-abc12345></div>';
      const result = VueObservableDetector.detectRouterTransition(beforeUrl, afterUrl, html, html);
      assert.strictEqual(result.routerTransitionDetected, true);
      assert.strictEqual(result.evidence.urlChanged, true);
      assert.strictEqual(result.evidence.hashChanged, true);
    });
    
    it('detectRouterTransition: should return false when no route change', () => {
      const url = 'http://example.com/#/page';
      const html = '<div data-v-abc12345>Content</div>';
      const result = VueObservableDetector.detectRouterTransition(url, url, html, html);
      assert.strictEqual(result.routerTransitionDetected, false);
    });
    
    it('detectDOMReplacementPatterns: should detect v-show visibility changes', () => {
      const oldHtml = '<div style="display: none">Hidden</div>';
      const newHtml = '<div style="display: block">Visible</div>';
      const result = VueObservableDetector.detectDOMReplacementPatterns(oldHtml, newHtml);
      assert.strictEqual(result.domReplacementDetected, true);
      assert.strictEqual(result.evidence.visibilityToggles, true);
    });
    
    it('detectDOMReplacementPatterns: should detect component count changes', () => {
      const oldHtml = '<div data-v-abc12345></div>';
      const newHtml = '<div data-v-abc12345></div><div data-v-def67890></div>';
      const result = VueObservableDetector.detectDOMReplacementPatterns(oldHtml, newHtml);
      assert.strictEqual(result.domReplacementDetected, true);
      assert.strictEqual(result.evidence.componentCountChanged, true);
    });
    
    it('detectDOMReplacementPatterns: should handle null HTML gracefully', () => {
      const result = VueObservableDetector.detectDOMReplacementPatterns(null, null);
      assert.strictEqual(result.domReplacementDetected, false);
    });
    
    it('detectAllVuePatterns: should aggregate all Vue patterns', () => {
      const beforeUrl = 'http://example.com/#/old';
      const afterUrl = 'http://example.com/#/new';
      const oldHtml = '<div data-v-abc12345 style="display: none"></div>';
      const newHtml = '<div data-v-abc12345 style="display: block"></div>';
      const result = VueObservableDetector.detectAllVuePatterns(oldHtml, newHtml, beforeUrl, afterUrl);
      
      assert.strictEqual(result.vueObservablePatternsDetected, true);
      assert.strictEqual(result.presence.vueDetected, true);
      assert.strictEqual(result.routerTransition.routerTransitionDetected, true);
      assert.strictEqual(result.domReplacement.domReplacementDetected, true);
    });
    
    it('detectAllVuePatterns: should return all false when Vue not present', () => {
      const html = '<div>Regular HTML</div>';
      const url = 'http://example.com/page';
      const result = VueObservableDetector.detectAllVuePatterns(html, html, url, url);
      
      assert.strictEqual(result.vueObservablePatternsDetected, false);
      assert.strictEqual(result.presence.vueDetected, false);
      assert.strictEqual(result.routerTransition.routerTransitionDetected, false);
      assert.strictEqual(result.domReplacement.domReplacementDetected, false);
    });
  });
  
  // ============================================================================
  // CROSS-FRAMEWORK VALIDATION
  // ============================================================================
  
  describe('Cross-Framework Validation', () => {
    
    it('should not produce false positives on plain HTML', () => {
      const html = '<div><p>Just some content</p><a href="/page">Link</a></div>';
      const url = 'http://example.com/page';
      
      const nextResult = NextJsObservableDetector.detectAllNextJsPatterns(html, html);
      const reactResult = ReactObservableDetector.detectAllReactPatterns(html, html, url, url);
      const vueResult = VueObservableDetector.detectAllVuePatterns(html, html, url, url);
      
      // All presence checks should be false
      assert.strictEqual(nextResult.presence.nextJsDetected, false);
      assert.strictEqual(reactResult.presence.reactDetected, false);
      assert.strictEqual(vueResult.presence.vueDetected, false);
      
      // All pattern checks should be false
      assert.strictEqual(nextResult.layoutTransition.layoutTransitionDetected, false);
      assert.strictEqual(nextResult.pageSwap.pageSwapDetected, false);
      assert.strictEqual(reactResult.effectNavigation.effectNavigationDetected, false);
      assert.strictEqual(reactResult.reRenderEvidence.reRenderEvidenceDetected, false);
      assert.strictEqual(vueResult.routerTransition.routerTransitionDetected, false);
      assert.strictEqual(vueResult.domReplacement.domReplacementDetected, false);
    });
    
    it('should handle mixed framework markers without cross-contamination', () => {
      // Unlikely but possible: HTML with markers from multiple frameworks
      const html = '<div data-reactroot="" data-v-abc12345 data-nextjs-router="app"></div>';
      
      const nextResult = NextJsObservableDetector.detectNextJsPresence(html);
      const reactResult = ReactObservableDetector.detectReactPresence(html);
      const vueResult = VueObservableDetector.detectVuePresence(html);
      
      // Each detector should only respond to its own markers
      assert.strictEqual(nextResult.nextJsDetected, true);
      assert.strictEqual(reactResult.reactDetected, true);
      assert.strictEqual(vueResult.vueDetected, true);
    });
    
    it('all detectors must handle null input without crashing', () => {
      // Null safety is critical for graceful degradation
      assert.doesNotThrow(() => {
        NextJsObservableDetector.detectAllNextJsPatterns(null, null);
        ReactObservableDetector.detectAllReactPatterns(null, null, null, null);
        VueObservableDetector.detectAllVuePatterns(null, null, null, null);
      });
    });
    
    it('all detectors must handle undefined input without crashing', () => {
      assert.doesNotThrow(() => {
        NextJsObservableDetector.detectAllNextJsPatterns(undefined, undefined);
        ReactObservableDetector.detectAllReactPatterns(undefined, undefined, undefined, undefined);
        VueObservableDetector.detectAllVuePatterns(undefined, undefined, undefined, undefined);
      });
    });
    
    it('all detectors must return deterministic results for identical input', () => {
      const html = '<div data-react-root="">Content</div>';
      const url = 'http://example.com/page';
      
      // Run detection multiple times
      const results = [];
      for (let i = 0; i < 5; i++) {
        results.push(ReactObservableDetector.detectAllReactPatterns(html, html, url, url));
      }
      
      // All results should be identical
      const first = results[0];
      for (const result of results.slice(1)) {
        assert.deepStrictEqual(result, first);
      }
    });
  });
});




