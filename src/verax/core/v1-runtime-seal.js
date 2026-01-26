/**
 * V1 Runtime Seal — Internal Auditability
 * 
 * Provides debug-level logging to identify which modules are CORE_V1_RUNTIME vs CORE_V1_SUPPORT
 * during execution. This is for internal audit purposes only and does not affect behavior.
 * 
 * Non-failing, non-blocking, debug-only.
 */

/**
 * CORE_V1_RUNTIME: Modules guaranteed to execute during `verax run`
 * These are the essential execution paths for the v1 product.
 */
const CORE_V1_RUNTIME = new Set([
  'src/cli/commands/run.js',
  'src/verax/learn/index.js',
  'src/verax/observe/index.js',
  'src/verax/detect/index.js',
  'src/verax/core/truth-classifier.js',
  'src/verax/core/product-contract.js',
  'src/verax/core/confidence/index.js',
  'src/verax/core/determinism/contract.js',
  'src/verax/core/evidence-builder.js',
  'src/verax/shared/budget-profiles.js',
]);

/**
 * CORE_V1_SUPPORT: Required for v1 but not always executed
 * Infrastructure, CLI parsing, schemas, auth, etc.
 */
const CORE_V1_SUPPORT = new Set([
  'src/cli/entry.js',
  'src/cli/config/cli-contract.js',
  'src/cli/util/auth/auth-config.js',
  'src/cli/util/support/errors.js',
  'src/cli/util/support/time-provider.js',
  'src/cli/util/config/project-discovery.js',
]);

/**
 * Log v1 runtime seal information (debug only)
 * @param {string} phase - Phase name (learn, observe, detect)
 */
export function logV1RuntimeSeal(phase) {
  // Only log if VERAX_DEBUG is enabled
  if (process.env.VERAX_DEBUG !== '1') {
    return;
  }

  // Log phase entry
  console.error(`[V1-SEAL] Entering ${phase} phase (CORE_V1_RUNTIME)`);
}

/**
 * Check if a module path is part of CORE_V1_RUNTIME
 * @param {string} modulePath - Module path to check
 * @returns {boolean}
 */
export function isV1Runtime(modulePath) {
  return CORE_V1_RUNTIME.has(modulePath);
}

/**
 * Check if a module path is part of CORE_V1_SUPPORT
 * @param {string} modulePath - Module path to check
 * @returns {boolean}
 */
export function isV1Support(modulePath) {
  return CORE_V1_SUPPORT.has(modulePath);
}

/**
 * Get v1 scope classification for a module
 * @param {string} modulePath - Module path to classify
 * @returns {'CORE_V1_RUNTIME'|'CORE_V1_SUPPORT'|'FROZEN'|'EXPERIMENTAL'|'UNKNOWN'}
 */
export function getV1Scope(modulePath) {
  if (isV1Runtime(modulePath)) return 'CORE_V1_RUNTIME';
  if (isV1Support(modulePath)) return 'CORE_V1_SUPPORT';
  
  // Check for FROZEN modules
  if (modulePath.includes('/core/ga/') ||
      modulePath.includes('/core/release/') ||
      modulePath.includes('/core/security/') ||
      modulePath.includes('/commands/gate.js') ||
      modulePath.includes('/commands/doctor.js') ||
      modulePath.includes('/commands/diagnose.js') ||
      modulePath.includes('/commands/explain.js') ||
      modulePath.includes('/commands/stability') ||
      modulePath.includes('/commands/triage.js') ||
      modulePath.includes('/commands/clean.js') ||
      modulePath.includes('dynamic-route-intelligence')) {
    return 'FROZEN';
  }
  
  // Check for EXPERIMENTAL modules
  if (modulePath.includes('vue-extractor') ||
      modulePath.includes('angular-extractor') ||
      modulePath.includes('sveltekit-extractor') ||
      modulePath.includes('svelte-') ||
      modulePath.includes('vue-navigation') ||
      modulePath.includes('angular-navigation')) {
    return 'EXPERIMENTAL';
  }
  
  return 'UNKNOWN';
}

/**
 * Print v1 runtime summary (debug only)
 */
export function printV1RuntimeSummary() {
  if (process.env.VERAX_DEBUG !== '1') {
    return;
  }

  console.error('[V1-SEAL] Run completed using CORE_V1_RUNTIME modules');
  console.error('[V1-SEAL] Product scope: See docs/V1_SCOPE.md');
}
