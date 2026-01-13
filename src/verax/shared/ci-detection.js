/**
 * Wave 5 — CI Detection
 * 
 * Detects CI environment and handles CI-specific behavior.
 */

/**
 * Detect if running in CI environment
 * @param {Object} options - Options with explicit ci flag
 * @returns {boolean} True if in CI mode
 */
export function isCI(options = {}) {
  // Explicit --ci flag takes precedence
  if (options.ci === true || options.ci === 'true') {
    return true;
  }
  
  // Check common CI environment variables
  const ciEnvVars = [
    'CI',
    'CONTINUOUS_INTEGRATION',
    'GITHUB_ACTIONS',
    'GITLAB_CI',
    'JENKINS_URL',
    'TRAVIS',
    'CIRCLECI',
    'BITBUCKET_COMMIT',
    'TEAMCITY_VERSION'
  ];
  
  for (const envVar of ciEnvVars) {
    if (process.env[envVar]) {
      return true;
    }
  }
  
  return false;
}

