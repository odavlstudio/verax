/**
 * Post-Auth & RBAC Detection Module
 * 
 * VISION 1.0: Post-authentication and permission-gated flows are OUT OF SCOPE.
 * 
 * This detector explicitly identifies when interactions hit post-auth boundaries:
 * - 403 Forbidden (permission denied after authenticated session)
 * - 401 Unauthorized + pre-auth gates (login, signup, reset) → IN SCOPE
 * - 401 Unauthorized + session context → implies prior auth attempt → OUT OF SCOPE
 * 
 * Emits explicit OUT_OF_SCOPE markers instead of silent failure findings.
 * No findings are produced for post-auth contexts.
 * 
 * @module post-auth-findings
 */

/**
 * Detect post-auth and RBAC-gated interactions
 * Returns markers for out-of-scope post-auth flows
 * 
 * @param {Array} traces - Interaction traces from observation
 * @param {Object} manifest - Project manifest (contains expectations, route info)
 * @param {Array} _findings - Findings array (NOT mutated - post-auth produces no findings)
 * @returns {Object} { findings: [], markers: [{ type, reason, evidence }] }
 */
export function detectPostAuthFindings(traces, manifest, _findings) {
  const postAuthMarkers = [];

  for (const trace of traces) {
    const interaction = trace.interaction || {};
    const httpStatus = trace.httpStatus || trace.authGuard?.httpStatus || null;
    const beforeUrl = trace.beforeUrl || '';
    const afterUrl = trace.afterUrl || '';
    const sensors = trace.sensors || {};
    const _network = sensors.network || {};
    const _consoleOutput = sensors.console || {};

    // ========================================================================
    // BOUNDARY 1: 403 Forbidden (Post-Auth Permission Denied)
    // This is ALWAYS out of scope - user is authenticated but denied access
    // ========================================================================
    if (httpStatus === 403) {
      const marker = {
        type: 'out_of_scope_post_auth_rbac',
        reason: 'out_of_scope_post_auth_rbac',
        confidence: 1.0,
        evidence: {
          httpStatus: 403,
          beforeUrl,
          afterUrl,
          interactionType: interaction.type || null,
          context: 'Permission denied - user authenticated but lacks permission',
        },
      };

      postAuthMarkers.push(marker);
      continue; // Skip further analysis for this trace
    }

    // ========================================================================
    // BOUNDARY 2: 401 Unauthorized - Distinguish pre-auth from post-auth
    // ========================================================================
    if (httpStatus === 401) {
      // Check if this is a PRE-AUTH gate (login/signup/reset) vs POST-AUTH (session expired)
      const isPreAuthGate = isPreAuthGatePath(beforeUrl, interaction);

      if (isPreAuthGate) {
        // 401 on pre-auth gate (login form) → IN SCOPE - we analyze auth gates
        continue;
      }

      // 401 on non-pre-auth path → POST-AUTH (session expired or restricted)
      // This implies the user WAS authenticated but lost session or hit protected resource
      const marker = {
        type: 'out_of_scope_post_auth_session',
        reason: 'out_of_scope_post_auth_session',
        confidence: 0.85,
        evidence: {
          httpStatus: 401,
          beforeUrl,
          afterUrl,
          interactionType: interaction.type || null,
          context: 'Unauthorized - implies authenticated session context outside pre-auth gates',
        },
      };

      postAuthMarkers.push(marker);
      continue;
    }

    // ========================================================================
    // BOUNDARY 3: Session State Detection (No HTTP Status)
    // If we see session context (cookies, auth headers) + protected route → OUT OF SCOPE
    // ========================================================================
    const sessionMeta = trace.sessionContext || {};
    const hasSessionCookies = (sessionMeta.cookies?.length || 0) > 0;
    const isProtectedRoute = isProtectedRoutePath(beforeUrl, manifest);
    const isPostAuthPathResult = isPostAuthPath(beforeUrl);

    if (hasSessionCookies && isProtectedRoute && isPostAuthPathResult) {
      const marker = {
        type: 'out_of_scope_post_auth_protected',
        reason: 'out_of_scope_post_auth_protected',
        confidence: 0.8,
        evidence: {
          httpStatus: null,
          beforeUrl,
          afterUrl,
          interactionType: interaction.type || null,
          sessionContext: 'Authenticated session detected on protected route',
          hasSessionCookies,
        },
      };

      postAuthMarkers.push(marker);
      continue;
    }
  }

  // IMPORTANT: Post-auth markers do NOT produce findings
  // They are tracked separately for transparency and skipped in truth calculation
  return {
    findings: [], // Always empty - post-auth produces no findings
    markers: postAuthMarkers,
    skips: postAuthMarkers.map(m => ({
      reason: m.reason,
      count: 1,
    })),
  };
}

/**
 * Check if a URL/interaction is a pre-auth gate (login, signup, reset)
 * PRE-AUTH gates are IN SCOPE for VERAX analysis
 * @private
 */
function isPreAuthGatePath(url, interaction = {}) {
  const urlLower = String(url || '').toLowerCase();
  const interactionLabel = String((interaction.label || interaction.selector || '')).toLowerCase();

  // Check URL for pre-auth paths
  const preAuthPatterns = [
    '/login',
    '/signin',
    '/sign-in',
    '/auth/login',
    '/auth/signin',
    '/signup',
    '/register',
    '/sign-up',
    '/auth/signup',
    '/forgot',
    '/password-reset',
    '/reset',
    '/forgot-password',
    '/auth/forgot',
  ];

  if (preAuthPatterns.some(p => urlLower.includes(p))) {
    return true;
  }

  // Check interaction label
  const preAuthInteractionPatterns = ['login', 'signin', 'signup', 'register', 'reset', 'forgot'];
  if (preAuthInteractionPatterns.some(p => interactionLabel.includes(p))) {
    return true;
  }

  return false;
}

/**
 * Check if a URL looks like a protected route (admin, dashboard, account, etc.)
 * These are associated with post-auth contexts
 * @private
 */
function isProtectedRoutePath(url, manifest = {}) {
  const urlLower = String(url || '').toLowerCase();

  // Common protected route patterns
  const protectedPatterns = [
    '/admin',
    '/dashboard',
    '/account',
    '/profile',
    '/settings',
    '/user',
    '/users',
    '/billing',
    '/payments',
    '/subscription',
    '/private',
    '/protected',
  ];

  if (protectedPatterns.some(p => urlLower.includes(p))) {
    return true;
  }

  // Check manifest for protected routes (if available)
  if (manifest.protectedRoutes && Array.isArray(manifest.protectedRoutes)) {
    return manifest.protectedRoutes.some(r => {
      const routePath = String(r.path || r || '').toLowerCase();
      return urlLower.includes(routePath);
    });
  }

  return false;
}

/**
 * Check if a URL is a post-auth path based on patterns
 * @private
 */
function isPostAuthPath(url) {
  const urlLower = String(url || '').toLowerCase();

  // If it's explicitly a pre-auth path, it's not post-auth
  if (isPreAuthGatePath(url)) {
    return false;
  }

  // If it's protected, it implies post-auth context
  if (isProtectedRoutePath(url)) {
    return true;
  }

  // General patterns: paths that require auth context
  const postAuthPatterns = [
    '/me',
    '/my-',
    '/user/',
    '/account',
    '/auth/callback', // Post-login callback
    '/oauth',
  ];

  return postAuthPatterns.some(p => urlLower.includes(p));
}
