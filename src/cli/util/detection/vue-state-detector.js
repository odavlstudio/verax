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

import BaseDetector from './base-detector.js';
/**
 * Vue State Detector class (BaseDetector implementation)
 */
export class VueStateDetector extends BaseDetector {
  constructor() {
    super({
      name: 'vue-state',
      framework: 'vue',
      type: 'state',
    });
  }

  detect(filePath, content, projectRoot) {
    return detectVueState(filePath, content, projectRoot);
  }
}
const traverse = _traverse.default || _traverse;

  /**
   * Main Vue state detector function
   * Parses Vue SFC and extracts state mutations (ref/reactive)
   * that are bound to template bindings.
   * 
   * @param {string} filePath - Path to .vue file
   * @param {string} content - Full file content
   * @param {string} projectRoot - Project root directory
   * @returns {Array} Array of state promises
   */
  function detectVueState(filePath, content, projectRoot) {
    const expectations = [];
    
    try {
      // Find script block
      const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/);
      if (!scriptMatch) {
        return expectations;
      }
      
      const scriptContent = scriptMatch[1];
      const lines = content.split('\n');
      
      // Extract template bindings to identify user-visible state
      const templateMatch = content.match(/<template[^>]*>([\s\S]*?)<\/template>/);
      if (!templateMatch) {
        return expectations;
      }
      
      const templateContent = templateMatch[1];
      const templateVars = new Set();
      
      // Extract {variable} patterns from template
      const varPattern = /\{\{?\s*([a-zA-Z_$][a-zA-Z0-9_$.]*)\s*\}?\}/g;
      let match;
      while ((match = varPattern.exec(templateContent)) !== null) {
        const varName = match[1].split('.')[0]; // Extract base variable name
        templateVars.add(varName);
      }
      
      // Extract v-model="variable" patterns
      const vModelPattern = /v-model(?::[a-z-]+)?\s*=\s*["']([a-zA-Z_$][a-zA-Z0-9_$]*)["']|v-model="([a-zA-Z_$][a-zA-Z0-9_$]*)"/g;
      while ((match = vModelPattern.exec(templateContent)) !== null) {
        const varName = match[1] || match[2];
        if (varName) templateVars.add(varName);
      }
      
      // Extract :value and similar bindings
      const bindingPattern = /:\w+\s*=\s*["']([a-zA-Z_$][a-zA-Z0-9_$]*)["']|:\w+="([a-zA-Z_$][a-zA-Z0-9_$]*)"/g;
      while ((match = bindingPattern.exec(templateContent)) !== null) {
        const varName = match[1] || match[2];
        if (varName) templateVars.add(varName);
      }
      
      if (templateVars.size === 0) {
        return expectations;
      }
      
      // Parse script block for ref() and reactive() declarations
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
          ['decorators', { decoratorsBeforeExport: true }],
        ],
        errorRecovery: true,
      });
      
      const relPath = filePath.replace(projectRoot, '').replace(/^\//, '');
      
      traverse(ast, {
        VariableDeclarator(path) {
          const node = path.node;
          const init = node.init;
          
          if (!init || init.type !== 'CallExpression') return;
          
          const callee = init.callee;
          if (!callee || !callee.name) return;
          
          const varName = node.id.name;
          if (!templateVars.has(varName)) return;
          
          if (callee.name === 'ref' || callee.name === 'reactive') {
            const loc = node.loc;
            const line = loc ? loc.start.line : 1;
            const column = loc ? loc.start.column : 0;
            
            const astSource = lines.slice(line - 1, Math.min(loc?.end?.line || line, line + 5))
              .join('\n')
              .substring(0, 200);
            
            expectations.push({
              type: 'state',
              promise: {
                kind: 'state-change',
                value: varName,
                stateVar: varName,
              },
              source: {
                file: relPath,
                line,
                column,
                astSource,
              },
              confidence: 0.9,
            });
          }
        },
      });
    } catch (error) {
      // Parse errors are silently handled
    }
    
    return expectations;
  }

export default VueStateDetector;





