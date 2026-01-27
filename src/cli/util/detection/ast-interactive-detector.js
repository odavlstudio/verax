import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';

// Handle default export from @babel/traverse (CommonJS/ESM compatibility)
const traverse = _traverse.default || _traverse;

/**
 * PHASE 11 — Professional Interactive Element Detection (No href)
 * 
 * AST-based detection of interactive elements without href:
 * - Elements with onClick/onSubmit handlers
 * - Elements with role="button" or role="link"
 * - Router links (React Router <Link>, <NavLink>, Next.js <Link>)
 * - Programmatic navigation calls (navigate(), history.push, router.push)
 * 
 * Features:
 * - AST source code extraction for evidence
 * - Context tracking (component > handler)
 * - Navigation promise extraction
 * - False positive prevention
 */

/**
 * Detect interactive elements without href and their navigation promises
 * @param {string} content - File content
 * @param {string} _filePath - Absolute file path (unused)
 * @param {string} _relPath - Relative path from source root (unused)
 * @returns {Array} Array of interactive element detections with navigation promises
 */
export function detectInteractiveElementsAST(content, _filePath, _relPath) {
  const detections = [];
  const lines = content.split('\n');
  
  try {
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
      ],
      errorRecovery: true,
    });
    
    // Track router imports
    const routerBindings = new Set();
    const navigationBindings = new Set();
    const historyBindings = new Set();
    
    traverse(ast, {
      // Track router/navigation imports
      ImportDeclaration(path) {
        const source = path.node.source.value;
        
        // React Router
        if (source === 'react-router-dom' || source === 'react-router') {
          path.node.specifiers.forEach((spec) => {
            if (spec.type === 'ImportSpecifier') {
              if (spec.imported.name === 'useNavigate' || spec.imported.name === 'useHistory') {
                navigationBindings.add(spec.local.name);
              }
              if (spec.imported.name === 'Link' || spec.imported.name === 'NavLink') {
                routerBindings.add(spec.local.name);
              }
            }
          });
        }
        
        // Next.js
        if (source === 'next/link' || source === 'next/navigation') {
          path.node.specifiers.forEach((spec) => {
            if (spec.type === 'ImportSpecifier') {
              if (spec.imported.name === 'Link') {
                routerBindings.add(spec.local.name);
              }
              if (spec.imported.name === 'useRouter') {
                navigationBindings.add(spec.local.name);
              }
            }
          });
        }
        
        // History API
        if (source === 'history') {
          path.node.specifiers.forEach((spec) => {
            if (spec.type === 'ImportSpecifier' || spec.type === 'ImportDefaultSpecifier') {
              historyBindings.add(spec.local.name);
            }
          });
        }
      },
      
      // PHASE 11: Detect JSX elements with interactive handlers
      JSXOpeningElement(path) {
        const { node } = path;
        const loc = node.loc;
        
        // Extract tag name
        let tagName = null;
        if (node.name.type === 'JSXIdentifier') {
          tagName = node.name.name;
        } else if (node.name.type === 'JSXMemberExpression') {
          tagName = `${node.name.object.name}.${node.name.property.name}`;
        }
        
        if (!tagName) return;
        
        // Check for onClick/onSubmit handlers
        let onClickHandler = null;
        let onSubmitHandler = null;
        let roleAttr = null;
        let linkTo = null;
        let linkHref = null;
        
        for (const attr of node.attributes) {
          if (attr.name?.name === 'onClick') {
            onClickHandler = attr.value;
          }
          if (attr.name?.name === 'onSubmit') {
            onSubmitHandler = attr.value;
          }
          if (attr.name?.name === 'role') {
            roleAttr = attr.value?.value || (attr.value?.expression?.value);
          }
          // React Router Link - check if tagName is Link or NavLink
          if (attr.name?.name === 'to' && (tagName === 'Link' || tagName === 'NavLink' || routerBindings.has(tagName))) {
            linkTo = attr.value;
            // Also add to routerBindings if not already there
            if (!routerBindings.has(tagName)) {
              routerBindings.add(tagName);
            }
          }
          // Next.js Link
          if (attr.name?.name === 'href' && (tagName === 'Link' || routerBindings.has(tagName))) {
            linkHref = attr.value;
            // Also add to routerBindings if not already there
            if (!routerBindings.has(tagName)) {
              routerBindings.add(tagName);
            }
          }
        }
        
        // PHASE 11: Detect interactive elements
        const isInteractive = 
          onClickHandler || 
          onSubmitHandler || 
          roleAttr === 'button' || 
          roleAttr === 'link' ||
          routerBindings.has(tagName) ||
          tagName === 'Link' ||
          tagName === 'NavLink' ||
          tagName === 'button' ||
          (tagName === 'a' && !linkHref && !linkTo);
        
        if (isInteractive) {
          // Extract navigation promise from handler
          const handlerValue = onClickHandler || onSubmitHandler;
          const navigationPromise = handlerValue ? extractNavigationPromise(
            handlerValue,
            path,
            routerBindings,
            navigationBindings,
            historyBindings,
            lines
          ) : null;
          
          // Extract context
          const context = inferContext(path);
          const isUIBound = isUIBoundHandler(path);
          
          // Extract AST source for handler
          const handlerSource = onClickHandler || onSubmitHandler;
          let handlerLoc = loc;
          if (handlerSource) {
            if (handlerSource.loc) {
              handlerLoc = handlerSource.loc;
            } else if (handlerSource.expression?.loc) {
              handlerLoc = handlerSource.expression.loc;
            }
          }
          const astSource = handlerSource ? extractASTSource(handlerSource, lines, handlerLoc) : null;
          
          // Extract selector hint
          const selectorHint = extractSelectorHint(node, path);
          
          detections.push({
            tagName,
            role: roleAttr,
            hasOnClick: !!onClickHandler,
            hasOnSubmit: !!onSubmitHandler,
            isRouterLink: routerBindings.has(tagName) || tagName === 'Link' || tagName === 'NavLink',
            linkTo: linkTo ? extractStringValue(linkTo) : null,
            linkHref: linkHref ? extractStringValue(linkHref) : null,
            navigationPromise,
            context,
            isUIBound,
            astSource,
            selectorHint,
            location: {
              line: loc?.start.line,
              column: loc?.start.column,
            },
          });
        }
      },
    });
    
  } catch (error) {
    // Parse errors are silently handled
  }
  
  return detections;
}

/**
 * Extract navigation promise from handler (router.push, navigate, etc.)
 */
function extractNavigationPromise(handlerValue, path, routerBindings, navigationBindings, historyBindings, lines = []) {
  if (!handlerValue) return null;
  
  // If handler is a reference to a function, we'd need to follow it; currently
  // only inline handlers and common patterns are supported to avoid speculative
  // navigation inference
  
  // Check if handler is an inline arrow function or function expression
  if (handlerValue.type === 'JSXExpressionContainer') {
    const expr = handlerValue.expression;
    
    // Arrow function: onClick={() => router.push('/path')} or onClick={() => navigate('/path')}
    if (expr.type === 'ArrowFunctionExpression' || expr.type === 'FunctionExpression') {
      const body = expr.body;
      
      // Check for navigation calls in body
      // For arrow functions, body can be an expression or BlockStatement
      return findNavigationCallInBody(body, routerBindings, navigationBindings, historyBindings, lines);
    }
    
    // Function reference: onClick={handleClick}
    if (expr.type === 'Identifier') {
      // Call-graph tracing is not implemented here; leave unresolved to avoid
      // inventing navigation intents
      return null;
    }
  }
  
  return null;
}

/**
 * Find navigation calls in function body
 */
function findNavigationCallInBody(body, routerBindings, navigationBindings, historyBindings, lines = []) {
  const navigationCalls = [];
  
  function walk(node) {
    if (!node) return;
    
    // CallExpression: router.push('/path'), navigate('/path'), etc.
    if (node.type === 'CallExpression') {
      const callee = node.callee;
      
      // router.push('/path'), router.replace('/path')
      if (callee.type === 'MemberExpression' &&
          callee.object.type === 'Identifier' &&
          routerBindings.has(callee.object.name)) {
        const method = callee.property.name;
        if (['push', 'replace', 'go'].includes(method)) {
          const target = extractStringValue(node.arguments[0]);
          if (target) {
            navigationCalls.push({
              type: 'router',
              method,
              target,
              astSource: node.loc ? extractASTSource(node, lines, node.loc) : null,
            });
          }
        }
      }
      
      // navigate('/path')
      if (callee.type === 'Identifier' && navigationBindings.has(callee.name)) {
        const target = extractStringValue(node.arguments[0]);
        if (target) {
            navigationCalls.push({
              type: 'navigate',
              method: 'navigate',
              target,
              astSource: node.loc ? extractASTSource(node, lines, node.loc) : null,
            });
        }
      }
      
      // history.push('/path')
      if (callee.type === 'MemberExpression' &&
          callee.object.type === 'Identifier' &&
          historyBindings.has(callee.object.name)) {
        const method = callee.property.name;
        if (['push', 'replace', 'go'].includes(method)) {
          const target = extractStringValue(node.arguments[0]);
          if (target) {
            navigationCalls.push({
              type: 'history',
              method,
              target,
              astSource: node.loc ? extractASTSource(node, lines, node.loc) : null,
            });
          }
        }
      }
      
      // window.location = '/path' or window.location.href = '/path'
      if (callee.type === 'MemberExpression' &&
          callee.object.type === 'MemberExpression' &&
          callee.object.object.type === 'Identifier' &&
          callee.object.object.name === 'window' &&
          callee.object.property.name === 'location') {
        const prop = callee.property.name;
        if (prop === 'href' || prop === 'pathname') {
          const target = extractStringValue(node.arguments[0]);
          if (target) {
            navigationCalls.push({
              type: 'window_location',
              method: prop,
              target,
              astSource: node.loc ? extractASTSource(node, lines, node.loc) : null,
            });
          }
        }
      }
    }
    
    // AssignmentExpression: window.location = '/path'
    if (node.type === 'AssignmentExpression') {
      if (node.left.type === 'MemberExpression' &&
          node.left.object.type === 'MemberExpression' &&
          node.left.object.object.type === 'Identifier' &&
          node.left.object.object.name === 'window' &&
          node.left.object.property.name === 'location') {
        const prop = node.left.property.name;
        if (prop === 'href' || prop === 'pathname') {
          const target = extractStringValue(node.right);
          if (target) {
            navigationCalls.push({
              type: 'window_location',
              method: 'assign',
              target,
              astSource: node.loc ? extractASTSource(node, lines, node.loc) : null,
            });
          }
        }
      }
    }
    
    // Recursively walk children
    if (node.body && Array.isArray(node.body)) {
      node.body.forEach(walk);
    } else if (node.body) {
      walk(node.body);
    }
    if (node.expression) {
      walk(node.expression);
    }
    if (node.consequent) {
      walk(node.consequent);
    }
    if (node.alternate) {
      walk(node.alternate);
    }
  }
  
  // Handle both BlockStatement and Expression bodies
  if (body.type === 'BlockStatement' && body.body) {
    body.body.forEach(walk);
  } else {
    // Arrow function with expression body: () => navigate('/path')
    walk(body);
  }
  
  return navigationCalls.length > 0 ? navigationCalls[0] : null;
}

/**
 * Extract string value from AST node
 */
function extractStringValue(node) {
  if (!node) return null;
  
  if (node.type === 'StringLiteral') {
    return node.value;
  }
  
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0].value.cooked;
  }
  
  // Template literal with expressions: `/path/${id}` -> '<dynamic>'
  if (node.type === 'TemplateLiteral' && node.expressions.length > 0) {
    return '<dynamic>';
  }
  
  return null;
}

/**
 * Extract selector hint from JSX element
 */
function extractSelectorHint(node, _path) {
  let selector = node.name.name || '';
  
  // Check for id attribute
  for (const attr of node.attributes) {
    if (attr.name?.name === 'id' && attr.value?.value) {
      return `#${attr.value.value}`;
    }
    if (attr.name?.name === 'data-testid' && attr.value?.value) {
      return `[data-testid="${attr.value.value}"]`;
    }
  }
  
  return selector;
}

/**
 * Infer execution context (handler, hook, component, etc.)
 * Reuses Phase 9/10 style context tracking
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
  
  if (node.id?.name) {
    return node.id.name;
  }
  
  const parent = path.parent;
  if (parent.type === 'VariableDeclarator' && parent.id.name) {
    return parent.id.name;
  }
  
  if (parent.type === 'ObjectProperty' && parent.key.name) {
    return parent.key.name;
  }
  
  return null;
}

/**
 * Determine if handler is UI-bound (connected to user interaction)
 */
function isUIBoundHandler(path) {
  const context = inferContext(path);
  
  if (context.includes('handler:on')) {
    return true;
  }
  
  if (context.includes('handler:handle')) {
    return true;
  }
  
  return false;
}

/**
 * Extract AST source code snippet for evidence
 */
function extractASTSource(node, lines, loc) {
  if (!loc || !loc.start || !loc.end) {
    return '';
  }
  
  const startLine = loc.start.line - 1;
  const endLine = loc.end.line - 1;
  
  if (startLine < 0 || endLine >= lines.length) {
    return '';
  }
  
  if (startLine === endLine) {
    const line = lines[startLine];
    const startCol = loc.start.column;
    const endCol = loc.end.column;
    return line.substring(startCol, endCol).trim();
  } else {
    const snippet = lines.slice(startLine, endLine + 1);
    if (snippet.length > 0) {
      snippet[0] = snippet[0].substring(loc.start.column);
      snippet[snippet.length - 1] = snippet[snippet.length - 1].substring(0, loc.end.column);
    }
    return snippet.join('\n').trim();
  }
}




