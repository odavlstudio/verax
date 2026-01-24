/**
 * Wave 9 — Privacy & Redaction Expansion
 *
 * Redacts sensitive information from all artifacts:
 * - Authorization headers (Authorization, Cookie, X-Auth-Token, X-API-Key)
 * - Bearer tokens (pattern: /bearer\s+\S+/i)
 * - Query parameters (token, auth, session, key, apikey, secret)
 * - localStorage/sessionStorage values
 * - Request/response bodies containing sensitive keys
 *
 * Applied to: network logs, screenshots, traces, findings
 */

const SENSITIVE_HEADERS = [
  'authorization',
  'cookie',
  'x-auth-token',
  'x-api-key',
  'api-key',
  'x-token',
  'x-session-token',
  'set-cookie'
];

const SENSITIVE_QUERY_PARAMS = [
  'token',
  'auth',
  'session',
  'key',
  'apikey',
  'api_key',
  'secret',
  'password',
  'pwd',
  'access_token',
  'refresh_token',
  'auth_token'
];

const BEARER_TOKEN_PATTERN = /bearer\s+\S+/gi;

/**
 * Redact headers object (from network request/response).
 * @param {Object} headers - Headers object
 * @returns {Object} - Redacted headers
 */
export function redactHeaders(headers) {
  if (!headers || typeof headers !== 'object') return headers;

  const redacted = { ...headers };
  for (const key of Object.keys(redacted)) {
    if (SENSITIVE_HEADERS.includes(key.toLowerCase())) {
      redacted[key] = '[REDACTED]';
    }
  }
  return redacted;
}

/**
 * Redact query parameters in a URL string.
 * @param {string} url - Full URL
 * @returns {string} - URL with sensitive query params redacted
 */
export function redactQueryParams(url) {
  if (!url || typeof url !== 'string') return url;

  try {
    const urlObj = new URL(url);
    for (const key of SENSITIVE_QUERY_PARAMS) {
      if (urlObj.searchParams.has(key)) {
        urlObj.searchParams.set(key, '[REDACTED]');
      }
    }
    return urlObj.toString();
  } catch (e) {
    // If URL parsing fails, try regex approach
    return redactBearerTokens(url);
  }
}

/**
 * Redact bearer tokens from any string.
 * @param {string} text - Text possibly containing bearer tokens
 * @returns {string} - Redacted text
 */
export function redactBearerTokens(text) {
  if (!text || typeof text !== 'string') return text;
  return text.replace(BEARER_TOKEN_PATTERN, 'Bearer [REDACTED]');
}

/**
 * Redact localStorage/sessionStorage values.
 * @param {Object} storage - Storage object { key: value }
 * @returns {Object} - Redacted storage
 */
export function redactStorage(storage) {
  if (!storage || typeof storage !== 'object') return storage;

  const redacted = { ...storage };
  for (const key of Object.keys(redacted)) {
    if (isSensitiveStorageKey(key)) {
      redacted[key] = '[REDACTED]';
    }
  }
  return redacted;
}

/**
 * Check if a storage key should be redacted.
 * @param {string} key - Storage key
 * @returns {boolean}
 */
function isSensitiveStorageKey(key) {
  const lower = key.toLowerCase();
  return SENSITIVE_QUERY_PARAMS.some(sensitive => lower.includes(sensitive));
}

/**
 * Redact request body (if it's JSON).
 * @param {*} body - Request body (string or object)
 * @returns {*} - Redacted body
 */
export function redactRequestBody(body) {
  if (!body) return body;

  try {
    let obj = typeof body === 'string' ? JSON.parse(body) : body;
    obj = redactSensitiveFields(obj);
    return typeof body === 'string' ? JSON.stringify(obj) : obj;
  } catch (e) {
    // If not JSON, apply string redaction
    return redactBearerTokens(String(body));
  }
}

/**
 * Deep redact sensitive fields in any object.
 * @param {*} obj - Object to redact
 * @returns {*} - Redacted object
 */
export function redactSensitiveFields(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitiveFields(item));
  }

  const redacted = {};
  for (const [key, value] of Object.entries(obj)) {
    if (isSensitiveStorageKey(key)) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object') {
      redacted[key] = redactSensitiveFields(value);
    } else if (typeof value === 'string') {
      redacted[key] = redactBearerTokens(value);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

/**
 * Redact an entire network log entry.
 * @param {Object} log - Network log entry
 * @returns {Object} - Redacted log
 */
export function redactNetworkLog(log) {
  if (!log || typeof log !== 'object') return log;

  return {
    ...log,
    url: redactQueryParams(log.url),
    requestHeaders: redactHeaders(log.requestHeaders),
    responseHeaders: redactHeaders(log.responseHeaders),
    requestBody: redactRequestBody(log.requestBody),
    responseBody: redactRequestBody(log.responseBody)
  };
}

/**
 * Redact an entire finding object.
 * @param {Object} finding - Finding object
 * @returns {Object} - Redacted finding
 */
export function redactFinding(finding) {
  if (!finding || typeof finding !== 'object') return finding;

  const redacted = { ...finding };
  if (redacted.evidence && typeof redacted.evidence === 'object') {
    // Deep redact all sensitive fields in evidence
    const redactedEvidence = { ...redacted.evidence };
    if (redactedEvidence.url) {
      redactedEvidence.url = redactQueryParams(redactedEvidence.url);
    }
    if (redactedEvidence.headers) {
      redactedEvidence.headers = redactHeaders(redactedEvidence.headers);
    }
    redacted.evidence = redactSensitiveFields(redactedEvidence);
  }
  if (redacted.url) {
    redacted.url = redactQueryParams(redacted.url);
  }
  return redacted;
}

/**
 * Redact an entire trace object.
 * @param {Object} trace - Trace object
 * @returns {Object} - Redacted trace
 */
export function redactTrace(trace) {
  if (!trace || typeof trace !== 'object') return trace;

  const redacted = { ...trace };
  if (redacted.url) {
    redacted.url = redactQueryParams(redacted.url);
  }
  if (redacted.network && Array.isArray(redacted.network)) {
    redacted.network = redacted.network.map(redactNetworkLog);
  }
  if (redacted.interaction) {
    redacted.interaction = redactSensitiveFields(redacted.interaction);
  }
  return redacted;
}



