/**
 * PHASE 2A: Auth Context Utilities
 * Parsing, redaction, and validation of authentication credentials for browser context
 */

import { existsSync, readFileSync } from 'fs';
import { createHash } from 'crypto';
import { resolve } from 'path';
import { redactAuthCookie, redactAuthHeaderValue, redactUrl } from '../evidence/redact.js';

/**
 * Parse a cookie string in the format "name=value;domain=example.com;path=/;secure;httpOnly;sameSite=Lax".
 * Returns a Playwright-compatible cookie object or { error } when invalid.
 */
export function parseAuthCookie(cookieString) {
  if (!cookieString || typeof cookieString !== 'string') {
    return { error: 'Cookie string must be non-empty' };
  }

  const parts = cookieString.split(';').map(p => p.trim()).filter(Boolean);
  if (parts.length === 0 || !parts[0].includes('=')) {
    return { error: 'Cookie must be in format "name=value" with optional attributes' };
  }

  const [namePart, ...attrParts] = parts;
  const [name, value] = namePart.split('=');
  if (!name || value === undefined) {
    return { error: 'Cookie must include name and value' };
  }

  const cookie = { name, value };

  for (const attr of attrParts) {
    const lower = attr.toLowerCase();
    if (lower === 'secure') cookie.secure = true;
    else if (lower === 'httponly') cookie.httpOnly = true;
    else if (lower.startsWith('domain=')) cookie.domain = attr.substring('domain='.length);
    else if (lower.startsWith('path=')) cookie.path = attr.substring('path='.length) || '/';
    else if (lower.startsWith('samesite=')) cookie.sameSite = attr.substring('samesite='.length);
  }

  cookie.path = cookie.path || '/';
  return cookie;
}

/**
 * Load cookies from --auth-cookie input.
 * Input must be either:
 *  - Path to JSON file containing an array of cookies, or
 *  - Inline JSON string representing an array of cookies
 */
export function loadAuthCookiesSource(value, cwd = process.cwd()) {
  if (!value || typeof value !== 'string') {
    return { error: '--auth-cookie value must be a JSON array or path to JSON array' };
  }

  const absPath = resolve(cwd, value);
  const tryParseArray = (raw, sourceLabel) => {
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return { error: `${sourceLabel} must be a JSON array of cookie objects` };
      }
      for (const c of parsed) {
        if (!c || typeof c !== 'object') {
          return { error: `${sourceLabel} must contain cookie objects with name/value` };
        }
        if (!c.name || !c.value) {
          return { error: `${sourceLabel} cookie entries must include name and value` };
        }
        if (!c.domain || !c.path) {
          return { error: `${sourceLabel} cookie entries must include domain and path` };
        }
      }
      return { cookies: parsed };
    } catch (error) {
      return { error: `${sourceLabel} must be a JSON array (inline JSON string or path to JSON file)` };
    }
  };

  if (existsSync(absPath)) {
    const content = readFileSync(absPath, 'utf-8');
    return tryParseArray(content, `--auth-cookie file ${value}`);
  }

  // Fallback to inline JSON
  return tryParseArray(value, '--auth-cookie inline value');
}

/**
 * Parse --auth-header flag value
 * Format: "Authorization: Bearer token123"
 * Returns: { name, value } or { error }
 */
export function parseAuthHeader(headerString) {
  if (!headerString || typeof headerString !== 'string') {
    return { error: 'Header string must be non-empty string' };
  }

  const colonIndex = headerString.indexOf(':');
  if (colonIndex === -1) {
    return { error: 'Header must be in format "Name: Value"' };
  }

  const name = headerString.substring(0, colonIndex).trim();
  const value = headerString.substring(colonIndex + 1).trim();

  if (!name || !value) {
    return { error: 'Header must have both name and value' };
  }

  return { name, value };
}

/**
 * Load auth storage state from JSON file
 * Returns: { cookies, origins } or { error }
 */
export function loadAuthStorage(filePath) {
  if (!existsSync(filePath)) {
    return { error: `Auth storage file not found: ${filePath}` };
  }

  try {
    const content = /** @type {string} */ (readFileSync(filePath, 'utf-8'));
    const state = JSON.parse(content);

    // Validate structure (Playwright storageState format)
    if (!state.cookies || !Array.isArray(state.cookies)) {
      return { error: 'Invalid storage state: missing cookies array' };
    }

    return state;
  } catch (error) {
    return { error: `Failed to load auth storage: ${error.message}` };
  }
}

/**
 * Redact sensitive cookie values for logging/artifacts
 * Returns: { name, valueHash, domain, path, secure, httpOnly }
 */
export function redactCookie(cookie) {
  const hash = /** @type {string} */ (createHash('sha256')
    .update(cookie.value)
    .digest('hex'))
    .substring(0, 8);

  return {
    name: cookie.name,
    valueHash: `[REDACTED:${hash}]`,
    domain: cookie.domain,
    path: cookie.path,
    secure: cookie.secure,
    httpOnly: cookie.httpOnly,
  };
}

/**
 * Redact sensitive header values for logging/artifacts
 * Returns: { name, valueHash }
 */
export function redactHeader(header) {
  const hash = /** @type {string} */ (createHash('sha256')
    .update(header.value)
    .digest('hex'))
    .substring(0, 8);

  return {
    name: header.name,
    valueHash: `[REDACTED:${hash}]`,
  };
}

/**
 * Validate auth configuration
 * Returns: { valid: boolean, errors: string[] }
 */
export function validateAuthConfig(config) {
  const errors = [];

  if (config.authStorage && config.authCookies && config.authCookies.length > 0) {
    errors.push('Cannot use both --auth-storage and --auth-cookie (choose one)');
  }

  if (config.authMode && !['strict', 'auto', 'off'].includes(config.authMode)) {
    errors.push('--auth-mode must be "strict", "auto", or "off"');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create redacted auth summary for artifacts
 * Returns: { storage: boolean, cookiesCount: number, headersCount: number, mode: string }
 */
export function createAuthSummary(config) {
  return {
    storage: !!config.authStorage,
    cookiesCount: config.authCookies?.length || 0,
    headersCount: config.authHeaders?.length || 0,
    mode: config.authMode || 'auto',
  };
}

function ensureRedactionCounters(counters) {
  const base = counters || {};
  return {
    headersRedacted: typeof base.headersRedacted === 'number' ? base.headersRedacted : 0,
    tokensRedacted: typeof base.tokensRedacted === 'number' ? base.tokensRedacted : 0,
  };
}

function sanitizeAuthVerification(verification, counters) {
  if (!verification) return null;
  const c = ensureRedactionCounters(counters);
  const signals = verification.signals || {};
  return {
    effective: verification.effective || 'unknown',
    confidence: typeof verification.confidence === 'number' ? verification.confidence : 0,
    signals: {
      ...signals,
      currentUrl: redactUrl(signals.currentUrl, c),
      finalUrl: redactUrl(signals.finalUrl, c),
    }
  };
}

/**
 * Build a redaction-safe auth artifact for downstream artifacts
 */
export function buildAuthArtifact(authResult, authMode = 'auto', authVerification = null, counters) {
  const c = ensureRedactionCounters(counters);
  const redactedCookies = (authResult?.redacted?.cookies || authResult?.cookies || []).map((cookie) => redactAuthCookie(cookie, c));
  const redactedHeaders = (authResult?.redacted?.headers || []).map((header) => redactAuthHeaderValue(header.name || '', header.value || '', c));

  return {
    applied: Boolean(authResult?.applied),
    mode: authMode || authResult?.mode || 'auto',
    methods: authResult?.methods || [],
    errors: authResult?.errors || [],
    verification: sanitizeAuthVerification(authVerification, c),
    redacted: {
      storageState: Boolean(authResult?.redacted?.storageState),
      cookies: redactedCookies,
      headers: redactedHeaders,
    },
  };
}
