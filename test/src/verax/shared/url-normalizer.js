/**
 * URL normalization for frontier deduplication and canonical form
 * Prevents infinite frontier growth from utm_* params and other tracking/session identifiers
 */

/**
 * Tracking parameter prefixes to remove from URLs
 */
const TRACKING_PARAM_PREFIXES = [
  'utm_',
  'gclid',
  'fbclid',
  'msclkid',
  'click_id',
  'session',
  'sid',
  'tracking',
  'ref',
  'source',
  'campaign',
  'medium'
];

/**
 * Check if a parameter name should be dropped
 * @param {string} name - Parameter name
 * @returns {boolean}
 */
function isTrackingParam(name) {
  const lowerName = name.toLowerCase();
  return TRACKING_PARAM_PREFIXES.some(prefix =>
    lowerName.startsWith(prefix.toLowerCase())
  );
}

/**
 * Normalize a URL to canonical form:
 * 1. Remove hash fragments
 * 2. Sort query parameters alphabetically
 * 3. Drop tracking/session parameters
 * 4. Decode percent-encoding for consistency
 * 5. Ensure protocol and host are lowercase
 *
 * @param {string} url - URL to normalize
 * @returns {string} Normalized URL
 */
export function normalizeUrl(url) {
  try {
    const parsed = new URL(url);

    // Step 1: Lowercase protocol and host
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase();

    // Step 2: Remove hash
    parsed.hash = '';

    // Step 3: Remove and drop tracking params
    const params = new URLSearchParams(parsed.search);
    const filteredParams = new URLSearchParams();

    // Sort and filter params
    const paramEntries = Array.from(params.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    for (const [name, value] of paramEntries) {
      if (!isTrackingParam(name)) {
        filteredParams.append(name, value);
      }
    }

    // Step 4: Reconstruct search string (sorted)
    parsed.search = filteredParams.toString();

    // Step 5: Return full canonical URL
    return parsed.toString();
  } catch (err) {
    // If URL parsing fails, return original
    return url;
  }
}

/**
 * Alias for normalizeUrl for clarity in frontier deduplication contexts
 * @param {string} url - URL to canonicalize
 * @returns {string} Canonical URL
 */
export function canonicalizeUrl(url) {
  return normalizeUrl(url);
}

/**
 * Drop tracking parameters from a URL
 * Preserves hash and other non-tracking parameters
 *
 * @param {string} url - URL to clean
 * @returns {string} URL with tracking params removed
 */
export function dropTrackingParams(url) {
  try {
    const parsed = new URL(url);
    const params = new URLSearchParams(parsed.search);

    // Filter out tracking params
    for (const name of params.keys()) {
      if (isTrackingParam(name)) {
        params.delete(name);
      }
    }

    parsed.search = params.toString();
    return parsed.toString();
  } catch (err) {
    return url;
  }
}

/**
 * Check if two URLs are equivalent in canonical form
 * @param {string} url1 - First URL
 * @param {string} url2 - Second URL
 * @returns {boolean} True if canonically equivalent
 */
export function areUrlsEquivalent(url1, url2) {
  return normalizeUrl(url1) === normalizeUrl(url2);
}

/**
 * Extract normalized domain from URL
 * @param {string} url - URL
 * @returns {string} Domain (protocol://hostname)
 */
export function getDomain(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}`;
  } catch (err) {
    return '';
  }
}

/**
 * Count tracked parameters in a URL
 * Useful for diagnostics
 * @param {string} url - URL
 * @returns {number} Count of tracking parameters
 */
export function countTrackingParams(url) {
  try {
    const parsed = new URL(url);
    const params = new URLSearchParams(parsed.search);
    let count = 0;

    for (const name of params.keys()) {
      if (isTrackingParam(name)) {
        count++;
      }
    }

    return count;
  } catch (err) {
    return 0;
  }
}
