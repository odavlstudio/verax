/**
 * Route intelligence pattern utilities (private helpers)
 *
 * NOTE: Static/declarative analysis only. Runtime/dynamic verification lives in
 * dynamic-route-intelligence.js.
 */

/**
 * Extract parameter names from dynamic route path (static analysis).
 * Supports React/Vue (:param) and Next.js ([param]) styles.
 * @param {string} path
 * @returns {string[]}
 */
export function extractParameters(path) {
  const parameters = [];

  if (!path || typeof path !== 'string') return parameters;

  // React/Vue Router :param
  const reactMatches = path.matchAll(/:(\w+)/g);
  for (const match of reactMatches) {
    parameters.push(match[1]);
  }

  // Next.js [param]
  const nextMatches = path.matchAll(/\[(\w+)\]/g);
  for (const match of nextMatches) {
    parameters.push(match[1]);
  }

  return parameters;
}

/**
 * Match a target path against a dynamic route pattern (static analysis only).
 * @param {string} target
 * @param {string} pattern
 * @returns {{ matched: boolean, groups?: string[] }|null}
 */
export function matchDynamicPattern(target, pattern) {
  if (!target || !pattern) return null;

  let regexPattern = pattern;

  // Replace :param with (\w+)
  regexPattern = regexPattern.replace(/:(\w+)/g, '(\\w+)');

  // Replace [param] with (\w+)
  regexPattern = regexPattern.replace(/\[(\w+)\]/g, '(\\w+)');

  // Escape other special characters
  regexPattern = regexPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Restore the capture groups
  regexPattern = regexPattern.replace(/\\\(\\\\w\+\\\)/g, '(\\w+)');

  const regex = new RegExp(`^${regexPattern}$`);
  const match = target.match(regex);

  return match ? { matched: true, groups: match.slice(1) } : null;
}

/**
 * Extract path from URL, supporting absolute and relative inputs.
 * @param {string} url
 * @returns {string}
 */
export function extractPathFromUrl(url) {
  if (!url || typeof url !== 'string') return '';

  try {
    const urlObj = new URL(url);
    return urlObj.pathname;
  } catch {
    const pathMatch = url.match(/^([^?#]+)/);
    return pathMatch ? pathMatch[1] : url;
  }
}
