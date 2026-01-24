/**
 * CODE INTELLIGENCE v1 — JSX Handler Mapper
 * 
 * Maps JSX event handlers (onClick, onSubmit) to function declarations.
 * Resolves handler identifiers to actual function bodies.
 * Captures sourceRef for both element and handler.
 */

import ts from 'typescript';
import { parseFile, findNodes, resolveIdentifier, isFunctionNode, getNodeLocation } from './ts-program.js';

/**
 * Extract handler mappings from JSX elements.
 * 
 * @param {string} projectRoot - Project root
 * @param {Object} program - TypeScript program
 * @returns {Array} - Handler mappings { element, handlerName, handlerNode, elementSourceRef, handlerSourceRef }
 */
export function extractHandlerMappings(projectRoot, program) {
  const mappings = [];
  
  if (!program || !program.program || !program.typeChecker) return mappings;
  
  for (const filePath of program.sourceFiles) {
    const ast = parseFile(filePath, true);
    if (!ast) continue;
    
    // Find JSX elements with event handlers
    const jsxElements = findNodes(ast, node => {
      return ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node);
    });
    
    for (const element of jsxElements) {
      const tagName = getTagName(element);
      const attributes = element.attributes;
      if (!attributes || !attributes.properties) continue;
      
      for (const attr of attributes.properties) {
        if (!ts.isJsxAttribute(attr)) continue;
        
        const attrName = attr.name;
        if (!ts.isIdentifier(attrName)) continue;
        
        const eventType = attrName.text;
        if (!['onClick', 'onSubmit', 'onChange', 'onBlur'].includes(eventType)) continue;
        
        const initializer = attr.initializer;
        if (!initializer) continue;
        
        let handlerNode = null;
        let handlerName = null;
        
        // JsxExpression: onClick={handleClick}
        if (ts.isJsxExpression(initializer)) {
          const expr = initializer.expression;
          
          if (ts.isIdentifier(expr)) {
            // Reference to function: onClick={handleClick}
            handlerName = expr.text;
            const declaration = resolveIdentifier(program.typeChecker, expr);
            if (declaration && isFunctionNode(declaration)) {
              handlerNode = declaration;
            } else if (declaration && ts.isVariableDeclaration(declaration)) {
              // const handleClick = () => {...}
              const init = declaration.initializer;
              if (init && isFunctionNode(init)) {
                handlerNode = init;
              }
            } else {
              // Fallback for JS/JSX where typeChecker cannot resolve identifiers.
              // Search the file for a matching function/variable declaration manually.
              const localMatch = findNodes(ast, n => {
                if (ts.isFunctionDeclaration(n) && n.name?.text === handlerName) return true;
                if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === handlerName) {
                  return isFunctionNode(n.initializer || n);
                }
                return false;
              })[0];

              if (localMatch) {
                if (isFunctionNode(localMatch)) {
                  handlerNode = localMatch;
                } else if (ts.isVariableDeclaration(localMatch)) {
                  const init = localMatch.initializer;
                  if (init && isFunctionNode(init)) {
                    handlerNode = init;
                  }
                }
              }
            }
          } else if (isFunctionNode(expr)) {
            // Inline arrow: onClick={() => {...}}
            handlerNode = expr;
            handlerName = 'inline';
          }
        }
        
        if (handlerNode) {
          const elementLoc = getNodeLocation(ast, element, projectRoot);
          const handlerSourceFile = program.program.getSourceFile(handlerNode.getSourceFile().fileName);
          const handlerLoc = handlerSourceFile 
            ? getNodeLocation(handlerSourceFile, handlerNode, projectRoot)
            : null;
          
          // Capture simple attribute map for matching hints (e.g., href/to)
          const attrMap = {};
          for (const ap of attributes.properties) {
            if (!ts.isJsxAttribute(ap)) continue;
            if (!ts.isIdentifier(ap.name)) continue;
            const aname = ap.name.text;
            const init = ap.initializer;
            if (!init) continue;
            if (ts.isStringLiteral(init)) {
              attrMap[aname] = init.text;
            } else if (ts.isJsxExpression(init) && init.expression && ts.isStringLiteral(init.expression)) {
              attrMap[aname] = init.expression.text;
            }
          }

          mappings.push({
            element: {
              tag: tagName,
              event: eventType,
              attrs: attrMap,
              sourceRef: elementLoc.sourceRef,
              file: elementLoc.file,
              line: elementLoc.line
            },
            handler: {
              name: handlerName,
              node: handlerNode,
              sourceRef: handlerLoc?.sourceRef || elementLoc.sourceRef,
              file: handlerLoc?.file || elementLoc.file,
              line: handlerLoc?.line || elementLoc.line
            }
          });
        }
      }
    }
  }
  
  return mappings;
}

  /**
   * Extract navigation-capable JSX elements (Link/NavLink/a) with static href/to.
   * Returns minimal element records with attrs and sourceRef, independent of handlers.
   */
  export function extractNavElements(projectRoot, program) {
    const elements = [];
    if (!program || !program.program || !program.typeChecker) return elements;
    for (const filePath of program.sourceFiles) {
      const ast = parseFile(filePath, true);
      if (!ast) continue;
      const jsxElements = findNodes(ast, node => ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node));
      for (const element of jsxElements) {
        const tagName = getTagName(element);
        if (!['Link', 'NavLink', 'a'].includes(tagName)) continue;
        const attributes = element.attributes;
        if (!attributes || !attributes.properties) continue;
        let href = null, to = null;
        for (const attr of attributes.properties) {
          if (!ts.isJsxAttribute(attr)) continue;
          if (!ts.isIdentifier(attr.name)) continue;
          const an = attr.name.text;
          const init = attr.initializer;
          if (!init) continue;
          if (an === 'href' || an === 'to') {
            if (ts.isStringLiteral(init)) {
              if (an === 'href') href = init.text; else to = init.text;
            } else if (ts.isJsxExpression(init) && init.expression && ts.isStringLiteral(init.expression)) {
              if (an === 'href') href = init.expression.text; else to = init.expression.text;
            } else if (ts.isJsxExpression(init) && init.expression && ts.isNoSubstitutionTemplateLiteral(init.expression)) {
              if (an === 'href') href = init.expression.text; else to = init.expression.text;
            }
          }
        }
        const target = to || href;
        if (typeof target === 'string' && target.startsWith('/') && !target.startsWith('//')) {
          const loc = getNodeLocation(ast, element, projectRoot);
          elements.push({
            tag: tagName,
            attrs: { href, to },
            sourceRef: loc.sourceRef,
            file: loc.file,
            line: loc.line
          });
        }
      }
    }
    return elements;
  }

/**
 * Get tag name from JSX element.
 * 
 * @param {ts.Node} element - JSX element node
 * @returns {string} - Tag name
 */
function getTagName(element) {
  const tagName = element.tagName;
  if (ts.isIdentifier(tagName)) {
    return tagName.text;
  }
  return 'unknown';
}

/**
 * Extract selector hint from JSX element for stable identification.
 * 
 * @param {ts.Node} element - JSX element node
 * @returns {string|null} - Selector hint (id, data-testid, or null)
 */
export function extractSelectorHint(element) {
  const attributes = element.attributes;
  if (!attributes || !attributes.properties) return null;
  
  // Priority: id > data-testid > data-cy > role
  for (const attr of attributes.properties) {
    if (!ts.isJsxAttribute(attr)) continue;
    
    const name = attr.name;
    if (!ts.isIdentifier(name)) continue;
    
    const attrName = name.text;
    const initializer = attr.initializer;
    
    if (attrName === 'id' && initializer && ts.isStringLiteral(initializer)) {
      return `#${initializer.text}`;
    }
    
    if (attrName === 'data-testid' && initializer) {
      if (ts.isStringLiteral(initializer)) {
        return `[data-testid="${initializer.text}"]`;
      } else if (ts.isJsxExpression(initializer)) {
        const expr = initializer.expression;
        if (expr && ts.isStringLiteral(expr)) {
          return `[data-testid="${expr.text}"]`;
        }
      }
    }
    
    if (attrName === 'data-cy' && initializer && ts.isStringLiteral(initializer)) {
      return `[data-cy="${initializer.text}"]`;
    }
  }
  
  return null;
}



