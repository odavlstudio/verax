/**
 * OBSERVED EXPECTATIONS
 *
 * Derives strict, evidence-backed expectations from runtime signals
 * (DOM attributes, navigation events, network requests, validation feedback,
 *  and supported state mutations) to reduce UNPROVEN_RESULT volume.
 *
 * Guarantees:
 * - Only uses concrete, observable evidence (no heuristics)
 * - Never writes to source manifests; data lives in runtime traces
 */

import { getUrlPath } from '../detect/evidence-validator.js';
import { isExternalUrl } from './domain-boundary.js';

function normalizePath(path) {
  if (!path) return '';
  if (path === '/') return '/';
  return path.replace(/\/$/, '') || '/';
}

function safeResolvePath(target, baseUrl, baseOrigin) {
  if (!target) return null;
  try {
    const resolved = new URL(target, baseUrl || baseOrigin || undefined);
    if (baseOrigin && isExternalUrl(resolved.href, baseOrigin)) {
      return null;
    }
    return resolved.pathname || '/';
  } catch (err) {
    return null;
  }
}

function hasTemplateToken(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const path = parsed.pathname || '';
    return /[{}`*]/.test(path) || /:\w+/.test(path);
  } catch (err) {
    return /[{}`*]/.test(url);
  }
}

function buildNavigationExpectation(interaction, trace, baseOrigin) {
  const beforeUrl = trace.before?.url || '';
  const navSensor = trace.sensors?.navigation || {};
  const attributeSource = interaction.dataHref
    ? 'data-href'
    : interaction.href
      ? 'href'
      : interaction.formAction
        ? 'action'
        : null;

  let targetPath = null;
  let source = attributeSource;

  if (attributeSource === 'data-href') {
    targetPath = safeResolvePath(interaction.dataHref, beforeUrl, baseOrigin);
  } else if (attributeSource === 'href') {
    targetPath = safeResolvePath(interaction.href, beforeUrl, baseOrigin);
  } else if (attributeSource === 'action') {
    targetPath = safeResolvePath(interaction.formAction, beforeUrl, baseOrigin);
  }

  if (!targetPath && navSensor.urlChanged && navSensor.afterUrl) {
    const observedPath = safeResolvePath(navSensor.afterUrl, beforeUrl, baseOrigin);
    if (observedPath) {
      targetPath = observedPath;
      source = 'navigation_event';
    }
  }

  if (!targetPath) {
    return null;
  }

  return {
    id: `obs-nav-${Date.now()}-${(interaction.selector || 'nav').replace(/[^a-zA-Z0-9]/g, '').slice(-8)}`,
    type: 'navigation',
    expectationStrength: 'OBSERVED',
    expectedTargetPath: targetPath,
    evidence: {
      selector: interaction.selector,
      attributeSource: source,
      observedUrl: targetPath,
      sourcePage: beforeUrl
    },
    sourcePage: beforeUrl,
    outcome: null,
    reason: null,
    repeatAttempted: false,
    repeated: false,
    confidenceLevel: 'LOW'
  };
}

function buildNetworkExpectation(interaction, trace) {
  const beforeUrl = trace.before?.url || '';
  const network = trace.sensors?.network || {};
  
  // Network sensor provides firstRequestUrl and observedRequestUrls
  const observedUrl = network.firstRequestUrl || network.observedRequestUrls?.[0] || null;

  if (!network.totalRequests || network.totalRequests <= 0) return null;
  if (!observedUrl || hasTemplateToken(observedUrl)) return null;

  return {
    id: `obs-net-${Date.now()}-${(interaction.selector || 'net').replace(/[^a-zA-Z0-9]/g, '').slice(-8)}`,
    type: 'network_action',
    expectationStrength: 'OBSERVED',
    expectedRequestUrl: observedUrl,
    evidence: {
      selector: interaction.selector,
      attributeSource: 'network_request',
      observedRequestUrl: observedUrl,
      sourcePage: beforeUrl
    },
    sourcePage: beforeUrl,
    outcome: null,
    reason: null,
    repeatAttempted: false,
    repeated: false,
    confidenceLevel: 'LOW'
  };
}

function buildValidationExpectation(interaction, trace) {
  const beforeUrl = trace.before?.url || '';
  const uiSignals = trace.sensors?.uiSignals || {};
  const validationDetected = uiSignals.after?.validationFeedbackDetected === true;

  if (!validationDetected) return null;

  return {
    id: `obs-val-${Date.now()}-${(interaction.selector || 'val').replace(/[^a-zA-Z0-9]/g, '').slice(-8)}`,
    type: 'validation_block',
    expectationStrength: 'OBSERVED',
    evidence: {
      selector: interaction.selector,
      attributeSource: 'validation_feedback',
      validationDetected: true,
      sourcePage: beforeUrl
    },
    sourcePage: beforeUrl,
    outcome: null,
    reason: null,
    repeatAttempted: false,
    repeated: false,
    confidenceLevel: 'LOW'
  };
}

function buildStateExpectation(interaction, trace) {
  const beforeUrl = trace.before?.url || '';
  const state = trace.sensors?.state || {};
  const hasChange = state.available && Array.isArray(state.changed) && state.changed.length > 0;

  if (!hasChange) return null;

  return {
    id: `obs-state-${Date.now()}-${(interaction.selector || 'state').replace(/[^a-zA-Z0-9]/g, '').slice(-8)}`,
    type: 'state_action',
    expectationStrength: 'OBSERVED',
    expectedStateKey: state.changed[0],
    evidence: {
      selector: interaction.selector,
      attributeSource: 'state_change',
      stateKeysChanged: state.changed,
      sourcePage: beforeUrl,
      storeType: state.storeType || null
    },
    sourcePage: beforeUrl,
    outcome: null,
    reason: null,
    repeatAttempted: false,
    repeated: false,
    confidenceLevel: 'LOW'
  };
}

export function deriveObservedExpectation(interaction, trace, baseOrigin) {
  if (!trace || !interaction) return null;

  const enrichedInteraction = {
    selector: interaction.selector,
    href: interaction.href || trace.interaction?.href,
    dataHref: interaction.dataHref || trace.interaction?.dataHref,
    formAction: interaction.formAction || trace.interaction?.formAction
  };

  const builders = [
    () => buildNavigationExpectation(enrichedInteraction, trace, baseOrigin),
    () => buildNetworkExpectation(interaction, trace),
    () => buildValidationExpectation(interaction, trace),
    () => buildStateExpectation(interaction, trace)
  ];

  for (const build of builders) {
    const expectation = build();
    if (expectation) {
      const evaluation = evaluateObservedExpectation(expectation, trace);
      expectation.outcome = evaluation.outcome;
      expectation.reason = evaluation.reason;
      expectation.confidenceLevel = 'LOW';
      return expectation;
    }
  }

  return null;
}

export function evaluateObservedExpectation(expectation, trace) {
  if (!expectation || !trace) {
    return { outcome: 'OBSERVED_BREAK', reason: 'missing_expectation' };
  }

  if (expectation.type === 'navigation') {
    const afterPath = normalizePath(getUrlPath(trace.after?.url || ''));
    const targetPath = normalizePath(expectation.expectedTargetPath || '');
    const navSensor = trace.sensors?.navigation || {};
    const urlChanged = navSensor.urlChanged === true || (trace.before?.url && trace.after?.url && trace.before.url !== trace.after.url);

    if (targetPath && afterPath === targetPath) {
      return { outcome: 'VERIFIED', reason: null };
    }

    if (urlChanged) {
      return { outcome: 'OBSERVED_BREAK', reason: 'navigation_target_mismatch' };
    }

    return { outcome: 'OBSERVED_BREAK', reason: 'navigation_not_observed' };
  }

  if (expectation.type === 'network_action') {
    const network = trace.sensors?.network || {};
    const expectedUrl = expectation.expectedRequestUrl || '';
    
    if (network.totalRequests && network.totalRequests > 0) {
      // Check if expected URL was requested
      const requestUrls = network.observedRequestUrls || [];
      const firstRequestUrl = network.firstRequestUrl || '';
      const allRequestUrls = [...requestUrls, firstRequestUrl].filter(Boolean);
      
      const expectedUrlFound = expectedUrl && allRequestUrls.some(url => 
        url && url.includes(expectedUrl)
      );
      
      if (expectedUrlFound) {
        return { outcome: 'VERIFIED', reason: null };
      }
      
      // Request occurred but not the expected one
      return { outcome: 'OBSERVED_BREAK', reason: 'network_request_url_mismatch' };
    }
    
    return { outcome: 'OBSERVED_BREAK', reason: 'network_request_missing' };
  }

  if (expectation.type === 'validation_block') {
    const uiSignals = trace.sensors?.uiSignals || {};
    const network = trace.sensors?.network || {};
    const validationDetected = uiSignals.after?.validationFeedbackDetected === true;
    const beforePath = normalizePath(getUrlPath(trace.before?.url || ''));
    const afterPath = normalizePath(getUrlPath(trace.after?.url || ''));

    if (validationDetected && beforePath === afterPath && (network.totalRequests || 0) === 0) {
      return { outcome: 'VERIFIED', reason: null };
    }

    if (!validationDetected) {
      return { outcome: 'OBSERVED_BREAK', reason: 'validation_feedback_missing' };
    }

    return { outcome: 'OBSERVED_BREAK', reason: 'validation_not_blocked' };
  }

  if (expectation.type === 'state_action') {
    const state = trace.sensors?.state || {};
    if (state.available && Array.isArray(state.changed) && state.changed.includes(expectation.expectedStateKey)) {
      return { outcome: 'VERIFIED', reason: null };
    }
    return { outcome: 'OBSERVED_BREAK', reason: 'state_not_changed' };
  }

  return { outcome: 'OBSERVED_BREAK', reason: 'unknown_expectation' };
}

export function shouldAttemptRepeatObservedExpectation(expectation, trace) {
  if (!expectation) return false;
  if (expectation.outcome !== 'VERIFIED') return false;
  if (expectation.repeatAttempted === true) return false; // Already attempted

  // Only repeat when we stayed on the same page to avoid altering traversal
  const beforeUrl = trace.before?.url || '';
  const afterUrl = trace.after?.url || '';
  const stayedOnPage = normalizePath(getUrlPath(beforeUrl)) === normalizePath(getUrlPath(afterUrl));

  if (!stayedOnPage) return false;

  // Only repeat non-navigation expectations (navigation would change page state)
  return expectation.type === 'network_action' || expectation.type === 'validation_block' || expectation.type === 'state_action';
}
