/**
 * Version Information — Single Source of Truth
 *
 * This is the ONLY place where version is defined.
 * All other references must import from here.
 */

export const VERSION = '0.4.6';

export const STABILITY = 'stable'; // 'stable' | 'experimental'

export const VERSIONING_LAW = {
  major: 'Breaking CLI contract, exit code changes, artifact schema changes',
  minor: 'New features, new judgments, new extraction capabilities',
  patch: 'Bug fixes, performance improvements, test additions',
};

export const DEPRECATION_POLICY = {
  noSilentRemovals: true,
  notice: 'Deprecated flags/features warn for at least one minor version before removal',
};

export const COMPATIBILITY_GUARANTEES = {
  cli: {
    commands: 'stable', // run, inspect, version, help
    exitCodes: 'stable', // 0, 10, 20, 30, 40, 50, 64
  },
  artifacts: {
    schema: 'stable', // summary.json, findings.json, observe.json
  },
  behavior: {
    determinism: 'stable', // Same input → same output
    readOnly: 'stable', // Never modifies application under test
    zeroConfig: 'stable', // Works without configuration files
  },
  experimental: {
    commands: 'Frozen until Vision 1.1 (diagnose, explain, stability, triage, clean, gate)',
    advancedAuth: 'Post-authentication flows (out of scope in v0.4.5)',
  },
};

export const BREAKING_CHANGES_SINCE_LAST_MAJOR = [];

/**
 * Get formatted version information
 */
export function getVersionInfo() {
  return {
    version: VERSION,
    stability: STABILITY,
    compatibility: COMPATIBILITY_GUARANTEES,
    versioningLaw: VERSIONING_LAW,
    deprecationPolicy: DEPRECATION_POLICY,
    breakingChangesSinceLastMajor: BREAKING_CHANGES_SINCE_LAST_MAJOR,
  };
}

/**
 * Get version string for display
 */
export function getVersionString() {
  return `${VERSION} (${STABILITY})`;
}
