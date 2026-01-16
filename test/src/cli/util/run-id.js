import { generateRunId as generateDeterministicRunId } from '../../verax/core/run-id.js';

const ZERO_BUDGET = Object.freeze({
  maxScanDurationMs: 0,
  maxInteractionsPerPage: 0,
  maxUniqueUrls: 0,
  interactionTimeoutMs: 0,
  navigationTimeoutMs: 0,
});

// Deterministic run ID wrapper to align CLI with core generator (no time/randomness)
export function generateRunId(url = 'about:blank') {
  let baseOrigin = 'about:blank';
  try {
    baseOrigin = new URL(url).origin;
  } catch {
    baseOrigin = url;
  }
  return generateDeterministicRunId({
    url,
    safetyFlags: {},
    baseOrigin,
    scanBudget: ZERO_BUDGET,
    manifestPath: null,
  });
}
