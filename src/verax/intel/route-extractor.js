/**
 * CODE INTELLIGENCE v1 — Route Extraction (AST-based)
 * 
 * Extracts routes from Next.js and React Router using AST analysis.
 * Includes dynamic routes with example paths.
 * 
 * Supported:
 * - Next.js pages router (file-system)
 * - Next.js app router (file-system)
 * - React Router <Route path="...">
 * - Dynamic routes: /users/[id] → /users/1
 */

import ts from 'typescript';
import { resolve, relative, basename, extname } from 'path';
import { existsSync, readdirSync, statSync } from 'fs';
import { parseFile, findNodes, getNodeLocation } from './ts-program.js';
import { extractVueRoutes } from '../vue-extractors/vue/vue-router-extractor.js';
import { normalizeDynamicRoute } from '../shared/dynamic-route-normalizer.js';

const INTERNAL_PATH_PATTERNS = [
  /^\/admin/,
  /^\/dashboard/,
  /^\/account/,
  /^\/settings/,
  /\/internal/,
  /\/private/
];

function _isInternalRoute(path) {
  return INTERNAL_PATH_PATTERNS.some(pattern => pattern.test(path));
}

/**
 * Extract routes from project.
 * 
 * @param {string} projectRoot - Project root
 * @param {Object} program - TypeScript program from createTSProgram
 * @returns {Array} - Array of route objects
 */
export function extractRoutes(projectRoot, program) {
  const routes = [];
  
  // Detect Next.js
  const hasNextConfig = existsSync(resolve(projectRoot, 'next.config.js')) ||
                        existsSync(resolve(projectRoot, 'next.config.mjs'));
  const hasPagesDir = existsSync(resolve(projectRoot, 'pages'));
  const hasAppDir = existsSync(resolve(projectRoot, 'app'));
  
  if (hasNextConfig || hasPagesDir || hasAppDir) {
    // Next.js detected
    if (hasPagesDir) {
      routes.push(...extractNextPagesRoutes(projectRoot));
    }
    if (hasAppDir) {
      routes.push(...extractNextAppRoutes(projectRoot));
    }
  }
  
  // React Router detection
  if (program && program.program) {
    routes.push(...extractReactRouterRoutes(projectRoot, program));
  }
  
  // Vue Router detection
  if (program && program.program) {
    routes.push(...extractVueRoutes(projectRoot, program));
  }
  
  return routes;
}

/**
 * Extract Next.js pages router routes (file-system based).
 * 
 * @param {string} projectRoot - Project root
 * @returns {Array} - Routes with sourceRef
 */
function extractNextPagesRoutes(projectRoot) {
  const routes = [];
  const pagesDir = resolve(projectRoot, 'pages');
  
  if (!existsSync(pagesDir)) return routes;
  
  function walk(dir, urlPath = '') {
    const entries = readdirSync(dir).sort((a, b) => a.localeCompare(b, 'en'));
    
    for (const entry of entries) {
      const fullPath = resolve(dir, entry);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Nested route
        walk(fullPath, `${urlPath}/${entry}`);
      } else if (stat.isFile()) {
        const ext = extname(entry);
        if (!['.js', '.jsx', '.ts', '.tsx'].includes(ext)) continue;
        
        const baseName = basename(entry, ext);
        
        // Skip special files
        if (baseName.startsWith('_')) continue;
        if (baseName === 'index') {
          // index.tsx -> /path or /
          const route = urlPath || '/';
          const relativePath = relative(projectRoot, fullPath);
          routes.push({
            path: route,
            sourceRef: `${relativePath.replace(/\\/g, '/')}:1`,
            file: relativePath.replace(/\\/g, '/'),
            framework: 'next-pages'
          });
        } else {
          // file.tsx -> /path/file
          const route = `${urlPath}/${baseName}`;
          const relativePath = relative(projectRoot, fullPath);
          const routeObj = {
            path: route,
            sourceRef: `${relativePath.replace(/\\/g, '/')}:1`,
            file: relativePath.replace(/\\/g, '/'),
            framework: 'next-pages'
          };
          
          // Normalize dynamic routes to example paths
          const normalized = normalizeDynamicRoute(route);
          if (normalized) {
            routeObj.path = normalized.examplePath;
            routeObj.originalPattern = normalized.originalPattern;
            routeObj.isDynamic = true;
            routeObj.exampleExecution = true;
          }
          
          routes.push(routeObj);
        }
      }
    }
  }
  
  walk(pagesDir);
  return routes;
}

/**
 * Extract Next.js app router routes (file-system based).
 * 
 * @param {string} projectRoot - Project root
 * @returns {Array} - Routes with sourceRef
 */
function extractNextAppRoutes(projectRoot) {
  const routes = [];
  const appDir = resolve(projectRoot, 'app');
  
  if (!existsSync(appDir)) return routes;
  
  function walk(dir, urlPath = '') {
    const entries = readdirSync(dir).sort((a, b) => a.localeCompare(b, 'en'));
    
    for (const entry of entries) {
      const fullPath = resolve(dir, entry);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Nested route segment
        walk(fullPath, `${urlPath}/${entry}`);
      } else if (stat.isFile()) {
        const ext = extname(entry);
        const baseName = basename(entry, ext);
        
        // App router: page.tsx defines the route
        if (baseName === 'page' && ['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
          const route = urlPath || '/';
          const relativePath = relative(projectRoot, fullPath);
          const routeObj = {
            path: route,
            sourceRef: `${relativePath.replace(/\\/g, '/')}:1`,
            file: relativePath.replace(/\\/g, '/'),
            framework: 'next-app'
          };
          
          // Normalize dynamic routes to example paths
          const normalized = normalizeDynamicRoute(route);
          if (normalized) {
            routeObj.path = normalized.examplePath;
            routeObj.originalPattern = normalized.originalPattern;
            routeObj.isDynamic = true;
            routeObj.exampleExecution = true;
          }
          
          routes.push(routeObj);
        }
      }
    }
  }
  
  walk(appDir);
  return routes;
}

/**
 * Extract React Router routes from JSX.
 * 
 * @param {string} projectRoot - Project root
 * @param {Object} program - TypeScript program
 * @returns {Array} - Routes with sourceRef
 */
function extractReactRouterRoutes(projectRoot, program) {
  const routes = [];
  
  for (const sourceFile of program.sourceFiles) {
    const ast = parseFile(sourceFile, true);
    if (!ast) continue;
    
    // Find <Route path="..."> elements
    const routeElements = findNodes(ast, node => {
      return ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node);
    });
    
    for (const element of routeElements) {
      const tagName = element.tagName;
      if (!ts.isIdentifier(tagName)) continue;
      if (tagName.text !== 'Route') continue;
      
      // Find path attribute
      const attributes = element.attributes;
      if (!attributes || !attributes.properties) continue;
      
      for (const attr of attributes.properties) {
        if (!ts.isJsxAttribute(attr)) continue;
        
        const name = attr.name;
        if (!ts.isIdentifier(name)) continue;
        if (name.text !== 'path') continue;
        
        const initializer = attr.initializer;
        if (!initializer) continue;
        
        let pathValue = null;
        
        // StringLiteral: path="..."
        if (ts.isStringLiteral(initializer)) {
          pathValue = initializer.text;
        }
        // JsxExpression: path={"..."}
        else if (ts.isJsxExpression(initializer)) {
          const expr = initializer.expression;
          if (expr && (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr))) {
            pathValue = expr.text;
          }
        }
        
        if (pathValue) {
          const location = getNodeLocation(ast, element, projectRoot);
          
          // Normalize dynamic routes to example paths
          const normalized = normalizeDynamicRoute(pathValue);
          const routeObj = normalized ? {
            path: normalized.examplePath,
            originalPattern: normalized.originalPattern,
            isDynamic: true,
            exampleExecution: true,
            sourceRef: location.sourceRef,
            file: location.file,
            line: location.line,
            framework: 'react-router'
          } : {
            path: pathValue,
            sourceRef: location.sourceRef,
            file: location.file,
            line: location.line,
            framework: 'react-router'
          };
          
          routes.push(routeObj);
        }
      }
    }
  }
  
  return routes;
}



