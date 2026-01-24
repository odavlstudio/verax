/**
 * PHASE 20 — Angular State Detector
 * 
 * Detects state mutations (component properties, services) in Angular components.
 * Only emits state promises if state is user-visible (used in template bindings).
 */

import { extractAngularComponent, extractTemplateBindings } from './angular-component-extractor.js';
import BaseDetector from './base-detector.js';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import { readFileSync, existsSync } from 'fs';
/**
 * Angular State Detector class (BaseDetector implementation)
 */
export class AngularStateDetector extends BaseDetector {
  constructor() {
    super({
      name: 'angular-state',
      framework: 'angular',
      type: 'state',
    });
  }

  detect(filePath, content, projectRoot) {
    return detectAngularState(filePath, content, projectRoot);
  }
}

/**
 * Detect state promises in Angular component
 * 
 * @param {string} filePath - Path to .ts file
 * @param {string} content - Full file content
 * @param {string} projectRoot - Project root directory
 * @returns {Array} Array of state expectations
 */
export function detectAngularState(filePath, content, projectRoot) {
  const expectations = [];
  
  try {
    const component = extractAngularComponent(content, filePath, projectRoot);
    
    // Extract template bindings to identify user-visible state
    let templateBindings = null;
    let templateContent = null;
    
    if (component.template) {
      if (component.template.isInline) {
        templateContent = component.template.content;
      } else if (existsSync(component.template.path)) {
        templateContent = readFileSync(component.template.path, 'utf8');
      }
      
      if (templateContent) {
        templateBindings = extractTemplateBindings(templateContent);
      }
    }
    
    // Collect all state variables used in template
    const templateStateVars = new Set();
    
    // From property bindings: [property]="value"
    if (templateBindings) {
      templateBindings.propertyBindings.forEach(binding => {
        templateStateVars.add(binding.value);
      });
      
      // From structural directives: *ngIf="condition"
      templateBindings.structuralDirectives.forEach(directive => {
        // Extract variable names from expressions
        const varMatch = directive.expression.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)/);
        if (varMatch) {
          templateStateVars.add(varMatch[1]);
        }
      });
    }
    
    // From template interpolation: {{ variable }}
    if (templateContent) {
      const interpolationRegex = /\{\{\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\}\}/g;
      let varMatch;
      while ((varMatch = interpolationRegex.exec(templateContent)) !== null) {
        templateStateVars.add(varMatch[1]);
      }
    }
    
    // Process component class to find state mutations
    if (component.componentClass && component.componentClass.content) {
      try {
        const ast = parse(component.componentClass.content, {
          sourceType: 'module',
          plugins: ['typescript', 'decorators-legacy', 'classProperties'],
        });
        
        traverse.default(ast, {
          // Detect property assignments: this.property = value
          AssignmentExpression(path) {
            const { node } = path;
            
            if (
              node.left.type === 'MemberExpression' &&
              node.left.object.type === 'ThisExpression' &&
              node.left.property.type === 'Identifier'
            ) {
              const propertyName = node.left.property.name;
              
              // Only emit if property is used in template
              if (templateStateVars.has(propertyName)) {
                const location = node.loc;
                const line = component.componentClass.startLine + (location ? location.start.line - 1 : 0);
                
                expectations.push({
                  type: 'state',
                  expectedTarget: propertyName,
                  context: 'property-assignment',
                  sourceRef: {
                    file: filePath,
                    line,
                    snippet: component.componentClass.content.substring(
                      node.start - (ast.program.body[0]?.start || 0),
                      node.end - (ast.program.body[0]?.start || 0)
                    ),
                  },
                  proof: 'PROVEN_EXPECTATION',
                  metadata: {
                    templateUsage: Array.from(templateStateVars).filter(v => v === propertyName).length,
                    stateType: 'component-property',
                  },
                });
              }
            }
          },
          
          // Detect property declarations: property: type = value
          ClassProperty(path) {
            const { node } = path;
            
            if (node.key.type === 'Identifier') {
              const propertyName = node.key.name;
              
              // Only emit if property is used in template and has initializer
              if (templateStateVars.has(propertyName) && node.value) {
                const location = node.loc;
                const line = component.componentClass.startLine + (location ? location.start.line - 1 : 0);
                
                expectations.push({
                  type: 'state',
                  expectedTarget: propertyName,
                  context: 'property-declaration',
                  sourceRef: {
                    file: filePath,
                    line,
                    snippet: component.componentClass.content.substring(
                      node.start - (ast.program.body[0]?.start || 0),
                      node.end - (ast.program.body[0]?.start || 0)
                    ),
                  },
                  proof: 'PROVEN_EXPECTATION',
                  metadata: {
                    templateUsage: Array.from(templateStateVars).filter(v => v === propertyName).length,
                    stateType: 'component-property',
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




