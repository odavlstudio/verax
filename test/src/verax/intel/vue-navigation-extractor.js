/**
 * CODE INTELLIGENCE v1 — Vue Navigation Promise Extraction (AST-based)
 * 
 * Extracts navigation promises from Vue components:
 * - <router-link to="/path">
 * - <RouterLink :to="{ path: '/path' }">
 * - router.push('/path'), router.replace('/path')
 * - Dynamic targets: router.push(`/users/${id}`)
 */

import ts from 'typescript';
import { parseFile, findNodes, getStringLiteral, getNodeLocation } from './ts-program.js';
import { readFileSync, existsSync } from 'fs';
import { resolve, extname, relative } from 'path';
import { globSync } from 'glob';
import { normalizeDynamicRoute, normalizeTemplateLiteral } from '../shared/dynamic-route-utils.js';

/**
 * Extract navigation promises from Vue components.
 * 
 * @param {Object|string} programOrProjectRoot - TypeScript program object or project root path
 * @param {string|Object} [maybeProjectRoot] - Project root string or program object (supports both call signatures)
 * @returns {Array} - Array of navigation expectation objects
 */
export function extractVueNavigationPromises(programOrProjectRoot, maybeProjectRoot) {
  // Accept both (program, projectRoot) and (projectRoot, program) call signatures
  const program = programOrProjectRoot && programOrProjectRoot.program ? programOrProjectRoot : maybeProjectRoot;
  const projectRoot = programOrProjectRoot && programOrProjectRoot.program ? (maybeProjectRoot || process.cwd()) : programOrProjectRoot;
  
  if (!program || !program.program || !projectRoot) return [];
  const expectations = [];
  
  // Find Vue component files (.vue, .ts, .js, .tsx, .jsx)
  const vueFiles = [];
  const tsProgram = program.program || program;
  const sourceFiles = tsProgram.getSourceFiles ? tsProgram.getSourceFiles() : (program.sourceFiles || []);
  
  for (const sourceFile of sourceFiles) {
    // sourceFiles can be either file paths (strings) or SourceFile objects
    const filePath = typeof sourceFile === 'string' ? sourceFile : (sourceFile.fileName || sourceFile);
    if (!filePath) continue;
    const ext = extname(filePath);
    if (['.vue', '.ts', '.js', '.tsx', '.jsx'].includes(ext)) {
      vueFiles.push(filePath);
    }
  }
  
  // Also explicitly glob for .vue files since TypeScript might not include them
  try {
    const vueFilesFromGlob = globSync('**/*.vue', { cwd: projectRoot, absolute: true, nodir: true });
    for (const filePath of vueFilesFromGlob) {
      const absPath = resolve(filePath);
      if (!vueFiles.includes(absPath) && !vueFiles.find(f => f.endsWith(filePath))) {
        vueFiles.push(absPath);
      }
    }
  } catch (err) {
    // glob not available, skip
  }
  
  for (const filePath of vueFiles) {
    const fileExpectations = extractFromFile(filePath, projectRoot, program);
    expectations.push(...fileExpectations);
  }
  
  return expectations;
}

/**
 * Extract navigation promises from a single file.
 * 
 * @param {string} filePath - File path
 * @param {string} projectRoot - Project root
 * @returns {Array} - Navigation expectations
 */
function extractFromFile(filePath, projectRoot, _program) {
  const expectations = [];
  
  // Check if it's a .vue file (SFC)
  if (extname(filePath) === '.vue') {
    const sfcExpectations = extractFromVueSFC(filePath, projectRoot);
    expectations.push(...sfcExpectations);
    
    // For .vue files, also parse the script section as AST
    // to handle template literals and complex navigation calls
    try {
      const content = readFileSync(filePath, 'utf-8');
      // @ts-expect-error - readFileSync with encoding returns string
      const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/);
      if (scriptMatch) {
        const scriptContent = scriptMatch[1];
        // Parse script content as TypeScript/JavaScript
        const ast = ts.createSourceFile(
          filePath,
          scriptContent,
          ts.ScriptTarget.Latest,
          true,
          ts.ScriptKind.TS
        );
        
        // Extract router.push/replace calls
        const routerCalls = findRouterCalls(ast);
        for (const call of routerCalls) {
          const expectation = extractFromRouterCall(call, ast, projectRoot, filePath);
          if (expectation) {
            // Check for duplicates (might already be extracted by regex)
            const isDupe = expectations.some(e => 
              e.targetPath === expectation.targetPath && 
              e.navigationMethod === expectation.navigationMethod &&
              e.sourceRef === expectation.sourceRef
            );
            if (!isDupe) {
              expectations.push(expectation);
            }
          }
        }
      }
    } catch (err) {
      // If script parsing fails, fall back to regex-based extraction (already done)
    }
    
    return expectations;
  }
  
  // Extract from script section (TypeScript/JavaScript)
  const ast = parseFile(filePath, true);
  if (!ast) return expectations;
  
  // Extract router.push/replace calls
  const routerCalls = findRouterCalls(ast);
  for (const call of routerCalls) {
    const expectation = extractFromRouterCall(call, ast, projectRoot);
    if (expectation) {
      expectations.push(expectation);
    }
  }
  
  // Extract RouterLink JSX/TSX components
  const routerLinks = findRouterLinkElements(ast);
  for (const element of routerLinks) {
    const expectation = extractFromRouterLink(element, ast, projectRoot);
    if (expectation) {
      expectations.push(expectation);
    }
  }
  
  return expectations;
}

/**
 * Extract navigation promises from Vue SFC (.vue file).
 * 
 * @param {string} filePath - File path
 * @param {string} projectRoot - Project root
 * @returns {Array} - Navigation expectations
 */
function extractFromVueSFC(filePath, projectRoot) {
  const expectations = [];
  
  if (!existsSync(filePath)) return expectations;
  
  try {
    const content = readFileSync(filePath, 'utf-8');
    
    // Extract template section
    // @ts-expect-error - readFileSync with encoding returns string
    const templateMatch = content.match(/<template[^>]*>([\s\S]*?)<\/template>/);
    if (templateMatch) {
      const templateContent = templateMatch[1];
      
      // Pattern 1: <router-link to="/path">
      const routerLinkRegex = /<router-link[^>]*\s+to=["']([^"']+)["'][^>]*>/g;
      let match;
      while ((match = routerLinkRegex.exec(templateContent)) !== null) {
        const path = match[1];
        if (path && path.startsWith('/')) {
          const normalized = normalizeDynamicRoute(path);
          const line = (templateContent.substring(0, match.index).match(/\n/g) || []).length + 1;
          
          if (normalized) {
            // Dynamic route
            expectations.push({
              type: 'spa_navigation',
              targetPath: normalized.examplePath,
              originalPattern: normalized.originalPattern,
              originalTarget: normalized.originalPattern,
              isDynamic: true,
              exampleExecution: true,
              parameters: normalized.parameters || [],
              matchAttribute: 'to',
              proof: 'PROVEN_EXPECTATION',
              sourceRef: `${relative(projectRoot, filePath).replace(/\\/g, '/')}:${line}`,
              selectorHint: 'router-link',
              metadata: {
                elementFile: relative(projectRoot, filePath).replace(/\\/g, '/'),
                elementLine: line,
                eventType: 'click'
              }
            });
          } else {
            // Static route
            expectations.push({
              type: 'spa_navigation',
              targetPath: path,
              matchAttribute: 'to',
              proof: 'PROVEN_EXPECTATION',
              sourceRef: `${relative(projectRoot, filePath).replace(/\\/g, '/')}:${line}`,
              selectorHint: 'router-link',
              metadata: {
                elementFile: relative(projectRoot, filePath).replace(/\\/g, '/'),
                elementLine: line,
                eventType: 'click'
              }
            });
          }
        }
      }
      
      // Pattern 2: <RouterLink :to="{ path: '/path' }">
      const routerLinkBindingRegex = /<RouterLink\s+[^>]*:to=["']\{[^}]*path:\s*["']([^"']+)["'][^}]*\}[^>]*>/g;
      while ((match = routerLinkBindingRegex.exec(templateContent)) !== null) {
        const path = match[1];
        if (path && path.startsWith('/')) {
          const normalized = normalizeDynamicRoute(path);
          const line = (templateContent.substring(0, match.index).match(/\n/g) || []).length + 1;
          
          if (normalized) {
            // Dynamic route
            expectations.push({
              type: 'spa_navigation',
              targetPath: normalized.examplePath,
              originalPattern: normalized.originalPattern,
              originalTarget: normalized.originalPattern,
              isDynamic: true,
              exampleExecution: true,
              parameters: normalized.parameters || [],
              matchAttribute: 'to',
              proof: 'PROVEN_EXPECTATION',
              sourceRef: `${relative(projectRoot, filePath).replace(/\\/g, '/')}:${line}`,
              selectorHint: 'RouterLink',
              metadata: {
                elementFile: relative(projectRoot, filePath).replace(/\\/g, '/'),
                elementLine: line,
                eventType: 'click'
              }
            });
          } else {
            // Static route
            expectations.push({
              type: 'spa_navigation',
              targetPath: path,
              matchAttribute: 'to',
              proof: 'PROVEN_EXPECTATION',
              sourceRef: `${relative(projectRoot, filePath).replace(/\\/g, '/')}:${line}`,
              selectorHint: 'RouterLink',
              metadata: {
                elementFile: relative(projectRoot, filePath).replace(/\\/g, '/'),
                elementLine: line,
                eventType: 'click'
              }
            });
          }
        }
      }
    }
    
    // Extract script section for router.push/replace
    // @ts-expect-error - readFileSync with encoding returns string
    const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/);
    if (scriptMatch) {
      const scriptContent = scriptMatch[1];
      const routerPushRegex = /router\.(push|replace)\s*\(\s*["']([^"']+)["']\s*\)/g;
      let match;
      while ((match = routerPushRegex.exec(scriptContent)) !== null) {
        const method = match[1];
        const path = match[2];
        if (path && path.startsWith('/')) {
          const normalized = normalizeDynamicRoute(path);
          const line = (scriptContent.substring(0, match.index).match(/\n/g) || []).length + 1;
          
          if (normalized) {
            // Dynamic route
            expectations.push({
              type: 'spa_navigation',
              targetPath: normalized.examplePath,
              originalPattern: normalized.originalPattern,
              originalTarget: normalized.originalPattern,
              isDynamic: true,
              exampleExecution: true,
              parameters: normalized.parameters || [],
              navigationMethod: method,
              proof: 'PROVEN_EXPECTATION',
              sourceRef: `${relative(projectRoot, filePath).replace(/\\/g, '/')}:${line}`,
              selectorHint: null,
              metadata: {
                elementFile: relative(projectRoot, filePath).replace(/\\/g, '/'),
                elementLine: line,
                handlerName: `router.${method}`,
                eventType: 'programmatic'
              }
            });
          } else {
            // Static route
            expectations.push({
              type: 'spa_navigation',
              targetPath: path,
              navigationMethod: method,
              proof: 'PROVEN_EXPECTATION',
              sourceRef: `${relative(projectRoot, filePath).replace(/\\/g, '/')}:${line}`,
              selectorHint: null,
              metadata: {
                elementFile: relative(projectRoot, filePath).replace(/\\/g, '/'),
                elementLine: line,
                handlerName: `router.${method}`,
                eventType: 'programmatic'
              }
            });
          }
        }
      }
    }
  } catch (err) {
    // Skip if file can't be parsed
  }
  
  return expectations;
}

/**
 * Find router.push/replace calls in AST.
 * 
 * @param {ts.SourceFile} ast - Source file
 * @returns {Array} - Call expression nodes
 */
function findRouterCalls(ast) {
  const _calls = [];
  
  const callExpressions = findNodes(ast, node => {
    if (!ts.isCallExpression(node)) return false;
    const expr = node.expression;
    if (!ts.isPropertyAccessExpression(expr)) return false;
    
    const obj = expr.expression;
    const prop = expr.name;
    
    if (!ts.isIdentifier(obj) || !ts.isIdentifier(prop)) return false;
    
    return obj.text === 'router' && (prop.text === 'push' || prop.text === 'replace');
  });
  
  return callExpressions;
}

/**
 * Extract expectation from router call.
 * 
 * @param {ts.CallExpression} call - Call expression
 * @param {ts.SourceFile} ast - Source file
 * @param {string} projectRoot - Project root
 * @param {string} [filePathOverride] - Optional file path override for .vue files
 * @returns {Object|null} - Expectation or null
 */
function extractFromRouterCall(call, ast, projectRoot, filePathOverride = null) {
  const expr = call.expression;
  if (!ts.isPropertyAccessExpression(expr)) return null;
  
  const prop = expr.name;
  const method = prop.text; // 'push' or 'replace'
  
  if (call.arguments.length === 0) return null;
  
  const arg = call.arguments[0];
  const location = getNodeLocation(ast, call, projectRoot);
  
  // Override file path if provided (for .vue files)
  if (filePathOverride) {
    const relativePath = relative(projectRoot, filePathOverride);
    location.file = relativePath.replace(/\\/g, '/');
    location.sourceRef = `${relativePath.replace(/\\/g, '/')}:${location.line}`;
  }
  
  // String literal: router.push('/path')
  const path = getStringLiteral(arg);
  if (path && path.startsWith('/')) {
    // Normalize dynamic routes
    const normalized = normalizeDynamicRoute(path);
    if (normalized) {
      return {
        type: 'spa_navigation',
        targetPath: normalized.examplePath,
        originalPattern: normalized.originalPattern,
        originalTarget: normalized.originalPattern,
        isDynamic: true,
        exampleExecution: true,
        parameters: normalized.parameters || [],
        navigationMethod: method,
        proof: 'PROVEN_EXPECTATION',
        sourceRef: location.sourceRef,
        selectorHint: null,
        metadata: {
          elementFile: location.file,
          elementLine: location.line,
          handlerName: `router.${method}`,
          eventType: 'programmatic'
        }
      };
    }
    // Static route
    return {
      type: 'spa_navigation',
      targetPath: path,
      navigationMethod: method,
      proof: 'PROVEN_EXPECTATION',
      sourceRef: location.sourceRef,
      selectorHint: null,
      metadata: {
        elementFile: location.file,
        elementLine: location.line,
        handlerName: `router.${method}`,
        eventType: 'programmatic'
      }
    };
  }
  
  // Template literal: router.push(`/users/${id}`)
  if (ts.isTemplateExpression(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) {
    let templateText = null;
    if (ts.isTemplateExpression(arg)) {
      // Build template string with ${} placeholders
      let text = arg.head?.text || '';
      for (const span of arg.templateSpans || []) {
        const expr = span.expression;
        if (ts.isIdentifier(expr)) {
          text += '${' + expr.text + '}';
        } else {
          // Complex expression - cannot normalize safely
          return null;
        }
        text += span.literal?.text || '';
      }
      templateText = text;
    } else if (ts.isNoSubstitutionTemplateLiteral(arg)) {
      templateText = arg.text;
    }
    
    if (templateText && templateText.startsWith('/')) {
      // Normalize template literal
      const normalized = normalizeTemplateLiteral(templateText) || normalizeDynamicRoute(templateText);
      if (normalized) {
        return {
          type: 'spa_navigation',
          targetPath: normalized.examplePath,
          originalPattern: normalized.originalPattern,
          originalTarget: normalized.originalPattern,
          isDynamic: true,
          exampleExecution: true,
          parameters: normalized.parameters || [],
          navigationMethod: method,
          proof: 'PROVEN_EXPECTATION',
          sourceRef: location.sourceRef,
          selectorHint: null,
          metadata: {
            elementFile: location.file,
            elementLine: location.line,
            handlerName: `router.${method}`,
            eventType: 'programmatic'
          }
        };
      }
    }
  }
  
  // Object literal: router.push({ path: '/path' })
  if (ts.isObjectLiteralExpression(arg)) {
    for (const prop of arg.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      const name = prop.name;
      if (!ts.isIdentifier(name)) continue;
      if (name.text !== 'path') continue;
      
      const pathValue = getStringLiteral(prop.initializer);
      if (pathValue && pathValue.startsWith('/')) {
        // Normalize dynamic routes
        const normalized = normalizeDynamicRoute(pathValue);
        if (normalized) {
          return {
            type: 'spa_navigation',
            targetPath: normalized.examplePath,
            originalPattern: normalized.originalPattern,
            originalTarget: normalized.originalPattern,
            isDynamic: true,
            exampleExecution: true,
            parameters: normalized.parameters || [],
            navigationMethod: method,
            proof: 'PROVEN_EXPECTATION',
            sourceRef: location.sourceRef,
            selectorHint: null,
            metadata: {
              elementFile: location.file,
              elementLine: location.line,
              handlerName: `router.${method}`,
              eventType: 'programmatic'
            }
          };
        }
        // Static route
        return {
          type: 'spa_navigation',
          targetPath: pathValue,
          navigationMethod: method,
          proof: 'PROVEN_EXPECTATION',
          sourceRef: location.sourceRef,
          selectorHint: null,
          metadata: {
            elementFile: location.file,
            elementLine: location.line,
            handlerName: `router.${method}`,
            eventType: 'programmatic'
          }
        };
      }
    }
  }
  
  return null;
}

/**
 * Find RouterLink JSX elements.
 * 
 * @param {ts.SourceFile} ast - Source file
 * @returns {Array} - JSX element nodes
 */
function findRouterLinkElements(ast) {
  const _elements = [];
  
  const jsxElements = findNodes(ast, node => {
    if (!ts.isJsxOpeningElement(node) && !ts.isJsxSelfClosingElement(node)) return false;
    
    const tagName = node.tagName;
    if (!ts.isIdentifier(tagName)) return false;
    
    return tagName.text === 'RouterLink' || tagName.text === 'router-link';
  });
  
  return jsxElements;
}

/**
 * Extract expectation from RouterLink element.
 * 
 * @param {ts.Node} element - JSX element
 * @param {ts.SourceFile} ast - Source file
 * @param {string} projectRoot - Project root
 * @returns {Object|null} - Expectation or null
 */
function extractFromRouterLink(element, ast, projectRoot) {
  const attributes = element.attributes;
  if (!attributes || !attributes.properties) return null;
  
  let targetPath = null;
  
  for (const attr of attributes.properties) {
    if (!ts.isJsxAttribute(attr)) continue;
    
    const name = attr.name;
    if (!ts.isIdentifier(name)) continue;
    
    if (name.text === 'to') {
      const initializer = attr.initializer;
      
      // String literal: to="/path"
      if (ts.isStringLiteral(initializer)) {
        targetPath = initializer.text;
      }
      // JSX expression: to={"/path"} or to={{ path: "/path" }}
      else if (ts.isJsxExpression(initializer)) {
        const expr = initializer.expression;
        
        // String literal in expression
        if (ts.isStringLiteral(expr)) {
          targetPath = expr.text;
        }
        // Object literal: to={{ path: "/path" }}
        else if (ts.isObjectLiteralExpression(expr)) {
          for (const prop of expr.properties) {
            if (!ts.isPropertyAssignment(prop)) continue;
            const propName = prop.name;
            if (!ts.isIdentifier(propName)) continue;
            if (propName.text !== 'path') continue;
            
            const pathValue = getStringLiteral(prop.initializer);
            if (pathValue) {
              targetPath = pathValue;
            }
          }
        }
      }
    }
  }
  
  if (targetPath && targetPath.startsWith('/')) {
    const location = getNodeLocation(ast, element, projectRoot);
    const normalized = normalizeDynamicRoute(targetPath);
    
    if (normalized) {
      // Dynamic route
      return {
        type: 'spa_navigation',
        targetPath: normalized.examplePath,
        originalPattern: normalized.originalPattern,
        originalTarget: normalized.originalPattern,
        isDynamic: true,
        exampleExecution: true,
        parameters: normalized.parameters || [],
        matchAttribute: 'to',
        proof: 'PROVEN_EXPECTATION',
        sourceRef: location.sourceRef,
        selectorHint: 'RouterLink',
        metadata: {
          elementFile: location.file,
          elementLine: location.line,
          eventType: 'click'
        }
      };
    }
    
    // Static route
    return {
      type: 'spa_navigation',
      targetPath: targetPath,
      matchAttribute: 'to',
      proof: 'PROVEN_EXPECTATION',
      sourceRef: location.sourceRef,
      selectorHint: 'RouterLink',
      metadata: {
        elementFile: location.file,
        elementLine: location.line,
        eventType: 'click'
      }
    };
  }
  
  return null;
}
