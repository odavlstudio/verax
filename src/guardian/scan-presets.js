/**
 * Scan Presets (Phase 6)
 * Opinionated defaults for one-command scans
 * Deterministic mappings: attempts, flows, policy thresholds.
 * Each preset must fully define coverage (enabled/disabled attempts), flows,
 * policy strictness, and operational defaults (fail-fast, evidence expectations).
 */

const { getDefaultAttemptIds } = require('./attempt-registry');
const { getDefaultFlowIds } = require('./flow-registry');

function resolveScanPreset(name = 'landing') {
  const preset = (name || '').toLowerCase();

  if (!preset) {
    throw new Error('Preset name is required');
  }

  switch (preset) {
    case 'landing':
      return {
        id: 'landing',
        attempts: ['site_smoke', 'primary_ctas', 'contact_discovery_v2', 'contact_form', 'language_switch', 'newsletter_signup'],
        disabledAttempts: ['signup', 'login', 'checkout'],
        flows: [], // focus on landing conversion, flows optional
        policy: {
          // lenient warnings, strict criticals
          failOnSeverity: 'CRITICAL',
          maxWarnings: 5,
          visualGates: { CRITICAL: 0, WARNING: 5, maxDiffPercent: 25 },
          coverage: { failOnGap: false, warnOnGap: true },
          evidence: { minCompleteness: 0.6, minIntegrity: 0.7, requireScreenshots: true, requireTraces: false }
        },
        failFast: true,
        evidence: { requireScreenshots: true, requireTraces: false, minCompleteness: 0.6, minIntegrity: 0.7 }
      };
    case 'landing-demo':
      return {
        id: 'landing-demo',
        attempts: ['site_smoke', 'primary_ctas', 'contact_discovery_v2', 'contact_form', 'language_switch'],
        disabledAttempts: ['signup', 'login', 'checkout', 'newsletter_signup'],
        flows: [],
        policy: {
          // Strict on broken navigation and CTA, lenient on revenue-related issues
          failOnSeverity: 'CRITICAL',
          maxWarnings: 5,
          failOnNewRegression: false,
          visualGates: { CRITICAL: 0, WARNING: 999, maxDiffPercent: 30 },
          coverage: { failOnGap: true, warnOnGap: false },
          evidence: { minCompleteness: 0.7, minIntegrity: 0.8, requireScreenshots: true, requireTraces: false }
        },
        failFast: true,
        evidence: { requireScreenshots: true, requireTraces: false, minCompleteness: 0.7, minIntegrity: 0.8 }
      };
    case 'startup':
      return {
        id: 'startup',
        attempts: getDefaultAttemptIds(),
        disabledAttempts: [],
        flows: getDefaultFlowIds(),
        policy: {
          failOnSeverity: 'CRITICAL',
          maxWarnings: 3,
          maxInfo: 999,
          failOnNewRegression: false,
          visualGates: { CRITICAL: 0, WARNING: 5, maxDiffPercent: 30 },
          coverage: { failOnGap: true, warnOnGap: false },
          evidence: { minCompleteness: 0.7, minIntegrity: 0.8, requireScreenshots: true, requireTraces: false }
        },
        failFast: true,
        evidence: { requireScreenshots: true, requireTraces: false, minCompleteness: 0.7, minIntegrity: 0.8 }
      };
    case 'saas':
      return {
        id: 'saas',
        attempts: ['site_smoke', 'primary_ctas', 'contact_discovery_v2', 'language_switch', 'contact_form', 'newsletter_signup'],
        flows: ['signup_flow', 'login_flow'],
        policy: {
          failOnSeverity: 'CRITICAL',
          maxWarnings: 1,
          failOnNewRegression: true,
          visualGates: { CRITICAL: 0, WARNING: 5, maxDiffPercent: 20 },
          coverage: { failOnGap: true, warnOnGap: false },
          evidence: { minCompleteness: 0.8, minIntegrity: 0.9, requireScreenshots: true, requireTraces: true }
        },
        failFast: true,
        evidence: { requireScreenshots: true, requireTraces: true, minCompleteness: 0.8, minIntegrity: 0.9 }
      };
    case 'shop':
    case 'ecommerce':
      return {
        id: 'shop',
        attempts: ['language_switch', 'contact_form', 'newsletter_signup'],
        flows: ['checkout_flow'],
        policy: {
          failOnSeverity: 'CRITICAL',
          maxWarnings: 0,
          failOnNewRegression: true,
          visualGates: { CRITICAL: 0, WARNING: 0, maxDiffPercent: 15 },
          coverage: { failOnGap: true, warnOnGap: false },
          evidence: { minCompleteness: 0.9, minIntegrity: 0.95, requireScreenshots: true, requireTraces: true }
        },
        failFast: true,
        evidence: { requireScreenshots: true, requireTraces: true, minCompleteness: 0.9, minIntegrity: 0.95 }
      };
    case 'enterprise':
      return {
        id: 'enterprise',
        attempts: getDefaultAttemptIds(),
        disabledAttempts: [],
        flows: getDefaultFlowIds(),
        policy: {
          failOnSeverity: 'WARNING',
          maxWarnings: 0,
          maxInfo: 0,
          maxTotalRisk: 0,
          failOnNewRegression: true,
          failOnSoftFailures: true,
          softFailureThreshold: 0,
          requireBaseline: true,
          visualGates: { CRITICAL: 0, WARNING: 0, maxDiffPercent: 10 },
          coverage: { failOnGap: true, warnOnGap: false },
          evidence: { minCompleteness: 1.0, minIntegrity: 0.98, requireScreenshots: true, requireTraces: true }
        },
        failFast: true,
        evidence: { requireScreenshots: true, requireTraces: true, minCompleteness: 1.0, minIntegrity: 0.98 }
      };
    default:
      throw new Error(`Unknown preset: ${name}`);
  }
}

module.exports = { resolveScanPreset };
