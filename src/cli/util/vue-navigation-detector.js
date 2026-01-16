/**
 * PHASE 20 — Vue Navigation Promise Detection
 * 
 * Detects Vue Router navigation promises:
 * - router.push('/path'), router.replace('/path')
 * - router.push({ name: 'X', params: { id: 1 }}) -> mark as dynamic/ambiguous
 */

import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';

const traverse = _traverse.default || _traverse;

/**
 * PHASE 20: Detect Vue navigation promises
 * 
 * @param {string} scriptContent - Script block content
 * @param {string} filePath - File path
 * @param {string} relPath - Relative path
 * @param {Object} _scriptBlock - Script block metadata
 * @param {Object} _templateBindings - Template bindings (optional)
 * @ts-expect-error - JSDoc params documented but unused
 * @returns {Array} Navigation promises
 */
export function detectVueNavigationPromises(scriptContent, filePath, relPath, _scriptBlock, _templateBindings) {
  const promises = [];
  
  try {
    const ast = parse(scriptContent, {
      sourceType: 'module',
      plugins: [
        'typescript',
        'classProperties',
        'optionalChaining',
        'nullishCoalescingOperator',
        'dynamicImport',
        'topLevelAwait',
        'objectRestSpread',
      ],
      errorRecovery: true,
    });
    
    const lines = scriptContent.split('\n');
    
    traverse(ast, {
      CallExpression(path) {
        const node = path.node;
        const callee = node.callee;
        
        // Detect router.push() and router.replace()
        if (callee.type === 'MemberExpression') {
          const object = callee.object;
          const property = callee.property;
          
          if (property.name === 'push' || property.name === 'replace') {
            // Check if object is 'router' or 'this.$router' or 'useRouter()'
            const isRouter = 
              (object.type === 'Identifier' && object.name === 'router') ||
              (object.type === 'MemberExpression' && 
               object.object.type === 'ThisExpression' && 
               object.property.name === '$router') ||
              (object.type === 'CallExpression' &&
               callee.type === 'Identifier' &&
               callee.name === 'useRouter');
            
            if (isRouter && node.arguments.length > 0) {
              const arg = node.arguments[0];
              let targetPath = null;
              let isDynamic = false;
              
              // String literal: router.push('/path')
              if (arg.type === 'StringLiteral') {
                targetPath = arg.value;
              }
              // Object literal: router.push({ name: 'X', params: {} })
              else if (arg.type === 'ObjectExpression') {
                const nameProp = arg.properties.find(p => 
                  p.key && p.key.name === 'name'
                );
                const pathProp = arg.properties.find(p => 
                  p.key && p.key.name === 'path'
                );
                
                if (pathProp && pathProp.value && pathProp.value.type === 'StringLiteral') {
                  targetPath = pathProp.value.value;
                } else if (nameProp) {
                  // Named route - mark as dynamic/ambiguous
                  isDynamic = true;
                  targetPath = '<named-route>';
                } else {
                  isDynamic = true;
                  targetPath = '<dynamic>';
                }
              }
              // Template literal or other dynamic
              else {
                isDynamic = true;
                targetPath = '<dynamic>';
              }
              
              if (targetPath) {
                const loc = node.loc;
                const line = loc ? loc.start.line : 1;
                const column = loc ? loc.start.column : 0;
                
                // Extract AST source
                const astSource = lines.slice(line - 1, loc ? loc.end.line : line)
                  .join('\n')
                  .substring(0, 200);
                
                // Build context chain
                const context = buildContext(path);
                
                promises.push({
                  type: 'navigation',
                  promise: {
                    kind: 'navigate',
                    value: targetPath,
                    isDynamic,
                  },
                  source: {
                    file: relPath,
                    line,
                    column,
                    context,
                    astSource,
                  },
                  confidence: isDynamic ? 0.7 : 1.0,
                });
              }
            }
          }
        }
      },
    });
  } catch (error) {
    // Parse error - skip
  }
  
  return promises;
}

/**
 * Build context chain from AST path
 */
function buildContext(path) {
  const context = [];
  let current = path;
  
  while (current) {
    if (current.isFunctionDeclaration()) {
      context.push({
        type: 'function',
        name: current.node.id?.name || '<anonymous>',
      });
    } else if (current.isArrowFunctionExpression()) {
      context.push({
        type: 'arrow-function',
        name: '<arrow>',
      });
    } else if (current.isMethodDefinition()) {
      context.push({
        type: 'method',
        name: current.node.key?.name || '<method>',
      });
    } else if (current.isObjectProperty()) {
      context.push({
        type: 'property',
        name: current.node.key?.name || '<property>',
      });
    }
    
    current = current.parentPath;
  }
  
  return context.reverse().map(c => `${c.type}:${c.name}`).join(' > ');
}

