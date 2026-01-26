/**
 * GATE 4: Network Trace Sanitizer
 * 
 * Removes sensitive data from HTTP request/response traces before writing to artifacts.
 * - Masks query parameters (token, auth, session, password, email, etc.)
 * - Strips request/response bodies
 * - Masks sensitive headers (Authorization, Cookie, X-API-Key, etc.)
 * - Ensures network traces are safe for inclusion in canonical artifacts
 */

import { SENSITIVE_QUERY_PATTERNS } from './evidence-security-policy.js';

/**
 * Sensitive HTTP header names (case-insensitive)
 */
const SENSITIVE_HEADERS = [
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token',
  'x-csrf-token',
  'x-access-token',
  'x-refresh-token',
  'x-token',
  'bearer',
  'authentication',
  'www-authenticate',
  'proxy-authenticate',
  'x-amzn-trace-id',
  'x-correlation-id',
  'traceparent',
  'tracestate',
];

/**
 * Mask all sensitive query parameters in a URL string.
 * Example: /api/login?email=user@example.com&token=abc123
 * Result: /api/login?email=[REDACTED]&token=[REDACTED]
 * 
 * @param {string} url - URL to sanitize
 * @returns {string} - URL with sensitive query params masked
 */
export function maskSensitiveQueryParams(url) {
  if (!url || typeof url !== 'string') {
    return url;
  }

  try {
    const urlObj = new URL(url);
    const params = new URLSearchParams(urlObj.search);
    let masked = false;

    // Find and mask sensitive parameters
    for (const [key] of params.entries()) {
      // Check if parameter name matches any sensitive pattern
      const testUrl = `?${key}=value`;
      const isSensitive = SENSITIVE_QUERY_PATTERNS.some(pattern => pattern.test(testUrl));

      if (isSensitive) {
        params.set(key, '[REDACTED]');
        masked = true;
      }
    }

    // Reconstruct URL if changes were made
    if (masked) {
      urlObj.search = params.toString();
      return urlObj.toString();
    }

    return url;
  } catch (error) {
    // If URL parsing fails, return original (malformed URLs)
    return url;
  }
}

/**
 * Mask sensitive headers in request/response headers object.
 * Modifies header object in-place for efficiency.
 * 
 * Example: { Authorization: 'Bearer token123', 'User-Agent': 'Chrome' }
 * Result: { Authorization: '[REDACTED]', 'User-Agent': 'Chrome' }
 * 
 * @param {Object} headers - Headers object
 * @returns {Object} - Headers with sensitive values masked
 */
export function maskSensitiveHeaders(headers) {
  if (!headers || typeof headers !== 'object') {
    return headers;
  }

  const masked = { ...headers };

  // Check all header keys (case-insensitive matching)
  Object.keys(masked).forEach(key => {
    const lowerKey = key.toLowerCase();
    
    // Check if this header key is in the sensitive list
    if (SENSITIVE_HEADERS.includes(lowerKey)) {
      masked[key] = '[REDACTED]';
    }

    // Also check for sensitive patterns in header values (e.g., Bearer tokens)
    if (typeof masked[key] === 'string') {
      // Mask patterns like "Bearer <token>" or "token=<value>"
      if (/^bearer\s+/i.test(masked[key])) {
        masked[key] = 'Bearer [REDACTED]';
      }
      // Mask common token prefixes
      else if (/^(jwt|token|key)\s+/i.test(masked[key])) {
        masked[key] = masked[key].replace(/^(\w+)\s+.+$/i, '$1 [REDACTED]');
      }
    }
  });

  return masked;
}

/**
 * Sanitize a network trace entry (HTTP request/response metadata).
 * Removes bodies, masks sensitive headers and query params.
 * 
 * @param {Object} trace - Network trace object
 * @returns {Object} - Sanitized trace (safe for canonical artifacts)
 */
export function sanitizeNetworkTrace(trace) {
  if (!trace || typeof trace !== 'object') {
    return trace;
  }

  const sanitized = { ...trace };

  // Sanitize request
  if (sanitized.request && typeof sanitized.request === 'object') {
    sanitized.request = { ...sanitized.request };

    // Remove request body (may contain credentials)
    delete sanitized.request.body;
    delete sanitized.request.postData;
    delete sanitized.request.bodySize;

    // Mask request URL query parameters
    if (sanitized.request.url) {
      sanitized.request.url = maskSensitiveQueryParams(sanitized.request.url);
    }

    // Mask request headers
    if (sanitized.request.headers) {
      sanitized.request.headers = maskSensitiveHeaders(sanitized.request.headers);
    }
  }

  // Sanitize response
  if (sanitized.response && typeof sanitized.response === 'object') {
    sanitized.response = { ...sanitized.response };

    // Remove response body (may contain credentials, PII, secrets)
    delete sanitized.response.body;
    delete sanitized.response.content;
    delete sanitized.response.bodySize;

    // Mask response headers (e.g., Set-Cookie)
    if (sanitized.response.headers) {
      sanitized.response.headers = maskSensitiveHeaders(sanitized.response.headers);
    }
  }

  return sanitized;
}

/**
 * Sanitize an array of network traces.
 * 
 * @param {Array<Object>} traces - Array of network traces
 * @returns {Array<Object>} - Array of sanitized traces
 */
export function sanitizeNetworkTraces(traces) {
  if (!Array.isArray(traces)) {
    return traces;
  }

  return traces.map(trace => sanitizeNetworkTrace(trace));
}

/**
 * Check if a URL contains sensitive query parameters.
 * 
 * @param {string} url - URL to check
 * @returns {boolean} - True if URL has sensitive params
 */
export function hasSensitiveQueryParams(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const urlObj = new URL(url);
    const queryString = urlObj.search;
    
    return SENSITIVE_QUERY_PATTERNS.some(pattern => pattern.test(queryString));
  } catch (error) {
    // Malformed URL, assume no sensitive params
    return false;
  }
}

/**
 * Check if headers contain sensitive information.
 * 
 * @param {Object} headers - Headers object to check
 * @returns {boolean} - True if headers have sensitive data
 */
export function hasSensitiveHeaders(headers) {
  if (!headers || typeof headers !== 'object') {
    return false;
  }

  // Check if any header key is in the sensitive list
  return Object.keys(headers).some(key => {
    const lowerKey = key.toLowerCase();
    return SENSITIVE_HEADERS.includes(lowerKey);
  });
}

/**
 * Validate that a trace is safe for canonical artifacts.
 * Returns { safe: boolean, issues: Array<string> }
 * 
 * @param {Object} trace - Network trace to validate
 * @returns {Object} - Validation result
 */
export function validateTraceIsSafe(trace) {
  const issues = [];

  if (!trace || typeof trace !== 'object') {
    return { safe: true, issues: [] };
  }

  // Check request body
  if (trace.request && trace.request.body) {
    issues.push('Request body present (should be removed)');
  }

  // Check response body
  if (trace.response && trace.response.body) {
    issues.push('Response body present (should be removed)');
  }

  // Check for sensitive query params in request URL
  if (trace.request && trace.request.url && hasSensitiveQueryParams(trace.request.url)) {
    issues.push(`Request URL contains sensitive query params: ${trace.request.url}`);
  }

  // Check for sensitive headers
  if (trace.request && trace.request.headers && hasSensitiveHeaders(trace.request.headers)) {
    issues.push('Request headers contain sensitive information');
  }
  if (trace.response && trace.response.headers && hasSensitiveHeaders(trace.response.headers)) {
    issues.push('Response headers contain sensitive information');
  }

  return {
    safe: issues.length === 0,
    issues
  };
}

/**
 * Get a summary of redactions applied to a trace.
 * 
 * @param {Object} before - Original trace
 * @param {Object} after - Sanitized trace
 * @returns {Object} - Summary of changes
 */
export function getRedactionSummary(before, after) {
  const summary = {
    bodiesRemoved: [],
    paramsRedacted: [],
    headersRedacted: [],
  };

  if (before.request && !after.request) {
    summary.bodiesRemoved.push('request');
  } else if (before.request?.body && !after.request?.body) {
    summary.bodiesRemoved.push('request-body');
  }

  if (before.response && !after.response) {
    summary.bodiesRemoved.push('response');
  } else if (before.response?.body && !after.response?.body) {
    summary.bodiesRemoved.push('response-body');
  }

  // Note which query params were redacted
  if (before.request?.url && before.request.url !== after.request?.url) {
    summary.paramsRedacted.push('request-url-query-params');
  }

  // Note which headers were redacted
  const beforeReqHeaders = Object.keys(before.request?.headers || {});
  
  for (const key of beforeReqHeaders) {
    if (before.request.headers[key] !== after.request?.headers?.[key]) {
      summary.headersRedacted.push(`request-${key}`);
    }
  }

  return summary;
}
