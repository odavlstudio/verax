/**
 * PHASE 21.6.1 — Bootstrap Guard
 * 
 * Runtime assertions to prevent execution bootstrap during inspection commands.
 * Hard crashes if forbidden operations are attempted.
 */

/**
 * Inspection command mode flag
 */
let isInspectionMode = false;

/**
 * Enable inspection mode (called before inspection command dispatch)
 */
export function enableInspectionMode() {
  isInspectionMode = true;
}

/**
 * Disable inspection mode (called after inspection command completes)
 */
export function disableInspectionMode() {
  isInspectionMode = false;
}

/**
 * Check if in inspection mode
 */
export function isInInspectionMode() {
  return isInspectionMode;
}

/**
 * Assert that execution bootstrap is allowed
 * Throws if called during inspection mode
 */
export function assertExecutionBootstrapAllowed(operation) {
  if (isInspectionMode) {
    throw new Error(
      `FORBIDDEN: ${operation} called during inspection command. ` +
      `Inspection commands (ga, inspect, gates, doctor) must not trigger execution bootstrap.`
    );
  }
}

/**
 * Guard wrapper for detectProject
 */
export function guardDetectProject(fn) {
  return function(...args) {
    assertExecutionBootstrapAllowed('detectProject');
    return fn(...args);
  };
}

/**
 * Guard wrapper for resolveURL
 */
export function guardResolveURL(fn) {
  return function(...args) {
    assertExecutionBootstrapAllowed('resolveURL');
    return fn(...args);
  };
}

/**
 * Guard wrapper for prompt
 */
export function guardPrompt(fn) {
  return function(...args) {
    assertExecutionBootstrapAllowed('prompt');
    return fn(...args);
  };
}

/**
 * Guard wrapper for browser setup
 */
export function guardBrowserSetup(fn) {
  return function(...args) {
    assertExecutionBootstrapAllowed('browser setup');
    return fn(...args);
  };
}




