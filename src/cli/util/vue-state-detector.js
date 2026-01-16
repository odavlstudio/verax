/**
 * PHASE 20 — Vue State Promise Detection
 * 
 * Detects ref/reactive mutations that are UI-bound:
 * - ref declarations: const count = ref(0);
 * - reactive: const state = reactive({ x: 1 });
 * - Only emit if identifiers are used in template bindings
 */

import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';

const traverse = _traverse.default || _traverse;

/**
 * PHASE 20: Detect Vue state promises
 * 
 * @param {string} scriptContent - Script block content
 * @param {string} filePath - File path
 * @param {string} relPath - Relative path
 * @param {Object} scriptBlock - Script block metadata
 * @param {Object} templateBindings - Template bindings
 * @returns {Array} State promises
 */
export function detectVueStatePromises(scriptContent, filePath, relPath, scriptBlock, templateBindings) {
  const promises = [];
  const templateVars = new Set(templateBindings.bindings || []);
  
  if (templateVars.size === 0) {
    return promises; // No template bindings, skip
  }
  
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
    const refDeclarations = new Map(); // varName -> { loc, astSource }
    const reactiveDeclarations = new Map();
    
    traverse(ast, {
      // Detect ref() declarations
      VariableDeclarator(path) {
        const node = path.node;
        const init = node.init;
        
        if (init && init.type === 'CallExpression') {
          const callee = init.callee;
          
          // ref(0) or ref({})
          if (callee.type === 'Identifier' && callee.name === 'ref') {
            const varName = node.id.name;
            if (templateVars.has(varName)) {
              const loc = node.loc;
              const line = loc ? loc.start.line : 1;
              const astSource = lines.slice(line - 1, loc ? loc.end.line : line)
                .join('\n')
                .substring(0, 200);
              
              refDeclarations.set(varName, {
                loc,
                astSource,
                line,
              });
            }
          }
          
          // reactive({})
          if (callee.type === 'Identifier' && callee.name === 'reactive') {
            const varName = node.id.name;
            if (templateVars.has(varName)) {
              const loc = node.loc;
              const line = loc ? loc.start.line : 1;
              const astSource = lines.slice(line - 1, loc ? loc.end.line : line)
                .join('\n')
                .substring(0, 200);
              
              reactiveDeclarations.set(varName, {
                loc,
                astSource,
                line,
              });
            }
          }
        }
      },
      
      // Detect mutations: count.value = ... or state.x = ...
      AssignmentExpression(path) {
        const node = path.node;
        const left = node.left;
        
        // count.value = ...
        if (left.type === 'MemberExpression' && 
            left.property.name === 'value' &&
            left.object.type === 'Identifier') {
          const varName = left.object.name;
          
          if (refDeclarations.has(varName) && templateVars.has(varName)) {
            const _decl = refDeclarations.get(varName);
            const loc = node.loc;
            const line = loc ? loc.start.line : 1;
            const column = loc ? loc.start.column : 0;
            
            const astSource = lines.slice(line - 1, loc ? loc.end.line : line)
              .join('\n')
              .substring(0, 200);
            
            const context = buildContext(path);
            
            promises.push({
              type: 'state',
              promise: {
                kind: 'state-change',
                value: `${varName}.value`,
                stateVar: varName,
              },
              source: {
                file: relPath,
                line,
                column,
                context,
                astSource,
              },
              confidence: 0.9,
            });
          }
        }
        
        // state.x = ...
        if (left.type === 'MemberExpression' &&
            left.object.type === 'Identifier') {
          const varName = left.object.name;
          
          if (reactiveDeclarations.has(varName) && templateVars.has(varName)) {
            const loc = node.loc;
            const line = loc ? loc.start.line : 1;
            const column = loc ? loc.start.column : 0;
            
            const astSource = lines.slice(line - 1, loc ? loc.end.line : line)
              .join('\n')
              .substring(0, 200);
            
            const context = buildContext(path);
            const propName = left.property.name || '<property>';
            
            promises.push({
              type: 'state',
              promise: {
                kind: 'state-change',
                value: `${varName}.${propName}`,
                stateVar: varName,
              },
              source: {
                file: relPath,
                line,
                column,
                context,
                astSource,
              },
              confidence: 0.9,
            });
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
    }
    
    current = current.parentPath;
  }
  
  return context.reverse().map(c => `${c.type}:${c.name}`).join(' > ');
}

