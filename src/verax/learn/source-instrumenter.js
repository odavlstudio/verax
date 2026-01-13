/**
 * Wave 5 — Source Instrumentation
 * 
 * Babel transform to inject data-verax-source attributes into JSX elements
 * with onClick/onSubmit handlers for runtime attribution.
 * 
 * This allows matching runtime interactions to source code locations.
 */

import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';
import { relative, sep, resolve as pathResolve, dirname as pathDirname, join as pathJoin } from 'path';
import { existsSync } from 'fs';

/**
 * Instrument JSX code with data-verax-source attributes.
 * 
 * @param {string} code - Source code to instrument
 * @param {string} filePath - Absolute path to source file
 * @param {string} workspaceRoot - Workspace root for relative paths
 * @returns {string} - Instrumented code
 */
export function instrumentJSX(code, filePath, workspaceRoot) {
  try {
    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    const importMap = buildImportMap(ast, filePath, workspaceRoot);

    traverse.default(ast, {
      JSXOpeningElement(path) {
        const attributes = path.node.attributes;
         const elementName = path.node.name;
        
        // Check if this element has onClick or onSubmit
        const hasHandler = attributes.some((attr) => {
          return (
            attr.type === 'JSXAttribute' &&
            attr.name &&
            attr.name.name &&
            (attr.name.name === 'onClick' || attr.name.name === 'onSubmit')
          );
        });

         // Also check if it's a Link element with navigation props
         const isLinkWithNav = 
           elementName.type === 'JSXIdentifier' &&
           elementName.name === 'Link' &&
           attributes.some((attr) => {
             return (
               attr.type === 'JSXAttribute' &&
               attr.name &&
               attr.name.name &&
               (attr.name.name === 'href' || attr.name.name === 'to')
             );
           });

         if (!hasHandler && !isLinkWithNav) return;

        // Check if already instrumented
        const alreadyInstrumented = attributes.some((attr) => {
          return (
            attr.type === 'JSXAttribute' &&
            attr.name &&
            attr.name.name === 'data-verax-source'
          );
        });

        // Add sourceRef if missing
        if (!alreadyInstrumented) {
          const loc = path.node.loc;
          const sourceRef = formatSourceRef(filePath, workspaceRoot, loc);
          const sourceAttr = t.jsxAttribute(
            t.jsxIdentifier('data-verax-source'),
            t.stringLiteral(sourceRef)
          );
          path.node.attributes.push(sourceAttr);
        }

        // Add handlerRef for identifier handlers
        const handlerAttr = attributes.find((attr) => (
          attr.type === 'JSXAttribute' &&
          attr.name?.name &&
          (attr.name.name === 'onClick' || attr.name.name === 'onSubmit')
        ));
        if (handlerAttr && handlerAttr.value && handlerAttr.value.type === 'JSXExpressionContainer') {
          const expr = handlerAttr.value.expression;
          if (expr && expr.type === 'Identifier') {
            const handlerRef = deriveHandlerRef(expr.name, importMap, filePath, workspaceRoot);
            if (handlerRef) {
              const hasHandlerRef = attributes.some((attr) => attr.type === 'JSXAttribute' && attr.name?.name === 'data-verax-handler');
              if (!hasHandlerRef) {
                const handlerAttrNode = t.jsxAttribute(
                  t.jsxIdentifier('data-verax-handler'),
                  t.stringLiteral(handlerRef)
                );
                path.node.attributes.push(handlerAttrNode);
              }
            }
          }
        }
      },
    });

    const output = generate.default(ast, {
      retainLines: true,
      compact: false,
    });

    return output.code;
  } catch (err) {
    console.warn(`Failed to instrument ${filePath}: ${err.message}`);
    return code; // Return original code on error
  }
}

/**
 * Format source reference as "file:line:col"
 * Normalizes Windows paths to use forward slashes.
 * 
 * @param {string} filePath - Absolute file path
 * @param {string} workspaceRoot - Workspace root
 * @param {Object} loc - Location object from AST
 * @returns {string} - Formatted source reference
 */
function formatSourceRef(filePath, workspaceRoot, loc) {
  let relPath = relative(workspaceRoot, filePath);
  
  // Normalize to forward slashes
  relPath = relPath.split(sep).join('/');
  
  const line = loc.start.line;
  const col = loc.start.column;
  
  return `${relPath}:${line}:${col}`;
}

/**
 * Instrument a file and write to output path.
 * 
 * @param {string} inputPath - Input file path
 * @param {string} outputPath - Output file path
 * @param {string} workspaceRoot - Workspace root
 */
export async function instrumentFile(inputPath, outputPath, workspaceRoot) {
  const { readFileSync, writeFileSync } = await import('fs');
  const { dirname } = await import('path');
  const { mkdirSync } = await import('fs');
  
  const code = readFileSync(inputPath, 'utf-8');
  const instrumented = instrumentJSX(code, inputPath, workspaceRoot);
  
  // Ensure output directory exists
  mkdirSync(dirname(outputPath), { recursive: true });
  
  writeFileSync(outputPath, instrumented, 'utf-8');
}

// === Handler Reference Helpers ===

const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

function buildImportMap(ast, filePath, workspaceRoot) {
  const map = new Map(); // localName -> { modulePath, exportName }
  const fileDir = pathDirname(filePath);

  traverse.default(ast, {
    ImportDeclaration(path) {
      const source = path.node.source.value;
      const resolved = resolveModulePath(source, fileDir, workspaceRoot);
      if (!resolved) return;

      const specifiers = path.node.specifiers || [];
      for (const spec of specifiers) {
        if (spec.type === 'ImportDefaultSpecifier') {
          map.set(spec.local.name, { modulePath: resolved, exportName: 'default' });
        } else if (spec.type === 'ImportSpecifier') {
          const imported = spec.imported.name;
          map.set(spec.local.name, { modulePath: resolved, exportName: imported });
        }
      }
    }
  });

  return map;
}

function resolveModulePath(specifier, fromDir, workspaceRoot) {
  if (specifier.startsWith('.') || specifier.startsWith('/')) {
    const base = specifier.startsWith('.') ? pathResolve(fromDir, specifier) : pathResolve(workspaceRoot, specifier);
    const candidates = [base, ...EXTENSIONS.map(ext => base + ext), ...EXTENSIONS.map(ext => pathJoin(base, 'index' + ext))];
    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        return relative(workspaceRoot, candidate).split(sep).join('/');
      }
    }
    return null;
  }
  // External module - not resolved
  return null;
}

function deriveHandlerRef(name, importMap, filePath, workspaceRoot) {
  const entry = importMap.get(name);
  if (entry) {
    return `${entry.modulePath}#${entry.exportName}`;
  }
  const localPath = relative(workspaceRoot, filePath).split(sep).join('/');
  return `${localPath}#${name}`;
}
