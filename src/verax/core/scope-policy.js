/**
 * SCOPE POLICY: Single source of truth for route classification
 * 
 * Gate 3: Scope Enforcement
 * VERAX operates as a pre-auth, public-flow guard.
 * Routes are classified at LEARN-TIME and filtered before observation.
 * 
 * Classification Categories:
 * - IN_SCOPE_PUBLIC: Public routes, safe to observe
 * - OUT_OF_SCOPE_AUTH: Protected routes (admin, account, login, etc.)
 * - OUT_OF_SCOPE_DYNAMIC: Dynamic entity routes (/users/:id, /posts/[id], etc.)
 * - OUT_OF_SCOPE_EXTERNAL: Different origins
 * - OUT_OF_SCOPE_UNKNOWN: Unvalidatable routes (conservative handling)
 */

/**
 * Classification result for a single route
 * @typedef {Object} ScopeClassification
 * @property {string} classification - One of: IN_SCOPE_PUBLIC, OUT_OF_SCOPE_*
 * @property {string} reason - Explanation for classification
 * @property {Array<string>} [matchedPatterns] - Which patterns matched (for debugging)
 */

const DEFAULT_AUTH_PATTERNS = [
  /^\/admin$/,
  /^\/admin\//,
  /^\/account$/,
  /^\/account\//,
  /^\/settings$/,
  /^\/settings\//,
  /^\/dashboard$/,
  /^\/dashboard\//,
  /^\/app$/,
  /^\/app\//,
  /^\/secure$/,
  /^\/secure\//,
  /^\/member$/,
  /^\/member\//,
  /^\/members\/$/,
  /^\/members\//,
  /^\/profile$/,
  /^\/profile\//,
  /^\/user$/,
  /^\/user\//,
  /^\/users\/$/,
  /^\/login$/,
  /^\/login\//,
  /^\/signin$/,
  /^\/signin\//,
  /^\/auth$/,
  /^\/auth\//,
  /^\/oauth$/,
  /^\/oauth\//,
  /^\/api\/auth/,
  /^\/internal$/,
  /^\/internal\//,
  /^\/private$/,
  /^\/private\//
];

const DYNAMIC_ROUTE_PATTERNS = [
  // Next.js style: /posts/[id]
  /\[([^\]]+)\]/,
  
  // React Router style: /posts/:id
  /:([a-zA-Z_$][a-zA-Z0-9_$]*)/,
  
  // Catch-all: /files/*
  /\/\*/,
  
  // Regex patterns: /posts/(\\d+)
  /\([^)]*\)/,
  
  // Glob patterns: /api/**/*
  /\*\*/,
  
  // Optional segments: /posts/:id?
  /\?$/
];

export class ScopePolicy {
  /**
   * @param {Object} options
   * @param {Array<string|RegExp>} [options.additionalAuthPatterns] - User-defined auth patterns
   * @param {Array<string|RegExp>} [options.additionalDynamicPatterns] - User-defined dynamic patterns
   * @param {boolean} [options.conservativeMode] - When true, unknown routes marked OUT_OF_SCOPE_UNKNOWN
   */
  constructor(options = {}) {
    this.authPatterns = [
      ...DEFAULT_AUTH_PATTERNS,
      ...(options.additionalAuthPatterns || []).map(p => 
        typeof p === 'string' ? new RegExp(`^${p}(/.*)?$`) : p
      )
    ];

    this.dynamicPatterns = [
      ...DYNAMIC_ROUTE_PATTERNS,
      ...(options.additionalDynamicPatterns || []).map(p =>
        typeof p === 'string' ? new RegExp(p) : p
      )
    ];

    this.conservativeMode = options.conservativeMode !== false; // Default: true (conservative)
  }

  /**
   * Classify a single route
   * @param {string} path - Route path (e.g. "/users/:id", "/pricing", "/admin/dashboard")
   * @returns {ScopeClassification}
   */
  classify(path) {
    if (!path || typeof path !== 'string') {
      return {
        classification: 'OUT_OF_SCOPE_UNKNOWN',
        reason: 'Invalid path provided'
      };
    }

    // Normalize path
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    // Check if dynamic route
    const dynamicMatch = this.checkDynamicPatterns(normalizedPath);
    if (dynamicMatch) {
      return {
        classification: 'OUT_OF_SCOPE_DYNAMIC',
        reason: `Dynamic route pattern detected: ${dynamicMatch}`,
        matchedPatterns: [dynamicMatch]
      };
    }

    // Check if auth/protected route
    const authMatch = this.checkAuthPatterns(normalizedPath);
    if (authMatch) {
      return {
        classification: 'OUT_OF_SCOPE_AUTH',
        reason: `Protected route pattern detected: ${authMatch}`,
        matchedPatterns: [authMatch]
      };
    }

    // If it looks like a public route, accept it
    // Public routes: /, /about, /pricing, /signup, /contact, etc.
    // Keep it simple: if no dynamic/auth patterns match, it's public
    return {
      classification: 'IN_SCOPE_PUBLIC',
      reason: 'No dynamic or auth patterns detected - classified as public',
      matchedPatterns: []
    };
  }

  /**
   * Check if path matches any dynamic route patterns
   * @private
   * @param {string} path
   * @returns {string|null} - Matched pattern description or null
   */
  checkDynamicPatterns(path) {
    for (const pattern of this.dynamicPatterns) {
      if (pattern.test(path)) {
        return pattern.toString();
      }
    }
    return null;
  }

  /**
   * Check if path matches any auth/protected route patterns
   * @private
   * @param {string} path
   * @returns {string|null} - Matched pattern description or null
   */
  checkAuthPatterns(path) {
    for (const pattern of this.authPatterns) {
      if (pattern.test(path)) {
        return pattern.toString();
      }
    }
    return null;
  }

  /**
   * Classify multiple routes and separate them
   * @param {Array<string>} routes - Route paths
   * @returns {Object} - { inScope, outOfScope, summary }
   */
  classifyMany(routes) {
    const inScope = [];
    const outOfScope = {
      auth: [],
      dynamic: [],
      external: [],
      unknown: []
    };

    const classifications = {};

    for (const route of routes) {
      const result = this.classify(route);
      classifications[route] = result;

      if (result.classification === 'IN_SCOPE_PUBLIC') {
        inScope.push(route);
      } else if (result.classification === 'OUT_OF_SCOPE_AUTH') {
        outOfScope.auth.push(route);
      } else if (result.classification === 'OUT_OF_SCOPE_DYNAMIC') {
        outOfScope.dynamic.push(route);
      } else if (result.classification === 'OUT_OF_SCOPE_EXTERNAL') {
        outOfScope.external.push(route);
      } else {
        outOfScope.unknown.push(route);
      }
    }

    return {
      inScope,
      outOfScope,
      summary: {
        total: routes.length,
        inScopeCount: inScope.length,
        outOfScopeCount: routes.length - inScope.length,
        outOfScopeCounts: {
          auth: outOfScope.auth.length,
          dynamic: outOfScope.dynamic.length,
          external: outOfScope.external.length,
          unknown: outOfScope.unknown.length
        }
      },
      classifications
    };
  }

  /**
   * Get example skipped routes (capped at maxExamples)
   * @param {Object} outOfScopeData - Result from classifyMany()
   * @param {number} maxExamples - Max examples per category (default: 10)
   * @returns {Object} - { auth: [...], dynamic: [...], external: [...], unknown: [...] }
   */
  getSkippedExamples(outOfScopeData, maxExamples = 10) {
    return {
      auth: (outOfScopeData.outOfScope.auth || []).slice(0, maxExamples),
      dynamic: (outOfScopeData.outOfScope.dynamic || []).slice(0, maxExamples),
      external: (outOfScopeData.outOfScope.external || []).slice(0, maxExamples),
      unknown: (outOfScopeData.outOfScope.unknown || []).slice(0, maxExamples)
    };
  }
}

/**
 * Create a scope policy from CLI options
 * @param {Object} cliOptions - CLI arguments
 * @returns {ScopePolicy}
 */
export function createScopePolicyFromCli(cliOptions = {}) {
  const additionalAuthPatterns = [];

  // Parse --out-of-scope-route-pattern flags
  if (cliOptions.outOfScopeRoutePattern) {
    const patterns = Array.isArray(cliOptions.outOfScopeRoutePattern)
      ? cliOptions.outOfScopeRoutePattern
      : [cliOptions.outOfScopeRoutePattern];
    
    additionalAuthPatterns.push(...patterns);
  }

  // Parse env var VERAX_OUT_OF_SCOPE_PATTERNS
  const envPatterns = process.env.VERAX_OUT_OF_SCOPE_PATTERNS;
  if (envPatterns) {
    const patterns = envPatterns.split(',').map(p => p.trim()).filter(p => p);
    additionalAuthPatterns.push(...patterns);
  }

  return new ScopePolicy({
    additionalAuthPatterns,
    conservativeMode: cliOptions.conservativeMode !== false
  });
}

/**
 * Default singleton scope policy
 */
export const defaultScopePolicy = new ScopePolicy();
