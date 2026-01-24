/**
 * CODE INTELLIGENCE v1 — Vue Router Route Extraction (AST-based)
 * 
 * Extracts routes from Vue Router configuration using AST analysis.
 * Includes dynamic routes with example paths.
 * 
 * Supported patterns:
 * - createRouter({ routes: [...] })
 * - const routes = [...]
 * - export const routes = [...]
 * - export default { routes: [...] }
 * - Dynamic routes: /users/:id → /users/1
 */

import ts from 'typescript';
import { resolve } from 'path';
import { existsSync, readFileSync } from 'fs';
import { parseFile, findNodes, getStringLiteral, getNodeLocation } from '../../intel/ts-program.js';
import { normalizeDynamicRoute } from '../../shared/dynamic-route-normalizer.js';

const INTERNAL_PATH_PATTERNS = [
  /^\/admin/,
  /^\/dashboard/,
  /^\/account/,
  /^\/settings/,
  /\/internal/,
  /\/private/
];

function isInternalRoute(path) {
  return INTERNAL_PATH_PATTERNS.some(pattern => pattern.test(path));
}

/**
 * Extract routes from Vue Router configuration.
 * 
 * @param {string} projectRoot - Project root
 * @param {Object} program - TypeScript program
 * @returns {Array} - Array of route objects with sourceRef
 */
export function extractVueRoutes(projectRoot, program) {
  const routes = [];
  
  if (!program || !program.program) return routes;
  
  // Look for router files in common locations
  const routerFilePatterns = [
    'src/router/index.ts',
    'src/router/index.js',
    'src/router.ts',
    'src/router.js',
    'router/index.ts',
    'router/index.js',
    'router.ts',
    'router.js'
  ];
  
  let routerFiles = [];
  
  // First, try to find router files by pattern
  for (const pattern of routerFilePatterns) {
    const filePath = resolve(projectRoot, pattern);
    if (existsSync(filePath)) {
      routerFiles.push(filePath);
    }
  }
  
  // If no router files found by pattern, search in source files
  if (routerFiles.length === 0 && program.sourceFiles) {
    for (const sourceFile of program.sourceFiles) {
      // sourceFiles is an array of file paths (strings) from createTSProgram
      const filePath = typeof sourceFile === 'string' ? sourceFile : sourceFile.fileName;
      try {
        const content = readFileSync(filePath, 'utf-8');
        if (content.includes('createRouter') || 
            content.includes('routes:') || 
            content.includes('const routes') ||
            content.includes('export const routes')) {
          routerFiles.push(filePath);
        }
      } catch (err) {
        // Skip if file can't be read
      }
    }
  }
  
  // Extract routes from each router file
  for (const filePath of routerFiles) {
    const ast = parseFile(filePath, true);
    if (!ast) continue;
    
    const fileRoutes = extractRoutesFromAST(ast, projectRoot);
    routes.push(...fileRoutes);
  }
  
  // Deduplicate by path
  const seen = new Set();
  const uniqueRoutes = [];
  for (const route of routes) {
    const key = route.path;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueRoutes.push(route);
    }
  }
  
  return uniqueRoutes;
}

/**
 * Extract routes from AST.
 * 
 * @param {ts.SourceFile} ast - Parsed source file
 * @param {string} projectRoot - Project root
 * @returns {Array} - Route objects
 */
function extractRoutesFromAST(ast, projectRoot) {
  const routes = [];
  
  // Find route array definitions
  const routeArrays = findRouteArrays(ast);
  
  for (const routeArray of routeArrays) {
    const extracted = extractRoutesFromArray(routeArray, ast, projectRoot, '');
    routes.push(...extracted);
  }
  
  return routes;
}

/**
 * Find route array definitions in AST.
 * 
 * @param {ts.SourceFile} ast - Source file
 * @returns {Array} - Array literal nodes
 */
function findRouteArrays(ast) {
  const arrays = [];
  
  // Pattern 1: createRouter({ routes: [...] })
  const createRouterCalls = findNodes(ast, node => {
    if (!ts.isCallExpression(node)) return false;
    const expr = node.expression;
    if (!ts.isIdentifier(expr)) return false;
    return expr.text === 'createRouter';
  });
  
  for (const call of createRouterCalls) {
    if (call.arguments.length === 0) continue;
    const arg = call.arguments[0];
    if (!ts.isObjectLiteralExpression(arg)) continue;
    
    for (const prop of arg.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      const name = prop.name;
      if (!ts.isIdentifier(name)) continue;
      if (name.text !== 'routes') continue;
      
      const init = prop.initializer;
      if (ts.isArrayLiteralExpression(init)) {
        arrays.push(init);
      }
    }
  }
  
  // Pattern 2: const routes = [...] or export const routes = [...]
  const routeVariables = findNodes(ast, node => {
    if (!ts.isVariableDeclaration(node)) return false;
    if (!ts.isIdentifier(node.name)) return false;
    return node.name.text === 'routes';
  });
  
  for (const decl of routeVariables) {
    if (decl.initializer && ts.isArrayLiteralExpression(decl.initializer)) {
      arrays.push(decl.initializer);
    }
  }
  
  // Pattern 3: export default { routes: [...] }
  const defaultExports = findNodes(ast, node => {
    if (!ts.isExportAssignment(node)) return false;
    return node.isExportEquals === false;
  });
  
  for (const exportNode of defaultExports) {
    const expr = exportNode.expression;
    if (!ts.isObjectLiteralExpression(expr)) continue;
    
    for (const prop of expr.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      const name = prop.name;
      if (!ts.isIdentifier(name)) continue;
      if (name.text !== 'routes') continue;
      
      const init = prop.initializer;
      if (ts.isArrayLiteralExpression(init)) {
        arrays.push(init);
      }
    }
  }
  
  return arrays;
}

/**
 * Extract routes from array literal.
 * 
 * @param {ts.ArrayLiteralExpression} arrayNode - Array literal node
 * @param {ts.SourceFile} ast - Source file
 * @param {string} projectRoot - Project root
 * @param {string} parentPath - Parent route path for nested routes
 * @returns {Array} - Route objects
 */
function extractRoutesFromArray(arrayNode, ast, projectRoot, parentPath) {
  const routes = [];
  
  for (const element of arrayNode.elements) {
    if (!ts.isObjectLiteralExpression(element)) continue;
    
    const routeObj = extractRouteFromObject(element, ast, projectRoot, parentPath);
    if (routeObj) {
      routes.push(routeObj);
      
      // Handle nested children
      if (routeObj.children) {
        for (const child of routeObj.children) {
          routes.push(child);
        }
        delete routeObj.children;
      }
    }
  }
  
  return routes;
}

/**
 * Extract route from object literal.
 * 
 * @param {ts.ObjectLiteralExpression} objNode - Object literal node
 * @param {ts.SourceFile} ast - Source file
 * @param {string} projectRoot - Project root
 * @param {string} parentPath - Parent route path
 * @returns {Object|null} - Route object or null
 */
function extractRouteFromObject(objNode, ast, projectRoot, parentPath) {
  let path = null;
  let children = null;
  
  for (const prop of objNode.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const name = prop.name;
    if (!ts.isIdentifier(name)) continue;
    
    if (name.text === 'path') {
      const pathValue = getStringLiteral(prop.initializer);
      if (pathValue) {
        path = pathValue;
      }
    } else if (name.text === 'children') {
      const init = prop.initializer;
      if (ts.isArrayLiteralExpression(init)) {
        children = init;
      }
    }
  }
  
  // Skip if path is wildcard
  if (!path || path.includes('*')) {
    return null;
  }
  
  // Build full path
  let fullPath = path;
  if (parentPath) {
    if (path.startsWith('/')) {
      fullPath = path;
    } else {
      // Relative path: join parent + child
      const parentNormalized = parentPath.endsWith('/') ? parentPath.slice(0, -1) : parentPath;
      fullPath = `${parentNormalized}/${path}`.replace(/\/+/g, '/');
    }
  }
  
  // Normalize dynamic routes to example paths
  const normalized = normalizeDynamicRoute(fullPath);
  const location = getNodeLocation(ast, objNode, projectRoot);
  
  let route;
  if (normalized) {
    // Dynamic route - use example path
    route = {
      path: normalized.examplePath,
      originalPattern: normalized.originalPattern,
      isDynamic: true,
      exampleExecution: true,
      sourceRef: location.sourceRef,
      file: location.file,
      line: location.line,
      framework: 'vue-router',
      public: !isInternalRoute(normalized.examplePath),
      children: null // Will be set below if children exist
    };
  } else {
    // Static route
    route = {
      path: fullPath,
      sourceRef: location.sourceRef,
      file: location.file,
      line: location.line,
      framework: 'vue-router',
      public: !isInternalRoute(fullPath),
      children: null // Will be set below if children exist
    };
  }
  
  // Extract nested children
  if (children) {
    const parentPathForChildren = normalized ? normalized.examplePath : fullPath;
    const childRoutes = extractRoutesFromArray(children, ast, projectRoot, parentPathForChildren);
    route.children = childRoutes;
  }
  
  return route;
}



