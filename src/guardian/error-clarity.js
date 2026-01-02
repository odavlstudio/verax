/**
 * Error & Failure Messaging — Human-Readable Error Output
 * 
 * Classifies execution failures into canonical categories and provides
 * plain-language explanations with actionable next steps.
 * Production-grade DX improvement for CLI output.
 */

// Canonical error taxonomy (internal-only classification)
const ERROR_CATEGORIES = {
  TIMEOUT: 'TIMEOUT',
  ELEMENT_NOT_FOUND: 'ELEMENT_NOT_FOUND',
  NAVIGATION_FAILED: 'NAVIGATION_FAILED',
  AUTH_BLOCKED: 'AUTH_BLOCKED',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  DISABLED_BY_PRESET: 'DISABLED_BY_PRESET',
  USER_FILTERED: 'USER_FILTERED',
  MISSING_DEPENDENCY: 'MISSING_DEPENDENCY',
  INFRA_ERROR: 'INFRA_ERROR',
  UNKNOWN: 'UNKNOWN'
};

// Error message templates (centralized, not duplicated)
const ERROR_MESSAGES = {
  TIMEOUT: {
    title: 'Timeout waiting for interaction',
    explanation: 'This step took longer than expected to complete. The page may have performance issues or the timeout setting may be too strict.',
    action: 'Increase timeout setting or verify page performance.'
  },
  ELEMENT_NOT_FOUND: {
    title: 'Expected element not found',
    explanation: 'A critical UI element (button, form, link) was not present on the page. The page structure may have changed or the element is dynamically loaded.',
    action: 'Verify the element selector is correct or wait for dynamic content to load.'
  },
  NAVIGATION_FAILED: {
    title: 'Navigation failed',
    explanation: 'Attempting to navigate to a URL resulted in an error. The page may be unavailable, blocked, or returned an error status.',
    action: 'Check if the URL is accessible and returns a valid response (HTTP 200).'
  },
  AUTH_BLOCKED: {
    title: 'Authentication blocked',
    explanation: 'The test was blocked by authentication or access control. The credentials may be incorrect or the account may lack permissions.',
    action: 'Verify credentials and ensure the test account has required permissions.'
  },
  NOT_APPLICABLE: {
    title: 'Skipped (not applicable)',
    explanation: 'This step is not applicable to this site based on its capabilities or configuration.',
    action: 'This is expected behavior. No action required.'
  },
  DISABLED_BY_PRESET: {
    title: 'Skipped (disabled by preset)',
    explanation: 'This step is disabled in the selected testing preset. It can be re-enabled by choosing a different preset.',
    action: 'Choose a different preset if you want to test this flow, or create a custom configuration.'
  },
  USER_FILTERED: {
    title: 'Skipped (user filtered)',
    explanation: 'This step was explicitly filtered out in your configuration.',
    action: 'Update your configuration if you want to include this step in testing.'
  },
  MISSING_DEPENDENCY: {
    title: 'Skipped (missing dependency)',
    explanation: 'This step requires a previous step to pass, but that step did not execute or failed.',
    action: 'Fix the blocking issue in the previous step, or run tests without dependencies.'
  },
  INFRA_ERROR: {
    title: 'Infrastructure error',
    explanation: 'A system-level issue occurred (browser launch failed, permissions error, etc.). This is not related to your site.',
    action: 'Check system resources, permissions, and Guardian logs. Retry the test.'
  },
  UNKNOWN: {
    title: 'Unexpected error',
    explanation: 'An error occurred that does not fit common categories. See detailed logs for more information.',
    action: 'Check Guardian logs with GUARDIAN_DEBUG=1 for full error details.'
  }
};

// Skip messages (NOT errors, labeled clearly)
const SKIP_MESSAGES = {
  DISABLED_BY_PRESET: 'Skipped by preset configuration',
  NOT_APPLICABLE: 'Not applicable to this site',
  USER_FILTERED: 'User-filtered from testing',
  MISSING_DEPENDENCY: 'Skipped (blocking flow failed)'
};

/**
 * Classify a raw error/failure into canonical category
 * 
 * @param {Object} failure - Failure object with outcome, error, reason, etc.
 * @returns {string} Canonical error category
 */
function classifyError(failure = {}) {
  const {
    outcome,
    reason,
    failureReason,
    message,
    code
  } = failure;

  // Skip outcomes (NOT errors)
  if (outcome === 'NOT_APPLICABLE') return ERROR_CATEGORIES.NOT_APPLICABLE;
  if (outcome === 'SKIPPED') {
    if (reason === 'DISABLED_BY_PRESET') return ERROR_CATEGORIES.DISABLED_BY_PRESET;
    if (reason === 'USER_FILTERED') return ERROR_CATEGORIES.USER_FILTERED;
    if (reason === 'MISSING_DEPENDENCY') return ERROR_CATEGORIES.MISSING_DEPENDENCY;
    return ERROR_CATEGORIES.NOT_APPLICABLE;
  }

  // Timeout errors
  if (failureReason === 'TIMEOUT' || reason === 'TIMEOUT') {
    return ERROR_CATEGORIES.TIMEOUT;
  }
  if (message && message.toLowerCase().includes('timeout')) {
    return ERROR_CATEGORIES.TIMEOUT;
  }
  if (code === 'TIMEOUT') {
    return ERROR_CATEGORIES.TIMEOUT;
  }

  // Element not found
  if (failureReason === 'ELEMENT_NOT_FOUND' || reason === 'ELEMENT_NOT_FOUND') {
    return ERROR_CATEGORIES.ELEMENT_NOT_FOUND;
  }
  if (message && (message.toLowerCase().includes('not found') || message.toLowerCase().includes('selector'))) {
    return ERROR_CATEGORIES.ELEMENT_NOT_FOUND;
  }
  if (code === 'ELEMENT_NOT_FOUND') {
    return ERROR_CATEGORIES.ELEMENT_NOT_FOUND;
  }

  // Navigation failures
  if (failureReason === 'NAVIGATION_FAILED' || reason === 'NAVIGATION_FAILED') {
    return ERROR_CATEGORIES.NAVIGATION_FAILED;
  }
  if (message && (message.toLowerCase().includes('navigation') || message.toLowerCase().includes('net::err'))) {
    return ERROR_CATEGORIES.NAVIGATION_FAILED;
  }
  if (code === 'NAVIGATION_FAILED') {
    return ERROR_CATEGORIES.NAVIGATION_FAILED;
  }

  // Auth blocked
  if (failureReason === 'AUTH_BLOCKED' || reason === 'AUTH_BLOCKED') {
    return ERROR_CATEGORIES.AUTH_BLOCKED;
  }
  if (message && (message.toLowerCase().includes('unauthorized') || message.toLowerCase().includes('forbidden') || message.toLowerCase().includes('403') || message.toLowerCase().includes('401'))) {
    return ERROR_CATEGORIES.AUTH_BLOCKED;
  }
  if (code === 'AUTH_BLOCKED') {
    return ERROR_CATEGORIES.AUTH_BLOCKED;
  }

  // Infrastructure errors
  if (failureReason === 'INFRA_ERROR' || reason === 'INFRA_ERROR') {
    return ERROR_CATEGORIES.INFRA_ERROR;
  }
  if (message && (message.toLowerCase().includes('browser') || message.toLowerCase().includes('permission') || message.toLowerCase().includes('system'))) {
    return ERROR_CATEGORIES.INFRA_ERROR;
  }
  if (code === 'BROWSER_LAUNCH_FAILED' || code === 'PERMISSION_DENIED') {
    return ERROR_CATEGORIES.INFRA_ERROR;
  }

  // Missing dependency
  if (failureReason === 'MISSING_DEPENDENCY' || reason === 'MISSING_DEPENDENCY') {
    return ERROR_CATEGORIES.MISSING_DEPENDENCY;
  }

  // Default to unknown
  return ERROR_CATEGORIES.UNKNOWN;
}

/**
 * Extract human-friendly error info from failure
 * 
 * @param {Object} failure - Failure with outcome, error details, etc.
 * @returns {Object} { category, title, explanation, action }
 */
function getErrorInfo(failure = {}) {
  const category = classifyError(failure);
  const template = ERROR_MESSAGES[category] || ERROR_MESSAGES[ERROR_CATEGORIES.UNKNOWN];

  return {
    category,
    title: template.title,
    explanation: template.explanation,
    action: template.action
  };
}

/**
 * Check if output should be shown
 * Skip in quiet, CI, or non-TTY environments
 * 
 * @param {Object} config - Guardian config
 * @param {Array} args - CLI arguments
 * @returns {boolean} true if should show error clarity
 */
function shouldShowErrorClarity(config = {}, args = []) {
  // Skip if --quiet or -q flag
  if (args.includes('--quiet') || args.includes('-q')) {
    return false;
  }

  // Skip if non-TTY (CI/automation without explicit output)
  if (!process.stdout.isTTY) {
    return false;
  }

  return true;
}

/**
 * Group failures by category
 * 
 * @param {Array} failures - Array of failed attempts/flows
 * @returns {Object} Map of category -> [failures]
 */
function groupFailuresByCategory(failures = []) {
  const groups = {};

  (failures || []).forEach(failure => {
    const category = classifyError(failure);
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(failure);
  });

  return groups;
}

/**
 * Deduplicate similar errors within a category
 * 
 * @param {Array} failures - Array of failures in same category
 * @returns {Array} Deduplicated failures (max 3)
 */
function deduplicateErrors(failures = []) {
  const seen = new Set();
  const deduplicated = [];

  (failures || []).forEach(failure => {
    const key = `${failure.attemptId || failure.name}`;
    if (!seen.has(key) && deduplicated.length < 3) {
      seen.add(key);
      deduplicated.push(failure);
    }
  });

  return deduplicated;
}

/**
 * Check if this is a skip (not an error)
 * 
 * @param {string} category - Error category
 * @returns {boolean} true if this is a skip
 */
function isSkip(category) {
  return [
    ERROR_CATEGORIES.NOT_APPLICABLE,
    ERROR_CATEGORIES.DISABLED_BY_PRESET,
    ERROR_CATEGORIES.USER_FILTERED,
    ERROR_CATEGORIES.MISSING_DEPENDENCY
  ].includes(category);
}

/**
 * Format error clarity block for CLI output
 * 
 * @param {Array} failures - Failed attempts/flows
 * @param {Object} config - Guardian config
 * @param {Array} args - CLI arguments
 * @returns {string} Formatted error clarity block
 */
function formatErrorClarity(failures = [], config = {}, args = []) {
  if (!shouldShowErrorClarity(config, args)) {
    return '';
  }

  if (!failures || failures.length === 0) {
    return '';
  }

  const lines = [];
  const groups = groupFailuresByCategory(failures);

  // Separate actual errors from skips
  const errors = {};
  const skips = {};

  Object.entries(groups).forEach(([category, categoryFailures]) => {
    if (isSkip(category)) {
      skips[category] = categoryFailures;
    } else {
      errors[category] = categoryFailures;
    }
  });

  // Print errors section
  const errorCategories = Object.keys(errors);
  if (errorCategories.length > 0) {
    lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push('FAILURES & ERRORS');
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push('');

    errorCategories.forEach(category => {
      const categoryFailures = errors[category];
      const errorInfo = getErrorInfo(categoryFailures[0]);

      lines.push(`${errorInfo.title}`);
      lines.push('────────────────────────────────────────────────────────────');
      lines.push(`${errorInfo.explanation}`);
      lines.push(`Action: ${errorInfo.action}`);

      // List affected flows/attempts (max 3)
      const deduped = deduplicateErrors(categoryFailures);
      const names = deduped
        .map(f => f.attemptName || f.name || f.attemptId || 'unknown');

      if (names.length > 0) {
        lines.push(`Affected: ${names.join(', ')}`);
      }

      if (categoryFailures.length > 3) {
        lines.push(`(+${categoryFailures.length - 3} more)`);
      }

      lines.push('');
    });
  }

  // Print skips section
  const skipCategories = Object.keys(skips);
  if (skipCategories.length > 0) {
    lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push('SKIPPED ATTEMPTS');
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push('');

    skipCategories.forEach(category => {
      const categorySkips = skips[category];
      const skipReason = SKIP_MESSAGES[category] || 'Skipped';

      // Count skips in this category
      const names = deduplicateErrors(categorySkips)
        .map(s => s.attemptName || s.name || s.attemptId || 'unknown')
        .slice(0, 3);

      lines.push(`${skipReason} (${categorySkips.length})`);
      lines.push('────────────────────────────────────────────────────────────');
      if (names.length > 0) {
        lines.push(`${names.join(', ')}`);
      }
      if (categorySkips.length > 3) {
        lines.push(`+${categorySkips.length - 3} more`);
      }
      lines.push('');
    });
  }

  if (lines.length > 1) {
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  return lines.join('\n');
}

/**
 * Print error clarity block to stdout
 * 
 * @param {Array} failures - Failed attempts/flows
 * @param {Object} config - Guardian config
 * @param {Array} args - CLI arguments
 */
function printErrorClarity(failures = [], config = {}, args = []) {
  const output = formatErrorClarity(failures, config, args);
  if (output && output.trim().length > 0) {
    console.log(output);
  }
}

module.exports = {
  ERROR_CATEGORIES,
  ERROR_MESSAGES,
  SKIP_MESSAGES,
  classifyError,
  getErrorInfo,
  shouldShowErrorClarity,
  groupFailuresByCategory,
  deduplicateErrors,
  isSkip,
  formatErrorClarity,
  printErrorClarity
};
