import { loadAuthStorage } from './auth-utils.js';
import { redactAuthCookie, redactAuthHeaderValue } from '../evidence/redact.js';

function cloneRedacted(base) {
  const redacted = base?.redacted || {};
  return {
    storageState: Boolean(redacted.storageState),
    cookies: Array.isArray(redacted.cookies) ? [...redacted.cookies] : [],
    headers: Array.isArray(redacted.headers) ? [...redacted.headers] : [],
  };
}

function normalizeHeaders(authHeaders = []) {
  const headers = [];
  for (const h of authHeaders) {
    if (!h) continue;
    if (typeof h === 'string') {
      const idx = h.indexOf(':');
      if (idx === -1) {
        headers.push({ error: 'Header must be in format "Name: Value"' });
      } else {
        headers.push({ name: h.substring(0, idx).trim(), value: h.substring(idx + 1).trim() });
      }
    } else if (h.name && h.value) {
      headers.push({ name: h.name, value: h.value });
    }
  }
  return headers;
}

export function buildAuthContextOptions(authConfig = {}, redactionCounters) {
  const authMode = authConfig.authMode || 'auto';
  const contextOptions = {};
  const result = {
    applied: false,
    mode: authMode,
    methods: [],
    errors: [],
    redacted: {
      storageState: false,
      cookies: [],
      headers: [],
    },
  };

  if (authMode === 'off') {
    return { contextOptions, authResult: result };
  }

  // Storage state applied at context creation
  if (authConfig.authStorage || authConfig.authStorageState) {
    const storage = authConfig.authStorageState || loadAuthStorage(authConfig.authStorage);
    if (storage?.error) {
      result.errors.push(storage.error);
    } else if (storage) {
      contextOptions.storageState = storage;
      result.applied = true;
      result.methods.push('storageState');
      result.redacted.storageState = true;
      result.redacted.cookies = (storage.cookies || []).map((c) => redactAuthCookie(c, redactionCounters));
    }
  }

  const headerList = normalizeHeaders(authConfig.authHeaders);
  const headerMap = {};
  for (const header of headerList) {
    if (header.error) {
      result.errors.push(header.error);
      continue;
    }
    if (!header.name || !header.value) {
      result.errors.push('Header must have both name and value');
      continue;
    }
    headerMap[header.name] = header.value;
    result.redacted.headers.push(redactAuthHeaderValue(header.name, header.value, redactionCounters));
  }

  if (Object.keys(headerMap).length > 0) {
    contextOptions.extraHTTPHeaders = headerMap;
    result.applied = true;
    result.methods.push('headers');
  }

  return { contextOptions, authResult: result };
}

/**
 * Apply cookies (and any post-context auth) to an existing Playwright context.
 */
export async function applyAuth(context, page, authConfig = {}, baseResult = null, redactionCounters) {
  const mode = authConfig?.authMode || 'auto';
  const result = {
    applied: false,
    mode,
    methods: baseResult?.methods ? [...baseResult.methods] : [],
    errors: baseResult?.errors ? [...baseResult.errors] : [],
    redacted: cloneRedacted(baseResult),
  };

  if (mode === 'off') {
    return result;
  }

  // If context options already applied headers/storage, mark applied
  if (result.methods.length > 0) {
    result.applied = true;
  }

  if (authConfig?.authCookies && authConfig.authCookies.length > 0) {
    const cookies = [];
    for (const cookie of authConfig.authCookies) {
      if (!cookie || typeof cookie !== 'object' || !cookie.name || !cookie.value) {
        const err = 'Invalid cookie object: expected {name,value,...}';
        result.errors.push(err);
        continue;
      }
      if (!cookie.domain || !cookie.path) {
        const err = 'Invalid cookie object: expected domain and path';
        result.errors.push(err);
        continue;
      }
      cookies.push({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path || '/',
        secure: Boolean(cookie.secure),
        httpOnly: Boolean(cookie.httpOnly),
        sameSite: cookie.sameSite || 'Lax',
      });
      result.redacted.cookies.push(redactAuthCookie(cookie, redactionCounters));
    }

    if (cookies.length > 0) {
      try {
        await context.addCookies(cookies);
        result.applied = true;
        if (!result.methods.includes('cookies')) {
          result.methods.push('cookies');
        }
      } catch (cookieError) {
        result.errors.push(`Cookie application failed: ${cookieError.message}`);
      }
    }
  }

  if (mode === 'strict' && result.errors.length > 0) {
    throw new Error(`[INFRA_AUTH_FAILURE] ${result.errors.join(', ')}`);
  }

  return result;
}
