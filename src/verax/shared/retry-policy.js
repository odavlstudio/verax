/**
 * Wave 9 — Deterministic Retry Policy
 *
 * Provides retry logic for navigation and interaction operations that may fail
 * due to element detachment or asynchronous settling issues.
 *
 * Rules:
 * - Max 2 retries (3 total attempts)
 * - Backoff: 200ms, then 400ms
 * - Recorded in attempt.meta.retriesUsed
 * - Deterministic: same failures don't retry
 */

import { RUNTIME_STABILITY_CONTRACT, isRetryAllowed } from '../core/runtime-stability-contract.js';

const MAX_RETRIES = RUNTIME_STABILITY_CONTRACT.maxRetriesPerInteraction;
const RETRY_DELAYS = RUNTIME_STABILITY_CONTRACT.retryDelaysMs; // ms

/**
 * Determine if an error is retryable (e.g., element detached, clickability).
 * @param {Error} error - The error that occurred
 * @returns {boolean} - True if we should retry
 */
export function isRetryableError(error, stage = 'interaction') {
  if (!error) return false;
  return isRetryAllowed(error, stage);
}

/**
 * Retry an operation with exponential backoff.
 * @param {Function} fn - Async function to retry
 * @param {string} operationName - For logging
 * @param {Object} decisionRecorder - Optional DecisionRecorder for Phase 6 determinism tracking
 * @returns {Promise<{result: *, retriesUsed: number}>}
 */
export async function retryOperation(fn, operationName = 'operation', decisionRecorder = null) {
  let lastError = null;
  let retriesUsed = 0;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await fn();
      return { result, retriesUsed };
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (attempt < MAX_RETRIES && isRetryableError(error)) {
        retriesUsed++;
        const delayMs = RETRY_DELAYS[attempt];        if (decisionRecorder && decisionRecorder.record) {
          const { recordRetryAttempt } = await import('../core/determinism-model.js');
          recordRetryAttempt(decisionRecorder, operationName, attempt + 1, delayMs, lastError.message);
        }
        
        // Explicit transparency: emit deterministic retry note
        try {
          console.log(`[VERAX][retry] Retrying ${operationName} attempt ${attempt + 2}/${MAX_RETRIES + 1} after ${delayMs}ms due to: ${lastError.message}`);
        } catch {
          // logging must never break retry flow
        }

        await new Promise(resolve => setTimeout(resolve, delayMs));
        // Continue to next attempt
      } else {
        // Don't retry: either out of retries or non-retryable error
        throw error;
      }
    }
  }

  throw lastError;
}

/**
 * Create a retryable version of an async function.
 * @param {Function} fn - Async function
 * @param {string} opName - Operation name for logging
 * @returns {Function} - Wrapped function that retries automatically
 */
export function makeRetryable(fn, opName = 'op') {
  return async function(...args) {
    const { result, retriesUsed } = await retryOperation(
      () => fn(...args),
      opName
    );
    // Return both result and metadata about retries
    return { result, meta: { retriesUsed } };
  };
}



