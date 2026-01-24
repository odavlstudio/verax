/**
 * SvelteKit Framework-Specific Expectation Extractor
 * PHASE 4: Production-grade literal-only extraction with deterministic IDs
 * 
 * Supported patterns (literal-only):
 * - <a href="/path"> (static only)
 * - goto('/path') (static only)
 * - <form action="/path"> (static only)
 * - Filesystem routes: src/routes/+page.svelte → "/"
 * 
 * Skip policy:
 * - Dynamic: variables, template strings, function calls, ternaries
 * - Params: [slug], [...rest], [[optional]] in route paths
 */

import { expIdFromHash } from '../support/idgen.js';

/**
 * Extract expectations from Svelte files
 * @param {string} content - Svelte file content
 * @param {string} filePath - File path for location tracking
 * @param {string} relPath - Relative path for reporting
 * @returns {Object} { expectations: Array, skipped: Object }
 */
export function extractSvelteKitExpectations(content, filePath, relPath) {
  const expectations = [];
  const skipped = {
    dynamic: 0,
    params: 0,
  };
  
  // Extract <a href="/path"> - static only
  const hrefRegex = /<a\s+[^>]*href=["']([^"']+)["']/gi;
  let match;
  
  while ((match = hrefRegex.exec(content)) !== null) {
    const path = match[1];
    
    // Skip dynamic paths (variables, template strings, brackets)
    if (path.includes('$') || path.includes('{') || path.includes('(')) {
      skipped.dynamic++;
      continue;
    }
    
    // Skip SvelteKit dynamic route segments
    if (path.includes('[')) {
      skipped.params++;
      continue;
    }
    
    const lineNum = content.substring(0, match.index).split('\n').length;
    const colNum = match.index - content.lastIndexOf('\n', match.index);
    
    // Only extract static paths
    if (path.startsWith('/') || path.startsWith('http')) {
      const id = expIdFromHash(relPath, lineNum, colNum, 'navigation', path);
      expectations.push({
        id,
        kind: 'navigation',
        value: path,
        type: 'navigation',
        category: 'expectation',
        confidence: 0.95,
        source: {
          file: relPath,
          filePath,
          line: lineNum,
          column: colNum,
          pattern: '<a href>',
        },
        promise: {
          kind: 'navigation',
          value: path,
          description: `Svelte link navigation to ${path}`,
        },
      });
    }
  }
  
  // Extract goto("/path") - static only
  const gotoRegex = /goto\(["']([^"']+)["']\)/gi;
  
  while ((match = gotoRegex.exec(content)) !== null) {
    const path = match[1];
    
    // Skip dynamic paths (variables, template strings, brackets)
    if (path.includes('$') || path.includes('{') || path.includes('(')) {
      skipped.dynamic++;
      continue;
    }
    
    // Skip SvelteKit dynamic route segments
    if (path.includes('[')) {
      skipped.params++;
      continue;
    }
    
    const lineNum = content.substring(0, match.index).split('\n').length;
    const colNum = match.index - content.lastIndexOf('\n', match.index);
    
    if (path.startsWith('/') || path.startsWith('http')) {
      const id = expIdFromHash(relPath, lineNum, colNum, 'navigation', path);
      expectations.push({
        id,
        kind: 'navigation',
        value: path,
        type: 'navigation',
        category: 'expectation',
        confidence: 0.90,
        source: {
          file: relPath,
          filePath,
          line: lineNum,
          column: colNum,
          pattern: 'goto()',
        },
        promise: {
          kind: 'navigation',
          value: path,
          description: `SvelteKit goto navigation to ${path}`,
        },
      });
    }
  }
  
  // Extract <form action="/path"> - static only
  const formActionRegex = /<form\s+[^>]*action=["']([^"']+)["']/gi;
  
  while ((match = formActionRegex.exec(content)) !== null) {
    const path = match[1];
    
    // Skip dynamic paths (variables, template strings, brackets)
    if (path.includes('$') || path.includes('{') || path.includes('(')) {
      skipped.dynamic++;
      continue;
    }
    
    // Skip SvelteKit dynamic route segments
    if (path.includes('[')) {
      skipped.params++;
      continue;
    }
    
    const lineNum = content.substring(0, match.index).split('\n').length;
    const colNum = match.index - content.lastIndexOf('\n', match.index);
    
    if (path.startsWith('/') || path.startsWith('http')) {
      const id = expIdFromHash(relPath, lineNum, colNum, 'form-submission', path);
      expectations.push({
        id,
        kind: 'form-submission',
        value: path,
        type: 'navigation',
        category: 'expectation',
        confidence: 0.85,
        source: {
          file: relPath,
          filePath,
          line: lineNum,
          column: colNum,
          pattern: '<form action>',
        },
        promise: {
          kind: 'form-submission',
          value: path,
          description: `SvelteKit form submission to ${path}`,
        },
      });
    }
  }
  
  return { expectations, skipped };
}

/**
 * Extract filesystem routes from SvelteKit route structure
 * @param {string} filePath - Absolute file path
 * @param {string} relPath - Relative path for reporting
 * @returns {Object} { expectations: Array, skipped: Object }
 */
export function extractSvelteKitFilesystemRoutes(filePath, relPath, _projectRoot) {
  const expectations = [];
  const skipped = {
    params: 0,
  };
  
  // Convert file path to route path
  // Example: src/routes/about/+page.svelte → /about
  // Example: src/routes/+page.svelte → /
  
  const routesMatch = relPath.match(/src[/\\]routes[/\\](.*)$/);
  if (!routesMatch) {
    return { expectations, skipped };
  }
  
  let routePath = routesMatch[1];
  
  // Remove +page.svelte, +layout.svelte, +server.js, etc.
  routePath = routePath.replace(/\+page\.(svelte|js|ts)$/, '');
  routePath = routePath.replace(/\+layout\.(svelte|js|ts)$/, '');
  routePath = routePath.replace(/\+server\.(js|ts)$/, '');
  
  // Check for dynamic route segments
  if (routePath.includes('[')) {
    skipped.params++;
    return { expectations, skipped };
  }
  
  // Clean up path
  routePath = routePath.replace(/[/\\]+$/, ''); // Remove trailing slashes
  routePath = routePath.replace(/\\/g, '/'); // Normalize to forward slashes
  
  // Convert to URL path
  let urlPath = '/' + routePath;
  if (urlPath.endsWith('/') && urlPath !== '/') {
    urlPath = urlPath.slice(0, -1);
  }
  
  // Generate deterministic ID for filesystem route
  const id = expIdFromHash(relPath, 1, 0, 'filesystem-route', urlPath);
  
  expectations.push({
    id,
    kind: 'filesystem-route',
    value: urlPath,
    type: 'navigation',
    category: 'expectation',
    confidence: 0.95,
    source: {
      file: relPath,
      filePath,
      line: 1,
      column: 0,
      pattern: 'SvelteKit filesystem route',
    },
    promise: {
      kind: 'navigation',
      value: urlPath,
      description: `SvelteKit filesystem route ${urlPath}`,
    },
  });
  
  return { expectations, skipped };
}
