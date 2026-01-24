/**
 * Test Matrix — Capability Coverage Mapping
 * 
 * Maps capabilities to fixtures, tests, and expected assertions.
 * 
 * This is the authoritative definition of what tests prove which capabilities.
 * Every capability in the registry MUST have at least one entry here.
 * 
 * @typedef {Object} TestMatrixEntry
 * @property {string} capabilityId - Capability ID from CAPABILITY_REGISTRY
 * @property {string} fixture - Path to fixture (relative to test/fixtures/)
 * @property {string} testFile - Test file name (relative to test/)
 * @property {string} testName - Name of the test case
 * @property {string[]} expectedAssertions - What the test must verify
 */

import { getAllCapabilityIds as _getAllCapabilityIds } from '../src/verax/core/capabilities/registry.js';

/**
 * Test Matrix: capabilityId → test entries
 */
export const TEST_MATRIX = {
  // NAVIGATION CAPABILITIES
  'link-detection-href': [
    {
      capabilityId: 'link-detection-href',
      fixture: 'static-site',
      testFile: 'static-html.lock.test.js',
      testName: 'static HTML site scan completes and produces findings',
      expectedAssertions: [
        'learn.json contains navigation expectations from <a href> links',
        'learn.json expectations have type navigation or spa_navigation',
        'learn.json expectations include targetPath from href attribute',
        'learn.json expectations include selectorHint and sourceRef',
        'findings.json contains findings for broken links',
        'traces.jsonl contains interaction traces for link clicks',
        'Evidence packages include before/after screenshots and URL states'
      ]
    },
    {
      capabilityId: 'link-detection-href',
      fixture: 'static-realistic',
      testFile: 'static-html.lock.test.js',
      testName: 'link detection from realistic fixture produces complete evidence',
      expectedAssertions: [
        'learn.json contains navigation expectations from all <a href> links',
        'Navigation expectations have proof: PROVEN_EXPECTATION for static href values',
        'Evidence packages include trigger (AST source snippet) and action (interaction trace)'
      ]
    },
    {
      capabilityId: 'link-detection-href',
      fixture: 'static-realistic',
      testFile: 'determinism.integration.test.js',
      testName: 'link-detection-href determinism proof',
      expectedAssertions: [
        'Determinism check passes with DETERMINISTIC verdict',
        'learn.json is identical across multiple runs',
        'Navigation expectations are stable and deterministic'
      ]
    }
  ],

  'interactive-element-no-href': [
    {
      capabilityId: 'interactive-element-no-href',
      fixture: 'static-realistic',
      testFile: 'static-html.lock.test.js',
      testName: 'interactive elements without href are detected with complete evidence',
      expectedAssertions: [
        'learn.json contains navigation expectations from buttons and clickable divs without href',
        'findings.json contains interactive_element_no_href entries with CONFIRMED severity',
        'findings.json entries have evidencePackage with trigger, before, after, signals, and justification',
        'evidencePackage.before.url and evidencePackage.after.url are present',
        'evidencePackage.signals.navigation.urlChanged is false for silent failures',
        'Confidence level is computed based on evidence completeness',
        'Analytics buttons and noop handlers are NOT reported (false-positive guardrails applied)',
        'Disabled buttons and prevented interactions are NOT reported (guardrails applied)'
      ]
    },
    {
      capabilityId: 'interactive-element-no-href',
      fixture: 'static-realistic',
      testFile: 'determinism.integration.test.js',
      testName: 'interactive-element-no-href determinism proof',
      expectedAssertions: [
        'Determinism check passes with DETERMINISTIC verdict',
        'findings.json is identical across multiple runs',
        'Evidence packages are stable and deterministic'
      ]
    }
  ],

  'navigation-silent-failure': [
    {
      capabilityId: 'navigation-silent-failure',
      fixture: 'static-realistic',
      testFile: 'static-html.lock.test.js',
      testName: 'navigation silent failures are detected with complete evidence',
      expectedAssertions: [
        'learn.json contains navigation expectations from contact form and newsletter form',
        'findings.json contains navigation_silent_failure entries with CONFIRMED severity',
        'findings.json entries have evidencePackage with trigger, before, after, signals, and justification',
        'evidencePackage.before.url and evidencePackage.after.url are present',
        'evidencePackage.signals.navigation.urlChanged is false for silent failures',
        'Confidence level is computed based on evidence completeness',
        'Analytics links are NOT reported (false-positive guardrails applied)'
      ]
    },
    {
      capabilityId: 'navigation-silent-failure',
      fixture: 'static-realistic',
      testFile: 'determinism.integration.test.js',
      testName: 'navigation-silent-failure determinism proof',
      expectedAssertions: [
        'Determinism check passes with DETERMINISTIC verdict',
        'findings.json is identical across multiple runs',
        'Evidence packages are stable and deterministic'
      ]
    }
  ],

  'external-navigation-blocking': [
    {
      capabilityId: 'external-navigation-blocking',
      fixture: 'external-nav',
      testFile: 'static-html.lock.test.js',
      testName: 'external navigation is blocked by safety policies',
      expectedAssertions: [
        'External links are detected but blocked',
        'findings.json or traces.jsonl documents the block',
        'findings.json contains external_navigation_blocked or unexpected_navigation entries',
        'Evidence includes blocked URL, base origin, and safety policy details',
        'Safety flags prevent cross-origin navigation',
        'Internal navigation (same origin) is NOT blocked'
      ]
    },
    {
      capabilityId: 'external-navigation-blocking',
      fixture: 'external-nav',
      testFile: 'determinism.integration.test.js',
      testName: 'external-navigation-blocking determinism proof',
      expectedAssertions: [
        'Determinism check passes with DETERMINISTIC verdict',
        'findings.json is identical across multiple runs',
        'Blocked navigation records are stable and deterministic'
      ]
    }
  ],

  // ROUTE DETECTION CAPABILITIES
  'route-detection-react-router': [
    {
      capabilityId: 'route-detection-react-router',
      fixture: 'react-router-app',
      testFile: 'dynamic-routes.test.js',
      testName: 'React Router routes are extracted',
      expectedAssertions: [
        'learn.json contains routes from React Router config',
        'learn.json routes array includes path, source, sourceRef, and public fields',
        'Routes include path patterns and component references',
        'Dynamic routes are normalized to example paths',
        'Nested routes (children) are extracted correctly',
        'Route sourceRef points to router configuration file'
      ]
    },
    {
      capabilityId: 'route-detection-react-router',
      fixture: 'react-spa',
      testFile: 'dynamic-routes.test.js',
      testName: 'SPA routes are discovered from Router configuration',
      expectedAssertions: [
        'Routes are extracted from Router component',
        'Route patterns are normalized correctly',
        'learn.json contains complete route definitions with evidence'
      ]
    },
    {
      capabilityId: 'route-detection-react-router',
      fixture: 'react-router-app',
      testFile: 'determinism.integration.test.js',
      testName: 'route-detection-react-router determinism proof',
      expectedAssertions: [
        'Determinism check passes with DETERMINISTIC verdict',
        'learn.json is identical across multiple runs',
        'Route definitions are stable and deterministic'
      ]
    }
  ],

  'route-detection-nextjs': [
    {
      capabilityId: 'route-detection-nextjs',
      fixture: 'nextjs-app',
      testFile: 'dynamic-routes.test.js',
      testName: 'Next.js file-based routes are extracted',
      expectedAssertions: [
        'learn.json contains routes from app/ or pages/ directories',
        'learn.json routes array includes path, source, sourceRef, public, and dynamic fields',
        'Routes include file paths and URL patterns',
        'Dynamic segments [param] are normalized to :param',
        'Route groups (group) are handled correctly',
        'Layout files are considered in route structure'
      ]
    },
    {
      capabilityId: 'route-detection-nextjs',
      fixture: 'nextjs-realistic',
      testFile: 'dynamic-routes.test.js',
      testName: 'Next.js routes from realistic fixture are extracted',
      expectedAssertions: [
        'learn.json contains routes from Next.js App Router or Pages Router',
        'Route definitions include complete source references',
        'Dynamic routes are properly normalized'
      ]
    },
    {
      capabilityId: 'route-detection-nextjs',
      fixture: 'nextjs-app',
      testFile: 'determinism.integration.test.js',
      testName: 'route-detection-nextjs determinism proof',
      expectedAssertions: [
        'Determinism check passes with DETERMINISTIC verdict',
        'learn.json is identical across multiple runs',
        'Route definitions are stable and deterministic'
      ]
    }
  ],

  'route-detection-vue-router': [
    {
      capabilityId: 'route-detection-vue-router',
      fixture: 'vue-router-app',
      testFile: 'vue-router-extractor.test.js',
      testName: 'Vue Router routes are extracted',
      expectedAssertions: [
        'learn.json contains routes from Vue Router config',
        'learn.json routes array includes path, source, sourceRef, public, and component fields',
        'Routes include path patterns and component references',
        'Dynamic routes are normalized to example paths',
        'Nested routes (children) are extracted correctly'
      ]
    },
    {
      capabilityId: 'route-detection-vue-router',
      fixture: 'vue-realistic',
      testFile: 'vue-support.test.js',
      testName: 'Vue Router route extraction from createRouter',
      expectedAssertions: [
        'learn.json contains routes extracted from Vue Router configuration',
        'Routes include static paths from routes array',
        'Dynamic routes are normalized to example paths',
        'Route sourceRef points to router configuration file',
        'Route definitions include complete evidence'
      ]
    },
    {
      capabilityId: 'route-detection-vue-router',
      fixture: 'vue-router-app',
      testFile: 'determinism.integration.test.js',
      testName: 'route-detection-vue-router determinism proof',
      expectedAssertions: [
        'Determinism check passes with DETERMINISTIC verdict',
        'learn.json is identical across multiple runs',
        'Route definitions are stable and deterministic'
      ]
    }
  ],
  
  'vue-navigation-detection': [
    {
      capabilityId: 'vue-navigation-detection',
      fixture: 'vue-realistic',
      testFile: 'vue-support.test.js',
      testName: 'Vue navigation promise detection',
      expectedAssertions: [
        'learn.json contains navigation expectations from <router-link>',
        'learn.json contains navigation expectations from router.push() and router.replace()',
        'learn.json expectations have type navigation or navigation_action',
        'learn.json expectations include target (URL), context (handler/component), sourceRef, and proof',
        'findings.json contains findings for navigation silent failures',
        'findings.json entries have CONFIRMED severity when navigation fails and no UI feedback',
        'Evidence packages include AST source snippets for navigation promises',
        'Evidence packages include trigger (AST source snippet), before/after URLs, and signals',
        'Guardrails prevent false positives from analytics-only navigation'
      ]
    },
    {
      capabilityId: 'vue-navigation-detection',
      fixture: 'vue-realistic',
      testFile: 'determinism.integration.test.js',
      testName: 'vue-navigation-detection determinism proof',
      expectedAssertions: [
        'Determinism check passes with DETERMINISTIC verdict',
        'learn.json is identical across multiple runs',
        'Navigation expectations are stable and deterministic'
      ]
    }
  ],
  
  'vue-network-detection': [
    {
      capabilityId: 'vue-network-detection',
      fixture: 'vue-realistic',
      testFile: 'vue-support.test.js',
      testName: 'Vue network call detection in handlers',
      expectedAssertions: [
        'learn.json contains network expectations from fetch calls in Vue handlers',
        'learn.json contains network expectations from axios calls in Vue handlers',
        'learn.json expectations have type network or network_action',
        'learn.json expectations include target (URL), method, context (handler/component), sourceRef, and proof',
        'findings.json contains findings for network silent failures',
        'findings.json entries have CONFIRMED severity when network fails and no UI feedback',
        'Evidence packages include handler context and AST source',
        'Evidence packages include trigger (AST source snippet), before/after screenshots, and signals',
        'Guardrails prevent false positives for analytics-only calls',
        'Guardrails prevent false positives when network succeeds but no UI feedback (downgrade to SUSPECTED)'
      ]
    },
    {
      capabilityId: 'vue-network-detection',
      fixture: 'vue-realistic',
      testFile: 'determinism.integration.test.js',
      testName: 'vue-network-detection determinism proof',
      expectedAssertions: [
        'Determinism check passes with DETERMINISTIC verdict',
        'learn.json is identical across multiple runs',
        'Network expectations are stable and deterministic'
      ]
    }
  ],
  
  'vue-state-detection': [
    {
      capabilityId: 'vue-state-detection',
      fixture: 'vue-realistic',
      testFile: 'vue-support.test.js',
      testName: 'Vue state mutation detection (ref/reactive)',
      expectedAssertions: [
        'learn.json contains state expectations from ref/reactive mutations',
        'learn.json expectations have type state_action or state',
        'learn.json expectations include expectedTarget (state variable name), context (component), sourceRef, and proof',
        'learn.json expectations include metadata.jsxUsage or metadata.templateUsage count for user-visible state',
        'Only template-bound state mutations are detected',
        'State variables used in template bindings ({{}}, :value, v-if, etc.) create expectations',
        'Evidence packages include template binding evidence',
        'Evidence packages include trigger (AST source snippet), before/after state snapshots, and signals',
        'Guardrails prevent false positives from cosmetic/background state'
      ]
    },
    {
      capabilityId: 'vue-state-detection',
      fixture: 'vue-realistic',
      testFile: 'determinism.integration.test.js',
      testName: 'vue-state-detection determinism proof',
      expectedAssertions: [
        'Determinism check passes with DETERMINISTIC verdict',
        'learn.json is identical across multiple runs',
        'State expectations are stable and deterministic'
      ]
    }
  ],

  // SVELTE CAPABILITIES
  'svelte-navigation-detection': [
    {
      capabilityId: 'svelte-navigation-detection',
      fixture: 'svelte-realistic',
      testFile: 'svelte-support.test.js',
      testName: 'Svelte navigation promise detection',
      expectedAssertions: [
        'learn.json contains navigation expectations from <a href> links',
        'learn.json contains navigation expectations from goto() calls',
        'learn.json expectations have type navigation or navigation_action',
        'learn.json expectations include target (URL), context (handler/component), sourceRef, and proof',
        'learn.json expectations include metadata.navigationType (link, goto, navigate)',
        'findings.json contains findings for navigation silent failures',
        'Evidence packages include AST source snippets for navigation promises',
        'Evidence packages include trigger (AST source snippet), before/after URLs, and signals',
        'Guardrails prevent false positives from analytics-only navigation and shallow routing'
      ]
    },
    {
      capabilityId: 'svelte-navigation-detection',
      fixture: 'svelte-realistic',
      testFile: 'determinism.integration.test.js',
      testName: 'svelte-navigation-detection determinism proof',
      expectedAssertions: [
        'Determinism check passes with DETERMINISTIC verdict',
        'learn.json is identical across multiple runs',
        'Navigation expectations are stable and deterministic'
      ]
    }
  ],

  'svelte-network-detection': [
    {
      capabilityId: 'svelte-network-detection',
      fixture: 'svelte-realistic',
      testFile: 'svelte-support.test.js',
      testName: 'Svelte network call detection in handlers',
      expectedAssertions: [
        'learn.json contains network expectations from fetch calls in Svelte handlers',
        'learn.json contains network expectations from axios calls in Svelte handlers',
        'learn.json expectations have type network or network_action',
        'learn.json expectations include target (URL), method, context (handler/component), sourceRef, and proof',
        'findings.json contains findings for network silent failures',
        'findings.json entries have CONFIRMED severity when network fails and no UI feedback',
        'Evidence packages include handler context and AST source',
        'Evidence packages include trigger (AST source snippet), before/after screenshots, and signals',
        'Guardrails prevent false positives for analytics-only calls',
        'Guardrails prevent false positives when network succeeds but no UI feedback (downgrade to SUSPECTED)'
      ]
    },
    {
      capabilityId: 'svelte-network-detection',
      fixture: 'svelte-realistic',
      testFile: 'determinism.integration.test.js',
      testName: 'svelte-network-detection determinism proof',
      expectedAssertions: [
        'Determinism check passes with DETERMINISTIC verdict',
        'learn.json is identical across multiple runs',
        'Network expectations are stable and deterministic'
      ]
    }
  ],

  'svelte-state-detection': [
    {
      capabilityId: 'svelte-state-detection',
      fixture: 'svelte-realistic',
      testFile: 'svelte-support.test.js',
      testName: 'Svelte state mutation detection (reactive stores, assignments)',
      expectedAssertions: [
        'learn.json contains state expectations from reactive store mutations',
        'learn.json contains state expectations from variable assignments',
        'learn.json expectations have type state_action or state',
        'learn.json expectations include expectedTarget (state variable name or store name), context (component), sourceRef, and proof',
        'learn.json expectations include metadata.templateUsage count for user-visible state',
        'Only template-bound state mutations are detected',
        'State variables used in template bindings ({variable}, {#if variable}, bind:value) create expectations',
        'Evidence packages include template binding evidence',
        'Evidence packages include trigger (AST source snippet), before/after state snapshots, and signals',
        'Guardrails prevent false positives from cosmetic/background state'
      ]
    },
    {
      capabilityId: 'svelte-state-detection',
      fixture: 'svelte-realistic',
      testFile: 'determinism.integration.test.js',
      testName: 'svelte-state-detection determinism proof',
      expectedAssertions: [
        'Determinism check passes with DETERMINISTIC verdict',
        'learn.json is identical across multiple runs',
        'State expectations are stable and deterministic'
      ]
    }
  ],

  // ANGULAR CAPABILITIES
  'angular-navigation-detection': [
    {
      capabilityId: 'angular-navigation-detection',
      fixture: 'angular-realistic',
      testFile: 'angular-support.test.js',
      testName: 'Angular navigation promise detection',
      expectedAssertions: [
        'learn.json contains navigation expectations from routerLink directives',
        'learn.json contains navigation expectations from Router.navigate() calls',
        'learn.json expectations have type navigation or navigation_action',
        'learn.json expectations include target (URL), context (handler/component), sourceRef, and proof',
        'learn.json expectations include metadata.navigationType (routerLink, router-navigate)',
        'findings.json contains findings for navigation silent failures',
        'Evidence packages include AST source snippets for navigation promises',
        'Evidence packages include trigger (AST source snippet), before/after URLs, and signals',
        'Guardrails prevent false positives from analytics-only navigation and shallow routing'
      ]
    },
    {
      capabilityId: 'angular-navigation-detection',
      fixture: 'angular-realistic',
      testFile: 'determinism.integration.test.js',
      testName: 'angular-navigation-detection determinism proof',
      expectedAssertions: [
        'Determinism check passes with DETERMINISTIC verdict',
        'learn.json is identical across multiple runs',
        'Navigation expectations are stable and deterministic'
      ]
    }
  ],

  'angular-network-detection': [
    {
      capabilityId: 'angular-network-detection',
      fixture: 'angular-realistic',
      testFile: 'angular-support.test.js',
      testName: 'Angular network call detection in component methods',
      expectedAssertions: [
        'learn.json contains network expectations from HttpClient calls in Angular components',
        'learn.json contains network expectations from fetch calls in Angular components',
        'learn.json expectations have type network or network_action',
        'learn.json expectations include target (URL), method, context (handler/component), sourceRef, and proof',
        'findings.json contains findings for network silent failures',
        'findings.json entries have CONFIRMED severity when network fails and no UI feedback',
        'Evidence packages include handler context and AST source',
        'Evidence packages include trigger (AST source snippet), before/after screenshots, and signals',
        'Guardrails prevent false positives for analytics-only calls',
        'Guardrails prevent false positives when network succeeds but no UI feedback (downgrade to SUSPECTED)'
      ]
    },
    {
      capabilityId: 'angular-network-detection',
      fixture: 'angular-realistic',
      testFile: 'determinism.integration.test.js',
      testName: 'angular-network-detection determinism proof',
      expectedAssertions: [
        'Determinism check passes with DETERMINISTIC verdict',
        'learn.json is identical across multiple runs',
        'Network expectations are stable and deterministic'
      ]
    }
  ],

  'angular-state-detection': [
    {
      capabilityId: 'angular-state-detection',
      fixture: 'angular-realistic',
      testFile: 'angular-support.test.js',
      testName: 'Angular state mutation detection (component properties)',
      expectedAssertions: [
        'learn.json contains state expectations from component property mutations',
        'learn.json expectations have type state_action or state',
        'learn.json expectations include expectedTarget (property name), context (component), sourceRef, and proof',
        'learn.json expectations include metadata.templateUsage count for user-visible state',
        'Only template-bound state mutations are detected',
        'State properties used in template bindings ({{property}}, *ngIf, [property]) create expectations',
        'Evidence packages include template binding evidence',
        'Evidence packages include trigger (AST source snippet), before/after state snapshots, and signals',
        'Guardrails prevent false positives from cosmetic/background state'
      ]
    },
    {
      capabilityId: 'angular-state-detection',
      fixture: 'angular-realistic',
      testFile: 'determinism.integration.test.js',
      testName: 'angular-state-detection determinism proof',
      expectedAssertions: [
        'Determinism check passes with DETERMINISTIC verdict',
        'learn.json is identical across multiple runs',
        'State expectations are stable and deterministic'
      ]
    }
  ],

  'route-validation-reachability': [
    {
      capabilityId: 'route-validation-reachability',
      fixture: 'static-site',
      testFile: 'route-validation.test.js',
      testName: 'routes are validated for HTTP reachability',
      expectedAssertions: [
        'learn.json includes validation results',
        'learn.json validation object includes routesValidated, routesReachable, routesUnreachable counts',
        'learn.json validation.details array contains route validation details with path, status, httpStatus, finalUrl, reason',
        'Reachable routes are marked as REACHABLE',
        'Unreachable routes are marked as UNREACHABLE with reason',
        'Evidence packages include route validation status for route findings'
      ]
    },
    {
      capabilityId: 'route-validation-reachability',
      fixture: 'react-realistic',
      testFile: 'route-validation.test.js',
      testName: 'route validation from realistic React fixture',
      expectedAssertions: [
        'learn.json contains validation results for React Router routes',
        'Route validation includes HTTP status codes and reachability status',
        'Evidence includes complete route validation details'
      ]
    },
    {
      capabilityId: 'route-validation-reachability',
      fixture: 'nextjs-realistic',
      testFile: 'route-validation.test.js',
      testName: 'route validation from realistic Next.js fixture',
      expectedAssertions: [
        'learn.json contains validation results for Next.js routes',
        'Route validation handles dynamic routes correctly',
        'Evidence includes complete route validation details'
      ]
    },
    {
      capabilityId: 'route-validation-reachability',
      fixture: 'static-site',
      testFile: 'determinism.integration.test.js',
      testName: 'route-validation-reachability determinism proof',
      expectedAssertions: [
        'Determinism check passes with DETERMINISTIC verdict',
        'learn.json validation results are identical across multiple runs',
        'Route validation status is stable and deterministic'
      ]
    }
  ],

  'dynamic-route-normalization': [
    {
      capabilityId: 'dynamic-route-normalization',
      fixture: 'nextjs-app',
      testFile: 'dynamic-routes.test.js',
      testName: 'dynamic route patterns are normalized to example paths',
      expectedAssertions: [
        'learn.json routes array includes normalizedPath for dynamic routes',
        'learn.json routes include metadata.isDynamic boolean',
        'learn.json routes include metadata.dynamicSegments array',
        '/:param patterns become /example',
        '/[slug] patterns become /example',
        'Template literals are normalized',
        'Evidence packages include normalized paths for route correlation'
      ]
    },
    {
      capabilityId: 'dynamic-route-normalization',
      fixture: 'react-realistic',
      testFile: 'dynamic-routes.test.js',
      testName: 'dynamic route normalization from realistic React fixture',
      expectedAssertions: [
        'learn.json contains normalized routes from React Router',
        'Dynamic routes are normalized to concrete example paths',
        'Evidence includes complete normalization metadata'
      ]
    },
    {
      capabilityId: 'dynamic-route-normalization',
      fixture: 'nextjs-realistic',
      testFile: 'dynamic-routes.test.js',
      testName: 'dynamic route normalization from realistic Next.js fixture',
      expectedAssertions: [
        'learn.json contains normalized routes from Next.js app router',
        'Dynamic routes are normalized to concrete example paths',
        'Evidence includes complete normalization metadata'
      ]
    },
    {
      capabilityId: 'dynamic-route-normalization',
      fixture: 'vue-realistic',
      testFile: 'dynamic-routes.test.js',
      testName: 'dynamic route normalization from realistic Vue fixture',
      expectedAssertions: [
        'learn.json contains normalized routes from Vue Router',
        'Dynamic routes are normalized to concrete example paths',
        'Evidence includes complete normalization metadata'
      ]
    },
    {
      capabilityId: 'dynamic-route-normalization',
      fixture: 'nextjs-app',
      testFile: 'determinism.integration.test.js',
      testName: 'dynamic-route-normalization determinism proof',
      expectedAssertions: [
        'Determinism check passes with DETERMINISTIC verdict',
        'learn.json normalized routes are identical across multiple runs',
        'Route normalization is stable and deterministic'
      ]
    }
  ],

  'route-intelligence-correlation': [
    {
      capabilityId: 'route-intelligence-correlation',
      fixture: 'react-realistic',
      testFile: 'route-intelligence.test.js',
      testName: 'Route Intelligence - correlateNavigationWithRoute - exact match',
      expectedAssertions: [
        'Navigation promises are correlated with route definitions',
        'Exact route matches have confidence 1.0',
        'Dynamic route patterns are matched correctly',
        'findings.json contains route_not_reachable findings when navigation fails',
        'Evidence packages include trigger (AST source snippet), route definition, before/after URLs, and signals'
      ]
    },
    {
      capabilityId: 'route-intelligence-correlation',
      fixture: 'react-realistic',
      testFile: 'route-findings-realistic.test.js',
      testName: 'Route Findings - React Router silent failure',
      expectedAssertions: [
        'Route silent failures are detected when navigation promise not fulfilled',
        'findings.json contains CONFIRMED route_not_reachable findings',
        'Evidence includes route definition and navigation trigger',
        'Findings include before/after URL and signals',
        'Evidence packages include complete route correlation data'
      ]
    },
    {
      capabilityId: 'route-intelligence-correlation',
      fixture: 'nextjs-realistic',
      testFile: 'route-findings-realistic.test.js',
      testName: 'Route Findings - Next.js App router dynamic routes',
      expectedAssertions: [
        'Dynamic routes are handled correctly',
        'Route mismatches are detected',
        'Evidence is complete for route findings',
        'findings.json contains route findings with proper severity and confidence',
        'Evidence packages include normalized route paths and correlation results'
      ]
    },
    {
      capabilityId: 'route-intelligence-correlation',
      fixture: 'vue-realistic',
      testFile: 'route-findings-realistic.test.js',
      testName: 'Route Findings - Vue Router correlation',
      expectedAssertions: [
        'Vue Router routes are correlated with navigation promises',
        'Route findings include complete evidence packages',
        'Evidence includes route definition and navigation trigger'
      ]
    },
    {
      capabilityId: 'route-intelligence-correlation',
      fixture: 'react-realistic',
      testFile: 'determinism.integration.test.js',
      testName: 'route-intelligence-correlation determinism proof',
      expectedAssertions: [
        'Determinism check passes with DETERMINISTIC verdict',
        'findings.json is identical across multiple runs',
        'Route correlation results are stable and deterministic'
      ]
    }
  ],

  'dynamic-route-intelligence': [
    {
      capabilityId: 'dynamic-route-intelligence',
      fixture: 'nextjs-realistic',
      testFile: 'dynamic-route-intelligence.test.js',
      testName: 'Dynamic Route Intelligence - classifyDynamicRoute - verified dynamic',
      expectedAssertions: [
        'Dynamic routes are classified by verifiability (STATIC, VERIFIED_DYNAMIC, AMBIGUOUS_DYNAMIC, UNVERIFIABLE_DYNAMIC)',
        'learn.json routes include route classification metadata',
        'Verified dynamic routes have URL change, route match, and UI feedback',
        'Auth-gated routes are marked as UNVERIFIABLE',
        'Evidence packages include route classification and verifiability status'
      ]
    },
    {
      capabilityId: 'dynamic-route-intelligence',
      fixture: 'nextjs-realistic',
      testFile: 'dynamic-route-findings-realistic.test.js',
      testName: 'Dynamic Route Findings - verified dynamic route',
      expectedAssertions: [
        'Verified dynamic routes do not produce false positives',
        'Unverifiable routes are skipped with documented reasons',
        'findings.json contains route findings with proper classification',
        'Evidence includes route definition, navigation trigger, and signals',
        'Evidence packages include route classification and skip reasons'
      ]
    },
    {
      capabilityId: 'dynamic-route-intelligence',
      fixture: 'nextjs-realistic',
      testFile: 'dynamic-route-findings-realistic.test.js',
      testName: 'Dynamic Route Findings - unverifiable route skip',
      expectedAssertions: [
        'Unverifiable routes are skipped, not reported as failures',
        'Skip reasons are documented and visible in artifacts',
        'Evidence Law is enforced for CONFIRMED findings',
        'learn.json includes skip reasons for unverifiable routes'
      ]
    },
    {
      capabilityId: 'dynamic-route-intelligence',
      fixture: 'react-realistic',
      testFile: 'dynamic-route-intelligence.test.js',
      testName: 'Dynamic Route Intelligence from realistic React fixture',
      expectedAssertions: [
        'React Router dynamic routes are classified correctly',
        'Route classification includes verifiability status',
        'Evidence includes complete route classification data'
      ]
    },
    {
      capabilityId: 'dynamic-route-intelligence',
      fixture: 'vue-realistic',
      testFile: 'dynamic-route-intelligence.test.js',
      testName: 'Dynamic Route Intelligence from realistic Vue fixture',
      expectedAssertions: [
        'Vue Router dynamic routes are classified correctly',
        'Route classification includes verifiability status',
        'Evidence includes complete route classification data'
      ]
    },
    {
      capabilityId: 'dynamic-route-intelligence',
      fixture: 'nextjs-realistic',
      testFile: 'determinism.integration.test.js',
      testName: 'dynamic-route-intelligence determinism proof',
      expectedAssertions: [
        'Determinism check passes with DETERMINISTIC verdict',
        'learn.json route classifications are identical across multiple runs',
        'Route intelligence results are stable and deterministic'
      ]
    }
  ],

  // NETWORK CAPABILITIES
  'network-detection-top-level': [
    {
      capabilityId: 'network-detection-top-level',
      fixture: 'react-action-app',
      testFile: 'ast-network-detection.test.js',
      testName: 'network calls at top-level are detected',
      expectedAssertions: [
        'learn.json contains network action contracts',
        'learn.json expectations have type network or network_action',
        'learn.json expectations include target (URL), method, context, and sourceRef',
        'fetch/axios calls are extracted with URLs and methods',
        'Context includes component or module name',
        'Evidence packages include trigger (AST source snippet) and action context'
      ]
    },
    {
      capabilityId: 'network-detection-top-level',
      fixture: 'react-realistic',
      testFile: 'ast-network-detection.test.js',
      testName: 'top-level network detection from realistic fixture',
      expectedAssertions: [
        'learn.json contains network expectations from component top-level',
        'Network expectations have proof: PROVEN_EXPECTATION for static URLs',
        'Evidence includes complete source references'
      ]
    },
    {
      capabilityId: 'network-detection-top-level',
      fixture: 'react-action-app',
      testFile: 'determinism.integration.test.js',
      testName: 'network-detection-top-level determinism proof',
      expectedAssertions: [
        'Determinism check passes with DETERMINISTIC verdict',
        'learn.json is identical across multiple runs',
        'Network expectations are stable and deterministic'
      ]
    }
  ],

  'network-detection-handler': [
    {
      capabilityId: 'network-detection-handler',
      fixture: 'react-action-app',
      testFile: 'ast-network-detection.test.js',
      testName: 'network calls in onClick handlers are detected',
      expectedAssertions: [
        'learn.json contains network action contracts from event handlers',
        'learn.json expectations have type network or network_action',
        'learn.json expectations include target (URL), method, context (handler name/event type), and sourceRef',
        'Network calls inside event handlers are detected',
        'Context includes handler function name or onClick',
        'URL and method are extracted correctly',
        'Evidence packages include trigger (AST source snippet) and action (interaction trace)'
      ]
    },
    {
      capabilityId: 'network-detection-handler',
      fixture: 'cross-file-action-app',
      testFile: 'ast-network-integration.test.js',
      testName: 'network calls in cross-file handlers are detected',
      expectedAssertions: [
        'Network calls in imported handler functions are detected',
        'Source file references are preserved',
        'learn.json contains complete evidence with cross-file context'
      ]
    },
    {
      capabilityId: 'network-detection-handler',
      fixture: 'static-realistic',
      testFile: 'static-html.lock.test.js',
      testName: 'handler network detection from realistic fixture',
      expectedAssertions: [
        'learn.json contains network expectations from button/form handlers',
        'Network expectations have proof: PROVEN_EXPECTATION for static URLs',
        'Evidence includes handler context and source references'
      ]
    },
    {
      capabilityId: 'network-detection-handler',
      fixture: 'react-action-app',
      testFile: 'determinism.integration.test.js',
      testName: 'network-detection-handler determinism proof',
      expectedAssertions: [
        'Determinism check passes with DETERMINISTIC verdict',
        'learn.json is identical across multiple runs',
        'Network expectations are stable and deterministic'
      ]
    }
  ],

  'network-detection-useeffect': [
    {
      capabilityId: 'network-detection-useeffect',
      fixture: 'react-action-app',
      testFile: 'ast-network-detection.test.js',
      testName: 'network calls in useEffect are detected',
      expectedAssertions: [
        'learn.json contains network action contracts from useEffect hooks',
        'learn.json expectations have type network or network_action',
        'learn.json expectations include target (URL), method, context (useEffect), and sourceRef',
        'Network calls inside useEffect hooks are detected',
        'Context includes useEffect identifier',
        'Dependency arrays are considered',
        'Evidence packages include trigger (AST source snippet) and component context'
      ]
    },
    {
      capabilityId: 'network-detection-useeffect',
      fixture: 'react-realistic',
      testFile: 'ast-network-detection.test.js',
      testName: 'useEffect network detection from realistic fixture',
      expectedAssertions: [
        'learn.json contains network expectations from useEffect hooks',
        'Network expectations have proof: PROVEN_EXPECTATION for static URLs',
        'Evidence includes useEffect dependency information'
      ]
    },
    {
      capabilityId: 'network-detection-useeffect',
      fixture: 'react-action-app',
      testFile: 'determinism.integration.test.js',
      testName: 'network-detection-useeffect determinism proof',
      expectedAssertions: [
        'Determinism check passes with DETERMINISTIC verdict',
        'learn.json is identical across multiple runs',
        'Network expectations are stable and deterministic'
      ]
    }
  ],

  'network-silent-failure': [
    {
      capabilityId: 'network-silent-failure',
      fixture: 'static-realistic',
      testFile: 'static-html.lock.test.js',
      testName: 'network silent failures are detected with complete evidence',
      expectedAssertions: [
        'learn.json contains network expectations from fetch/axios calls in handlers',
        'findings.json contains network_silent_failure entries with CONFIRMED severity',
        'findings.json entries have evidencePackage with trigger, before, after, signals, and justification',
        'evidencePackage.signals.network contains failedRequests and topFailedUrls',
        'evidencePackage.signals.uiSignals.changed is false for silent failures',
        'Confidence level is computed based on evidence completeness',
        'Analytics beacons and background polling are NOT reported (false-positive guardrails applied)',
        'Network success + no UI feedback is SUSPECTED, not CONFIRMED (guardrails applied)',
        'Optimistic UI and retry logic cases are reported with MEDIUM confidence'
      ]
    },
    {
      capabilityId: 'network-silent-failure',
      fixture: 'react-realistic',
      testFile: 'static-html.lock.test.js',
      testName: 'network silent failures in React components are detected',
      expectedAssertions: [
        'learn.json contains network expectations from React component handlers',
        'findings.json contains network_silent_failure entries with complete evidence',
        'Evidence packages include network request details and UI feedback signals'
      ]
    },
    {
      capabilityId: 'network-silent-failure',
      fixture: 'static-realistic',
      testFile: 'determinism.integration.test.js',
      testName: 'network-silent-failure determinism proof',
      expectedAssertions: [
        'Determinism check passes with DETERMINISTIC verdict',
        'findings.json is identical across multiple runs',
        'Evidence packages are stable and deterministic'
      ]
    }
  ],

  'network-request-observation': [
    {
      capabilityId: 'network-request-observation',
      fixture: 'network-ok',
      testFile: 'ast-network-integration.test.js',
      testName: 'actual network requests are observed during execution',
      expectedAssertions: [
        'traces.jsonl contains network sensor data',
        'traces.jsonl sensors.network includes requests map with URL, method, status, timing',
        'traces.jsonl sensors.network includes failedRequests and successfulRequests arrays',
        'traces.jsonl sensors.network includes totalRequests count and topFailedUrls',
        'Network requests are captured with URLs, methods, status codes',
        'Request timing is recorded',
        'Evidence packages include network signals from observed requests'
      ]
    },
    {
      capabilityId: 'network-request-observation',
      fixture: 'static-realistic',
      testFile: 'static-html.lock.test.js',
      testName: 'network request observation from realistic fixture',
      expectedAssertions: [
        'traces.jsonl contains network sensor data from realistic interactions',
        'Observed network requests match expected network calls',
        'Network sensor data includes complete request/response details'
      ]
    },
    {
      capabilityId: 'network-request-observation',
      fixture: 'network-ok',
      testFile: 'determinism.integration.test.js',
      testName: 'network-request-observation determinism proof',
      expectedAssertions: [
        'Determinism check passes with DETERMINISTIC verdict',
        'traces.jsonl is identical across multiple runs',
        'Network sensor data is stable and deterministic'
      ]
    }
  ],

  // STATE CAPABILITIES
  'state-detection-usestate': [
    {
      capabilityId: 'state-detection-usestate',
      fixture: 'react-state-toggle',
      testFile: 'ast-usestate-detection.test.js',
      testName: 'useState hooks are detected and promises extracted',
      expectedAssertions: [
        'learn.json contains state action contracts from useState',
        'learn.json expectations have type state_action or state',
        'learn.json expectations include expectedTarget (state variable name), context, sourceRef, and proof',
        'learn.json expectations include metadata.jsxUsage count for user-visible state',
        'State name, setter name, and component are extracted',
        'JSX usage is detected and counted',
        'Only state used in JSX/template bindings creates expectations',
        'Evidence packages include trigger (AST source snippet) and action context'
      ]
    },
    {
      capabilityId: 'state-detection-usestate',
      fixture: 'react-realistic',
      testFile: 'ast-usestate-detection.test.js',
      testName: 'useState detection from realistic React fixture',
      expectedAssertions: [
        'learn.json contains state expectations from useState hooks',
        'State expectations have proof: PROVEN_EXPECTATION for JSX-bound state',
        'Evidence includes complete source references and JSX usage counts'
      ]
    },
    {
      capabilityId: 'state-detection-usestate',
      fixture: 'react-state-toggle',
      testFile: 'determinism.integration.test.js',
      testName: 'state-detection-usestate determinism proof',
      expectedAssertions: [
        'Determinism check passes with DETERMINISTIC verdict',
        'learn.json is identical across multiple runs',
        'State expectations are stable and deterministic'
      ]
    }
  ],

  'state-detection-redux': [
    {
      capabilityId: 'state-detection-redux',
      fixture: 'redux-dispatch-toggle',
      testFile: 'state-contracts.test.js',
      testName: 'Redux dispatch calls are detected',
      expectedAssertions: [
        'learn.json contains state action contracts from Redux',
        'learn.json expectations have type state_action or state',
        'learn.json expectations include expectedTarget (action type or state key), context, sourceRef, and proof',
        'learn.json expectations include metadata.actionType for Redux actions',
        'Dispatch calls are extracted with action types',
        'Store references are identified',
        'Only user-visible actions create expectations',
        'Evidence packages include trigger (AST source snippet) and action context'
      ]
    },
    {
      capabilityId: 'state-detection-redux',
      fixture: 'redux-simple',
      testFile: 'state-contracts.test.js',
      testName: 'Redux store mutations are detected',
      expectedAssertions: [
        'State mutations are extracted from Redux code',
        'Action creators are identified',
        'Evidence includes complete Redux action and dispatch context'
      ]
    },
    {
      capabilityId: 'state-detection-redux',
      fixture: 'react-realistic',
      testFile: 'state-contracts.test.js',
      testName: 'Redux detection from realistic React fixture',
      expectedAssertions: [
        'learn.json contains state expectations from Redux dispatch calls',
        'State expectations have proof: PROVEN_EXPECTATION for user-visible actions',
        'Evidence includes complete source references'
      ]
    },
    {
      capabilityId: 'state-detection-redux',
      fixture: 'redux-dispatch-toggle',
      testFile: 'determinism.integration.test.js',
      testName: 'state-detection-redux determinism proof',
      expectedAssertions: [
        'Determinism check passes with DETERMINISTIC verdict',
        'learn.json is identical across multiple runs',
        'State expectations are stable and deterministic'
      ]
    }
  ],

  'state-detection-zustand': [
    {
      capabilityId: 'state-detection-zustand',
      fixture: 'zustand-set',
      testFile: 'state-contracts.test.js',
      testName: 'Zustand store mutations are detected',
      expectedAssertions: [
        'learn.json contains state action contracts from Zustand',
        'learn.json expectations have type state_action or state',
        'learn.json expectations include expectedTarget (state key), context, sourceRef, and proof',
        'learn.json expectations include metadata.stateKey for Zustand state keys',
        'Store set calls are extracted',
        'State keys are identified',
        'Only user-visible state keys create expectations',
        'Evidence packages include trigger (AST source snippet) and action context'
      ]
    },
    {
      capabilityId: 'state-detection-zustand',
      fixture: 'react-realistic',
      testFile: 'state-contracts.test.js',
      testName: 'Zustand detection from realistic React fixture',
      expectedAssertions: [
        'learn.json contains state expectations from Zustand set() calls',
        'State expectations have proof: PROVEN_EXPECTATION for user-visible state keys',
        'Evidence includes complete source references'
      ]
    },
    {
      capabilityId: 'state-detection-zustand',
      fixture: 'zustand-set',
      testFile: 'determinism.integration.test.js',
      testName: 'state-detection-zustand determinism proof',
      expectedAssertions: [
        'Determinism check passes with DETERMINISTIC verdict',
        'learn.json is identical across multiple runs',
        'State expectations are stable and deterministic'
      ]
    }
  ],

  'state-mutation-observation': [
    {
      capabilityId: 'state-mutation-observation',
      fixture: 'react-state-toggle',
      testFile: 'ast-usestate-integration.test.js',
      testName: 'state mutations are observed during execution',
      expectedAssertions: [
        'traces.jsonl contains state sensor data',
        'traces.jsonl sensors.state includes available boolean, type (redux/zustand/null), and changed array',
        'traces.jsonl sensors.state includes before and after state snapshots (keys only, values redacted)',
        'State changes are captured with before/after values',
        'State keys are tracked',
        'Evidence packages include state signals from observed mutations'
      ]
    },
    {
      capabilityId: 'state-mutation-observation',
      fixture: 'react-realistic',
      testFile: 'ast-usestate-integration.test.js',
      testName: 'state mutation observation from realistic React fixture',
      expectedAssertions: [
        'traces.jsonl contains state sensor data from realistic interactions',
        'Observed state mutations match expected state changes',
        'State sensor data includes complete mutation details'
      ]
    },
    {
      capabilityId: 'state-mutation-observation',
      fixture: 'react-state-toggle',
      testFile: 'determinism.integration.test.js',
      testName: 'state-mutation-observation determinism proof',
      expectedAssertions: [
        'Determinism check passes with DETERMINISTIC verdict',
        'traces.jsonl is identical across multiple runs',
        'State sensor data is stable and deterministic'
      ]
    }
  ],

  'state-silent-failure': [
    {
      capabilityId: 'state-silent-failure',
      fixture: 'redux-silent-fixture',
      testFile: 'state-contracts.test.js',
      testName: 'state mutations that fail silently are detected',
      expectedAssertions: [
        'findings.json contains state_silent_failure entries',
        'findings.json entries have CONFIRMED severity when state mutation fails and no UI feedback',
        'findings.json entries have SUSPECTED severity when state mutation succeeds but no UI feedback',
        'Evidence includes expected vs observed state changes',
        'Evidence packages include trigger (AST source snippet), before/after state snapshots, UI feedback signals, and action trace',
        'UI state sensor data is included',
        'Guardrails prevent false positives from cosmetic/background state and optimistic UI'
      ]
    },
    {
      capabilityId: 'state-silent-failure',
      fixture: 'react-realistic',
      testFile: 'state-contracts.test.js',
      testName: 'state silent failure from realistic React fixture',
      expectedAssertions: [
        'findings.json contains state findings from realistic interactions',
        'State findings include complete evidence packages',
        'Evidence includes state mutation status and UI feedback correlation'
      ]
    },
    {
      capabilityId: 'state-silent-failure',
      fixture: 'forms-heavy',
      testFile: 'state-contracts.test.js',
      testName: 'state silent failure from forms-heavy fixture',
      expectedAssertions: [
        'findings.json contains state findings from form interactions',
        'State findings include form state mutations and UI feedback',
        'Evidence includes complete state mutation and UI correlation data'
      ]
    },
    {
      capabilityId: 'state-silent-failure',
      fixture: 'redux-silent-fixture',
      testFile: 'determinism.integration.test.js',
      testName: 'state-silent-failure determinism proof',
      expectedAssertions: [
        'Determinism check passes with DETERMINISTIC verdict',
        'findings.json is identical across multiple runs',
        'State findings are stable and deterministic'
      ]
    },
    {
      capabilityId: 'state-detection-redux',
      fixture: 'react-realistic',
      testFile: 'determinism.integration.test.js',
      testName: 'state-detection-redux determinism proof',
      expectedAssertions: [
        'Determinism check passes with DETERMINISTIC verdict',
        'learn.json is identical across multiple runs',
        'State expectations are stable and deterministic'
      ]
    },
    {
      capabilityId: 'state-detection-zustand',
      fixture: 'react-realistic',
      testFile: 'determinism.integration.test.js',
      testName: 'state-detection-zustand determinism proof',
      expectedAssertions: [
        'Determinism check passes with DETERMINISTIC verdict',
        'learn.json is identical across multiple runs',
        'State expectations are stable and deterministic'
      ]
    },
    {
      capabilityId: 'state-mutation-observation',
      fixture: 'react-realistic',
      testFile: 'determinism.integration.test.js',
      testName: 'state-mutation-observation determinism proof',
      expectedAssertions: [
        'Determinism check passes with DETERMINISTIC verdict',
        'traces.jsonl is identical across multiple runs',
        'State sensor data is stable and deterministic'
      ]
    }
  ],

  // UI FEEDBACK CAPABILITIES
  'ui-feedback-loading': [
    {
      capabilityId: 'ui-feedback-loading',
      fixture: 'good-loading',
      testFile: 'ui-feedback-detection.test.js',
      testName: 'loading indicators are detected',
      expectedAssertions: [
        'traces.jsonl contains UI feedback signals for loading',
        'traces.jsonl sensors.uiSignals includes hasLoadingIndicator boolean',
        'traces.jsonl sensors.uiSignals includes loadingStateChanged boolean',
        'traces.jsonl sensors.uiSignals includes explanation array',
        'Loading indicators (spinners, progress bars) are detected',
        'aria-busy attributes are captured',
        'Evidence packages include loading feedback signals'
      ]
    },
    {
      capabilityId: 'ui-feedback-loading',
      fixture: 'loading-indicator',
      testFile: 'ui-feedback-integration.test.js',
      testName: 'loading states are observed during async operations',
      expectedAssertions: [
        'Loading indicators appear and disappear',
        'UI feedback sensor captures loading state transitions',
        'Evidence packages include loading state change signals'
      ]
    },
    {
      capabilityId: 'ui-feedback-loading',
      fixture: 'static-realistic',
      testFile: 'ui-feedback-detection.test.js',
      testName: 'loading detection from realistic fixture',
      expectedAssertions: [
        'traces.jsonl contains loading signals from realistic interactions',
        'Loading detection includes complete signal data',
        'Evidence includes loading state transitions'
      ]
    },
    {
      capabilityId: 'ui-feedback-loading',
      fixture: 'good-loading',
      testFile: 'determinism.integration.test.js',
      testName: 'ui-feedback-loading determinism proof',
      expectedAssertions: [
        'Determinism check passes with DETERMINISTIC verdict',
        'traces.jsonl is identical across multiple runs',
        'Loading signals are stable and deterministic'
      ]
    }
  ],

  'ui-feedback-css-spinner': [
    {
      capabilityId: 'ui-feedback-css-spinner',
      fixture: 'css-loading-realistic',
      testFile: 'css-loading-feedback-capability.test.js',
      testName: 'CSS spinner detection truth boundary and correlation',
      expectedAssertions: [
        'Border spinner pattern is detected (border + border-top different color, circular)',
        'Rotation animation spinner is detected (transform: rotate, animation)',
        'Pulse animation spinner is detected (opacity pulse, scale animation)',
        'Decorative elements (too large, always present) are rejected',
        'Elements outside size bounds (too small <8px, too large >100px) are rejected',
        'Spinners without corroborating signals are marked SUSPECTED (REJECTED_NO_CORROBORATION)',
        'Spinners with 2+ signals (spinner + disabled button OR pointer-events) are CONFIRMED (ACCEPTED_WITH_CORROBORATION)',
        'Evidence packages include cssSpinners array with type, reasonCode, elementId, width, height',
        'Evidence packages include cssSpinnerReasonCode explaining detection decision',
        'traces.jsonl contains uiSignals.after.cssSpinnerDetected boolean',
        'Determinism: CSS spinner detection produces identical results across runs'
      ]
    },
    {
      capabilityId: 'ui-feedback-css-spinner',
      fixture: 'css-loading-realistic',
      testFile: 'css-loading-feedback-capability.test.js',
      testName: 'CSS spinner false positive prevention',
      expectedAssertions: [
        'Decorative rotating icon (always present, large) is NOT detected as spinner',
        'Elements with semantic attributes (aria-busy, data-loading) are skipped (handled by ui-feedback-loading)',
        'Guardrails prevent "feedback missing" when CSS spinner feedback is present'
      ]
    },
    {
      capabilityId: 'ui-feedback-css-spinner',
      fixture: 'css-loading-realistic',
      testFile: 'determinism.integration.test.js',
      testName: 'ui-feedback-css-spinner determinism proof',
      expectedAssertions: [
        'Determinism check passes with DETERMINISTIC verdict',
        'learn.json is identical across multiple runs',
        'CSS spinner detection results are stable and deterministic',
        'findings.json is identical across multiple runs'
      ]
    }
  ],

  'ui-feedback-disabled': [
    {
      capabilityId: 'ui-feedback-disabled',
      fixture: 'slow-action',
      testFile: 'ui-feedback-integration.test.js',
      testName: 'button disabled state changes are detected',
      expectedAssertions: [
        'traces.jsonl contains button state transitions',
        'traces.jsonl sensors.uiSignals includes disabledElements array',
        'traces.jsonl sensors.uiSignals includes disabledButtonsChanged boolean',
        'traces.jsonl sensors.uiSignals includes explanation array',
        'Disabled state changes are captured',
        'Button state sensor tracks enabled/disabled',
        'Evidence packages include disabled state feedback signals'
      ]
    },
    {
      capabilityId: 'ui-feedback-disabled',
      fixture: 'forms-heavy',
      testFile: 'ui-feedback-integration.test.js',
      testName: 'disabled state detection from realistic fixture',
      expectedAssertions: [
        'traces.jsonl contains disabled state signals from form interactions',
        'Disabled state detection includes complete signal data',
        'Evidence includes disabled state transitions'
      ]
    },
    {
      capabilityId: 'ui-feedback-disabled',
      fixture: 'slow-action',
      testFile: 'determinism.integration.test.js',
      testName: 'ui-feedback-disabled determinism proof',
      expectedAssertions: [
        'Determinism check passes with DETERMINISTIC verdict',
        'traces.jsonl is identical across multiple runs',
        'Disabled state signals are stable and deterministic'
      ]
    }
  ],

  'ui-feedback-toast': [
    {
      capabilityId: 'ui-feedback-toast',
      fixture: 'multi-signal',
      testFile: 'ui-feedback-integration.test.js',
      testName: 'toast notifications are detected',
      expectedAssertions: [
        'traces.jsonl contains notification signals',
        'traces.jsonl sensors.uiSignals includes hasStatusSignal boolean',
        'traces.jsonl sensors.uiSignals includes hasLiveRegion boolean',
        'traces.jsonl sensors.uiSignals includes statusSignalChanged boolean',
        'traces.jsonl sensors.uiSignals includes explanation array',
        'Toast messages are detected via role=alert or live regions',
        'Notification content is captured',
        'Evidence packages include toast notification signals'
      ]
    },
    {
      capabilityId: 'ui-feedback-toast',
      fixture: 'static-realistic',
      testFile: 'ui-feedback-integration.test.js',
      testName: 'toast detection from realistic fixture',
      expectedAssertions: [
        'traces.jsonl contains toast signals from realistic interactions',
        'Toast detection includes complete signal data',
        'Evidence includes toast notification presence'
      ]
    },
    {
      capabilityId: 'ui-feedback-toast',
      fixture: 'multi-signal',
      testFile: 'determinism.integration.test.js',
      testName: 'ui-feedback-toast determinism proof',
      expectedAssertions: [
        'Determinism check passes with DETERMINISTIC verdict',
        'traces.jsonl is identical across multiple runs',
        'Toast signals are stable and deterministic'
      ]
    }
  ],

  'ui-feedback-dom-change': [
    {
      capabilityId: 'ui-feedback-dom-change',
      fixture: 'async-partial-failure',
      testFile: 'ui-feedback-integration.test.js',
      testName: 'meaningful DOM changes are detected',
      expectedAssertions: [
        'traces.jsonl contains DOM change signals',
        'traces.jsonl sensors.uiSignals includes changed boolean',
        'traces.jsonl sensors.uiSignals includes domChange object with change details',
        'traces.jsonl sensors.uiSignals includes explanation array',
        'Element additions and text changes are detected',
        'Viewport changes are tracked',
        'Evidence packages include DOM change feedback signals'
      ]
    },
    {
      capabilityId: 'ui-feedback-dom-change',
      fixture: 'react-realistic',
      testFile: 'ui-feedback-integration.test.js',
      testName: 'DOM change detection from realistic fixture',
      expectedAssertions: [
        'traces.jsonl contains DOM change signals from realistic interactions',
        'DOM change detection includes complete signal data',
        'Evidence includes DOM change details'
      ]
    },
    {
      capabilityId: 'ui-feedback-dom-change',
      fixture: 'async-partial-failure',
      testFile: 'determinism.integration.test.js',
      testName: 'ui-feedback-dom-change determinism proof',
      expectedAssertions: [
        'Determinism check passes with DETERMINISTIC verdict',
        'traces.jsonl is identical across multiple runs',
        'DOM change signals are stable and deterministic'
      ]
    }
  ],

  'ui-feedback-missing': [
    {
      capabilityId: 'ui-feedback-missing',
      fixture: 'static-realistic',
      testFile: 'static-html.lock.test.js',
      testName: 'ui feedback missing cases are detected with complete evidence',
      expectedAssertions: [
        'observe.json contains uiSignals data showing absence of feedback',
        'findings.json contains ui_feedback_missing entries with CONFIRMED severity',
        'findings.json entries have evidencePackage with trigger, before, after, signals, and justification',
        'evidencePackage.signals.uiSignals.changed is false for missing feedback cases',
        'evidencePackage.signals.uiFeedback.overallUiFeedbackScore is low (< 0.3) for missing feedback',
        'Confidence level is computed based on evidence completeness',
        'Loading indicators, toasts, and DOM changes present prevent CONFIRMED findings (guardrails applied)',
        'Delayed feedback and partial DOM changes are reported with MEDIUM confidence',
        'Validation feedback presence blocks silent failure claims (guardrails applied)'
      ]
    },
    {
      capabilityId: 'ui-feedback-missing',
      fixture: 'react-realistic',
      testFile: 'static-html.lock.test.js',
      testName: 'ui feedback missing in React components is detected',
      expectedAssertions: [
        'observe.json contains uiSignals data from React component interactions',
        'findings.json contains ui_feedback_missing entries with complete evidence',
        'Evidence packages include UI feedback signals and DOM change comparisons'
      ]
    },
    {
      capabilityId: 'ui-feedback-missing',
      fixture: 'static-realistic',
      testFile: 'determinism.integration.test.js',
      testName: 'ui-feedback-missing determinism proof',
      expectedAssertions: [
        'Determinism check passes with DETERMINISTIC verdict',
        'findings.json is identical across multiple runs',
        'Evidence packages are stable and deterministic'
      ]
    }
  ],

  'ui-feedback-intelligence': [
    {
      capabilityId: 'ui-feedback-intelligence',
      fixture: 'network-failure',
      testFile: 'ui-feedback-intelligence.test.js',
      testName: 'UI Feedback Intelligence - network failure no feedback',
      expectedAssertions: [
        'Feedback signals are detected from trace sensors',
        'Feedback scoring produces CONFIRMED/MISSING/AMBIGUOUS',
        'Promise-feedback correlation identifies silent failures',
        'findings.json contains ui_feedback_missing entries with CONFIRMED severity when feedback is missing',
        'findings.json entries have evidencePackage with trigger, before, after, signals, and justification',
        'evidencePackage.signals.uiFeedback.overallUiFeedbackScore is low (< 0.3) for missing feedback',
        'Evidence includes before/after screenshots and signals',
        'Guardrails prevent false positives when feedback is present'
      ]
    },
    {
      capabilityId: 'ui-feedback-intelligence',
      fixture: 'feedback-gap-no-feedback',
      testFile: 'ui-feedback-realistic.test.js',
      testName: 'UI Feedback Findings - network failure no feedback',
      expectedAssertions: [
        'Network failures without feedback are detected',
        'Findings include complete evidence',
        'Evidence Law is enforced',
        'Confidence scores are computed based on evidence completeness'
      ]
    },
    {
      capabilityId: 'ui-feedback-intelligence',
      fixture: 'loading-indicator',
      testFile: 'ui-feedback-realistic.test.js',
      testName: 'UI Feedback Findings - loading indicator present',
      expectedAssertions: [
        'Loading indicators prevent false positives',
        'Feedback presence is correctly scored',
        'No CONFIRMED findings when feedback is present (guardrails applied)'
      ]
    },
    {
      capabilityId: 'ui-feedback-intelligence',
      fixture: 'static-realistic',
      testFile: 'ui-feedback-intelligence.test.js',
      testName: 'UI feedback intelligence from realistic fixture',
      expectedAssertions: [
        'findings.json contains UI feedback findings with complete evidence',
        'Evidence packages include UI feedback signals and promise correlation',
        'Guardrails prevent false positives from delayed/partial feedback'
      ]
    },
    {
      capabilityId: 'ui-feedback-intelligence',
      fixture: 'network-failure',
      testFile: 'determinism.integration.test.js',
      testName: 'ui-feedback-intelligence determinism proof',
      expectedAssertions: [
        'Determinism check passes with DETERMINISTIC verdict',
        'findings.json is identical across multiple runs',
        'UI feedback intelligence results are stable and deterministic'
      ]
    }
  ],

  // VALIDATION CAPABILITIES
  'validation-feedback-detection': [
    {
      capabilityId: 'validation-feedback-detection',
      fixture: 'validation-visible',
      testFile: 'ui-feedback-integration.test.js',
      testName: 'form validation feedback is detected',
      expectedAssertions: [
        'traces.jsonl contains validation feedback signals',
        'traces.jsonl sensors.uiSignals includes validationFeedbackDetected boolean',
        'traces.jsonl sensors.uiSignals includes validationFeedbackChanged boolean',
        'traces.jsonl sensors.uiSignals includes explanation array',
        'Error messages and visual indicators are detected',
        'Validation state is captured',
        'Evidence packages include validation feedback signals'
      ]
    },
    {
      capabilityId: 'validation-feedback-detection',
      fixture: 'forms-heavy',
      testFile: 'ui-feedback-integration.test.js',
      testName: 'validation feedback detection from realistic fixture',
      expectedAssertions: [
        'traces.jsonl contains validation signals from form interactions',
        'Validation detection includes complete signal data',
        'Evidence includes validation feedback presence'
      ]
    },
    {
      capabilityId: 'validation-feedback-detection',
      fixture: 'validation-visible',
      testFile: 'determinism.integration.test.js',
      testName: 'validation-feedback-detection determinism proof',
      expectedAssertions: [
        'Determinism check passes with DETERMINISTIC verdict',
        'traces.jsonl is identical across multiple runs',
        'Validation signals are stable and deterministic'
      ]
    }
  ],

  'validation-silent-failure': [
    {
      capabilityId: 'validation-silent-failure',
      fixture: 'validation-silent',
      testFile: 'ui-feedback-integration.test.js',
      testName: 'validation that should block but does not is detected',
      expectedAssertions: [
        'findings.json contains validation_block findings',
        'findings.json entries have CONFIRMED severity when validation should block but does not',
        'findings.json entries have evidencePackage with trigger, before, after, signals, and justification',
        'evidencePackage.signals.uiSignals.validationFeedbackDetected is false for silent validation failures',
        'Invalid form submissions that proceed are reported',
        'Evidence includes validation state',
        'Guardrails prevent false positives when validation feedback is present'
      ]
    },
    {
      capabilityId: 'validation-silent-failure',
      fixture: 'forms-heavy',
      testFile: 'ui-feedback-integration.test.js',
      testName: 'validation silent failure from realistic fixture',
      expectedAssertions: [
        'findings.json contains validation findings with complete evidence',
        'Evidence packages include validation feedback signals and form submission details',
        'Guardrails prevent false positives from validation feedback presence'
      ]
    },
    {
      capabilityId: 'validation-silent-failure',
      fixture: 'validation-silent',
      testFile: 'determinism.integration.test.js',
      testName: 'validation-silent-failure determinism proof',
      expectedAssertions: [
        'Determinism check passes with DETERMINISTIC verdict',
        'findings.json is identical across multiple runs',
        'Validation findings are stable and deterministic'
      ]
    }
  ],

  // CONFIDENCE CAPABILITIES
  'confidence-unified-system': [
    {
      capabilityId: 'confidence-unified-system',
      fixture: 'network-failure',
      testFile: 'confidence-system.test.js',
      testName: 'Confidence System - determinism',
      expectedAssertions: [
        'Same inputs produce identical confidence scores and reasons',
        'Confidence scores are normalized to 0..1',
        'Confidence levels are HIGH/MEDIUM/LOW/UNPROVEN',
        'Reason codes are stable and deterministic',
        'findings.json entries include confidence number (0-1)',
        'findings.json entries include confidenceLevel string',
        'findings.json entries include confidenceReasons array'
      ]
    },
    {
      capabilityId: 'confidence-unified-system',
      fixture: 'react-realistic',
      testFile: 'confidence-integration.test.js',
      testName: 'Confidence Integration - route findings have unified confidence',
      expectedAssertions: [
        'All findings include confidence (0..1)',
        'All findings include confidenceLevel',
        'All findings include confidenceReasons array',
        'Confidence fields are present in artifacts',
        'Confidence computation is consistent across all finding types'
      ]
    },
    {
      capabilityId: 'confidence-unified-system',
      fixture: 'static-realistic',
      testFile: 'confidence-system.test.js',
      testName: 'confidence system from realistic fixture',
      expectedAssertions: [
        'findings.json contains confidence scores for all findings',
        'Confidence scores are computed based on evidence completeness',
        'Confidence reasons explain score computation'
      ]
    },
    {
      capabilityId: 'confidence-unified-system',
      fixture: 'network-failure',
      testFile: 'determinism.integration.test.js',
      testName: 'confidence-unified-system determinism proof',
      expectedAssertions: [
        'Determinism check passes with DETERMINISTIC verdict',
        'findings.json is identical across multiple runs',
        'Confidence scores are stable and deterministic'
      ]
    }
  ],

  // EVIDENCE LAW CAPABILITIES
  'evidence-law-enforcement': [
    {
      capabilityId: 'evidence-law-enforcement',
      fixture: 'static-site',
      testFile: 'artifact-verifier.test.js',
      testName: 'Evidence Law is enforced on findings',
      expectedAssertions: [
        'findings.json includes enforcement metadata',
        'findings.json includes evidenceEnforcement object with enforced, missingFields, and downgraded fields',
        'CONFIRMED findings have sufficient evidence',
        'enforcement.droppedCount and downgradedCount are tracked',
        'Evidence Law enforcement is applied to all CONFIRMED findings'
      ]
    },
    {
      capabilityId: 'evidence-law-enforcement',
      fixture: 'static-realistic',
      testFile: 'artifact-verifier.test.js',
      testName: 'evidence law enforcement from realistic fixture',
      expectedAssertions: [
        'findings.json contains enforcement metadata for all findings',
        'Evidence enforcement tracks missing evidence fields',
        'Evidence enforcement tracks downgrade decisions'
      ]
    },
    {
      capabilityId: 'evidence-law-enforcement',
      fixture: 'static-site',
      testFile: 'determinism.integration.test.js',
      testName: 'evidence-law-enforcement determinism proof',
      expectedAssertions: [
        'Determinism check passes with DETERMINISTIC verdict',
        'findings.json is identical across multiple runs',
        'Evidence enforcement results are stable and deterministic'
      ]
    }
  ],

  'evidence-substantive-check': [
    {
      capabilityId: 'evidence-substantive-check',
      fixture: 'static-site',
      testFile: 'artifact-verifier.test.js',
      testName: 'evidence is validated for substantive content',
      expectedAssertions: [
        'Evidence objects contain at least one substantive field',
        'findings.json includes evidenceValidation object with valid, invalidFields, and validationErrors fields',
        'Empty evidence objects are flagged',
        'Sensor data counts as substantive evidence',
        'Evidence validation is applied to all findings'
      ]
    },
    {
      capabilityId: 'evidence-substantive-check',
      fixture: 'static-realistic',
      testFile: 'artifact-verifier.test.js',
      testName: 'evidence substantive check from realistic fixture',
      expectedAssertions: [
        'findings.json contains validation metadata for all findings',
        'Evidence validation tracks invalid evidence fields',
        'Evidence validation tracks validation errors'
      ]
    },
    {
      capabilityId: 'evidence-substantive-check',
      fixture: 'static-site',
      testFile: 'determinism.integration.test.js',
      testName: 'evidence-substantive-check determinism proof',
      expectedAssertions: [
        'Determinism check passes with DETERMINISTIC verdict',
        'findings.json is identical across multiple runs',
        'Evidence validation results are stable and deterministic'
      ]
    }
  ],

  'evidence-downgrade-suspected': [
    {
      capabilityId: 'evidence-downgrade-suspected',
      fixture: 'static-site',
      testFile: 'artifact-verifier.test.js',
      testName: 'findings without evidence are downgraded to SUSPECTED',
      expectedAssertions: [
        'Findings marked CONFIRMED without evidence are downgraded',
        'findings.json entries include downgradeReason string when downgraded',
        'findings.json entries include originalSeverity string when downgraded',
        'enforcement.downgrades array contains downgrade records',
        'Original and downgraded status are tracked',
        'Downgrade decisions are based on evidence completeness and quality'
      ]
    },
    {
      capabilityId: 'evidence-downgrade-suspected',
      fixture: 'static-realistic',
      testFile: 'artifact-verifier.test.js',
      testName: 'evidence downgrade from realistic fixture',
      expectedAssertions: [
        'findings.json contains downgrade metadata for findings with incomplete evidence',
        'Downgrade reasons explain why findings were downgraded',
        'Original severity is preserved in downgrade metadata'
      ]
    },
    {
      capabilityId: 'evidence-downgrade-suspected',
      fixture: 'static-site',
      testFile: 'determinism.integration.test.js',
      testName: 'evidence-downgrade-suspected determinism proof',
      expectedAssertions: [
        'Determinism check passes with DETERMINISTIC verdict',
        'findings.json is identical across multiple runs',
        'Downgrade decisions are stable and deterministic'
      ]
    }
  ],

  'state-driven-view-switch': [
    {
      capabilityId: 'state-driven-view-switch',
      fixture: 'realistic/view-switch-realistic',
      testFile: 'view-switch-capability.test.js',
      testName: 'view switch promise extraction and correlation',
      expectedAssertions: [
        'learn.json contains VIEW_SWITCH_PROMISE expectations from setView, setTab, etc.',
        'VIEW_SWITCH_PROMISE expectations have target (literal), viewKind, isUrlChanging: false',
        'VIEW_SWITCH_PROMISE expectations include astSnippet for evidence',
        'Correlation produces CONFIRMED with 2+ signals, SUSPECTED with 1 signal, INFORMATIONAL when blocked',
        'findings.json contains view switch findings with correct severity and reason codes',
        'Guardrails prevent CONFIRMED on minor changes, analytics-only, and ambiguous outcomes',
        'Evidence packages include trigger AST snippet, before/after DOM signatures, screenshots, and justification',
        'traces.jsonl contains interaction traces for view switch interactions'
      ]
    },
    {
      capabilityId: 'state-driven-view-switch',
      fixture: 'realistic/view-switch-realistic',
      testFile: 'view-switch-capability.test.js',
      testName: 'view switch truth boundary (literals only)',
      expectedAssertions: [
        'StringLiteral and NumericLiteral arguments are accepted',
        'Function calls, member expressions, and identifiers are rejected',
        'Template literals with interpolation are rejected',
        'Empty template literals are accepted',
        'Only allowlisted function names match (setView, setTab, NAVIGATE, showModal, etc.)'
      ]
    },
    {
      capabilityId: 'state-driven-view-switch',
      fixture: 'realistic/view-switch-realistic',
      testFile: 'determinism.integration.test.js',
      testName: 'state-driven-view-switch determinism proof',
      expectedAssertions: [
        'Determinism check passes with DETERMINISTIC verdict',
        'learn.json is identical across multiple runs',
        'findings.json is identical across multiple runs',
        'View switch expectations and findings are stable and deterministic'
      ]
    }
  ],

  'guardrails-truth-reconciliation': [
    {
      capabilityId: 'guardrails-truth-reconciliation',
      fixture: 'static-realistic',
      testFile: 'guardrails-hardening.test.js',
      testName: 'guardrails truth reconciliation and report generation',
      expectedAssertions: [
        'Downgrade CONFIRMED -> SUSPECTED forces confidenceAfter cap (<= 0.69) + reason code present',
        'INFORMATIONAL forces confidenceAfter LOW/UNPROVEN',
        'IGNORED forces confidenceAfter UNPROVEN (0)',
        'guardrails.report.json deterministic ordering and schema',
        'guardrails.report.json perFinding entries match findings.json by findingIdentity',
        'guardrails.report.json finalDecision matches finding severity',
        'Verifier catches missing perFinding entry',
        'Integration: guardrails.report.json written + consistent with findings'
      ]
    },
    {
      capabilityId: 'guardrails-truth-reconciliation',
      fixture: 'static-realistic',
      testFile: 'determinism.integration.test.js',
      testName: 'guardrails-truth-reconciliation determinism proof',
      expectedAssertions: [
        'Determinism check passes with DETERMINISTIC verdict',
        'guardrails.report.json is identical across multiple runs',
        'Confidence reconciliation is stable and deterministic',
        'findings.json confidence levels match guardrails.report.json after reconciliation'
      ]
    }
  ],

  'confidence-engine-hardening': [
    {
      capabilityId: 'confidence-engine-hardening',
      fixture: 'static-realistic',
      testFile: 'confidence-engine-hardening.test.js',
      testName: 'confidence invariants and centralized computation',
      expectedAssertions: [
        'CONFIRMED status requires confidence >= 0.70 (invariant enforced)',
        'SUSPECTED status requires confidence in [0.30, 0.69] (invariant enforced)',
        'INFORMATIONAL status requires confidence in [0.01, 0.29] (invariant enforced)',
        'IGNORED status requires confidence === 0 (invariant enforced)',
        'UNPROVEN_EXPECTATION caps confidence at 0.39',
        'VERIFIED_WITH_ERRORS caps confidence at 0.49',
        'Guardrails downgrade overrides raw confidence',
        'confidence.report.json deterministic ordering and schema',
        'confidence.report.json perFinding entries match findings.json by findingIdentity',
        'confidence.report.json confidenceAfter matches finding confidence',
        'confidence.report.json truthStatus matches finding severity',
        'Verifier catches CONFIRMED with confidence < 0.7',
        'Verifier catches SUSPECTED with confidence >= 0.7',
        'Low-activity legitimate scenarios handled correctly',
        'UNPROVEN vs PROVEN expectations handled correctly',
        'Integration: confidence.report.json written + consistent with findings'
      ]
    },
    {
      capabilityId: 'confidence-engine-hardening',
      fixture: 'static-realistic',
      testFile: 'determinism.integration.test.js',
      testName: 'confidence-engine-hardening determinism proof',
      expectedAssertions: [
        'Determinism check passes with DETERMINISTIC verdict',
        'confidence.report.json is identical across multiple runs',
        'Confidence computation is stable and deterministic',
        'findings.json confidence values match confidence.report.json after normalization'
      ]
    }
  ],

  'determinism-hardening': [
    {
      capabilityId: 'determinism-hardening',
      fixture: 'static-realistic',
      testFile: 'determinism-hardening.test.js',
      testName: 'Determinism hardening proof',
      expectedAssertions: [
        'Deterministic fixture runs produce DETERMINISTIC verdict',
        'Expected non-determinism (adaptive events) produces NON_DETERMINISTIC_EXPECTED verdict',
        'Unexpected non-determinism (real status change) produces NON_DETERMINISTIC_UNEXPECTED verdict',
        'runFingerprint is stable across deterministic runs',
        'determinism.report.json is generated with correct verdict and diffs',
        'determinism.contract.json is generated with adaptive/retry events',
        'All artifacts (including new ones) are normalized correctly for comparison',
        'CLI integration for --determinism works as expected',
        'Verifier catches VERIFIED_WITH_ERRORS in determinism mode'
      ]
    },
    {
      capabilityId: 'determinism-hardening',
      fixture: 'static-realistic',
      testFile: 'determinism.integration.test.js',
      testName: 'determinism-hardening integration proof',
      expectedAssertions: [
        'Determinism check passes with DETERMINISTIC verdict',
        'determinism.contract.json is identical across multiple runs',
        'run.meta.json includes stable runFingerprint',
        'All artifacts are normalized and compared correctly'
      ]
    }
  ],

  'security-baseline-enforcement': [
    {
      capabilityId: 'security-baseline-enforcement',
      fixture: 'static-realistic',
      testFile: 'enterprise-readiness.test.js',
      testName: 'Security baseline enforcement',
      expectedAssertions: [
        'security:check produces security.report.json artifact with deterministic ordering',
        'security.report.json artifact includes secretsReport, vulnReport, supplyChainReport',
        'security.report.json artifact has stable reason codes',
        'OSV scanner availability is handled gracefully (OK, NOT_AVAILABLE, ERROR)',
        'Security findings appear in run.status.json artifact when applicable',
        'Verifier validates security.report.json artifact schema'
      ]
    }
  ],

  'ga-release-readiness': [
    {
      capabilityId: 'ga-release-readiness',
      fixture: 'static-realistic',
      testFile: 'enterprise-readiness.test.js',
      testName: 'GA readiness evaluation',
      expectedAssertions: [
        'ga command produces ga.report.json artifact with stable failure codes',
        'ga.report.json artifact includes gaReady, blockers, warnings, summary',
        'GA fails if gates fail (simulated)',
        'GA passes if gates pass (mocked)',
        'GA requires security:check PASS or NOT_AVAILABLE (if policy allows)',
        'Verifier validates ga.report.json artifact schema',
        'release.report.json artifact is produced by release:check command'
      ]
    }
  ],

  'enterprise-operational-guarantees': [
    {
      capabilityId: 'enterprise-operational-guarantees',
      fixture: 'static-realistic',
      testFile: 'enterprise-readiness.test.js',
      testName: 'Operational guarantees proof',
      expectedAssertions: [
        'CLI module loading regression tests pass',
        'All commands support --json output with stable event codes',
        'Never silent failure rule: internal errors recorded in failure ledger or run.status.json artifact',
        'Security/release/ga commands follow never silent failure rule',
        'Evidence includes artifact validation and error recording'
      ]
    }
  ],

  'performance-budget-clarity': [
    {
      capabilityId: 'performance-budget-clarity',
      fixture: 'static-realistic',
      testFile: 'enterprise-readiness.test.js',
      testName: 'Performance budget clarity',
      expectedAssertions: [
        'performance.report.json artifact includes scan budget config',
        'performance.report.json artifact includes actual pages visited, network requests observed',
        'performance.report.json artifact includes time spent per stage (from pipeline tracker)',
        'performance.report.json artifact includes memory usage snapshot',
        'Verifier checks performance artifact schema and consistency',
        'Performance report artifact is normalized deterministically',
        'determinism.integration.test.js covers performance.report.json artifact normalization'
      ]
    }
  ]
};

/**
 * Get all test entries for a capability
 * @param {string} capabilityId
 * @returns {TestMatrixEntry[]}
 */
export function getTestEntries(capabilityId) {
  return TEST_MATRIX[capabilityId] || [];
}

/**
 * Get all capabilities that have test entries
 * @returns {string[]}
 */
export function getTestedCapabilities() {
  return Object.keys(TEST_MATRIX);
}

/**
 * Check if a capability has test coverage
 * @param {string} capabilityId
 * @returns {boolean}
 */
export function hasTestCoverage(capabilityId) {
  return capabilityId in TEST_MATRIX && TEST_MATRIX[capabilityId].length > 0;
}

/**
 * Get all fixtures used in the test matrix
 * @returns {Set<string>}
 */
export function getAllFixtures() {
  const fixtures = new Set();
  for (const entries of Object.values(TEST_MATRIX)) {
    for (const entry of entries) {
      fixtures.add(entry.fixture);
    }
  }
  return fixtures;
}



