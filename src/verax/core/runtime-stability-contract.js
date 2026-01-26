import { CANONICAL_OUTCOMES } from './canonical-outcomes.js';

/**
 * Runtime Stability Envelope
 * Single source of truth for retry, timeout, and uncertainty handling.
 * These values are intentionally conservative to avoid silent flakes.
 */
export const RUNTIME_STABILITY_CONTRACT = {
  maxRetriesPerInteraction: 2,
  retryDelaysMs: [200, 400],
  retryableErrorPatterns: [
    'element is not attached to the DOM',
    'element is not visible',
    'element is not clickable',
    'element was detached from the DOM',
    'Navigation failed',
    'net::ERR_',
    'timeout waiting for element'
  ],
  retryGuards: {
    allowStages: new Set(['navigation', 'interaction']),
    forbidCategories: new Set(['assertion_failure', 'budget_exceeded', 'settle_timeout'])
  },
  timeoutOutcomes: {
    navigation: { outcome: CANONICAL_OUTCOMES.COVERAGE_GAP, verdict: 'INCOMPLETE', reasonCode: 'navigation_timeout', message: 'Navigation did not complete within the stability window' },
    interaction: { outcome: CANONICAL_OUTCOMES.COVERAGE_GAP, verdict: 'INCOMPLETE', reasonCode: 'interaction_timeout', message: 'Interaction did not settle; result unsafe to trust' },
    settle: { outcome: CANONICAL_OUTCOMES.COVERAGE_GAP, verdict: 'INCOMPLETE', reasonCode: 'settle_timeout', message: 'DOM/network did not stabilize in time' },
    selector: { outcome: CANONICAL_OUTCOMES.UNPROVEN_INTERACTION, verdict: 'UNPROVEN', reasonCode: 'selector_not_found', message: 'Selector could not be resolved; promise unproven' },
    network: { outcome: CANONICAL_OUTCOMES.COVERAGE_GAP, verdict: 'INCOMPLETE', reasonCode: 'network_blocked', message: 'Network unavailable or blocked during interaction' }
  }
};

export function retryBudgetFor(stage = 'interaction') {
  return {
    maxRetries: RUNTIME_STABILITY_CONTRACT.maxRetriesPerInteraction,
    delaysMs: [...RUNTIME_STABILITY_CONTRACT.retryDelaysMs],
    allowed: RUNTIME_STABILITY_CONTRACT.retryGuards.allowStages.has(stage)
  };
}

export function isRetryAllowed(error, stage = 'interaction') {
  if (!retryBudgetFor(stage).allowed) return false;
  const message = String(error?.message || '');
  return RUNTIME_STABILITY_CONTRACT.retryableErrorPatterns.some(pattern => message.includes(pattern));
}

export function classifyTimeout(stage = 'interaction') {
  const key = stage === 'selector' ? 'selector' : stage === 'navigation' ? 'navigation' : stage === 'settle' ? 'settle' : stage === 'network' ? 'network' : 'interaction';
  return RUNTIME_STABILITY_CONTRACT.timeoutOutcomes[key];
}

export function describeRuntimeFailure(reasonKey) {
  const fallback = {
    verdict: 'INCOMPLETE',
    reasonCode: reasonKey,
    outcome: CANONICAL_OUTCOMES.COVERAGE_GAP,
    message: 'Runtime stability could not be guaranteed'
  };
  return RUNTIME_STABILITY_CONTRACT.timeoutOutcomes[reasonKey] || fallback;
}
