/**
 * Capability Registry
 * 
 * Single source of truth for all VERAX capabilities.
 * 
 * This registry defines what VERAX can detect and observe.
 * Every capability MUST have:
 * - A test in the test matrix
 * - A fixture that demonstrates it
 * - Required artifacts documented
 * 
 * No capability exists unless it appears here AND passes tests.
 */

/**
 * Capability maturity levels:
 * - stable: Production-ready, fully tested, deterministic
 * - partial: Works for common cases, may have edge case limitations
 * - experimental: Early implementation, may have significant limitations
 */
export const CAPABILITY_MATURITY = {
  STABLE: 'stable',
  PARTIAL: 'partial',
  EXPERIMENTAL: 'experimental'
};

/**
 * Capability categories
 */
export const CAPABILITY_CATEGORY = {
  NAVIGATION: 'navigation',
  NETWORK: 'network',
  STATE: 'state',
  UI_FEEDBACK: 'ui-feedback',
  ROUTES: 'routes',
  EVIDENCE: 'evidence',
  VALIDATION: 'validation',
  ANALYSIS: 'analysis',  // Analysis capabilities (confidence scoring, quality metrics)
  RELIABILITY: 'reliability',  // Reliability capabilities (determinism, consistency)
  SECURITY: 'security',  // Security capabilities (redaction, privacy)
  RELEASE: 'release',  // Release capabilities (gates, stability)
  OPERATIONS: 'operations',  // Operational guarantees (performance, resource management)
  PERFORMANCE: 'performance'  // Performance capabilities (timing, budgets)
};

/**
 * Canonical Capability Registry
 * 
 * Each entry defines a capability VERAX can detect/observe.
 * 
 * @typedef {Object} Capability
 * @property {string} id - Stable identifier (kebab-case)
 * @property {string} category - One of CAPABILITY_CATEGORY
 * @property {string} description - One sentence description
 * @property {string[]} requiredArtifacts - Artifact keys from ARTIFACT_REGISTRY
 * @property {string} maturity - One of CAPABILITY_MATURITY
 */

export const CAPABILITY_REGISTRY = {
  // NAVIGATION CAPABILITIES
  'link-detection-href': {
    id: 'link-detection-href',
    category: CAPABILITY_CATEGORY.NAVIGATION,
    description: 'Detects HTML links with href attributes and extracts navigation expectations',
    requiredArtifacts: ['learn', 'findings', 'traces'],
    maturity: CAPABILITY_MATURITY.STABLE
  },
  'interactive-element-no-href': {
    id: 'interactive-element-no-href',
    category: CAPABILITY_CATEGORY.NAVIGATION,
    description: 'Detects interactive elements (buttons, divs with onClick) that should navigate but lack href',
    requiredArtifacts: ['learn', 'findings', 'traces'],
    maturity: CAPABILITY_MATURITY.STABLE
  },
  'navigation-silent-failure': {
    id: 'navigation-silent-failure',
    category: CAPABILITY_CATEGORY.NAVIGATION,
    description: 'Detects when navigation is promised but fails silently (no URL change, no feedback)',
    requiredArtifacts: ['findings', 'traces', 'evidence'],
    maturity: CAPABILITY_MATURITY.STABLE
  },
  'external-navigation-blocking': {
    id: 'external-navigation-blocking',
    category: CAPABILITY_CATEGORY.NAVIGATION,
    description: 'Detects when external navigation is blocked by safety policies',
    requiredArtifacts: ['findings', 'traces'],
    maturity: CAPABILITY_MATURITY.STABLE
  },

  // ROUTE DETECTION CAPABILITIES
  'route-detection-react-router': {
    id: 'route-detection-react-router',
    category: CAPABILITY_CATEGORY.ROUTES,
    description: 'Extracts routes from React Router configuration',
    requiredArtifacts: ['learn', 'project'],
    maturity: CAPABILITY_MATURITY.STABLE
  },
  'route-detection-nextjs': {
    id: 'route-detection-nextjs',
    category: CAPABILITY_CATEGORY.ROUTES,
    description: 'Extracts routes from Next.js file-based routing (app/ and pages/)',
    requiredArtifacts: ['learn', 'project'],
    maturity: CAPABILITY_MATURITY.STABLE
  },
  'route-detection-vue-router': {
    id: 'route-detection-vue-router',
    category: CAPABILITY_CATEGORY.ROUTES,
    description: 'Extracts routes from Vue Router configuration',
    requiredArtifacts: ['learn', 'project'],
    maturity: CAPABILITY_MATURITY.STABLE
  },
  
  // Vue.js Framework Capabilities (Experimental - Learn-only)
  'vue-navigation-detection': {
    id: 'vue-navigation-detection',
    category: CAPABILITY_CATEGORY.NAVIGATION,
    description: 'Detects Vue Router navigation promises from <router-link> and router.push/replace in Vue SFCs',
    requiredArtifacts: ['learn', 'findings', 'traces'],
    maturity: CAPABILITY_MATURITY.EXPERIMENTAL
  },
  'vue-network-detection': {
    id: 'vue-network-detection',
    category: CAPABILITY_CATEGORY.NETWORK,
    description: 'Detects network calls (fetch/axios) inside Vue handlers, setup functions, and methods',
    requiredArtifacts: ['learn', 'findings', 'traces'],
    maturity: CAPABILITY_MATURITY.EXPERIMENTAL
  },
  'vue-state-detection': {
    id: 'vue-state-detection',
    category: CAPABILITY_CATEGORY.STATE,
    description: 'Detects Vue ref/reactive state mutations that are UI-bound via template bindings',
    requiredArtifacts: ['learn', 'findings', 'traces'],
    maturity: CAPABILITY_MATURITY.EXPERIMENTAL
  },
  
  // Svelte Framework Capabilities (Experimental - Learn-only)
  'svelte-navigation-detection': {
    id: 'svelte-navigation-detection',
    category: CAPABILITY_CATEGORY.NAVIGATION,
    description: 'Detects Svelte navigation promises from <a href> links and goto() calls in Svelte SFCs',
    requiredArtifacts: ['learn', 'findings', 'traces'],
    maturity: CAPABILITY_MATURITY.EXPERIMENTAL
  },
  'svelte-network-detection': {
    id: 'svelte-network-detection',
    category: CAPABILITY_CATEGORY.NETWORK,
    description: 'Detects network calls (fetch/axios) inside Svelte handlers, functions, and reactive statements',
    requiredArtifacts: ['learn', 'findings', 'traces'],
    maturity: CAPABILITY_MATURITY.EXPERIMENTAL
  },
  'svelte-state-detection': {
    id: 'svelte-state-detection',
    category: CAPABILITY_CATEGORY.STATE,
    description: 'Detects Svelte reactive store mutations and variable assignments that are UI-bound via markup bindings',
    requiredArtifacts: ['learn', 'findings', 'traces'],
    maturity: CAPABILITY_MATURITY.EXPERIMENTAL
  },
  
  // Angular Framework Capabilities (Experimental - Learn-only)
  'angular-navigation-detection': {
    id: 'angular-navigation-detection',
    category: CAPABILITY_CATEGORY.NAVIGATION,
    description: 'Detects Angular navigation promises from routerLink directives and Router.navigate() calls in Angular components',
    requiredArtifacts: ['learn', 'findings', 'traces'],
    maturity: CAPABILITY_MATURITY.EXPERIMENTAL
  },
  'angular-network-detection': {
    id: 'angular-network-detection',
    category: CAPABILITY_CATEGORY.NETWORK,
    description: 'Detects network calls (HttpClient, fetch) inside Angular component methods and services',
    requiredArtifacts: ['learn', 'findings', 'traces'],
    maturity: CAPABILITY_MATURITY.EXPERIMENTAL
  },
  'angular-state-detection': {
    id: 'angular-state-detection',
    category: CAPABILITY_CATEGORY.STATE,
    description: 'Detects Angular component property mutations that are UI-bound via template bindings',
    requiredArtifacts: ['learn', 'findings', 'traces'],
    maturity: CAPABILITY_MATURITY.EXPERIMENTAL
  },
  
  'route-validation-reachability': {
    id: 'route-validation-reachability',
    category: CAPABILITY_CATEGORY.ROUTES,
    description: 'Validates that discovered routes are reachable via HTTP',
    requiredArtifacts: ['learn', 'summary'],
    maturity: CAPABILITY_MATURITY.STABLE
  },
  'dynamic-route-normalization': {
    id: 'dynamic-route-normalization',
    category: CAPABILITY_CATEGORY.ROUTES,
    description: 'Normalizes dynamic route patterns (/:param, /[slug]) to example paths',
    requiredArtifacts: ['learn'],
    maturity: CAPABILITY_MATURITY.STABLE
  },
  'route-intelligence-correlation': {
    id: 'route-intelligence-correlation',
    category: CAPABILITY_CATEGORY.ROUTES,
    description: 'Correlates navigation promises with route definitions and evaluates outcomes',
    requiredArtifacts: ['learn', 'detect'],
    maturity: CAPABILITY_MATURITY.STABLE
  },
  'dynamic-route-intelligence': {
    id: 'dynamic-route-intelligence',
    category: CAPABILITY_CATEGORY.ROUTES,
    description: 'Classifies dynamic routes by verifiability and produces evidence-backed findings or explicit skips',
    requiredArtifacts: ['learn', 'detect', 'evidence'],
    maturity: CAPABILITY_MATURITY.STABLE
  },

  // NETWORK CAPABILITIES
  'network-detection-top-level': {
    id: 'network-detection-top-level',
    category: CAPABILITY_CATEGORY.NETWORK,
    description: 'Detects network calls (fetch/axios) at top-level of component or module',
    requiredArtifacts: ['learn', 'findings', 'traces'],
    maturity: CAPABILITY_MATURITY.STABLE
  },
  'network-detection-handler': {
    id: 'network-detection-handler',
    category: CAPABILITY_CATEGORY.NETWORK,
    description: 'Detects network calls inside event handlers (onClick, onSubmit, etc.)',
    requiredArtifacts: ['learn', 'findings', 'traces'],
    maturity: CAPABILITY_MATURITY.STABLE
  },
  'network-detection-useeffect': {
    id: 'network-detection-useeffect',
    category: CAPABILITY_CATEGORY.NETWORK,
    description: 'Detects network calls inside React useEffect hooks',
    requiredArtifacts: ['learn', 'findings', 'traces'],
    maturity: CAPABILITY_MATURITY.STABLE
  },
  'network-silent-failure': {
    id: 'network-silent-failure',
    category: CAPABILITY_CATEGORY.NETWORK,
    description: 'Detects when network requests fail silently (no user feedback)',
    requiredArtifacts: ['findings', 'traces', 'evidence'],
    maturity: CAPABILITY_MATURITY.STABLE
  },
  'network-request-observation': {
    id: 'network-request-observation',
    category: CAPABILITY_CATEGORY.NETWORK,
    description: 'Observes actual network requests during interaction execution',
    requiredArtifacts: ['traces', 'evidence'],
    maturity: CAPABILITY_MATURITY.STABLE
  },

  // STATE CAPABILITIES
  'state-detection-usestate': {
    id: 'state-detection-usestate',
    category: CAPABILITY_CATEGORY.STATE,
    description: 'Detects React useState hooks and extracts state mutation promises',
    requiredArtifacts: ['learn', 'findings', 'traces'],
    maturity: CAPABILITY_MATURITY.STABLE
  },
  'state-detection-redux': {
    id: 'state-detection-redux',
    category: CAPABILITY_CATEGORY.STATE,
    description: 'Detects Redux store dispatch calls and extracts state mutation promises',
    requiredArtifacts: ['learn', 'findings', 'traces'],
    maturity: CAPABILITY_MATURITY.PARTIAL
  },
  'state-detection-zustand': {
    id: 'state-detection-zustand',
    category: CAPABILITY_CATEGORY.STATE,
    description: 'Detects Zustand store set calls and extracts state mutation promises',
    requiredArtifacts: ['learn', 'findings', 'traces'],
    maturity: CAPABILITY_MATURITY.PARTIAL
  },
  'state-mutation-observation': {
    id: 'state-mutation-observation',
    category: CAPABILITY_CATEGORY.STATE,
    description: 'Observes actual state mutations during interaction execution',
    requiredArtifacts: ['traces', 'evidence'],
    maturity: CAPABILITY_MATURITY.PARTIAL
  },
  'state-silent-failure': {
    id: 'state-silent-failure',
    category: CAPABILITY_CATEGORY.STATE,
    description: 'Detects when state mutations are promised but fail silently',
    requiredArtifacts: ['findings', 'traces', 'evidence'],
    maturity: CAPABILITY_MATURITY.PARTIAL
  },
  'state-driven-view-switch': {
    id: 'state-driven-view-switch',
    category: CAPABILITY_CATEGORY.STATE,
    description: 'Detects state-driven navigation/view switches without URL changes (setView, setTab, dispatch(NAVIGATE), etc.)',
    requiredArtifacts: ['learn', 'findings', 'traces', 'evidence'],
    maturity: CAPABILITY_MATURITY.STABLE
  },

  // UI FEEDBACK CAPABILITIES
  'ui-feedback-loading': {
    id: 'ui-feedback-loading',
    category: CAPABILITY_CATEGORY.UI_FEEDBACK,
    description: 'Detects loading indicators (spinners, progress bars, aria-busy)',
    requiredArtifacts: ['traces', 'evidence'],
    maturity: CAPABILITY_MATURITY.STABLE
  },
  'ui-feedback-css-spinner': {
    id: 'ui-feedback-css-spinner',
    category: CAPABILITY_CATEGORY.UI_FEEDBACK,
    description: 'Detects CSS-only loading indicators (spinners) without semantic attributes using visual patterns',
    requiredArtifacts: ['traces', 'evidence'],
    maturity: CAPABILITY_MATURITY.STABLE
  },
  'ui-feedback-disabled': {
    id: 'ui-feedback-disabled',
    category: CAPABILITY_CATEGORY.UI_FEEDBACK,
    description: 'Detects button/input disabled state changes',
    requiredArtifacts: ['traces', 'evidence'],
    maturity: CAPABILITY_MATURITY.STABLE
  },
  'ui-feedback-toast': {
    id: 'ui-feedback-toast',
    category: CAPABILITY_CATEGORY.UI_FEEDBACK,
    description: 'Detects toast notifications and alert messages',
    requiredArtifacts: ['traces', 'evidence'],
    maturity: CAPABILITY_MATURITY.STABLE
  },
  'ui-feedback-dom-change': {
    id: 'ui-feedback-dom-change',
    category: CAPABILITY_CATEGORY.UI_FEEDBACK,
    description: 'Detects meaningful DOM changes (element additions, text changes)',
    requiredArtifacts: ['traces', 'evidence'],
    maturity: CAPABILITY_MATURITY.STABLE
  },
  'ui-feedback-missing': {
    id: 'ui-feedback-missing',
    category: CAPABILITY_CATEGORY.UI_FEEDBACK,
    description: 'Detects when user actions should show feedback but none is observed',
    requiredArtifacts: ['findings', 'traces'],
    maturity: CAPABILITY_MATURITY.STABLE
  },
  'ui-feedback-intelligence': {
    id: 'ui-feedback-intelligence',
    category: CAPABILITY_CATEGORY.UI_FEEDBACK,
    description: 'Correlates promises with UI feedback signals and produces evidence-backed findings',
    requiredArtifacts: ['findings', 'traces', 'evidence'],
    maturity: CAPABILITY_MATURITY.STABLE
  },

  // CONFIDENCE CAPABILITIES
  'confidence-unified-system': {
    id: 'confidence-unified-system',
    category: CAPABILITY_CATEGORY.ANALYSIS,
    description: 'Unified confidence system computing score (0..1), level (HIGH/MEDIUM/LOW/UNPROVEN), and stable reason codes',
    requiredArtifacts: ['findings'],
    maturity: CAPABILITY_MATURITY.STABLE
  },

  // VALIDATION CAPABILITIES
  'validation-feedback-detection': {
    id: 'validation-feedback-detection',
    category: CAPABILITY_CATEGORY.VALIDATION,
    description: 'Detects form validation feedback (error messages, visual indicators)',
    requiredArtifacts: ['traces', 'evidence'],
    maturity: CAPABILITY_MATURITY.STABLE
  },
  'validation-silent-failure': {
    id: 'validation-silent-failure',
    category: CAPABILITY_CATEGORY.VALIDATION,
    description: 'Detects when validation should block submission but does not',
    requiredArtifacts: ['findings', 'traces'],
    maturity: CAPABILITY_MATURITY.STABLE
  },

  // EVIDENCE LAW CAPABILITIES
  'evidence-law-enforcement': {
    id: 'evidence-law-enforcement',
    category: CAPABILITY_CATEGORY.EVIDENCE,
    description: 'Enforces Evidence Law: CONFIRMED findings must have sufficient evidence',
    requiredArtifacts: ['findings'],
    maturity: CAPABILITY_MATURITY.STABLE
  },
  'evidence-substantive-check': {
    id: 'evidence-substantive-check',
    category: CAPABILITY_CATEGORY.EVIDENCE,
    description: 'Validates that evidence contains substantive signals (not empty)',
    requiredArtifacts: ['findings'],
    maturity: CAPABILITY_MATURITY.STABLE
  },
  'evidence-downgrade-suspected': {
    id: 'evidence-downgrade-suspected',
    category: CAPABILITY_CATEGORY.EVIDENCE,
    description: 'Downgrades findings from CONFIRMED to SUSPECTED when evidence is insufficient',
    requiredArtifacts: ['findings'],
    maturity: CAPABILITY_MATURITY.STABLE
  },
  'guardrails-truth-reconciliation': {
    id: 'guardrails-truth-reconciliation',
    category: CAPABILITY_CATEGORY.ANALYSIS,
    description: 'Reconciles confidence with guardrails outcome to ensure consistent truth boundaries',
    requiredArtifacts: ['findings', 'guardrailsReport'],
    maturity: CAPABILITY_MATURITY.STABLE
  },
  'confidence-engine-hardening': {
    id: 'confidence-engine-hardening',
    category: CAPABILITY_CATEGORY.ANALYSIS,
    description: 'Enforces formal confidence invariants and provides audit-grade confidence artifacts',
    requiredArtifacts: ['findings', 'confidenceReport'],
    maturity: CAPABILITY_MATURITY.STABLE
  },
  'determinism-hardening': {
    id: 'determinism-hardening',
    category: CAPABILITY_CATEGORY.RELIABILITY,
    description: 'Ensures VERAX produces provably deterministic outputs and reports non-determinism explicitly',
    requiredArtifacts: ['determinismReport', 'determinismContract'],
    maturity: CAPABILITY_MATURITY.STABLE
  },
  'security-baseline-enforcement': {
    id: 'security-baseline-enforcement',
    category: CAPABILITY_CATEGORY.SECURITY,
    description: 'Enforces security baseline checks including secret scanning, vulnerability scanning, and supply-chain policy',
    requiredArtifacts: ['securityReport'],
    maturity: CAPABILITY_MATURITY.STABLE
  },
  'ga-release-readiness': {
    id: 'ga-release-readiness',
    category: CAPABILITY_CATEGORY.RELEASE,
    description: 'Evaluates and enforces GA readiness criteria for releases, including gates, determinism, verifier, and security',
    requiredArtifacts: ['gaReport'],
    maturity: CAPABILITY_MATURITY.STABLE
  },
  'enterprise-operational-guarantees': {
    id: 'enterprise-operational-guarantees',
    category: CAPABILITY_CATEGORY.OPERATIONS,
    description: 'Ensures crash-proof CLI, structured logging, and never-silent failure reporting for all commands',
    requiredArtifacts: [], // Operational guarantees are mostly about internal behavior and logging
    maturity: CAPABILITY_MATURITY.STABLE
  },
  'performance-budget-clarity': {
    id: 'performance-budget-clarity',
    category: CAPABILITY_CATEGORY.PERFORMANCE,
    description: 'Provides clear performance reports with scan budget, actual usage, stage timings, and memory snapshots',
    requiredArtifacts: ['performanceReport'],
    maturity: CAPABILITY_MATURITY.STABLE
  }
};

/**
 * Get all capability IDs
 * @returns {string[]}
 */
export function getAllCapabilityIds() {
  return Object.keys(CAPABILITY_REGISTRY);
}

/**
 * Get capabilities by category
 * @param {string} category
 * @returns {Object[]}
 */
export function getCapabilitiesByCategory(category) {
  return Object.values(CAPABILITY_REGISTRY).filter(cap => cap.category === category);
}

/**
 * Get capability by ID
 * @param {string} id
 * @returns {Capability|null}
 */
export function getCapability(id) {
  return CAPABILITY_REGISTRY[id] || null;
}

/**
 * Validate that a capability exists
 * @param {string} id
 * @returns {boolean}
 */
export function isValidCapability(id) {
  return id in CAPABILITY_REGISTRY;
}




