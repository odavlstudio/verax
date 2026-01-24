/**
 * Deprecation Warning System
 * 
 * Helps manage backward compatibility by warning users about deprecated features
 * before they are removed.
 * 
 * Deprecation Policy:
 * - No silent removals
 * - Features must be deprecated for ≥1 minor version before removal
 * - Deprecation warnings are non-fatal (never block execution)
 * - Each warning shown once per process (not per invocation)
 */

const SHOWN_WARNINGS = new Set();

/**
 * Emit a deprecation warning for a CLI flag or feature
 * @param {Object} options - Deprecation details
 * @param {string} options.feature - Name of deprecated feature (e.g., '--profile')
 * @param {string} options.since - Version when deprecated (e.g., '0.4.0')
 * @param {string} options.removeIn - Version when it will be removed (e.g., '0.5.0')
 * @param {string} [options.replacement] - Recommended alternative
 * @param {string} [options.reason] - Why it was deprecated
 */
export function deprecationWarning(options) {
  const { feature, since, removeIn, replacement, reason } = options;
  
  // Only show each warning once per process
  const key = `${feature}-${since}`;
  if (SHOWN_WARNINGS.has(key)) {
    return;
  }
  SHOWN_WARNINGS.add(key);
  
  // Build warning message
  const lines = [
    `⚠️  DEPRECATION WARNING: ${feature}`,
    `   Deprecated since: v${since}`,
    `   Will be removed in: v${removeIn}`,
  ];
  
  if (reason) {
    lines.push(`   Reason: ${reason}`);
  }
  
  if (replacement) {
    lines.push(`   Use instead: ${replacement}`);
  }
  
  // Emit to stderr (warnings should not pollute stdout)
  console.warn(lines.join('\n'));
}

/**
 * Check if a flag is deprecated and warn if used
 * @param {string[]} args - Command line arguments
 * @param {Object} deprecatedFlags - Map of flag -> deprecation info
 * @returns {string[]} args with deprecated flags removed (if specified)
 */
export function checkDeprecatedFlags(args, deprecatedFlags) {
  const cleanedArgs = [...args];
  
  Object.entries(deprecatedFlags).forEach(([flag, info]) => {
    if (args.includes(flag)) {
      deprecationWarning({
        feature: flag,
        since: info.since,
        removeIn: info.removeIn,
        replacement: info.replacement,
        reason: info.reason,
      });
      
      // If removeNow is true, filter out the deprecated flag
      if (info.removeNow) {
        const index = cleanedArgs.indexOf(flag);
        if (index !== -1) {
          cleanedArgs.splice(index, 1);
          // Also remove the value if it's a flag with argument
          if (info.hasValue && index < cleanedArgs.length) {
            cleanedArgs.splice(index, 1);
          }
        }
      }
    }
  });
  
  return cleanedArgs;
}

/**
 * Reset shown warnings (for testing)
 */
export function resetDeprecationWarnings() {
  SHOWN_WARNINGS.clear();
}

/**
 * Example deprecated flags registry
 * This would be maintained in the actual CLI code
 */
export const DEPRECATED_FLAGS = {
  // Example: if we were deprecating --profile
  // '--profile': {
  //   since: '0.4.0',
  //   removeIn: '0.5.0',
  //   replacement: '--ci-mode',
  //   reason: 'Replaced with more explicit --ci-mode flag',
  //   hasValue: true,
  //   removeNow: false,
  // },
};
