/**
 * CODE INTELLIGENCE v1 — Effect Detector
 * 
 * Detects DIRECT effects in handler function bodies:
 * - Navigation: navigate(), router.push(), router.replace()
 * - Network: fetch(), axios.get/post/put/delete(), XMLHttpRequest
 * - Validation: preventDefault() + return false, throw, setError
 * 
 * String literals ONLY. No template literals in v1.
 */

import ts from 'typescript';
import { getFunctionBody, getStringLiteral, findNodes, getNodeLocation } from './ts-program.js';
import { normalizeTemplateLiteral } from '../shared/dynamic-route-normalizer.js';

/**
 * Detect effects in handler function.
 * 
 * @param {ts.Node} handlerNode - Function node
 * @param {ts.SourceFile} sourceFile - Source file
 * @param {string} projectRoot - Project root
 * @param {string} eventType - Event type (onSubmit, onClick, etc.) - VALIDATION INTELLIGENCE v1
 * @returns {Array} - Array of effect objects
 */
export function detectEffects(handlerNode, sourceFile, projectRoot, eventType = null) {
  const effects = [];
  const statements = getFunctionBody(handlerNode);
  
  if (!statements) {
    // Arrow function with expression body
    if (ts.isArrowFunction(handlerNode) && ts.isExpression(handlerNode.body)) {
      const effect = analyzeExpression(handlerNode.body, sourceFile, projectRoot, eventType);
      if (effect) effects.push(effect);
    }
    return effects;
  }
  
  // Walk all statements and expressions
  for (const statement of statements) {
    findNodes(statement, node => {
      const effect = analyzeNode(node, sourceFile, projectRoot, eventType);
      if (effect) effects.push(effect);
      return false; // Continue walking
    });
  }
  
  return effects;
}

/**
 * Analyze node for effects.
 * 
 * @param {ts.Node} node - AST node
 * @param {ts.SourceFile} sourceFile - Source file
 * @param {string} projectRoot - Project root
 * @param {string} eventType - Event type (onSubmit, onClick, etc.) - VALIDATION INTELLIGENCE v1
 * @returns {Object|null} - Effect object or null
 */
function analyzeNode(node, sourceFile, projectRoot, eventType = null) {
  // Call expressions
  if (ts.isCallExpression(node)) {
    return analyzeCallExpression(node, sourceFile, projectRoot, eventType);
  }
  
  // VALIDATION INTELLIGENCE v1: Check for return false in submit context
  if (ts.isReturnStatement(node) && eventType === 'onSubmit') {
    const expression = node.expression;
    if (expression && expression.kind === ts.SyntaxKind.FalseKeyword) {
      const location = getNodeLocation(sourceFile, node, projectRoot);
      return {
        type: 'validation_block',
        method: 'return_false',
        target: null,
        sourceRef: location.sourceRef,
        file: location.file,
        line: location.line
      };
    }
  }
  
  return null;
}

/**
 * Analyze expression for effects.
 * 
 * @param {ts.Expression} expr - Expression node
 * @param {ts.SourceFile} sourceFile - Source file
 * @param {string} projectRoot - Project root
 * @param {string} eventType - Event type (onSubmit, onClick, etc.) - VALIDATION INTELLIGENCE v1
 * @returns {Object|null} - Effect object or null
 */
function analyzeExpression(expr, sourceFile, projectRoot, eventType = null) {
  if (ts.isCallExpression(expr)) {
    return analyzeCallExpression(expr, sourceFile, projectRoot, eventType);
  }
  return null;
}

/**
 * Analyze call expression for effects.
 * 
 * @param {ts.CallExpression} call - Call expression
 * @param {ts.SourceFile} sourceFile - Source file
 * @param {string} projectRoot - Project root
 * @param {string} eventType - Event type (onSubmit, onClick, etc.) - VALIDATION INTELLIGENCE v1
 * @returns {Object|null} - Effect object or null
 */
function analyzeCallExpression(call, sourceFile, projectRoot, eventType = null) {
  const expr = call.expression;
  
  // Navigation: navigate("/path")
  if (ts.isIdentifier(expr) && expr.text === 'navigate') {
    const target = getFirstStringArg(call);
    if (target) {
      const location = getNodeLocation(sourceFile, call, projectRoot);
      return {
        type: 'navigation',
        method: 'navigate',
        target,
        sourceRef: location.sourceRef,
        file: location.file,
        line: location.line
      };
    }
  }
  
  // Router: router.push("/path")
  if (ts.isPropertyAccessExpression(expr)) {
    const obj = expr.expression;
    const prop = expr.name;
    
    if (ts.isIdentifier(obj) && ts.isIdentifier(prop)) {
      const objName = obj.text;
      const propName = prop.text;
      
      // router.push/replace/navigate
      if ((objName === 'router' || objName === 'history') && 
          ['push', 'replace', 'navigate'].includes(propName)) {
        const target = getFirstStringArg(call);
        if (target) {
          const location = getNodeLocation(sourceFile, call, projectRoot);
          return {
            type: 'navigation',
            method: `${objName}.${propName}`,
            target,
            sourceRef: location.sourceRef,
            file: location.file,
            line: location.line
          };
        }
      }
      
      // axios.get/post/put/delete("/api/...")
      if (objName === 'axios' && ['get', 'post', 'put', 'delete', 'patch'].includes(propName)) {
        const target = getFirstStringArg(call);
        if (target) {
          const location = getNodeLocation(sourceFile, call, projectRoot);
          return {
            type: 'network',
            method: propName.toUpperCase(),
            target,
            sourceRef: location.sourceRef,
            file: location.file,
            line: location.line
          };
        }
      }
    }
  }
  
  // fetch("/api/...")
  if (ts.isIdentifier(expr) && expr.text === 'fetch') {
    const target = getFirstStringArg(call);
    if (target) {
      // Check for method in options
      let method = 'GET';
      if (call.arguments.length > 1) {
        const options = call.arguments[1];
        if (ts.isObjectLiteralExpression(options)) {
          for (const prop of options.properties) {
            if (ts.isPropertyAssignment(prop)) {
              const name = prop.name;
              if (ts.isIdentifier(name) && name.text === 'method') {
                const value = getStringLiteral(prop.initializer);
                if (value) method = value.toUpperCase();
              }
            }
          }
        }
      }
      
      const location = getNodeLocation(sourceFile, call, projectRoot);
      return {
        type: 'network',
        method,
        target,
        sourceRef: location.sourceRef,
        file: location.file,
        line: location.line
      };
    }
  }
  
  // preventDefault() - VALIDATION INTELLIGENCE v1: validation_block in onSubmit context
  if (ts.isPropertyAccessExpression(expr)) {
    const prop = expr.name;
    if (ts.isIdentifier(prop) && prop.text === 'preventDefault') {
      const location = getNodeLocation(sourceFile, call, projectRoot);
      // If in onSubmit context, emit validation_block; otherwise legacy validation type
      if (eventType === 'onSubmit') {
        return {
          type: 'validation_block',
          method: 'preventDefault',
          target: null,
          sourceRef: location.sourceRef,
          file: location.file,
          line: location.line
        };
      } else {
        return {
          type: 'validation',
          method: 'preventDefault',
          target: null,
          sourceRef: location.sourceRef,
          file: location.file,
          line: location.line
        };
      }
    }

    // xhr.open('POST', '/api/foo')
    if (ts.isIdentifier(prop) && prop.text === 'open') {
      const args = call.arguments;
      if (args.length >= 2) {
        const methodLiteral = getStringLiteral(args[0]);
        const urlLiteral = getStringLiteral(args[1]);
        if (methodLiteral && urlLiteral) {
          const location = getNodeLocation(sourceFile, call, projectRoot);
          return {
            type: 'network',
            method: methodLiteral.toUpperCase(),
            target: urlLiteral,
            sourceRef: location.sourceRef,
            file: location.file,
            line: location.line
          };
        }
      }
    }
  }
  
  // STATE INTELLIGENCE: Redux dispatch(action())
  if (ts.isIdentifier(expr) && expr.text === 'dispatch') {
    const firstArg = call.arguments[0];
    if (firstArg && ts.isCallExpression(firstArg)) {
      // dispatch(increment()) - action creator call
      let actionName = null;
      
      // Simple action creator: increment()
      if (ts.isIdentifier(firstArg.expression)) {
        actionName = firstArg.expression.text;
      }
      // Slice action: counterSlice.actions.increment()
      else if (ts.isPropertyAccessExpression(firstArg.expression)) {
        const prop = firstArg.expression.name;
        if (ts.isIdentifier(prop)) {
          actionName = prop.text;
        }
      }
      
      if (actionName) {
        const location = getNodeLocation(sourceFile, call, projectRoot);
        return {
          type: 'state',
          method: 'dispatch',
          target: actionName,
          storeType: 'redux',
          sourceRef: location.sourceRef,
          file: location.file,
          line: location.line
        };
      }
    }
  }
  
  // STATE INTELLIGENCE: Zustand set((state) => ({ key: value }))
  if (ts.isIdentifier(expr) && expr.text === 'set') {
    const firstArg = call.arguments[0];
    if (firstArg && ts.isArrowFunction(firstArg)) {
      // Extract keys from object literal in return
      const body = firstArg.body;
      if (ts.isObjectLiteralExpression(body)) {
        const keys = [];
        for (const prop of body.properties) {
          if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
            keys.push(prop.name.text);
          }
        }
        
        if (keys.length > 0) {
          const location = getNodeLocation(sourceFile, call, projectRoot);
          return {
            type: 'state',
            method: 'set',
            target: keys.join(','), // Multiple keys possible
            storeType: 'zustand',
            sourceRef: location.sourceRef,
            file: location.file,
            line: location.line
          };
        }
      }
    }
  }
  
  return null;
}

/**
 * Get first string argument from call expression.
 * 
 * @param {ts.CallExpression} call - Call expression
 * @returns {string|null} - String value or null
 */
function getFirstStringArg(call) {
  if (call.arguments.length === 0) return null;
  const firstArg = call.arguments[0];
  
  // Try string literal first
  const stringLiteral = getStringLiteral(firstArg);
  if (stringLiteral) return stringLiteral;
  
  // Try template literal (static only - no interpolations)
  if (ts.isTemplateExpression(firstArg)) {
    // Check if it's a static template (no expressions)
    if (firstArg.templateSpans && firstArg.templateSpans.length === 0) {
      // Pure template literal without ${} - treat as static
      const text = firstArg.head?.text || '';
      return text;
    }
    
    // Template with expressions - extract pattern for normalization
    let templateText = firstArg.head?.text || '';
    for (const span of firstArg.templateSpans) {
      // Check if expression is a simple identifier we can replace
      const expr = span.expression;
      if (ts.isIdentifier(expr)) {
        templateText += '${' + expr.text + '}';
      } else {
        // Complex expression - cannot normalize safely
        return null;
      }
      templateText += span.literal?.text || '';
    }
    
    // Normalize template literal to example path
    const normalized = normalizeTemplateLiteral(templateText);
    return normalized ? normalized.examplePath : null;
  }
  
  // Try NoSubstitutionTemplateLiteral (template literal without expressions)
  if (ts.isNoSubstitutionTemplateLiteral(firstArg)) {
    return firstArg.text;
  }
  
  return null;
}



