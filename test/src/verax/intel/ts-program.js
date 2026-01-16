/**
 * CODE INTELLIGENCE v1 — TypeScript Program Foundation
 * 
 * Provides AST-based code understanding:
 * - Creates TypeScript Program over project sources
 * - Walks AST nodes
 * - Resolves symbols
 * - Tracks source locations (file:line)
 * 
 * NO REGEX. NO GUESSING. AST ONLY.
 */

import ts from 'typescript';
import { resolve, relative, extname } from 'path';
import { readdirSync, statSync, readFileSync, existsSync } from 'fs';

/**
 * Create a TypeScript Program for AST analysis.
 * 
 * @param {string} projectRoot - Project root directory
 * @param {Object} options - Options { includeJs: boolean }
 * @returns {Object} - { program, typeChecker, sourceFiles }
 */
export function createTSProgram(projectRoot, options = {}) {
  const { includeJs = true } = options;
  
  // Collect source files
  const sourceFiles = collectSourceFiles(projectRoot, includeJs);
  
  if (sourceFiles.length === 0) {
    return {
      program: null,
      typeChecker: null,
      sourceFiles: [],
      error: 'No source files found'
    };
  }
  
  // Create compiler options
  const compilerOptions = {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    jsx: ts.JsxEmit.React,
    allowJs: includeJs,
    checkJs: false,
    noEmit: true,
    skipLibCheck: true,
    skipDefaultLibCheck: true,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    esModuleInterop: true,
    resolveJsonModule: true
  };
  
  // Create program
  const program = ts.createProgram(sourceFiles, compilerOptions);
  const typeChecker = program.getTypeChecker();
  
  return {
    program,
    typeChecker,
    sourceFiles,
    error: null
  };
}

/**
 * Collect source files (.ts, .tsx, .js, .jsx).
 * 
 * @param {string} projectRoot - Project root
 * @param {boolean} includeJs - Include .js/.jsx files
 * @returns {string[]} - Array of absolute file paths
 */
function collectSourceFiles(projectRoot, includeJs) {
  const files = [];
  const extensions = includeJs 
    ? ['.ts', '.tsx', '.js', '.jsx']
    : ['.ts', '.tsx'];
  
  const ignoreDirs = ['node_modules', '.verax', 'dist', 'build', '.next', 'out', '.git'];
  
  function walk(dir) {
    try {
      const entries = readdirSync(dir);
      
      for (const entry of entries) {
        const fullPath = resolve(dir, entry);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Skip ignored directories
          if (ignoreDirs.includes(entry)) continue;
          walk(fullPath);
        } else if (stat.isFile()) {
          const ext = extname(entry);
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (err) {
      // Skip directories we can't read
    }
  }
  
  walk(projectRoot);
  return files;
}

/**
 * Get source location for AST node.
 * 
 * @param {ts.SourceFile} sourceFile - TypeScript source file
 * @param {ts.Node} node - AST node
 * @param {string} projectRoot - Project root for relative path
 * @returns {Object} - { file, line, column, sourceRef }
 */
export function getNodeLocation(sourceFile, node, projectRoot) {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
  const relativePath = relative(projectRoot, sourceFile.fileName);
  
  return {
    file: relativePath.replace(/\\/g, '/'),
    line: line + 1, // 1-indexed
    column: character + 1,
    sourceRef: `${relativePath.replace(/\\/g, '/')}:${line + 1}`
  };
}

/**
 * Walk AST and invoke callback for each node.
 * 
 * @param {ts.Node} node - Root node
 * @param {Function} callback - Callback(node) => void
 */
export function walkAST(node, callback) {
  callback(node);
  ts.forEachChild(node, child => walkAST(child, callback));
}

/**
 * Find nodes matching a predicate.
 * 
 * @param {ts.Node} root - Root node
 * @param {Function} predicate - Predicate(node) => boolean
 * @returns {ts.Node[]} - Matching nodes
 */
export function findNodes(root, predicate) {
  const results = [];
  
  walkAST(root, node => {
    if (predicate(node)) {
      results.push(node);
    }
  });
  
  return results;
}

/**
 * Get string literal value from node.
 * 
 * @param {ts.Node} node - AST node
 * @returns {string|null} - String value or null
 */
export function getStringLiteral(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  return null;
}

/**
 * Resolve identifier to its declaration.
 * 
 * @param {ts.TypeChecker} typeChecker - Type checker
 * @param {ts.Identifier} identifier - Identifier node
 * @returns {ts.Declaration|null} - Declaration node or null
 */
export function resolveIdentifier(typeChecker, identifier) {
  try {
    const symbol = typeChecker.getSymbolAtLocation(identifier);
    if (!symbol || !symbol.declarations || symbol.declarations.length === 0) {
      return null;
    }
    return symbol.declarations[0];
  } catch (err) {
    return null;
  }
}

/**
 * Check if node is a function declaration or arrow function.
 * 
 * @param {ts.Node} node - AST node
 * @returns {boolean}
 */
export function isFunctionNode(node) {
  return ts.isFunctionDeclaration(node) ||
         ts.isFunctionExpression(node) ||
         ts.isArrowFunction(node) ||
         ts.isMethodDeclaration(node);
}

/**
 * Get function body statements.
 * 
 * @param {ts.Node} funcNode - Function node
 * @returns {ts.Statement[]|null} - Statements or null
 */
export function getFunctionBody(funcNode) {
  if (!isFunctionNode(funcNode)) return null;
  
  const body = funcNode.body;
  if (!body) return null;
  
  // Arrow function with expression body
  if (ts.isExpression(body)) {
    return []; // No statements, just expression
  }
  
  // Block body
  if (ts.isBlock(body)) {
    return Array.from(body.statements);
  }
  
  return null;
}

/**
 * Parse a single file into AST.
 * 
 * @param {string} filePath - File path
 * @param {boolean} isJsx - Is JSX/TSX
 * @returns {ts.SourceFile|null} - Parsed source file
 */
export function parseFile(filePath, isJsx = false) {
  if (!existsSync(filePath)) return null;
  
  try {
    const content = readFileSync(filePath, 'utf-8');
    const ext = extname(filePath);
    const scriptKind = isJsx || ext === '.tsx' || ext === '.jsx'
      ? ts.ScriptKind.TSX
      : ts.ScriptKind.TS;
    
    return ts.createSourceFile(
      filePath,
  // @ts-expect-error - readFileSync with encoding returns string
      content,
      ts.ScriptTarget.ES2020,
      true,
      scriptKind
    );
  } catch (err) {
    return null;
  }
}
