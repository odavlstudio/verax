/**
 * Wave 3 — Error Normalizer
 * 
 * Converts technical errors into human-friendly messages with next steps.
 */

/**
 * Normalize error into user-friendly message
 * @param {Error} error - Error object
 * @param {Object} context - Context information
 * @param {boolean} debug - Whether to show full stack
 * @returns {Object} { message: string, nextSteps: string[], stack: string }
 */
export function normalizeError(error, context = {}, debug = false) {
  const errorMessage = error.message || String(error);
  const stack = error.stack || '';
  
  // Missing URL
  if (errorMessage.includes('--url is required') || errorMessage.includes('URL is required')) {
    return {
      message: 'URL is required to run a scan.',
      nextSteps: [
        'Try: verax run --url http://localhost:3000',
        'Or run: verax (interactive wizard)'
      ],
      stack: debug ? stack : null
    };
  }
  
  // Project root not found
  if (errorMessage.includes('does not exist') && context.projectRoot) {
    return {
      message: `Project directory not found: ${context.projectRoot}`,
      nextSteps: [
        'Check that the path is correct',
        'Or specify a different path with --projectRoot',
        'Or run from the project directory: cd /path/to/project && verax run --url <url>'
      ],
      stack: debug ? stack : null
    };
  }
  
  // INVALID_CONTEXT
  if (errorMessage.includes('INVALID_CONTEXT') || context.verdict === 'INVALID_CONTEXT') {
    return {
      message: 'The URL you\'re scanning doesn\'t match the project being analyzed.',
      nextSteps: [
        'Ensure the URL matches your project (e.g., localhost:3000 for local dev server)',
        'Or use --force to scan anyway (not recommended)',
        'Or specify the correct --projectRoot that matches the URL'
      ],
      stack: debug ? stack : null
    };
  }
  
  // NO_EXPECTATIONS_FOUND
  if (errorMessage.includes('NO_EXPECTATIONS_FOUND') || context.verdict === 'NO_EXPECTATIONS_FOUND') {
    return {
      message: 'No code-derived expectations found in your project.',
      nextSteps: [
        'VERAX needs static, proven patterns in your code:',
        '  • HTML links: <a href="/about">',
        '  • Static fetch/axios: fetch("/api/users") (no template literals)',
        '  • State mutations: useState, Redux dispatch, Zustand set',
        'Dynamic routes and URLs are intentionally skipped.',
        'See README for supported patterns.'
      ],
      stack: debug ? stack : null
    };
  }
  
  // Playwright launch failure
  const lowerError = errorMessage.toLowerCase();
  const lowerStack = stack.toLowerCase();
  if (lowerError.includes('executable') || 
      lowerError.includes('browsertype') ||
      lowerError.includes('chromium') ||
      lowerError.includes('playwright') ||
      lowerStack.includes('playwright')) {
    return {
      message: 'Browser automation failed. Playwright browsers are not installed.',
      nextSteps: [
        'Install Playwright browsers: npx playwright install chromium',
        'Or with system dependencies: npx playwright install --with-deps chromium',
        'See: https://playwright.dev/docs/installation'
      ],
      stack: debug ? stack : null
    };
  }
  
  // Network/navigation errors
  if (errorMessage.includes('net::ERR') || errorMessage.includes('Navigation timeout') || errorMessage.includes('Protocol error')) {
    return {
      message: `Cannot connect to ${context.url || 'the URL'}.`,
      nextSteps: [
        'Ensure the URL is correct and the server is running',
        'Check network connectivity',
        'For localhost: ensure your dev server is started'
      ],
      stack: debug ? stack : null
    };
  }
  
  // Flow file not found
  if (errorMessage.includes('Flow file not found')) {
    return {
      message: `Flow file not found: ${context.flowPath || 'specified path'}`,
      nextSteps: [
        'Check that the file path is correct',
        'Ensure the flow file exists',
        'See README for flow file format'
      ],
      stack: debug ? stack : null
    };
  }
  
  // Generic error
  return {
    message: errorMessage,
    nextSteps: [
      'Check the error message above',
      'Run with --debug for detailed error information',
      'See README or run: verax --help'
    ],
    stack: debug ? stack : null
  };
}

/**
 * Print normalized error to console
 * @param {Error} error - Error object
 * @param {Object} context - Context
 * @param {boolean} debug - Debug mode
 */
export function printNormalizedError(error, context = {}, debug = false) {
  const normalized = normalizeError(error, context, debug);
  
  console.error(`\nError: ${normalized.message}\n`);
  
  if (normalized.nextSteps && normalized.nextSteps.length > 0) {
    console.error('Next steps:');
    normalized.nextSteps.forEach(step => {
      console.error(`  ${step}`);
    });
    console.error('');
  }
  
  if (normalized.stack && debug) {
    console.error('Stack trace:');
    console.error(normalized.stack);
    console.error('');
  }
}

