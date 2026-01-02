/**
 * Stage 5: Retry Policy
 * 
 * Centralized retry logic with strict caps to avoid flakiness
 */

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG = {
  maxRetries: 1, // Max 1 retry for any operation
  retryableErrors: [
    'Navigation timeout',
    'net::ERR_CONNECTION_REFUSED',
    'net::ERR_CONNECTION_RESET',
    'Target closed',
    'Protocol error'
  ]
};

/**
 * Check if an error is retryable
 * @param {Error} error - The error to check
 * @param {Object} config - Retry configuration
 * @returns {boolean} True if retryable
 */
function isRetryable(error, config = DEFAULT_RETRY_CONFIG) {
  if (!error) return false;
  
  const errorMsg = error.message || String(error);
  return config.retryableErrors.some(pattern => errorMsg.includes(pattern));
}

/**
 * Execute with retry
 * @param {Function} fn - Async function to execute
 * @param {Object} options - Retry options
 * @returns {Promise<any>} Result of fn
 */
async function executeWithRetry(fn, options = {}) {
  const {
    maxRetries = DEFAULT_RETRY_CONFIG.maxRetries,
    retryableErrors = DEFAULT_RETRY_CONFIG.retryableErrors,
    onRetry = null
  } = options;

  let lastError;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      attempt++;

      // Check if we should retry
      if (attempt > maxRetries) {
        break;
      }

      if (!isRetryable(error, { retryableErrors })) {
        // Not retryable, fail immediately
        throw error;
      }

      // Call retry callback
      if (onRetry) {
        onRetry(attempt, maxRetries, error);
      }

      // Small delay before retry (fixed, not random)
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // All retries exhausted
  throw lastError;
}

/**
 * Create a retry policy for specific operation types
 * @param {string} type - Operation type ('navigation', 'action', 'wait')
 * @returns {Object} Retry configuration
 */
function createRetryPolicy(type) {
  switch (type) {
    case 'navigation':
      return {
        maxRetries: 1,
        retryableErrors: [
          'Navigation timeout',
          'net::ERR_CONNECTION_REFUSED',
          'net::ERR_CONNECTION_RESET'
        ]
      };
    
    case 'action':
      return {
        maxRetries: 1,
        retryableErrors: [
          'Target closed',
          'Protocol error'
        ]
      };
    
    case 'wait':
      return {
        maxRetries: 0, // No retries for waits
        retryableErrors: []
      };
    
    default:
      return DEFAULT_RETRY_CONFIG;
  }
}

module.exports = {
  DEFAULT_RETRY_CONFIG,
  isRetryable,
  executeWithRetry,
  createRetryPolicy
};
