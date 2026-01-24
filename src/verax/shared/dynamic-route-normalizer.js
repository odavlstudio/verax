/**
 * DYNAMIC ROUTE UTILITIES
 * 
 * Safely converts dynamic route patterns into executable example paths.
 * Patterns are deterministic - always produce the same example paths.
 * 
 * Supported patterns:
 * - React Router: /users/:id
 * - Next.js: /users/[id], /blog/[slug]
 * - Vue Router: /users/:id
 * - Template literals: /blog/${slug}
 */

/**
 * Detect if a path contains dynamic parameters.
 * 
 * @param {string} path - Route path
 * @returns {boolean} - True if path contains dynamic parameters
 */
export function isDynamicPath(path) {
  if (!path || typeof path !== 'string') return false;
  // React/Vue Router :param
  if (/:(\w+)/.test(path)) return true;
  // Next.js [param]
  if (/\[\w+\]/.test(path)) return true;
  // Template literal ${param}
  if (/\$\{\w+\}/.test(path)) return true;
  return false;
}

/**
 * Alternative name for isDynamicPath for compatibility.
 */
export function isDynamicRoute(path) {
  return isDynamicPath(path);
}

/**
 * Generate a deterministic example value for a parameter.
 * Always produces the same value for the same parameter name.
 * 
 * @param {string} paramName - Parameter name
 * @returns {string} - Example value
 */
function getExampleValue(paramName) {
  // Parameter name heuristics (deterministic)
  const lowerName = paramName.toLowerCase();
  
  // IDs → numeric
  if (lowerName.includes('id') || 
      lowerName.includes('num') || 
      lowerName.includes('index')) {
    return '1';
  }
  
  // Slugs, names, titles, etc → 'example'
  if (lowerName.includes('slug') || 
      lowerName.includes('name') || 
      lowerName.includes('title') || 
      lowerName.includes('username') ||
      lowerName.includes('email') ||
      lowerName.includes('author')) {
    return 'example';
  }
  
  // UUIDs → 'uuid-example'
  if (lowerName.includes('uuid') || lowerName.includes('guid')) {
    return 'uuid-example';
  }
  
  // Default: use 'example'
  return 'example';
}

/**
 * Convert a dynamic route pattern into an executable example path.
 * 
 * @param {string} originalPath - Route with dynamic parameters
 * @returns {Object|null} - { examplePath, originalPattern, isDynamic } or null
 */
export function createExamplePath(originalPath) {
  if (!originalPath || typeof originalPath !== 'string') {
    return null;
  }
  
  if (!isDynamicPath(originalPath)) {
    return null;
  }
  
  let examplePath = originalPath;
  let _isDynamic = false;
  const parameters = new Set();
  
  // Replace React/Vue :param
  examplePath = examplePath.replace(/:(\w+)/g, (match, paramName) => {
    _isDynamic = true;
    parameters.add(paramName);
    return getExampleValue(paramName);
  });
  
  // Replace Next.js [param]
  examplePath = examplePath.replace(/\[(\w+)\]/g, (match, paramName) => {
    _isDynamic = true;
    parameters.add(paramName);
    return getExampleValue(paramName);
  });
  
  // Replace template ${param}
  examplePath = examplePath.replace(/\$\{(\w+)\}/g, (match, paramName) => {
    _isDynamic = true;
    parameters.add(paramName);
    return getExampleValue(paramName);
  });
  
  return {
    examplePath,
    originalPattern: originalPath,
    isDynamic: true,
    exampleExecution: true,
    parameters: Array.from(parameters)
  };
}

/**
 * Normalize a dynamic route pattern (alias for createExamplePath).
 * 
 * @param {string} pattern - Original route pattern
 * @returns {Object|null} - Normalized result
 */
export function normalizeDynamicRoute(pattern) {
  return createExamplePath(pattern);
}

/**
 * Check if a target can be safely normalized (is string literal or simple pattern).
 * 
 * @param {string} target - Navigation target
 * @returns {boolean} - True if can be normalized safely
 */
export function canNormalizeTarget(target) {
  if (!target || typeof target !== 'string') return false;
  
  // Pure variable reference like ${path} - can't normalize
  if (target === '${path}' || target === '${id}') {
    return false;
  }
  
  return true;
}

/**
 * Normalize a navigation target with potential template literals.
 * 
 * @param {string} originalTarget - Original target string
 * @returns {Object} - { exampleTarget, originalTarget, isDynamic, parameters }
 */
export function normalizeNavigationTarget(originalTarget) {
  if (!canNormalizeTarget(originalTarget)) {
    return {
      exampleTarget: null,
      originalTarget: null,
      isDynamic: false,
      parameters: []
    };
  }
  
  // Check if it has template literals
  const templateRegex = /\$\{(\w+)\}/g;
  const matches = [...originalTarget.matchAll(templateRegex)];
  
  if (matches.length === 0) {
    // No template literals - static path
    return {
      exampleTarget: originalTarget,
      originalTarget: null,
      isDynamic: false,
      parameters: []
    };
  }
  
  // Extract parameter names
  const parameters = matches.map(m => m[1]);
  
  // Replace ${param} with example values
  let exampleTarget = originalTarget;
  for (const match of matches) {
    const paramName = match[1];
    const exampleValue = getExampleValue(paramName);
    exampleTarget = exampleTarget.replace(match[0], exampleValue);
  }
  
  return {
    exampleTarget,
    originalTarget,
    isDynamic: true,
    parameters
  };
}

/**
 * Normalize a template literal string (for backwards compatibility).
 * 
 * @param {string} template - Template literal or string
 * @returns {Object|null} - Result or null
 */
export function normalizeTemplateLiteral(template) {
  if (!template || typeof template !== 'string') {
    return null;
  }
  
  const result = normalizeNavigationTarget(template);
  
  if (result.isDynamic) {
    return {
      originalPattern: result.originalTarget,
      examplePath: result.exampleTarget,
      isDynamic: true,
      exampleExecution: true,
      parameters: result.parameters
    };
  }
  
  return null;
}



