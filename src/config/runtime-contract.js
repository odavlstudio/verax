// Runtime Stability Envelope (Explicit Contract)
// Centralized rules for retries, timeouts, and uncertainty classification.

export const RuntimeContract = {
  // Max retries per interaction (0 = never retry)
  MAX_RETRIES_PER_INTERACTION: 0,

  // Retry is allowed only for strictly transient timeouts (none in v1)
  RETRY_ALLOWED_CAUSES: [],

  // Retry is forbidden for selector mismatches, blocked clicks, prevented submits
  RETRY_FORBIDDEN_CAUSES: [
    'not-found',
    'blocked',
    'prevented-submit',
  ],

  // Timeout outcomes are always classified as INCOMPLETE (never SUCCESS)
  classifyTimeoutOutcome(phase) {
    return { state: 'INCOMPLETE', reason: `timeout:${phase}` };
  },
};

export function isRetryAllowed(cause) {
  return RuntimeContract.RETRY_ALLOWED_CAUSES.includes(cause) &&
    !RuntimeContract.RETRY_FORBIDDEN_CAUSES.includes(cause);
}
