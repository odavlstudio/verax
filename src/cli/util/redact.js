/**
 * Redaction utilities (Phase 8.2)
 * Deterministic redaction for headers, URLs, bodies, console messages.
 */

const REDACTED = '***REDACTED***';
const SENSITIVE_HEADERS = [
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'proxy-authorization',
];

function ensureCounters(counters) {
  if (!counters) return { headersRedacted: 0, tokensRedacted: 0 };
  if (typeof counters.headersRedacted !== 'number') counters.headersRedacted = 0;
  if (typeof counters.tokensRedacted !== 'number') counters.tokensRedacted = 0;
  return counters;
}

export function redactHeaders(headers = {}, counters = { headersRedacted: 0, tokensRedacted: 0 }) {
  const c = ensureCounters(counters);
  const sanitized = {};
  Object.entries(headers || {}).forEach(([key, value]) => {
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

export function redactBody(body, counters = { headersRedacted: 0, tokensRedacted: 0 }) {
  if (body == null) return body;
  
  const c = ensureCounters(counters);
  
  if (typeof body === 'string') {
    return redactTokensInText(body, counters);
  }
  
  if (typeof body === 'object' && !Array.isArray(body)) {
    // Handle plain objects by redacting sensitive property names
    const redacted = {};
    Object.entries(body).forEach(([key, value]) => {
      const keyLower = key.toLowerCase();
      if (keyLower === 'token' || keyLower === 'api_key' || keyLower === 'access_token' || 
          keyLower === 'password' || keyLower === 'secret') {
        // Redact sensitive property values
        c.tokensRedacted += 1;
        redacted[key] = REDACTED;
      } else if (typeof value === 'string') {
        // Redact token patterns within string values
        redacted[key] = redactTokensInText(value, counters);
      } else if (typeof value === 'object' && value !== null) {
        // Recursively redact nested objects/arrays
        redacted[key] = redactBody(value, counters);
      } else {
        redacted[key] = value;
      }
    });
    return redacted;
  }
  
  if (Array.isArray(body)) {
    return body.map(item => redactBody(item, counters));
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

  // Query/string parameters FIRST (most specific - only api_key, access_token)
  // Use word boundary \b to avoid matching within words like "token" inside "example.com"
  output = output.replace(/\b(api_key|access_token)=([^&\s]+)/gi, (match, key, value) => {
    // Skip if value is itself just REDACTED (avoid double-redacting)
    if (value === REDACTED) return match;
    c.tokensRedacted += 1;
    return `${key}=${REDACTED}`;
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

export function getRedactionCounters(counters) {
  const c = ensureCounters(counters);
  return { headersRedacted: c.headersRedacted, tokensRedacted: c.tokensRedacted };
}

export const REDACTION_PLACEHOLDER = REDACTED;
