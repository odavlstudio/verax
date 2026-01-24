/**
 * Time Provider — Deterministic Time Infrastructure
 * 
 * Provides a singleton time abstraction that can be mocked for testing.
 * In production, behaves identically to Date.now() and new Date().toISOString().
 * In test mode (VERAX_TEST_TIME), returns fixed deterministic values.
 * 
 * DESIGN: No behavior changes to production code. Infrastructure only.
 * Time is not yet extracted from all call sites; this enables gradual migration.
 * 
 * @example
 * // Production: returns real time
 * const provider = getTimeProvider();
 * provider.now()  // => Date.now()
 * provider.iso()  // => new Date().toISOString()
 * 
 * @example
 * // Testing: with VERAX_TEST_TIME set
 * process.env.VERAX_TEST_TIME = '2026-01-19T10:00:00.000Z';
 * const provider = getTimeProvider();
 * provider.now()  // => Date.parse('2026-01-19T10:00:00.000Z')
 * provider.iso()  // => '2026-01-19T10:00:00.000Z'
 */

/**
 * @typedef {Object} TimeProvider
 * @property {() => number} now
 * @property {() => string} iso
 * @property {() => Date} date
 * @property {(isoString: string) => number} parse
 * @property {(isoString: string, deltaMs: number) => string|null} addMs
 * @property {(epochMs: number) => string|null} fromEpochMs
 */

/**
 * Build a time provider.
 * Accepts optional fixed time or custom resolvers for tests.
 * All consumers should rely on these helpers instead of touching Date directly.
 *
 * @param {Object} [options]
 * @param {string} [options.fixedTime] - ISO timestamp used for deterministic providers
 * @param {function} [options.now] - Custom now() implementation
 * @param {function} [options.iso] - Custom iso() implementation
 * @returns {TimeProvider}
 */
function createTimeProvider({ fixedTime, now, iso } = {}) {
  const resolveNow = () => {
    if (typeof now === 'function') return now();
    if (fixedTime) return Date.parse(fixedTime);
    return Date.now();
  };

  const resolveIso = () => {
    if (typeof iso === 'function') return iso();
    if (fixedTime) return fixedTime;
    return new Date(resolveNow()).toISOString();
  };

  return {
    now: resolveNow,
    iso: resolveIso,
    // Return Date instance for APIs that require Date objects (e.g., archiver)
    date() {
      return new Date(resolveNow());
    },
    // Parse ISO string to epoch ms (deterministic, no timezone surprises)
    parse(isoString) {
      if (!isoString) return NaN;
      return Date.parse(isoString);
    },
    // Add milliseconds to an ISO timestamp and return ISO
    addMs(isoString, deltaMs) {
      if (!isoString || typeof deltaMs !== 'number') return null;
      const ms = Date.parse(isoString);
      if (Number.isNaN(ms)) return null;
      return new Date(ms + deltaMs).toISOString();
    },
    // Convert epoch ms to ISO string
    fromEpochMs(epochMs) {
      if (typeof epochMs !== 'number') return null;
      return new Date(epochMs).toISOString();
    },
  };
}

/**
 * Initialize provider based on environment
 * If VERAX_TEST_TIME is set, use deterministic provider.
 * Otherwise, use real-time provider.
 * @returns {{now: function, iso: function}}
 */
function initializeProvider() {
  if (process.env.VERAX_TEST_TIME) {
    return createTimeProvider({ fixedTime: process.env.VERAX_TEST_TIME });
  }
  return createTimeProvider();
}

// Global provider instance (singleton)
let currentProvider = initializeProvider();

/**
 * Get the current time provider
 * @returns {TimeProvider}
 */
function getTimeProvider() {
  return /** @type {TimeProvider} */ (currentProvider);
}

/**
 * Override the time provider (primarily for testing)
 * @param {TimeProvider} provider - Must have now() and iso() methods
 * @throws {Error} if provider is invalid
 */
function setTimeProvider(provider) {
  if (!provider || typeof provider.now !== 'function' || typeof provider.iso !== 'function') {
    throw new Error('Provider must have now() and iso() methods');
  }
  currentProvider = provider;
}

/**
 * Reset provider to default (for test cleanup)
 */
function resetTimeProvider() {
  currentProvider = initializeProvider();
}

export { createTimeProvider, getTimeProvider, setTimeProvider, resetTimeProvider };








