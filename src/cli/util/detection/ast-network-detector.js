import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';

// Handle default export from @babel/traverse (CommonJS/ESM compatibility)
const traverse = _traverse.default || _traverse;

/**
 * PHASE 9 — AST-Based Network Detection
 * 
 * Production-quality AST-based network call detection.
 * Detects fetch/axios/XMLHttpRequest calls in nested contexts:
 * - Event handlers (onClick, onSubmit, etc.)
 * - React hooks (useEffect, useCallback, etc.)
 * - Custom functions bound to UI interactions
 * 
 * Features:
 * - AST source code extraction for evidence
 * - False-positive filtering (analytics)
 * - UI-bound handler detection
 * - Deterministic behavior
 */

/**
 * Detect network calls in source code using AST parsing
 * @param {string} content - File content
 * @param {string} _filePath - Absolute file path (unused)
 * @param {string} _relPath - Relative path from source root (unused)
 * @returns {Array} Array of detected network calls with metadata including AST source
 */
export function detectNetworkCallsAST(content, _filePath, _relPath) {
  const detections = [];
  const lines = content.split('\n');
  
  try {
    // Parse with comprehensive plugin support
    const ast = parse(content, {
      sourceType: 'module',
      plugins: [
        'jsx',
        'typescript',
        'classProperties',
        'optionalChaining',
        'nullishCoalescingOperator',
        'dynamicImport',
        ['decorators', { decoratorsBeforeExport: true }],
        'topLevelAwait',
        'objectRestSpread',
        'asyncGenerators',
        'functionBind',
        'exportDefaultFrom',
        'exportNamespaceFrom',
      ],
      errorRecovery: true,
    });
    
    // Track axios imports and aliases
    const axiosBindings = new Set();
    
    traverse(ast, {
      // Track axios imports
      ImportDeclaration(path) {
        if (path.node.source.value === 'axios') {
          path.node.specifiers.forEach((spec) => {
            if (spec.type === 'ImportDefaultSpecifier' || 
                spec.type === 'ImportSpecifier') {
              axiosBindings.add(spec.local.name);
            }
          });
        }
      },
      
      // Detect require('axios')
      VariableDeclarator(path) {
        if (path.node.init?.type === 'CallExpression' &&
            path.node.init.callee.name === 'require' &&
            path.node.init.arguments[0]?.value === 'axios') {
          if (path.node.id.type === 'Identifier') {
            axiosBindings.add(path.node.id.name);
          }
        }
      },
      
      // Detect fetch() calls
      CallExpression(path) {
        const { node } = path;
        const loc = node.loc;
        
        // Check for fetch(...)
        if (node.callee.type === 'Identifier' && node.callee.name === 'fetch') {
          // Check if fetch is shadowed in local scope
          if (path.scope.hasBinding('fetch')) {
            return; // Shadowed by local variable/parameter
          }
          
          const urlArg = node.arguments[0];
          const initArg = node.arguments[1];
          const url = extractUrl(urlArg);
          
          // PHASE 9: Filter false positives (analytics calls)
          if (isAnalyticsCall(url, path)) {
            return; // Skip analytics - not a user-facing promise
          }
          
          const context = inferContext(path);
          const isUIBound = isUIBoundHandler(path);
          
          const detection = {
            kind: 'fetch',
            url: url,
            method: extractMethod(initArg, 'GET'),
            location: {
              line: loc?.start.line,
              column: loc?.start.column,
            },
            context: context,
            isUIBound: isUIBound,
            astSource: extractASTSource(node, lines, loc),
          };
          
          detections.push(detection);
        }
        
        // Check for globalThis.fetch(...)
        if (node.callee.type === 'MemberExpression' &&
            node.callee.object.name === 'globalThis' &&
            node.callee.property.name === 'fetch') {
          const urlArg = node.arguments[0];
          const initArg = node.arguments[1];
          const url = extractUrl(urlArg);
          
          // PHASE 9: Filter false positives (analytics calls)
          if (isAnalyticsCall(url, path)) {
            return; // Skip analytics - not a user-facing promise
          }
          
          const context = inferContext(path);
          const isUIBound = isUIBoundHandler(path);
          
          const detection = {
            kind: 'fetch',
            url: url,
            method: extractMethod(initArg, 'GET'),
            location: {
              line: loc?.start.line,
              column: loc?.start.column,
            },
            context: context,
            isUIBound: isUIBound,
            astSource: extractASTSource(node, lines, loc),
          };
          
          detections.push(detection);
        }
        
        // Check for axios(...) or axios.get/post/etc(...)
        if (isAxiosCall(node, axiosBindings)) {
          const method = extractAxiosMethod(node);
          const urlArg = getAxiosUrlArg(node, method);
          const url = extractUrl(urlArg);
          
          // PHASE 9: Filter false positives (analytics calls)
          if (isAnalyticsCall(url, path)) {
            return; // Skip analytics - not a user-facing promise
          }
          
          const context = inferContext(path);
          const isUIBound = isUIBoundHandler(path);
          
          const detection = {
            kind: 'axios',
            url: url,
            method: method.toUpperCase(),
            location: {
              line: loc?.start.line,
              column: loc?.start.column,
            },
            context: context,
            isUIBound: isUIBound,
            astSource: extractASTSource(node, lines, loc),
          };
          
          detections.push(detection);
        }
      },
      
      // Detect new XMLHttpRequest()
      NewExpression(path) {
        const { node } = path;
        const loc = node.loc;
        
        if (node.callee.type === 'Identifier' && 
            node.callee.name === 'XMLHttpRequest') {
          
          // Try to find associated .open() call
          const xhrDetails = findXhrOpen(path);
          
          const url = xhrDetails.url || '<dynamic>';
          
          // PHASE 9: Filter false positives (analytics calls)
          if (isAnalyticsCall(url, path)) {
            return; // Skip analytics - not a user-facing promise
          }
          
          const context = inferContext(path);
          const isUIBound = isUIBoundHandler(path);
          
          const detection = {
            kind: 'xhr',
            url: url,
            method: xhrDetails.method || 'GET',
            location: {
              line: loc?.start.line,
              column: loc?.start.column,
            },
            context: context,
            isUIBound: isUIBound,
            astSource: extractASTSource(node, lines, loc),
          };
          
          detections.push(detection);
        }
      },
    });
    
  } catch (error) {
    // Parse errors are silently skipped (malformed code, etc.)
    // In production, you might log these for debugging
  }
  
  return detections;
}

/**
 * Check if a call expression is an axios call
 */
function isAxiosCall(node, axiosBindings) {
  // Direct axios call: axios(...)
  if (node.callee.type === 'Identifier' && 
      axiosBindings.has(node.callee.name)) {
    return true;
  }
  
  // Method call: axios.get/post/etc(...)
  if (node.callee.type === 'MemberExpression' &&
      node.callee.object.type === 'Identifier' &&
      axiosBindings.has(node.callee.object.name)) {
    const method = node.callee.property.name;
    return ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'request'].includes(method);
  }
  
  return false;
}

/**
 * Extract HTTP method from axios call
 */
function extractAxiosMethod(node) {
  if (node.callee.type === 'MemberExpression') {
    return node.callee.property.name; // get, post, etc.
  }
  
  // Direct axios(...) call - check config.method
  const configArg = node.arguments[0];
  if (configArg?.type === 'ObjectExpression') {
    const methodProp = configArg.properties.find(
      p => p.key?.name === 'method'
    );
    if (methodProp?.value.type === 'StringLiteral') {
      return methodProp.value.value;
    }
  }
  
  return 'request'; // default for axios(config)
}

/**
 * Get URL argument for axios call
 */
function getAxiosUrlArg(node, method) {
  // axios.get(url, ...) - URL is first arg
  if (method !== 'request' && node.callee.type === 'MemberExpression') {
    return node.arguments[0];
  }
  
  // axios(config) - URL is in config.url
  const configArg = node.arguments[0];
  if (configArg?.type === 'ObjectExpression') {
    const urlProp = configArg.properties.find(
      p => p.key?.name === 'url'
    );
    return urlProp?.value;
  }
  
  return null;
}

/**
 * Extract URL from argument node
 */
function extractUrl(urlArg) {
  if (!urlArg) {
    return '<dynamic>';
  }
  
  // String literal: "https://example.com"
  if (urlArg.type === 'StringLiteral') {
    return urlArg.value;
  }
  
  // Template literal without expressions: `https://example.com`
  if (urlArg.type === 'TemplateLiteral' && 
      urlArg.expressions.length === 0) {
    return urlArg.quasis[0].value.cooked;
  }
  
  // Template literal with expressions: `https://example.com/${id}`
  if (urlArg.type === 'TemplateLiteral' && 
      urlArg.expressions.length > 0) {
    return '<dynamic>';
  }
  
  // Any other expression (variable, computation, etc.)
  return '<dynamic>';
}

/**
 * Extract HTTP method from fetch init object
 */
function extractMethod(initArg, defaultMethod = 'GET') {
  if (!initArg || initArg.type !== 'ObjectExpression') {
    return defaultMethod;
  }
  
  const methodProp = initArg.properties.find(
    p => p.key?.name === 'method'
  );
  
  if (methodProp?.value.type === 'StringLiteral') {
    return methodProp.value.value.toUpperCase();
  }
  
  return defaultMethod;
}

/**
 * Infer execution context (handler, hook, component, etc.)
 */
function inferContext(path) {
  const contexts = [];
  
  let current = path.parentPath;
  while (current) {
    const node = current.node;
    
    // Event handler prop: onClick={() => ...}
    if (current.isJSXAttribute()) {
      const attrName = node.name.name;
      if (attrName && attrName.startsWith('on')) {
        contexts.push(`handler:${attrName}`);
      }
    }
    
    // Hook: useEffect(() => ...), useCallback(() => ...)
    if (current.isCallExpression() && 
        current.node.callee.type === 'Identifier') {
      const calleeName = current.node.callee.name;
      if (calleeName.startsWith('use')) {
        contexts.push(`hook:${calleeName}`);
      }
    }
    
    // Function/Arrow in component
    if (current.isFunctionDeclaration() || 
        current.isFunctionExpression() || 
        current.isArrowFunctionExpression()) {
      const funcName = getFunctionName(current);
      if (funcName) {
        // Check if it looks like a handler
        if (funcName.startsWith('handle') || funcName.startsWith('on')) {
          contexts.push(`handler:${funcName}`);
        } else {
          contexts.push(`function:${funcName}`);
        }
      }
    }
    
    current = current.parentPath;
  }
  
  return contexts.length > 0 ? contexts.reverse().join(' > ') : 'top-level';
}

/**
 * Get function name from path
 */
function getFunctionName(path) {
  const node = path.node;
  
  // Named function
  if (node.id?.name) {
    return node.id.name;
  }
  
  // Variable declarator: const handleClick = () => ...
  const parent = path.parent;
  if (parent.type === 'VariableDeclarator' && parent.id.name) {
    return parent.id.name;
  }
  
  // Object property: { onClick: () => ... }
  if (parent.type === 'ObjectProperty' && parent.key.name) {
    return parent.key.name;
  }
  
  return null;
}

/**
 * Try to find xhr.open() call for an XMLHttpRequest instance
 * This is a best-effort heuristic
 */
function findXhrOpen(newExprPath) {
  const result = { url: null, method: null };
  
  // Check if assigned to a variable
  const parent = newExprPath.parent;
  if (parent.type === 'VariableDeclarator' && parent.id.name) {
    const xhrName = parent.id.name;
    
    // Look for xhr.open(...) in the same scope
    const binding = newExprPath.scope.getBinding(xhrName);
    if (binding) {
      // Scan references for .open() calls
      for (const refPath of binding.referencePaths) {
        const refParent = refPath.parent;
        if (refParent.type === 'MemberExpression' &&
            refParent.property.name === 'open') {
          // Check if it's a call expression
          const callParent = refPath.parentPath.parent;
          if (callParent.type === 'CallExpression') {
            // xhr.open(method, url, ...)
            const methodArg = callParent.arguments[0];
            const urlArg = callParent.arguments[1];
            
            result.method = extractUrl(methodArg)?.toUpperCase() || 'GET';
            result.url = extractUrl(urlArg);
            break;
          }
        }
      }
    }
  }
  
  return result;
}

/**
 * PHASE 9: Extract AST source code snippet for evidence
 * @param {Object} node - AST node
 * @param {string[]} lines - File content split by lines
 * @param {Object} loc - Location object with start/end
 * @returns {string} Source code snippet
 */
function extractASTSource(node, lines, loc) {
  if (!loc || !loc.start || !loc.end) {
    return '';
  }
  
  const startLine = loc.start.line - 1; // 0-indexed
  const endLine = loc.end.line - 1;
  
  if (startLine < 0 || endLine >= lines.length) {
    return '';
  }
  
  if (startLine === endLine) {
    // Single line - extract substring
    const line = lines[startLine];
    const startCol = loc.start.column;
    const endCol = loc.end.column;
    return line.substring(startCol, endCol).trim();
  } else {
    // Multi-line - extract full lines
    const snippet = lines.slice(startLine, endLine + 1);
    // Trim first line from start column, last line to end column
    if (snippet.length > 0) {
      snippet[0] = snippet[0].substring(loc.start.column);
      snippet[snippet.length - 1] = snippet[snippet.length - 1].substring(0, loc.end.column);
    }
    return snippet.join('\n').trim();
  }
}

/**
 * PHASE 9: Check if network call is analytics (false positive trap)
 * Analytics calls should NOT be reported as user-facing promises
 * @param {string} url - Network call URL
 * @param {Object} path - Babel path object
 * @returns {boolean} True if this is an analytics call
 */
function isAnalyticsCall(url, path) {
  // Check URL patterns
  if (typeof url === 'string') {
    const analyticsPatterns = [
      '/api/analytics',
      '/analytics',
      '/track',
      '/api/track',
      '/api/event',
      '/events',
      '/beacon',
      '/api/beacon',
    ];
    
    for (const pattern of analyticsPatterns) {
      if (url.includes(pattern)) {
        return true;
      }
    }
  }
  
  // Check context for analytics-related function names
  const context = inferContext(path);
  const analyticsContexts = [
    'track',
    'analytics',
    'beacon',
    'telemetry',
    'metrics',
  ];
  
  for (const keyword of analyticsContexts) {
    if (context.toLowerCase().includes(keyword)) {
      return true;
    }
  }
  
  // Check parent function/variable names
  let current = path.parentPath;
  while (current) {
    const funcName = getFunctionName(current);
    if (funcName) {
      const lowerName = funcName.toLowerCase();
      if (analyticsContexts.some(keyword => lowerName.includes(keyword))) {
        return true;
      }
    }
    current = current.parentPath;
  }
  
  return false;
}

/**
 * PHASE 9: Determine if handler is UI-bound (connected to user interaction)
 * @param {Object} path - Babel path object
 * @returns {boolean} True if handler is bound to UI interaction
 */
function isUIBoundHandler(path) {
  const context = inferContext(path);
  
  // Direct event handlers (onClick, onSubmit, etc.)
  if (context.includes('handler:on')) {
    return true;
  }
  
  // Handler functions (handleClick, handleSubmit, etc.)
  if (context.includes('handler:handle')) {
    return true;
  }
  
  // Check if function is referenced in JSX
  let current = path.parentPath;
  while (current) {
    // Check if we're inside JSX attribute
    if (current.isJSXAttribute()) {
      const attrName = current.node.name?.name;
      if (attrName && attrName.startsWith('on')) {
        return true;
      }
    }
    
    // Check if function is assigned to event handler
    if (current.isVariableDeclarator()) {
      const varName = current.node.id?.name;
      if (varName && (varName.startsWith('handle') || varName.startsWith('on'))) {
        // Check if this variable is used in JSX
        const binding = current.scope.getBinding(varName);
        if (binding) {
          for (const refPath of binding.referencePaths) {
            if (refPath.findParent(p => p.isJSXAttribute())) {
              return true;
            }
          }
        }
      }
    }
    
    current = current.parentPath;
  }
  
  return false;
}



