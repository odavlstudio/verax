/**
 * Redaction utilities (Phase 8.2)
 * Deterministic redaction for headers, URLs, bodies, console messages.
 * 
 * DETERMINISM: All object key iteration is sorted to ensure consistent output.
 * Stack depth is limited to prevent overflow on deeply nested structures.
 */

const REDACTED = '***REDACTED***';
const MAX_REDACTION_DEPTH = 15; // Prevent stack overflow on pathological inputs

const SENSITIVE_HEADERS = [
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token',
  'x-session-token',
  'x-access-token',
  'api-key',
  'proxy-authorization',
];

// Centralized sensitive key detection for deterministic redaction
const SENSITIVE_KEYS = new Set([
  'token',
  'api_key',
  'access_token',
  'id_token',
  'refresh_token',
  'password',
  'secret',
  'apikey',
  'auth',
  'authorization',
  'key',
]);

function ensureCounters(counters) {
  if (!counters) return { headersRedacted: 0, tokensRedacted: 0 };
  if (typeof counters.headersRedacted !== 'number') counters.headersRedacted = 0;
  if (typeof counters.tokensRedacted !== 'number') counters.tokensRedacted = 0;
  return counters;
}

export function redactHeaders(headers = {}, counters = { headersRedacted: 0, tokensRedacted: 0 }) {
  const c = ensureCounters(counters);
  const sanitized = {};
  
  // DETERMINISM: Sort keys for consistent output
  const sortedKeys = Object.keys(headers || {}).sort((a, b) => a.localeCompare(b, 'en'));
  
  sortedKeys.forEach((key) => {
    const value = headers[key];
    const lower = key.toLowerCase();
    if (SENSITIVE_HEADERS.includes(lower)) {
      sanitized[key] = REDACTED;
      c.headersRedacted += 1;
    } else {
      sanitized[key] = value;
    }
  });
  return sanitized;
}

export function redactUrl(url, counters = { headersRedacted: 0, tokensRedacted: 0 }) {
  if (url == null) return '';
  return redactTokensInText(url, counters);
}

/**
 * Recursively redact sensitive keys in a request or response body.
 * @param {any} body - The body to redact
 * @param {object} counters - Redaction counters to track what was redacted
 * @param {number} depth - Current recursion depth (prevents stack overflow)
 * @returns {any} A new object/array with sensitive keys redacted
 */
export function redactBody(body, counters = { headersRedacted: 0, tokensRedacted: 0 }, depth = 0) {
  if (body == null) return body;
  
  const c = ensureCounters(counters);
  
  // DETERMINISM: Prevent unbounded recursion on deeply nested structures
  if (depth > MAX_REDACTION_DEPTH) {
    return body;
  }
  
  if (typeof body === 'string') {
    return redactTokensInText(body, counters);
  }
  
  if (typeof body === 'object' && !Array.isArray(body)) {
    // Handle plain objects by redacting sensitive property names
    const redacted = {};
    
    // DETERMINISM: Sort keys for consistent output
    const sortedKeys = Object.keys(body).sort((a, b) => a.localeCompare(b, 'en'));
    
    sortedKeys.forEach((key) => {
      const value = body[key];
      const keyLower = key.toLowerCase();
      if (SENSITIVE_KEYS.has(keyLower)) {
        // Redact sensitive property values
        c.tokensRedacted += 1;
        redacted[key] = REDACTED;
      } else if (typeof value === 'string') {
        // Redact token patterns within string values
        redacted[key] = redactTokensInText(value, counters);
      } else if (typeof value === 'object' && value !== null) {
        // Recursively redact nested objects/arrays
        redacted[key] = redactBody(value, counters, depth + 1);
      } else {
        redacted[key] = value;
      }
    });
    return redacted;
  }
  
  if (Array.isArray(body)) {
    return body.map(item => redactBody(item, counters, depth + 1));
  }
  
  try {
    const str = JSON.stringify(body);
    const redacted = redactTokensInText(str, counters);
    return JSON.parse(redacted);
  } catch {
    return REDACTED;
  }
}

export function redactConsole(text = '', counters = { headersRedacted: 0, tokensRedacted: 0 }) {
  return redactTokensInText(text, counters);
}

export function redactTokensInText(text, counters = { headersRedacted: 0, tokensRedacted: 0 }) {
  const c = ensureCounters(counters);
  if (text == null) return '';
  if (typeof text !== 'string') return String(text);
  
  let output = text;

  // Query/string parameters FIRST (most specific)
  // Matches token-like parameters in URLs or plain query strings
  output = output.replace(/([?&])(token|auth|access_token|id_token|refresh_token|api_key|key)=([^&#\s]+)/gi, (_match, prefix, key) => {
    c.tokensRedacted += 1;
    return `${prefix}${key}=${REDACTED}`;
  });

  // Bearer tokens
  output = output.replace(/Bearer\s+([A-Za-z0-9._-]+)/gi, (_match, _token) => {
    c.tokensRedacted += 1;
    return `Bearer ${REDACTED}`;
  });

  // JWT-like strings (three base64url-ish segments)
  // More specific: require uppercase or numbers, not just domain patterns like "api.example.com"
  output = output.replace(/[A-Z0-9][A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, (_match) => {
    c.tokensRedacted += 1;
    return REDACTED;
  });

  return output;
}

// Auth-specific helpers (shared across network, traces, auth artifacts)
export function redactAuthCookie(cookie, counters = { headersRedacted: 0, tokensRedacted: 0 }) {
  if (!cookie || typeof cookie !== 'object') return cookie;
  const c = ensureCounters(counters);
  c.tokensRedacted += 1;
  return {
    name: cookie.name,
    value: REDACTED,
    domain: cookie.domain,
    path: cookie.path,
    secure: Boolean(cookie.secure),
    httpOnly: Boolean(cookie.httpOnly),
    sameSite: cookie.sameSite || 'Lax'
  };
}

export function redactAuthHeaderValue(name, value, counters = { headersRedacted: 0, tokensRedacted: 0 }) {
  const c = ensureCounters(counters);
  c.headersRedacted += 1;
  const sanitizedName = name;
  const redactedValue = REDACTED;
  return { name: sanitizedName, value: redactedValue };
}

export function getRedactionCounters(counters) {
  const c = ensureCounters(counters);
  return { headersRedacted: c.headersRedacted, tokensRedacted: c.tokensRedacted };
}

export const REDACTION_PLACEHOLDER = REDACTED;



