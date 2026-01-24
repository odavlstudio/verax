/**
 * Cleanup Error Logger
 * 
 * Provides centralized, non-fatal error logging for browser/resource cleanup.
 * Ensures cleanup failures are visible while maintaining idempotency and
 * never interrupting normal execution flow.
 * 
 * DESIGN PRINCIPLES:
 * - Logging is informational, not fatal
 * - Never throws, never blocks
 * - Deduplicates excessive repeated warnings
 * - Attaches cleanup metadata for forensics
 */

import { getTimeProvider } from './time-provider.js';

// Track seen cleanup scopes to prevent spam
const seenScopes = new Set();

/**
 * Log a cleanup error with deduplication
 * @param {string} scope - Cleanup scope (e.g., 'browser', 'context')
 * @param {string} errorMessage - Error message
 * @param {Object} metadata - Additional metadata
 * @returns {Object} Cleanup error metadata
 */
export function logCleanupError(scope, errorMessage, metadata = {}) {
  try {
    const scopeKey = `${scope}`;
    const isDuplicate = seenScopes.has(scopeKey);
    
    // Always log to console.warn for visibility
    const message = `[cleanup] ${scope} failed: ${errorMessage}`;
    if (!isDuplicate) {
      console.warn(message);
      seenScopes.add(scopeKey);
    }
    
    // Return metadata for attachment to run context (if needed)
    return {
      scope,
      error: errorMessage,
      timestamp: getTimeProvider().iso(),
      isDuplicate,
      ...metadata,
    };
  } catch (e) {
    // FAIL-SAFE: Even logging must never throw
    // Silently ignore logger failures
  }
}

/**
 * Reset the deduplication cache
 * Used for testing or when starting a new cleanup cycle
 */
export function resetCleanupLogger() {
  seenScopes.clear();
}








