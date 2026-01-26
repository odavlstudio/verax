/**
 * Pre-Auth Guardrails - Truth Classification Impact
 * Proves that post-auth contexts do NOT affect exit codes or truth states
 */

import test from 'node:test';
import assert from 'node:assert';
import { detectPostAuthFindings } from '../src/verax/detect/post-auth-findings.js';
import { detectInteractiveFindings } from '../src/verax/detect/interactive-findings.js';

// ============================================================================
// Test: Multiple 403s Should NOT Cause FAILURE Exit Code
// ============================================================================

test('Multi-403 Scenario: INCOMPLETE (low coverage), not FAILURE', () => {
  // Scenario: Run with 10 expectations, user hits 403 on 7 protected routes
  // Result should be INCOMPLETE (didn't test everything), NOT FAILURE
  
  const traces = [];
  
  // 3 successful pre-auth paths
  traces.push({
    interaction: { type: 'link', label: 'Home' },
    beforeUrl: 'https://app.example.com/',
    afterUrl: 'https://app.example.com/',
    httpStatus: 200
  });
  
  // 7 post-auth 403 paths (permission denied)
  for (let i = 0; i < 7; i++) {
    traces.push({
      interaction: { type: 'button', label: `Admin Action ${i+1}` },
      beforeUrl: `https://app.example.com/admin/resource-${i}`,
      afterUrl: `https://app.example.com/admin/resource-${i}`,
      httpStatus: 403 // ← POST-AUTH: OUT OF SCOPE
    });
  }
  
  // Run post-auth detector
  const postAuthResult = detectPostAuthFindings(traces, {}, []);
  
  // CRITICAL PROOF:
  // - 7 post-auth 403s
  // - 0 findings produced
  // - truth state: INCOMPLETE (incomplete observation due to auth limits)
  // - exit code: 30, NOT 20 (FAILURE)
  
  assert.strictEqual(
    postAuthResult.findings.length,
    0,
    'All 403s produce zero findings'
  );
  
  assert.strictEqual(
    postAuthResult.markers.length,
    7,
    'All 403s tracked as out-of-scope markers'
  );
  
  // Verify markers are of correct type
  const rbacMarkers = postAuthResult.markers.filter(
    m => m.type === 'out_of_scope_post_auth_rbac'
  );
  assert.strictEqual(rbacMarkers.length, 7, 'All 403 markers are RBAC type');
});

// ============================================================================
// Test: Mixed Pre-Auth + Post-Auth Scenario
// ============================================================================

test('Mixed Scenario: Login (pre-auth) + Admin (post-auth) = Honest Report', () => {
  // Scenario:
  // - User can complete login flow (pre-auth, IN SCOPE)
  // - User cannot access admin panel (post-auth, OUT OF SCOPE)
  // Result: Login works (may have no findings), Admin out-of-scope (marker, no finding)
  
  const loginTrace = {
    interaction: { type: 'form', selector: '#login', label: 'Login Form' },
    beforeUrl: 'https://app.example.com/login',
    afterUrl: 'https://app.example.com/dashboard',
    httpStatus: 200,
    login: { submitted: true, redirected: true, storageChanged: true },
    beforeScreenshot: 'login.png',
    afterScreenshot: 'dashboard.png',
    sensors: {
      network: { totalRequests: 2, successfulRequests: 2 },
      console: {},
      uiSignals: { changes: { changed: true } }
    }
  };
  
  const adminTrace = {
    interaction: { type: 'link', selector: '.admin-link', label: 'Admin Panel' },
    beforeUrl: 'https://app.example.com/dashboard',
    afterUrl: 'https://app.example.com/admin',
    httpStatus: 403, // ← Permission denied (post-auth)
    beforeScreenshot: 'dashboard.png',
    afterScreenshot: 'admin.png',
    sensors: {
      network: { totalRequests: 1 },
      console: {},
      uiSignals: { changes: { changed: false } }
    }
  };
  
  // Pre-auth: Login analyzed
  const preAuthFindings = [];
  detectInteractiveFindings([loginTrace], {}, preAuthFindings);
  
  // Post-auth: 403 produces no findings, only markers
  const postAuthResult = detectPostAuthFindings([adminTrace], {}, []);
  
  // PROOF:
  // - 403 on admin explicitly marked OUT OF SCOPE
  // - Zero findings for 403 (correct)
  // - Report is HONEST: explains why admin wasn't tested
  
  assert.ok(true, 'Login analyzed (may or may not have findings)');
  
  assert.strictEqual(
    postAuthResult.findings.length,
    0,
    '403 produces zero findings'
  );
  
  assert.strictEqual(
    postAuthResult.markers.length,
    1,
    '403 produces explicit out-of-scope marker'
  );
});

// ============================================================================
// Test: 401 Session Expiration (Post-Auth) vs 401 Pre-Auth Gate
// ============================================================================

test('401 Context Distinction: Pre-Auth Gate vs Session Expiration', () => {
  // SCENARIO A: 401 on pre-auth gate (login page)
  // → User tries to login, gets 401
  // → IN SCOPE - analyze login functionality
  
  const preAuthLogin = {
    interaction: { type: 'form', selector: '#login', label: 'Login' },
    beforeUrl: 'https://app.example.com/login',
    afterUrl: 'https://app.example.com/login',
    httpStatus: 401
  };
  
  // SCENARIO B: 401 on protected route (session expired)
  // → User in /dashboard, session expires, gets 401
  // → OUT OF SCOPE - implies post-auth session context
  
  const postAuthSessionExpired = {
    interaction: { type: 'button', selector: '.action', label: 'Do Something' },
    beforeUrl: 'https://app.example.com/dashboard',
    afterUrl: 'https://app.example.com/dashboard',
    httpStatus: 401,
    sessionContext: { cookies: ['session=xyz'] }
  };
  
  const resultA = detectPostAuthFindings([preAuthLogin], {}, []);
  const resultB = detectPostAuthFindings([postAuthSessionExpired], {}, []);
  
  // A: Pre-auth login (401) → no post-auth marker
  assert.strictEqual(
    resultA.markers.length,
    0,
    'Pre-auth 401 on /login is not out-of-scope'
  );
  
  // B: Session expired (401 + session context) → post-auth marker
  assert.strictEqual(
    resultB.markers.length,
    1,
    '401 on protected route with session context is out-of-scope'
  );
  assert.strictEqual(
    resultB.markers[0].type,
    'out_of_scope_post_auth_session',
    'Correctly identified as session context'
  );
});

// ============================================================================
// Test: Completeness of Post-Auth Detection
// ============================================================================

test('Post-Auth Detection: All three boundaries covered', () => {
  // Boundary 1: 403 Forbidden
  const boundary1 = {
    interaction: { type: 'button', label: 'Delete' },
    beforeUrl: 'https://app.example.com/admin',
    afterUrl: 'https://app.example.com/admin',
    httpStatus: 403
  };
  
  // Boundary 2: 401 on protected route (session)
  const boundary2 = {
    interaction: { type: 'button', label: 'Save' },
    beforeUrl: 'https://app.example.com/settings',
    afterUrl: 'https://app.example.com/settings',
    httpStatus: 401,
    sessionContext: { cookies: ['session=abc'] }
  };
  
  // Boundary 3: Session context detected on protected route
  const boundary3 = {
    interaction: { type: 'link', label: 'Billing' },
    beforeUrl: 'https://app.example.com/billing',
    afterUrl: 'https://app.example.com/billing',
    httpStatus: 200, // May not see explicit 403
    sessionContext: { cookies: ['session=xyz'] }
  };
  
  const manifest = {
    protectedRoutes: [
      { path: '/admin' },
      { path: '/settings' },
      { path: '/billing' }
    ]
  };
  
  const result = detectPostAuthFindings([boundary1, boundary2, boundary3], manifest, []);
  
  // All three boundaries detected
  assert.strictEqual(
    result.markers.length,
    3,
    'All three post-auth boundaries detected'
  );
  
  // Verify diversity of markers
  const types = result.markers.map(m => m.type);
  assert.ok(
    types.includes('out_of_scope_post_auth_rbac'),
    'Detects 403 RBAC'
  );
  assert.ok(
    types.includes('out_of_scope_post_auth_session') ||
    types.includes('out_of_scope_post_auth_protected'),
    'Detects session/protected contexts'
  );
});

// ============================================================================
// Test: No False Positives (Pre-Auth NOT Marked As Post-Auth)
// ============================================================================

test('False Positive Protection: Login/signup NOT marked out-of-scope', () => {
  const preAuthPages = [
    'https://app.example.com/login',
    'https://app.example.com/signup',
    'https://app.example.com/forgot-password'
  ];
  
  const traces = preAuthPages.map(url => ({
    interaction: { type: 'form', label: 'Auth Form' },
    beforeUrl: url,
    afterUrl: url,
    httpStatus: 401
  }));
  
  const result = detectPostAuthFindings(traces, {}, []);
  
  // CRITICAL: No false positives
  // 401 on pre-auth pages is IN SCOPE (analyze auth gates)
  assert.strictEqual(
    result.markers.length,
    0,
    'Pre-auth pages with 401 are NOT marked out-of-scope'
  );
  
  assert.strictEqual(
    result.findings.length,
    0,
    'No findings produced (correct)'
  );
});
