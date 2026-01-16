import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';

// Handle default export from @babel/traverse (CommonJS/ESM compatibility)
const traverse = _traverse.default || _traverse;

/**
 * PHASE 10 — Professional useState Tracking
 * 
 * AST-based React useState detection with:
 * - Context tracking (handler/hook/function)
 * - AST source extraction for evidence
 * - State ↔ UI correlation
 * - False positive prevention
 */

/**
 * Detect useState patterns and their UI connections
 * PHASE 10: Enhanced with context tracking and AST source extraction
 * @param {string} content - File content
 * @param {string} _filePath - Absolute file path (unused)
 * @param {string} _relPath - Relative path from source root (unused)
 * @returns {Array} Array of state-driven UI promises with context and AST source
 */
export function detectUseStatePromises(content, _filePath, _relPath) {
  const promises = [];
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
    
    // Track useState imports from 'react'
    const useStateImported = new Set();
    
    // Track all state declarations: { stateName, setterName, componentName, loc }
    const stateDeclarations = [];
    
    // PHASE 10: Enhanced setter calls with context and AST source
    // Track setter calls: { setterName, stateName, loc, isUpdaterFunction, context, astSource, isUIBound }
    const setterCalls = [];
    
    // Track JSX usage of state variables: { stateName, loc, usageType }
    const jsxUsages = [];
    
    traverse(ast, {
      // Track useState imports
      ImportDeclaration(path) {
        if (path.node.source.value === 'react') {
          path.node.specifiers.forEach((spec) => {
            if (spec.type === 'ImportSpecifier' && spec.imported.name === 'useState') {
              useStateImported.add(spec.local.name);
            }
            // Handle: import React from 'react'
            if (spec.type === 'ImportDefaultSpecifier') {
              useStateImported.add('React.useState');
            }
            // Handle: import * as React from 'react'
            if (spec.type === 'ImportNamespaceSpecifier') {
              useStateImported.add(`${spec.local.name}.useState`);
            }
          });
        }
      },
      
      // Detect useState declarations
      VariableDeclarator(path) {
        const { node } = path;
        const loc = node.loc;
        
        // Check if init is a useState call
        if (node.init?.type === 'CallExpression') {
          const callee = node.init.callee;
          let isUseState = false;
          
          // Direct: useState(...)
          if (callee.type === 'Identifier' && useStateImported.has(callee.name)) {
            isUseState = true;
          }
          
          // React.useState(...)
          if (callee.type === 'MemberExpression' &&
              callee.object.name === 'React' &&
              callee.property.name === 'useState') {
            isUseState = true;
          }
          
          if (isUseState && node.id.type === 'ArrayPattern') {
            // Extract [state, setState]
            const elements = node.id.elements;
            if (elements.length >= 2) {
              const stateVar = elements[0];
              const setterVar = elements[1];
              
              if (stateVar?.type === 'Identifier' && setterVar?.type === 'Identifier') {
                const stateName = stateVar.name;
                const setterName = setterVar.name;
                
                // Find component name
                const componentName = findComponentName(path);
                
                stateDeclarations.push({
                  stateName,
                  setterName,
                  componentName,
                  location: {
                    line: loc?.start.line,
                    column: loc?.start.column,
                  },
                });
              }
            }
          }
        }
      },
      
      // PHASE 10: Detect setter calls with context tracking and AST source
      CallExpression(path) {
        const { node } = path;
        const loc = node.loc;
        
        if (node.callee.type === 'Identifier') {
          const calleeName = node.callee.name;
          
          // Check if this identifier matches any known setter
          const matchingState = stateDeclarations.find(s => s.setterName === calleeName);
          if (matchingState) {
            // Check if it's an updater function: setX(prev => next)
            const isUpdaterFunction = node.arguments.length > 0 &&
              (node.arguments[0].type === 'ArrowFunctionExpression' ||
               node.arguments[0].type === 'FunctionExpression');
            
            // PHASE 10: Infer context (handler/hook/function) - reuse Phase 9 style
            const context = inferContext(path);
            const isUIBound = isUIBoundHandler(path);
            
            // PHASE 10: Extract AST source code for evidence
            const astSource = extractASTSource(node, lines, loc);
            
            setterCalls.push({
              setterName: calleeName,
              stateName: matchingState.stateName,
              location: {
                line: loc?.start.line,
                column: loc?.start.column,
              },
              isUpdaterFunction,
              context, // PHASE 10: Context tracking
              astSource, // PHASE 10: AST source for evidence
              isUIBound, // PHASE 10: UI-bound detection
            });
          }
        }
      },
      
      // Detect state usage in JSX
      JSXExpressionContainer(path) {
        const { node } = path;
        const loc = node.loc;
        
        // Check if expression references any state variable
        if (node.expression.type === 'Identifier') {
          const identifierName = node.expression.name;
          const matchingState = stateDeclarations.find(s => s.stateName === identifierName);
          
          if (matchingState) {
            const usageType = inferJSXUsageType(path);
            jsxUsages.push({
              stateName: identifierName,
              location: {
                line: loc?.start.line,
                column: loc?.start.column,
              },
              usageType,
            });
          }
        }
        
        // Check member expressions: {state.property}
        if (node.expression.type === 'MemberExpression' &&
            node.expression.object.type === 'Identifier') {
          const identifierName = node.expression.object.name;
          const matchingState = stateDeclarations.find(s => s.stateName === identifierName);
          
          if (matchingState) {
            const usageType = inferJSXUsageType(path);
            jsxUsages.push({
              stateName: identifierName,
              location: {
                line: loc?.start.line,
                column: loc?.start.column,
              },
              usageType,
            });
          }
        }
        
        // Check expressions like: {loading ? 'Loading...' : 'Done'}
        if (node.expression.type === 'ConditionalExpression') {
          const testIdentifiers = extractIdentifiers(node.expression.test);
          testIdentifiers.forEach(name => {
            const matchingState = stateDeclarations.find(s => s.stateName === name);
            if (matchingState) {
              jsxUsages.push({
                stateName: name,
                location: {
                  line: loc?.start.line,
                  column: loc?.start.column,
                },
                usageType: 'conditional-rendering',
              });
            }
          });
        }
        
        // Check logical expressions: {loading && <Spinner />}
        if (node.expression.type === 'LogicalExpression') {
          const leftIdentifiers = extractIdentifiers(node.expression.left);
          leftIdentifiers.forEach(name => {
            const matchingState = stateDeclarations.find(s => s.stateName === name);
            if (matchingState) {
              jsxUsages.push({
                stateName: name,
                location: {
                  line: loc?.start.line,
                  column: loc?.start.column,
                },
                usageType: 'conditional-rendering',
              });
            }
          });
        }
        
        // Check call expressions in JSX: {items.map(...)}
        if (node.expression.type === 'CallExpression' &&
            node.expression.callee.type === 'MemberExpression' &&
            node.expression.callee.object.type === 'Identifier') {
          const identifierName = node.expression.callee.object.name;
          const matchingState = stateDeclarations.find(s => s.stateName === identifierName);
          
          if (matchingState) {
            jsxUsages.push({
              stateName: identifierName,
              location: {
                line: loc?.start.line,
                column: loc?.start.column,
              },
              usageType: 'expression',
            });
          }
        }
      },
      
      // Also check JSX attributes
      JSXAttribute(path) {
        const { node } = path;
        const loc = node.loc;
        
        if (node.value?.type === 'JSXExpressionContainer') {
          const expr = node.value.expression;
          
          if (expr.type === 'Identifier') {
            const matchingState = stateDeclarations.find(s => s.stateName === expr.name);
            if (matchingState) {
              jsxUsages.push({
                stateName: expr.name,
                location: {
                  line: loc?.start.line,
                  column: loc?.start.column,
                },
                usageType: `attribute:${node.name.name}`,
              });
            }
          }
          
          // Also check member expressions: value={form.email}
          if (expr.type === 'MemberExpression' && expr.object.type === 'Identifier') {
            const matchingState = stateDeclarations.find(s => s.stateName === expr.object.name);
            if (matchingState) {
              jsxUsages.push({
                stateName: expr.object.name,
                location: {
                  line: loc?.start.line,
                  column: loc?.start.column,
                },
                usageType: `attribute:${node.name.name}`,
              });
            }
          }
        }
      },
    });
    
    // Now emit promises only for states that are:
    // 1. Declared with useState
    // 2. Have setter calls
    // 3. Are used in JSX
    for (const stateDecl of stateDeclarations) {
      const { stateName, setterName, componentName, location } = stateDecl;
      
      const relatedSetterCalls = setterCalls.filter(c => c.stateName === stateName);
      const relatedJSXUsages = jsxUsages.filter(u => u.stateName === stateName);
      
      // PHASE 10: Only emit promise if:
      // - State is used in JSX (proves UI connection)
      // - Setter is called (proves mutation intent)
      if (relatedJSXUsages.length > 0 && relatedSetterCalls.length > 0) {
        // PHASE 10: Include context and AST source in promises
        promises.push({
          type: 'state-ui-promise',
          stateName,
          setterName,
          componentName: componentName || 'UnknownComponent',
          setterCallCount: relatedSetterCalls.length,
          jsxUsageCount: relatedJSXUsages.length,
          usageTypes: [...new Set(relatedJSXUsages.map(u => u.usageType))],
          location,
          // PHASE 10: Enhanced metadata with context and AST source
          metadata: {
            hasUpdaterFunction: relatedSetterCalls.some(c => c.isUpdaterFunction),
            setterCalls: relatedSetterCalls.map(c => ({
              context: c.context,
              astSource: c.astSource,
              isUIBound: c.isUIBound,
              isUpdaterFunction: c.isUpdaterFunction,
              location: c.location,
            })),
          },
        });
      }
    }
    
  } catch (error) {
    // Parse errors are silently handled
  }
  
  return promises;
}

/**
 * Find the component name that contains this path
 */
function findComponentName(path) {
  let current = path.parentPath;
  
  while (current) {
    const node = current.node;
    
    // Function component
    if (current.isFunctionDeclaration() && node.id?.name) {
      return node.id.name;
    }
    
    // Arrow function assigned to variable
    if (current.isVariableDeclarator() && node.id?.name) {
      return node.id.name;
    }
    
    // Export default function
    if (current.isExportDefaultDeclaration()) {
      if (node.declaration?.id?.name) {
        return node.declaration.id.name;
      }
      if (node.declaration?.type === 'FunctionExpression' ||
          node.declaration?.type === 'ArrowFunctionExpression') {
        return 'DefaultExport';
      }
    }
    
    current = current.parentPath;
  }
  
  return null;
}

/**
 * Infer the type of JSX usage
 */
function inferJSXUsageType(path) {
  const parent = path.parent;
  
  // Attribute usage
  if (parent.type === 'JSXAttribute') {
    return `attribute:${parent.name.name}`;
  }
  
  // Text content
  if (parent.type === 'JSXElement') {
    return 'text-content';
  }
  
  // Conditional rendering
  const expression = path.node.expression;
  if (expression.type === 'ConditionalExpression' || 
      expression.type === 'LogicalExpression') {
    return 'conditional-rendering';
  }
  
  return 'expression';
}

/**
 * Extract all identifiers from an expression
 */
function extractIdentifiers(node) {
  const identifiers = [];
  
  if (!node) return identifiers;
  
  if (node.type === 'Identifier') {
    identifiers.push(node.name);
  } else if (node.type === 'ConditionalExpression') {
    identifiers.push(...extractIdentifiers(node.test));
    identifiers.push(...extractIdentifiers(node.consequent));
    identifiers.push(...extractIdentifiers(node.alternate));
  } else if (node.type === 'LogicalExpression') {
    identifiers.push(...extractIdentifiers(node.left));
    identifiers.push(...extractIdentifiers(node.right));
  } else if (node.type === 'UnaryExpression') {
    identifiers.push(...extractIdentifiers(node.argument));
  } else if (node.type === 'BinaryExpression') {
    identifiers.push(...extractIdentifiers(node.left));
    identifiers.push(...extractIdentifiers(node.right));
  } else if (node.type === 'MemberExpression') {
    identifiers.push(...extractIdentifiers(node.object));
  }
  
  return identifiers;
}

/**
 * PHASE 10: Infer execution context (handler, hook, component, etc.)
 * Reuses Phase 9 style context tracking
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
 * PHASE 10: Get function name from path
 * Reuses Phase 9 helper
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
 * PHASE 10: Determine if handler is UI-bound (connected to user interaction)
 * Reuses Phase 9 logic
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

/**
 * PHASE 10: Extract AST source code snippet for evidence
 * Reuses Phase 9 helper
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
