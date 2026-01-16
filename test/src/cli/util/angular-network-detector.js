/**
 * PHASE 20 — Angular Network Detector
 * 
 * Detects network calls (HttpClient, fetch) in Angular component methods and services.
 * Reuses AST network detector but ensures it works with Angular TypeScript files.
 */

import { extractAngularComponent, extractTemplateBindings, mapTemplateHandlersToClass } from './angular-component-extractor.js';
import { detectNetworkCallsAST } from './ast-network-detector.js';
import { relative } from 'path';
import { readFileSync, existsSync } from 'fs';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';

/**
 * Detect network promises in Angular component
 * 
 * @param {string} filePath - Path to .ts file
 * @param {string} content - Full file content
 * @param {string} projectRoot - Project root directory
 * @returns {Array} Array of network expectations
 */
export function detectAngularNetwork(filePath, content, projectRoot) {
  const expectations = [];
  
  try {
    const component = extractAngularComponent(content, filePath, projectRoot);
    
    // Extract event handlers from template to identify UI-bound handlers
    let templateBindings = null;
    if (component.template) {
      let templateContent = null;
      
      if (component.template.isInline) {
        templateContent = component.template.content;
      } else if (existsSync(component.template.path)) {
        templateContent = readFileSync(component.template.path, 'utf8');
      }
      
      if (templateContent) {
        templateBindings = extractTemplateBindings(templateContent);
      }
    }
    
    const mappedHandlers = component.componentClass && templateBindings
      ? mapTemplateHandlersToClass(templateBindings.eventHandlers, component.componentClass.content)
      : [];
    
    const uiBoundHandlers = new Set(mappedHandlers.map(h => h.methodName));
    
    // Process component class
    if (component.componentClass && component.componentClass.content) {
      // Use AST network detector on class content
      const networkCalls = detectNetworkCallsAST(component.componentClass.content, filePath, relative(projectRoot, filePath));
      
      // Also detect HttpClient calls specifically
      const httpClientCalls = detectHttpClientCalls(component.componentClass.content, component.componentClass.startLine);
      
      // Combine and filter network calls
      const allNetworkCalls = [...networkCalls, ...httpClientCalls];
      
      for (const networkCall of allNetworkCalls) {
        // Check if this is in a UI-bound handler
        const isUIBound = networkCall.context && uiBoundHandlers.has(networkCall.context);
        
        // Skip analytics-only calls (filtered by guardrails later)
        if (networkCall.target && (
          networkCall.target.includes('/api/analytics') ||
          networkCall.target.includes('/api/track') ||
          networkCall.target.includes('/api/beacon')
        )) {
          continue;
        }
        
        expectations.push({
          type: 'network',
          target: networkCall.target || networkCall.url,
          method: networkCall.method || 'GET',
          context: networkCall.context || 'component',
          sourceRef: {
            file: filePath,
            line: networkCall.line || component.componentClass.startLine,
            snippet: networkCall.snippet || '',
          },
          proof: networkCall.proof || 'LIKELY_EXPECTATION',
          metadata: {
            isUIBound,
            handlerContext: networkCall.context,
            networkKind: networkCall.kind || 'http',
          },
        });
      }
    }
  } catch (error) {
    // Skip if extraction fails
  }
  
  return expectations;
}

/**
 * Detect HttpClient calls (get, post, put, delete, etc.)
 * 
 * @param {string} classContent - Component class content
 * @param {number} startLine - Starting line number
 * @returns {Array} Array of network call detections
 */
function detectHttpClientCalls(classContent, startLine) {
  const calls = [];
  
  try {
    const ast = parse(classContent, {
      sourceType: 'module',
      plugins: ['typescript', 'decorators-legacy', 'classProperties'],
    });
    
    traverse.default(ast, {
      CallExpression(path) {
        const { node } = path;
        
        // Detect http.get(), http.post(), etc.
        if (
          node.callee.type === 'MemberExpression' &&
          ['get', 'post', 'put', 'delete', 'patch'].includes(node.callee.property.name)
        ) {
          const method = node.callee.property.name.toUpperCase();
          const firstArg = node.arguments[0];
          let url = null;
          
          if (firstArg && firstArg.type === 'StringLiteral') {
            url = firstArg.value;
          } else if (firstArg && firstArg.type === 'TemplateLiteral' && firstArg.quasis.length === 1) {
            url = firstArg.quasis[0].value.raw;
          }
          
          if (url) {
            const location = node.loc;
            const line = startLine + (location ? location.start.line - 1 : 0);
            
            calls.push({
              target: url,
              method,
              line,
              snippet: classContent.substring(
                node.start - (ast.program.body[0]?.start || 0),
                node.end - (ast.program.body[0]?.start || 0)
              ),
              kind: 'httpClient',
              proof: firstArg.type === 'StringLiteral' ? 'PROVEN_EXPECTATION' : 'LIKELY_EXPECTATION',
            });
          }
        }
      },
    });
  } catch (parseError) {
    // Skip if parsing fails
  }
  
  return calls;
}

