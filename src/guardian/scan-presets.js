/**
 * Scan Presets (Phase 6)
 * Opinionated defaults for one-command scans
 * Deterministic mappings: attempts, flows, policy thresholds.
 */

const { getDefaultAttemptIds } = require('./attempt-registry');
const { getDefaultFlowIds } = require('./flow-registry');

function resolveScanPreset(name = 'landing') {
  const preset = (name || '').toLowerCase();

  // Defaults: curated attempts + curated flows
  const defaults = {
    attempts: getDefaultAttemptIds(),
    flows: getDefaultFlowIds(),
    policy: null
  };

  switch (preset) {
    case 'landing':
      return {
        attempts: ['contact_form', 'language_switch', 'newsletter_signup'],
        flows: [], // focus on landing conversion, flows optional
        policy: {
          // lenient warnings, strict criticals
          failOnSeverity: 'CRITICAL',
          maxWarnings: 999,
          visualGates: { CRITICAL: 0, WARNING: 999, maxDiffPercent: 25 }
        }
      };
    case 'landing-demo':
      return {
        attempts: ['contact_form', 'language_switch'],
        flows: [],
        policy: {
          // Strict on broken navigation and CTA, lenient on revenue-related issues
          failOnSeverity: 'CRITICAL',
          maxWarnings: 5,
          failOnNewRegression: false,
          visualGates: { CRITICAL: 0, WARNING: 999, maxDiffPercent: 30 }
        }
      };
    case 'saas':
      return {
        attempts: ['language_switch', 'contact_form', 'newsletter_signup'],
        flows: ['signup_flow', 'login_flow'],
        policy: {
          failOnSeverity: 'CRITICAL',
          maxWarnings: 1,
          failOnNewRegression: true,
          visualGates: { CRITICAL: 0, WARNING: 5, maxDiffPercent: 20 }
        }
      };
    case 'shop':
    case 'ecommerce':
      return {
        attempts: ['language_switch', 'contact_form', 'newsletter_signup'],
        flows: ['checkout_flow'],
        policy: {
          failOnSeverity: 'CRITICAL',
          maxWarnings: 0,
          failOnNewRegression: true,
          visualGates: { CRITICAL: 0, WARNING: 0, maxDiffPercent: 15 }
        }
      };
    default:
      return defaults;
  }
}

module.exports = { resolveScanPreset };
