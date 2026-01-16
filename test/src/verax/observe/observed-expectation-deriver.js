/**
 * OBSERVED EXPECTATION DERIVER
 * 
 * Generates STRICT, EVIDENCE-BASED "Observed Expectations" from DOM attributes
 * and runtime signals. Only creates expectations when evidence is provable.
 * 
 * Rules:
 * - Navigation: only if element has href/data-href OR navigation event happened
 * - Network: only if network request occurred with concrete URL (no template variables)
 * - Validation: only if validation message is detected (not inferred)
 * - State: only if state sensor shows named store mutation (supported stores only)
 */

import { getUrlPath } from '../detect/evidence-validator.js';

/**
 * Derive an OBSERVED expectation from an interaction trace.
 * Returns null if no strict evidence is available.
 * 
 * @param {Object} trace - Interaction trace with sensors and evidence
 * @param {Object} interaction - Interaction object (type, selector, label, etc.)
 * @param {string} beforeUrl - URL before interaction
 * @param {string} afterUrl - URL after interaction
 * @returns {Object|null} Observed expectation or null
 */
export function deriveObservedExpectation(trace, interaction, beforeUrl, afterUrl) {
  if (!trace || !interaction) {
    return null;
  }

  const sensors = trace.sensors || {};
  const networkSummary = sensors.network || {};
  const navigationSummary = sensors.navigation || {};
  const uiSignals = sensors.uiSignals || {};
  const stateDiff = sensors.state || {};

  // === NAVIGATION EXPECTATION ===
  if (interaction.type === 'link' || interaction.type === 'button') {
    // Check for href/data-href attribute
    const href = interaction.href || interaction.dataHref || '';
    const hasHrefAttribute = href && !href.startsWith('#') && !href.startsWith('javascript:');
    
    // Check for navigation event
    const urlChanged = navigationSummary.urlChanged === true;
    const historyChanged = navigationSummary.historyLengthDelta !== null && navigationSummary.historyLengthDelta !== 0;
    const hasNavigationEvent = urlChanged || historyChanged;
    
    // Check for stable path change
    const beforePath = getUrlPath(beforeUrl);
    const afterPath = getUrlPath(afterUrl);
    const pathChanged = beforePath && afterPath && beforePath !== afterPath;
    const pathStable = afterPath && afterPath !== ''; // Path exists and is not empty
    
    // Navigation expectation: requires href/data-href OR (navigation event AND stable path)
    if (hasHrefAttribute || (hasNavigationEvent && pathChanged && pathStable)) {
      const targetPath = hasHrefAttribute ? (href.startsWith('http') ? getUrlPath(href) : href) : afterPath;
      
      // Only create if target path is concrete (no template variables like {id})
      if (targetPath && !targetPath.includes('{') && !targetPath.includes('${')) {
        return {
          type: 'navigation',
          expectationStrength: 'OBSERVED',
          fromPath: beforePath || '/',
          targetPath: targetPath,
          evidence: {
            selectorHint: interaction.selector,
            source: 'runtime_observation',
            attributeSource: hasHrefAttribute ? (interaction.href ? 'href' : 'data-href') : 'navigation_event',
            observedUrl: afterUrl,
            sourcePage: beforeUrl
          },
          proof: 'OBSERVED_EXPECTATION'
        };
      }
    }
  }

  // === NETWORK EXPECTATION ===
  if (interaction.type === 'button' || interaction.type === 'form') {
    const totalRequests = networkSummary.totalRequests || 0;
    const hasNetworkRequest = totalRequests > 0;
    
    // Check for concrete request URLs from network sensor
    // Network sensor provides slowRequests and topFailedUrls arrays with url property
    const slowRequests = networkSummary.slowRequests || [];
    const topFailedUrls = networkSummary.topFailedUrls || [];
    const allRequestUrls = [
      ...slowRequests.map(r => r.url),
      ...topFailedUrls.map(r => r.url)
    ];
    
    // Find first concrete URL (no template variables, no query params for now)
    const concreteRequestUrl = allRequestUrls.find(url => 
      url && 
      typeof url === 'string' &&
      !url.includes('{') && 
      !url.includes('${') &&
      !url.includes('?') // Avoid query params for now (could be dynamic)
    );
    
    // Network expectation: requires network request with concrete URL
    if (hasNetworkRequest && concreteRequestUrl) {
      return {
        type: 'network_action',
        expectationStrength: 'OBSERVED',
        fromPath: getUrlPath(beforeUrl) || '/',
        expectedTarget: concreteRequestUrl,
        evidence: {
          selectorHint: interaction.selector,
          source: 'runtime_observation',
          observedRequestUrl: concreteRequestUrl,
          requestCount: totalRequests,
          sourcePage: beforeUrl
        },
        proof: 'OBSERVED_EXPECTATION'
      };
    }
  }

  // === VALIDATION EXPECTATION ===
  if (interaction.type === 'form') {
    // Check for explicit validation feedback (detected by UI signal sensor)
    const validationFeedback = uiSignals.after?.validationFeedbackDetected === true;
    
    // Validation expectation: requires explicit validation feedback detection
    // UI signal sensor detects: invalid elements, visible alert regions, aria-live regions
    if (validationFeedback) {
      return {
        type: 'validation_block',
        expectationStrength: 'OBSERVED',
        fromPath: getUrlPath(beforeUrl) || '/',
        evidence: {
          selectorHint: interaction.selector,
          source: 'runtime_observation',
          validationFeedbackDetected: true,
          sourcePage: beforeUrl
        },
        proof: 'OBSERVED_EXPECTATION'
      };
    }
  }

  // === STATE EXPECTATION ===
  if (interaction.type === 'button') {
    // Check for state mutation
    const stateChanged = stateDiff.available === true && stateDiff.changed && stateDiff.changed.length > 0;
    const storeType = stateDiff.storeType || null;
    const supportedStores = ['redux', 'zustand', 'mobx', 'recoil']; // Only supported stores
    
    // State expectation: requires state mutation in supported store
    if (stateChanged && storeType && supportedStores.includes(storeType.toLowerCase())) {
      const changedKeys = stateDiff.changed || [];
      const firstChangedKey = changedKeys[0] || null;
      
      if (firstChangedKey) {
        return {
          type: 'state_action',
          expectationStrength: 'OBSERVED',
          fromPath: getUrlPath(beforeUrl) || '/',
          expectedTarget: firstChangedKey,
          evidence: {
            selectorHint: interaction.selector,
            source: 'runtime_observation',
            storeType: storeType,
            changedKeys: changedKeys,
            sourcePage: beforeUrl
          },
          proof: 'OBSERVED_EXPECTATION'
        };
      }
    }
  }

  // No strict evidence available
  return null;
}

/**
 * Check if an expectation is OBSERVED (not PROVEN).
 */
export function isObservedExpectation(expectation) {
  if (!expectation) return false;
  return expectation.expectationStrength === 'OBSERVED' || 
         expectation.proof === 'OBSERVED_EXPECTATION';
}

