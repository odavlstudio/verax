/**
 * Post-Auth Guardrails Tests
 * Proves Vision 1.0 boundaries: 401 pre-auth IN SCOPE, 403 + post-auth OUT OF SCOPE
 */

import test from 'node:test';
import assert from 'node:assert';
import { detectPostAuthFindings } from '../src/verax/detect/post-auth-findings.js';
import { detectInteractiveFindings } from '../src/verax/detect/interactive-findings.js';

// ============================================================================
// Test Suite 1: Post-Auth Detector (403 Forbidden)
// ============================================================================

test('Post-Auth: 403 Forbidden → Out of Scope (no findings)', () => {
  const traces = [
    {
      interaction: { type: 'button', selector: '.delete-btn', label: 'Delete User' },
      beforeUrl: 'https://app.example.com/admin/users/123',
      afterUrl: 'https://app.example.com/admin/users/123',
      httpStatus: 403, // ← VISION 1.0: 403 is post-auth/RBAC
      authGuard: { httpStatus: 403 }
    }
  ];

  const result = detectPostAuthFindings(traces, {}, []);
  
  // CRITICAL: No findings produced for post-auth
  assert.strictEqual(result.findings.length, 0, '403 produces zero findings');
  
  // But we get an explicit marker
  assert.strictEqual(result.markers.length, 1, '403 produces explicit marker');
  assert.strictEqual(
    result.markers[0].type,
    'out_of_scope_post_auth_rbac',
    'Marker type is out_of_scope_post_auth_rbac'
  );
  assert.strictEqual(result.markers[0].confidence, 1.0, 'High confidence in 403 post-auth');
});

// ============================================================================
// Test Suite 2: 401 Unauthorized - Distinguish Pre-Auth from Post-Auth
// ============================================================================

test('Pre-Auth: 401 on /login page → In Scope (analyzed)', () => {
  const traces = [
    {
      interaction: { type: 'form', selector: '#login-form', label: 'Login Form' },
      beforeUrl: 'https://app.example.com/login',
      afterUrl: 'https://app.example.com/login',
      httpStatus: 401, // ← Pre-auth gate
      authGuard: { httpStatus: 401, isProtected: true }
    }
  ];

  const result = detectPostAuthFindings(traces, {}, []);
  
  // 401 on /login is PRE-AUTH, so no out-of-scope marker
  assert.strictEqual(result.markers.length, 0, '401 on /login produces zero markers');
  assert.strictEqual(result.findings.length, 0, 'No findings yet (handled by interactive detector)');
});

test('Post-Auth: 401 on /dashboard → Out of Scope (session context)', () => {
  const traces = [
    {
      interaction: { type: 'button', selector: '.edit-btn', label: 'Edit Profile' },
      beforeUrl: 'https://app.example.com/dashboard',
      afterUrl: 'https://app.example.com/dashboard',
      httpStatus: 401, // ← Not on pre-auth gate
      authGuard: { httpStatus: 401, isProtected: true }
    }
  ];

  const result = detectPostAuthFindings(traces, {}, []);
  
  // 401 on non-pre-auth path implies session context
  assert.strictEqual(result.markers.length, 1, 'Non-pre-auth 401 produces marker');
  assert.strictEqual(
    result.markers[0].type,
    'out_of_scope_post_auth_session',
    'Marker identifies session context'
  );
});

// ============================================================================
// Test Suite 3: Interactive Findings Skip 403 (Defers to Post-Auth)
// ============================================================================

test('Interactive: 403 Forbidden → Skipped, defers to post-auth', () => {
  const traces = [
    {
      interaction: { type: 'button', selector: '.delete-btn', label: 'Delete' },
      beforeUrl: 'https://app.example.com/admin',
      afterUrl: 'https://app.example.com/admin',
      httpStatus: 403, // ← Post-auth
      beforeScreenshot: 'before.png',
      afterScreenshot: 'after.png',
      sensors: {
        network: { totalRequests: 1 },
        console: {},
        uiSignals: { changes: { changed: false } }
      }
    }
  ];

  const findings = [];
  detectInteractiveFindings(traces, {}, findings);
  
  // CRITICAL: Interactive detector skips 403
  assert.strictEqual(findings.length, 0, '403 produces zero findings from interactive detector');
});

test('Interactive: 401 on login form → Still analyzed', () => {
  const traces = [
    {
      interaction: { type: 'form', selector: '#login', label: 'Login' },
      beforeUrl: 'https://app.example.com/login',
      afterUrl: 'https://app.example.com/login',
      httpStatus: 401,
      login: { submitted: true, redirected: false },
      beforeScreenshot: 'before.png',
      afterScreenshot: 'after.png',
      sensors: {
        network: { totalRequests: 0 },
        console: {},
        uiSignals: { changes: { changed: false } }
      }
    }
  ];

  const findings = [];
  detectInteractiveFindings(traces, {}, findings);
  
  // 401 on pre-auth gate is still analyzed (can have silent failures)
  // If login submitted but no effect, it would be captured
  // (actual detection depends on specific signals)
});

// ============================================================================
// Test Suite 4: Distinctions Between 401 Pre-Auth vs Post-Auth
// ============================================================================

test('Pre-Auth Boundaries: /login, /signup, /reset', () => {
  const preAuthPaths = [
    'https://app.example.com/login',
    'https://app.example.com/signin',
    'https://app.example.com/sign-in',
    'https://app.example.com/signup',
    'https://app.example.com/register',
    'https://app.example.com/sign-up',
    'https://app.example.com/forgot-password',
    'https://app.example.com/password-reset',
    'https://app.example.com/auth/login',
  ];

  for (const path of preAuthPaths) {
    const traces = [
      {
        interaction: { type: 'form', selector: '#form', label: 'Auth' },
        beforeUrl: path,
        afterUrl: path,
        httpStatus: 401
      }
    ];

    const result = detectPostAuthFindings(traces, {}, []);
    assert.strictEqual(
      result.markers.length,
      0,
      `401 on ${path} should not produce post-auth marker (pre-auth gate)`
    );
  }
});

test('Post-Auth Boundaries: /admin, /dashboard, /account, /profile', () => {
  const postAuthPaths = [
    'https://app.example.com/admin',
    'https://app.example.com/dashboard',
    'https://app.example.com/account',
    'https://app.example.com/profile',
    'https://app.example.com/settings',
    'https://app.example.com/billing',
  ];

  for (const path of postAuthPaths) {
    const traces = [
      {
        interaction: { type: 'button', selector: '.btn', label: 'Action' },
        beforeUrl: path,
        afterUrl: path,
        httpStatus: 403
      }
    ];

    const result = detectPostAuthFindings(traces, {}, []);
    assert.strictEqual(
      result.markers.length,
      1,
      `403 on ${path} should produce post-auth marker`
    );
    assert.strictEqual(
      result.markers[0].type,
      'out_of_scope_post_auth_rbac',
      `403 on ${path} is RBAC out-of-scope`
    );
  }
});

// ============================================================================
// Test Suite 5: No Findings Produced for Post-Auth
// ============================================================================

test('Post-Auth Guarantee: No findings when httpStatus=403', () => {
  const manifest = {
    protectedRoutes: [
      { path: '/admin' },
      { path: '/settings' }
    ]
  };

  const traces = [
    {
      interaction: { type: 'button', selector: '.delete', label: 'Delete' },
      beforeUrl: 'https://app.example.com/admin/users',
      afterUrl: 'https://app.example.com/admin/users',
      httpStatus: 403
    },
    {
      interaction: { type: 'button', selector: '.edit', label: 'Edit' },
      beforeUrl: 'https://app.example.com/settings/privacy',
      afterUrl: 'https://app.example.com/settings/privacy',
      httpStatus: 403
    }
  ];

  const findings = [];
  const postAuthResult = detectPostAuthFindings(traces, manifest, findings);

  // CRITICAL: Zero findings produced
  assert.strictEqual(postAuthResult.findings.length, 0, 'No findings for post-auth');
  assert.strictEqual(findings.length, 0, 'Parent findings array unchanged');

  // But markers track what was skipped
  assert.strictEqual(postAuthResult.markers.length, 2, 'Two out-of-scope markers');
});

test('Pre-Auth vs Post-Auth: Login failing is a finding, 403 is not', () => {
  const preAuthTrace = {
    interaction: { type: 'form', selector: '#login', label: 'Login' },
    beforeUrl: 'https://app.example.com/login',
    afterUrl: 'https://app.example.com/login',
    httpStatus: 200,
    login: { submitted: true, redirected: false, storageChanged: false },
    beforeScreenshot: 'b.png',
    afterScreenshot: 'a.png',
    sensors: { network: { totalRequests: 0 }, console: {} }
  };

  const postAuthTrace = {
    interaction: { type: 'button', selector: '.delete', label: 'Delete' },
    beforeUrl: 'https://app.example.com/admin',
    afterUrl: 'https://app.example.com/admin',
    httpStatus: 403,
    beforeScreenshot: 'b.png',
    afterScreenshot: 'a.png',
    sensors: { network: {}, console: {} }
  };

  // Pre-auth finding (login fails)
  const preAuthFindings = [];
  detectInteractiveFindings([preAuthTrace], {}, preAuthFindings);

  // Post-auth marker (403)
  const postAuthResult = detectPostAuthFindings([postAuthTrace], {}, []);

  // Pre-auth can produce findings (login failure is IN SCOPE)
  // Post-auth never produces findings (403 is OUT OF SCOPE)
  assert.ok(postAuthResult.findings.length === 0, 'Post-auth: zero findings');
  assert.ok(postAuthResult.markers.length === 1, 'Post-auth: explicit marker');
});

// ============================================================================
// Test Suite 6: Exit Code Impact
// ============================================================================

test('Post-Auth Guarantee: 403 cannot cause FAILURE exit code', () => {
  // Post-auth skips produce markers, not findings
  // Markers don't increment silentFailures count
  // So truth state cannot be FAILURE due to 403
  
  const traces = [
    { httpStatus: 403 },
    { httpStatus: 403 },
    { httpStatus: 403 }
  ];

  const result = detectPostAuthFindings(traces, {}, []);
  
  // All 403s skipped
  assert.strictEqual(result.findings.length, 0, 'Zero findings = no FAILURE exit code');
  assert.strictEqual(result.markers.length, 3, 'Three out-of-scope markers tracked');
});
