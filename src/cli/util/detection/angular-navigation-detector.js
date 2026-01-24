/**
 * PHASE 20 — Angular Navigation Detector
 * 
 * Detects navigation promises in Angular applications:
 * - routerLink directive in templates
 * - Router.navigate() calls in component methods
 * - ActivatedRoute navigation
 */

import { extractAngularComponent, extractTemplateBindings, mapTemplateHandlersToClass } from './angular-component-extractor.js'; // eslint-disable-line no-unused-vars
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import { readFileSync, existsSync } from 'fs';
import BaseDetector from './base-detector.js';
/**
 * Angular Navigation Detector class (BaseDetector implementation)
 */
export class AngularNavigationDetector extends BaseDetector {
  constructor() {
    super({
      name: 'angular-navigation',
      framework: 'angular',
      type: 'navigation',
    });
  }

  detect(filePath, content, projectRoot) {
    return detectAngularNavigation(filePath, content, projectRoot);
  }
}

/**
 * Detect navigation promises in Angular component
 * 
 * @param {string} filePath - Path to .ts file
 * @param {string} content - Full file content
 * @param {string} projectRoot - Project root directory
 * @returns {Array} Array of navigation expectations
 */
export function detectAngularNavigation(filePath, content, projectRoot) {
  const expectations = [];
  
  try {
    const component = extractAngularComponent(content, filePath, projectRoot);
    
    // Extract navigation from template (routerLink)
    if (component.template) {
      let templateContent = null;
      
      if (component.template.isInline) {
        templateContent = component.template.content;
      } else if (existsSync(component.template.path)) {
        templateContent = readFileSync(component.template.path, 'utf8');
      }
      
      if (templateContent) {
        const _templateBindings = extractTemplateBindings(templateContent);
        
        // Extract routerLink directives
        const routerLinkRegex = /routerLink\s*=\s*["']([^"']+)["']/g;
        let linkMatch;
        while ((linkMatch = routerLinkRegex.exec(templateContent)) !== null) {
          const href = linkMatch[1];
          // Skip external links and hash-only links
          if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('#')) {
            continue;
          }
          
          const beforeMatch = templateContent.substring(0, linkMatch.index);
          const line = (beforeMatch.match(/\n/g) || []).length + 1;
          
          expectations.push({
            type: 'navigation',
            target: href,
            context: 'template',
            sourceRef: {
              file: component.template.isInline ? filePath : component.template.path,
              line,
              snippet: linkMatch[0],
            },
            proof: 'PROVEN_EXPECTATION',
            metadata: {
              navigationType: 'routerLink',
            },
          });
        }
      }
    }
    
    // Extract navigation from component class (Router.navigate())
    if (component.componentClass && component.componentClass.content) {
      try {
        const ast = parse(component.componentClass.content, {
          sourceType: 'module',
          plugins: ['typescript', 'decorators-legacy', 'classProperties'],
        });
        
        traverse.default(ast, {
          CallExpression(path) {
            const { node } = path;
            
            // Detect router.navigate() calls
            if (
              node.callee.type === 'MemberExpression' &&
              node.callee.property.name === 'navigate' &&
              node.arguments.length > 0
            ) {
              const arg = node.arguments[0];
              let target = null;
              
              if (arg.type === 'StringLiteral') {
                target = arg.value;
              } else if (arg.type === 'ArrayExpression' && arg.elements.length > 0) {
                // Router.navigate(['/path']) or Router.navigate(['/path', param])
                const firstElement = arg.elements[0];
                if (firstElement.type === 'StringLiteral') {
                  target = firstElement.value;
                }
              } else if (arg.type === 'TemplateLiteral' && arg.quasis.length === 1) {
                target = arg.quasis[0].value.raw;
              }
              
              if (target && !target.startsWith('http://') && !target.startsWith('https://') && !target.startsWith('#')) {
                const location = node.loc;
                const line = component.componentClass.startLine + (location ? location.start.line - 1 : 0);
                
                expectations.push({
                  type: 'navigation',
                  target,
                  context: 'router-navigate',
                  sourceRef: {
                    file: filePath,
                    line,
                    snippet: component.componentClass.content.substring(
                      node.start - (ast.program.body[0]?.start || 0),
                      node.end - (ast.program.body[0]?.start || 0)
                    ),
                  },
                  proof: arg.type === 'StringLiteral' ? 'PROVEN_EXPECTATION' : 'LIKELY_EXPECTATION',
                  metadata: {
                    navigationType: 'router-navigate',
                  },
                });
              }
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




