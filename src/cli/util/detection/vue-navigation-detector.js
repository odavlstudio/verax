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

import BaseDetector from './base-detector.js';

/**
 * Vue Navigation Detector class (BaseDetector implementation)
 */
export class VueNavigationDetector extends BaseDetector {
  constructor() {
    super({
      name: 'vue-navigation',
      framework: 'vue',
      type: 'navigation',
    });
  }

  detect(filePath, content, projectRoot) {
    return detectVueNavigation(filePath, content, projectRoot);
  }
}

/**
 * Detect Vue navigation promises from Router API calls
 * Parses Vue SFC script blocks for router.push(), router.replace() calls
 * that target named or dynamic routes.
 * 
 * @param {string} filePath - Path to .vue file
 * @param {string} content - Full file content
 * @param {string} projectRoot - Project root directory
 * @returns {Array} Array of navigation promises
 */
function detectVueNavigation(filePath, content, projectRoot) {
  const expectations = [];
  
  try {
    // Find script block
    const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/);
    if (!scriptMatch) {
      return expectations;
    }
    
    const scriptContent = scriptMatch[1];
    const lines = content.split('\n');
    const relPath = filePath.replace(projectRoot, '').replace(/^\//, '');
    
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
    
    traverse(ast, {
      CallExpression(path) {
        const node = path.node;
        const callee = node.callee;
        
        if (!callee || callee.type !== 'MemberExpression') return;
        
        const property = callee.property;
        if (!property || !property.name || (property.name !== 'push' && property.name !== 'replace')) return;
        
        const object = callee.object;
        const isRouter = 
          (object.type === 'Identifier' && object.name === 'router') ||
          (object.type === 'MemberExpression' && 
           object.object.type === 'ThisExpression' && 
           object.property.name === '$router');
        
        if (!isRouter || !node.arguments.length) return;
        
        const arg = node.arguments[0];
        let targetPath = null;
        let isDynamic = false;
        
        if (arg.type === 'StringLiteral' || (arg.type === 'Literal' && typeof arg.value === 'string')) {
          targetPath = arg.value;
        } else if (arg.type === 'ObjectExpression') {
          const pathProp = arg.properties.find(p => p.key && p.key.name === 'path');
          const nameProp = arg.properties.find(p => p.key && p.key.name === 'name');
          
          if (pathProp && (pathProp.value.type === 'StringLiteral' || pathProp.value.type === 'Literal')) {
            targetPath = pathProp.value.value;
          } else if (nameProp) {
            isDynamic = true;
            targetPath = '<named-route>';
          } else {
            isDynamic = true;
            targetPath = '<dynamic>';
          }
        } else {
          isDynamic = true;
          targetPath = '<dynamic>';
        }
        
        if (!targetPath) return;
        
        const loc = node.loc;
        const line = loc ? loc.start.line : 1;
        const column = loc ? loc.start.column : 0;
        
        const astSource = lines.slice(line - 1, Math.min(loc?.end?.line || line, line + 3))
          .join('\n')
          .substring(0, 200);
        
        expectations.push({
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
            astSource,
          },
          confidence: isDynamic ? 0.7 : 1.0,
        });
      },
    });
  } catch (error) {
    // Parse errors are silently handled
  }
  
  return expectations;
}

export default VueNavigationDetector;





