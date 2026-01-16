/**
 * PHASE 20 — Angular Component Extractor
 * 
 * Extracts component metadata, template, and class content from Angular TypeScript files.
 * Handles @Component decorators, template files, and component class methods.
 * Deterministic and robust (no external runtime execution).
 */

/**
 * PHASE 20: Extract Angular component metadata
 * 
 * @param {string} content - Full .ts file content
 * @param {string} filePath - Path to the .ts file (for context)
 * @param {string} projectRoot - Project root directory
 * @returns {Object} { componentClass: {content, startLine}, template: {content, path, isInline}, decorator: {content, startLine} }
 */
export function extractAngularComponent(content, filePath, projectRoot) {
  const result = {
    componentClass: null,
    template: null,
    decorator: null,
  };
  
  try {
    // Extract @Component decorator
    const decoratorRegex = /@Component\s*\(\s*\{([\s\S]*?)\}\s*\)/;
    const decoratorMatch = content.match(decoratorRegex);
    
    if (decoratorMatch) {
      const _decoratorContent = decoratorMatch[0];
      const decoratorConfig = decoratorMatch[1];
      const beforeDecorator = content.substring(0, decoratorMatch.index);
      const decoratorStartLine = (beforeDecorator.match(/\n/g) || []).length + 1;
      
      result.decorator = {
        content: decoratorConfig,
        startLine: decoratorStartLine,
      };
      
      // Extract template (inline or external file)
      const templateMatch = decoratorConfig.match(/template\s*:\s*['"`]([\s\S]*?)['"`]/);
      const templateUrlMatch = decoratorConfig.match(/templateUrl\s*:\s*['"`]([^'"`]+)['"`]/);
      
      if (templateMatch) {
        // Inline template
        result.template = {
          content: templateMatch[1],
          path: filePath,
          isInline: true,
        };
      } else if (templateUrlMatch) {
        // External template file
        const templateUrl = templateUrlMatch[1];
        const templatePath = resolveTemplatePath(templateUrl, filePath, projectRoot);
        result.template = {
          path: templatePath,
          isInline: false,
        };
      }
    }
    
    // Extract component class
    const classRegex = /export\s+class\s+(\w+)\s*(?:extends\s+\w+)?\s*\{([\s\S]*?)\n\}/;
    const classMatch = content.match(classRegex);
    
    if (classMatch) {
      const beforeClass = content.substring(0, classMatch.index);
      const classStartLine = (beforeClass.match(/\n/g) || []).length + 1;
      
      result.componentClass = {
        content: classMatch[2],
        className: classMatch[1],
        startLine: classStartLine,
      };
    }
  } catch (error) {
    // Skip if extraction fails
  }
  
  return result;
}

/**
 * Resolve template path from templateUrl
 * 
 * @param {string} templateUrl - Template URL from decorator
 * @param {string} componentPath - Path to component file
 * @param {string} projectRoot - Project root directory
 * @returns {string} Resolved template path
 */
function resolveTemplatePath(templateUrl, componentPath, projectRoot) {
  const { join: _join, dirname, resolve } = require('path');
  
  if (templateUrl.startsWith('./') || templateUrl.startsWith('../')) {
    // Relative path
    return resolve(dirname(componentPath), templateUrl);
  } else {
    // Absolute path from project root
    return resolve(projectRoot, templateUrl);
  }
}

/**
 * Extract template bindings from Angular template
 * Detects event handlers, property bindings, and structural directives
 * 
 * @param {string} templateContent - Template content
 * @returns {Object} { eventHandlers: [], propertyBindings: [], structuralDirectives: [] }
 */
export function extractTemplateBindings(templateContent) {
  const eventHandlers = [];
  const propertyBindings = [];
  const structuralDirectives = [];
  
  // Extract event handlers: (click)="handler()", (submit)="onSubmit()"
  const eventHandlerRegex = /\((\w+)\)\s*=\s*["']([^"']+)["']/g;
  let handlerMatch;
  while ((handlerMatch = eventHandlerRegex.exec(templateContent)) !== null) {
    eventHandlers.push({
      event: handlerMatch[1],
      handler: handlerMatch[2],
      line: (templateContent.substring(0, handlerMatch.index).match(/\n/g) || []).length + 1,
    });
  }
  
  // Extract property bindings: [property]="value", [disabled]="isDisabled"
  const propertyBindingRegex = /\[(\w+)\]\s*=\s*["']([^"']+)["']/g;
  let bindingMatch;
  while ((bindingMatch = propertyBindingRegex.exec(templateContent)) !== null) {
    propertyBindings.push({
      property: bindingMatch[1],
      value: bindingMatch[2],
      line: (templateContent.substring(0, bindingMatch.index).match(/\n/g) || []).length + 1,
    });
  }
  
  // Extract structural directives: *ngIf="condition", *ngFor="item of items"
  const structuralDirectiveRegex = /\*ng(If|For|Switch)\s*=\s*["']([^"']+)["']/g;
  let directiveMatch;
  while ((directiveMatch = structuralDirectiveRegex.exec(templateContent)) !== null) {
    structuralDirectives.push({
      directive: directiveMatch[1],
      expression: directiveMatch[2],
      line: (templateContent.substring(0, directiveMatch.index).match(/\n/g) || []).length + 1,
    });
  }
  
  return {
    eventHandlers,
    propertyBindings,
    structuralDirectives,
  };
}

/**
 * Map template handlers to component class methods
 * 
 * @param {Array} eventHandlers - Event handlers from template
 * @param {string} classContent - Component class content
 * @returns {Array} Mapped handlers with method references
 */
export function mapTemplateHandlersToClass(eventHandlers, classContent) {
  return eventHandlers.map(handler => {
    // Extract method name from handler expression
    const methodName = handler.handler.split('(')[0].trim();
    
    // Try to find method definition in class
    const methodRegex = new RegExp(`(?:public|private|protected)?\\s*(?:async\\s+)?${methodName}\\s*\\(`, 'g');
    const methodMatch = methodRegex.exec(classContent);
    
    return {
      ...handler,
      methodName,
      methodFound: !!methodMatch,
      methodLine: methodMatch ? (classContent.substring(0, methodMatch.index).match(/\n/g) || []).length + 1 : null,
    };
  });
}

