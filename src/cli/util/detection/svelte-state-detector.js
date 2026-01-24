import BaseDetector from './base-detector.js';

/**
 * PHASE 20 — Svelte State Detector
 * 
 * Detects state mutations (reactive stores, assignments) in Svelte components.
 * Only emits state promises if state is user-visible (used in markup bindings).
 */
/**
 * Svelte State Detector class (BaseDetector implementation)
 */
export class SvelteStateDetector extends BaseDetector {
  constructor() {
    super({
      name: 'svelte-state',
      framework: 'svelte',
      type: 'state',
    });
  }

  detect(filePath, content, _projectRoot) {
    return detectSvelteState(filePath, content);
  }
}

import { extractSvelteSFC, extractTemplateBindings } from './svelte-sfc-extractor.js';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';

/**
 * Detect state promises in Svelte SFC
 * 
 * @param {string} filePath - Path to .svelte file
 * @param {string} content - Full file content
 * @returns {Array} Array of state expectations
 */
export function detectSvelteState(filePath, content) {
  const expectations = [];
  
  try {
    const sfc = extractSvelteSFC(content);
    const { scriptBlocks, markup } = sfc;
    
    // Extract template bindings to identify user-visible state
    const templateBindings = markup ? extractTemplateBindings(markup.content) : { bindings: [], reactiveStatements: [] };
    
    // Collect all state variables used in template
    const templateStateVars = new Set();
    
    // From bindings: bind:value="count"
    templateBindings.bindings.forEach(binding => {
      templateStateVars.add(binding.variable);
    });
    
    // From reactive statements: $: doubled = count * 2
    templateBindings.reactiveStatements.forEach(stmt => {
      // Extract variable names from reactive statements
      const varMatch = stmt.statement.match(/^\s*(\w+)\s*=/);
      if (varMatch) {
        templateStateVars.add(varMatch[1]);
      }
    });
    
    // From markup: {count}, {#if isOpen}, etc.
    if (markup && markup.content) {
      // Extract {variable} patterns
      const varPattern = /\{([a-zA-Z_$][a-zA-Z0-9_$]*)\}/g;
      let varMatch;
      while ((varMatch = varPattern.exec(markup.content)) !== null) {
        templateStateVars.add(varMatch[1]);
      }
      
      // Extract {#if variable} patterns
      const ifPattern = /\{#if\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\}/g;
      let ifMatch;
      while ((ifMatch = ifPattern.exec(markup.content)) !== null) {
        templateStateVars.add(ifMatch[1]);
      }
    }
    
    // Process script blocks to find state mutations
    for (const scriptBlock of scriptBlocks) {
      if (!scriptBlock.content) continue;
      
      try {
        const ast = parse(scriptBlock.content, {
          sourceType: 'module',
          plugins: ['typescript', 'jsx'],
        });
        
        // Track reactive store declarations
        const reactiveStores = new Map();
        
        traverse.default(ast, {
          // Detect reactive store declarations: $store, writable(), readable()
          VariableDeclarator(path) {
            const { node } = path;
            if (node.init) {
              // Detect writable() stores
              if (
                node.init.type === 'CallExpression' &&
                node.init.callee.name === 'writable'
              ) {
                const storeName = node.id.name;
                reactiveStores.set(storeName, 'writable');
              }
              
              // Detect readable() stores
              if (
                node.init.type === 'CallExpression' &&
                node.init.callee.name === 'readable'
              ) {
                const storeName = node.id.name;
                reactiveStores.set(storeName, 'readable');
              }
            }
          },
          
          // Detect store mutations: $store = value, store.set(value), store.update(fn)
          AssignmentExpression(path) {
            const { node } = path;
            
            // Detect direct assignments: count = 5
            if (node.left.type === 'Identifier') {
              const varName = node.left.name;
              
              // Only emit if variable is used in template
              if (templateStateVars.has(varName)) {
                const location = node.loc;
                const line = scriptBlock.startLine + (location ? location.start.line - 1 : 0);
                
                expectations.push({
                  type: 'state',
                  expectedTarget: varName,
                  context: 'assignment',
                  sourceRef: {
                    file: filePath,
                    line,
                    snippet: scriptBlock.content.substring(
                      node.start - (ast.program.body[0]?.start || 0),
                      node.end - (ast.program.body[0]?.start || 0)
                    ),
                  },
                  proof: 'PROVEN_EXPECTATION',
                  metadata: {
                    templateUsage: Array.from(templateStateVars).filter(v => v === varName).length,
                    stateType: 'variable',
                  },
                });
              }
            }
            
            // Detect store assignments: $store = value
            if (
              node.left.type === 'Identifier' &&
              node.left.name.startsWith('$') &&
              reactiveStores.has(node.left.name.substring(1))
            ) {
              const storeName = node.left.name.substring(1);
              const location = node.loc;
              const line = scriptBlock.startLine + (location ? location.start.line - 1 : 0);
              
              expectations.push({
                type: 'state',
                expectedTarget: storeName,
                context: 'store-assignment',
                sourceRef: {
                  file: filePath,
                  line,
                  snippet: scriptBlock.content.substring(
                    node.start - (ast.program.body[0]?.start || 0),
                    node.end - (ast.program.body[0]?.start || 0)
                  ),
                },
                proof: 'PROVEN_EXPECTATION',
                metadata: {
                  stateType: 'store',
                  storeType: reactiveStores.get(storeName),
                },
              });
            }
          },
          
          // Detect store.set() calls
          CallExpression(path) {
            const { node } = path;
            
            if (
              node.callee.type === 'MemberExpression' &&
              node.callee.property.name === 'set' &&
              node.callee.object.type === 'Identifier' &&
              reactiveStores.has(node.callee.object.name)
            ) {
              const storeName = node.callee.object.name;
              const location = node.loc;
              const line = scriptBlock.startLine + (location ? location.start.line - 1 : 0);
              
              expectations.push({
                type: 'state',
                expectedTarget: storeName,
                context: 'store-set',
                sourceRef: {
                  file: filePath,
                  line,
                  snippet: scriptBlock.content.substring(
                    node.start - (ast.program.body[0]?.start || 0),
                    node.end - (ast.program.body[0]?.start || 0)
                  ),
                },
                proof: 'PROVEN_EXPECTATION',
                metadata: {
                  stateType: 'store',
                  storeType: reactiveStores.get(storeName),
                },
              });
            }
            
            // Detect store.update() calls
            if (
              node.callee.type === 'MemberExpression' &&
              node.callee.property.name === 'update' &&
              node.callee.object.type === 'Identifier' &&
              reactiveStores.has(node.callee.object.name)
            ) {
              const storeName = node.callee.object.name;
              const location = node.loc;
              const line = scriptBlock.startLine + (location ? location.start.line - 1 : 0);
              
              expectations.push({
                type: 'state',
                expectedTarget: storeName,
                context: 'store-update',
                sourceRef: {
                  file: filePath,
                  line,
                  snippet: scriptBlock.content.substring(
                    node.start - (ast.program.body[0]?.start || 0),
                    node.end - (ast.program.body[0]?.start || 0)
                  ),
                },
                proof: 'PROVEN_EXPECTATION',
                metadata: {
                  stateType: 'store',
                  storeType: reactiveStores.get(storeName),
                },
              });
            }
          },
        });
      } catch (parseError) {
        // Skip if parsing fails
      }
    }
  } catch (error) {
    // Skip if extraction fails
  }
  
  return expectations;
}




