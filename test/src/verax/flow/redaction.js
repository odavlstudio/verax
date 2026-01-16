/**
 * Wave 7 — Redaction Utility
 *
 * Ensures secrets are never exposed in artifacts, logs, or traces.
 * Replaces resolved secret values with "***REDACTED***".
 */

/**
 * Redact secrets from a string.
 *
 * @param {string} str - Input string
 * @param {Set} secretValues - Set of actual secret values to replace
 * @returns {string} - Redacted string
 */
export function redactString(str, secretValues = new Set()) {
  if (typeof str !== 'string' || secretValues.size === 0) {
    return str;
  }

  let result = str;
  for (const secret of secretValues) {
    if (secret && typeof secret === 'string') {
      // Use global replace to catch all occurrences
      const escaped = secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(escaped, 'g'), '***REDACTED***');
    }
  }
  return result;
}

/**
 * Redact secrets from a JavaScript object recursively.
 *
 * @param {*} obj - Object to redact
 * @param {Set} secretValues - Set of secret values to replace
 * @returns {*} - Redacted object (deep copy)
 */
export function redactObject(obj, secretValues = new Set()) {
  if (secretValues.size === 0) {
    return obj;
  }

  if (typeof obj === 'string') {
    return redactString(obj, secretValues);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => redactObject(item, secretValues));
  }

  if (obj !== null && typeof obj === 'object') {
    const redacted = {};
    for (const [key, value] of Object.entries(obj)) {
      redacted[key] = redactObject(value, secretValues);
    }
    return redacted;
  }

  return obj;
}

/**
 * Redact secrets from JSON string.
 *
 * @param {string} jsonStr - JSON string
 * @param {Set} secretValues - Set of secret values
 * @returns {string} - Redacted JSON string
 */
export function redactJSON(jsonStr, secretValues = new Set()) {
  if (typeof jsonStr !== 'string' || secretValues.size === 0) {
    return jsonStr;
  }
  return redactString(jsonStr, secretValues);
}
