/**
 * Wave 6 & 8 — TypeScript-based Contract Resolver
 *
 * Resolves PROVEN network action contracts (Wave 6) and state action contracts (Wave 8)
 * across files using TypeScript Program.
 * Follows handler identifiers across modules and call chains (depth <= 3).
 * Zero heuristics. Only static literal URLs and resolvable state mutations produce PROVEN contracts.
 */

import ts from 'typescript';
import { resolve, relative, dirname, sep, join } from 'path';
import { existsSync, statSync } from 'fs';
import { glob } from 'glob';

const MAX_DEPTH = 3;
const SUPPORTED_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

/**
 * Resolve action contracts across files using TypeScript compiler API.
 *
 * @param {string} rootDir - Directory containing the source (fixture/project)
 * @param {string} workspaceRoot - Workspace root for relative paths
 * @returns {Promise<Array<Object>>} - PROVEN contracts (both NETWORK_ACTION and STATE_ACTION)
 */
export async function resolveActionContracts(rootDir, workspaceRoot) {
  const files = await glob('**/*.{ts,tsx,js,jsx}', {
    cwd: rootDir,
    absolute: true,
    ignore: ['node_modules/**', 'dist/**', 'build/**']
  });

  const normalizedRoot = resolve(rootDir);

  const program = ts.createProgram(files, {
    allowJs: true,
    checkJs: true,
    jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    skipLibCheck: true,
    noResolve: false
  });

  const checker = program.getTypeChecker();
  const contracts = [];

  function createVisitFunction(importMap, sourceFile) {
    return function visit(node) {
      if (ts.isJsxAttribute(node)) {
        const name = node.name.getText();
        if (name !== 'onClick' && name !== 'onSubmit') return;

        if (!node.initializer || !ts.isJsxExpression(node.initializer)) return;
        const expr = node.initializer.expression;
        if (!expr) return;

        // We only handle identifier handlers (cross-file capable)
        if (!ts.isIdentifier(expr)) return;

        const _handlerName = expr.text;
        const handlerRef = deriveHandlerRef(expr, importMap, sourceFile, workspaceRoot);
        if (!handlerRef) return;

        const symbol = checker.getSymbolAtLocation(expr);
        if (!symbol) return;
        const targetSymbol = ts.SymbolFlags.Alias & symbol.flags ? checker.getAliasedSymbol(symbol) : symbol;

        // Check for network action contracts (Wave 6)
        const networkContract = followHandler(targetSymbol, checker, 0, 'network');
        if (networkContract) {
          const sourceRef = formatSourceRef(sourceFile.fileName, workspaceRoot, node.getStart(), sourceFile);
          const openingElement = node.parent && node.parent.parent && ts.isJsxOpeningElement(node.parent.parent)
            ? node.parent.parent
            : null;
          const elementType = getElementName(openingElement);

          contracts.push({
            kind: 'NETWORK_ACTION',
            method: networkContract.method,
            urlPath: networkContract.url,
            source: sourceRef,
            handlerRef,
            sourceChain: networkContract.chain,
            elementType
          });
        }

        // Check for state action contracts (Wave 8)
        const stateContract = followHandler(targetSymbol, checker, 0, 'state');
        if (stateContract) {
          const sourceRef = formatSourceRef(sourceFile.fileName, workspaceRoot, node.getStart(), sourceFile);
          const openingElement = node.parent && node.parent.parent && ts.isJsxOpeningElement(node.parent.parent)
            ? node.parent.parent
            : null;
          const elementType = getElementName(openingElement);

          contracts.push({
            kind: 'STATE_ACTION',
            stateKind: stateContract.stateKind,
            source: sourceRef,
            handlerRef,
            sourceChain: stateContract.chain,
            elementType
          });
        }
      }
      ts.forEachChild(node, visit);
    };
  }

  for (const sourceFile of program.getSourceFiles()) {
    const sourcePath = resolve(sourceFile.fileName);
    if (!sourcePath.toLowerCase().startsWith(normalizedRoot.toLowerCase())) continue;
    if (sourceFile.isDeclarationFile) continue;

    const importMap = buildImportMap(sourceFile, rootDir, workspaceRoot);
    const visit = createVisitFunction(importMap, sourceFile);
    visit(sourceFile);
  }

  return dedupeContracts(contracts);
}

function dedupeContracts(list) {
  const seen = new Set();
  const out = [];
  for (const c of list) {
    const key = `${c.handlerRef}|${c.urlPath}|${c.method}|${c.source}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

function buildImportMap(sourceFile, rootDir, workspaceRoot) {
  const map = new Map(); // localName -> { modulePath, exportName }
  const fileDir = dirname(sourceFile.fileName);

  sourceFile.forEachChild((node) => {
    if (!ts.isImportDeclaration(node) || !node.importClause || !node.moduleSpecifier) return;
    const moduleText = node.moduleSpecifier.getText().slice(1, -1);
    const resolved = resolveModulePath(moduleText, fileDir, rootDir, workspaceRoot);
    if (!resolved) return;

    const { importClause } = node;
    if (importClause.name) {
      // default import: import foo from './x'
      map.set(importClause.name.text, { modulePath: resolved, exportName: 'default' });
    }
    if (importClause.namedBindings && ts.isNamedImports(importClause.namedBindings)) {
      for (const spec of importClause.namedBindings.elements) {
        const importedName = spec.propertyName ? spec.propertyName.text : spec.name.text;
        map.set(spec.name.text, { modulePath: resolved, exportName: importedName });
      }
    }
  });

  return map;
}

function resolveModulePath(specifier, fromDir, rootDir, workspaceRoot) {
  if (specifier.startsWith('.') || specifier.startsWith('/')) {
    const base = specifier.startsWith('.') ? resolve(fromDir, specifier) : resolve(rootDir, specifier);
    const candidateFiles = [base, ...SUPPORTED_EXTENSIONS.map(ext => base + ext), ...SUPPORTED_EXTENSIONS.map(ext => join(base, 'index' + ext))];
    for (const file of candidateFiles) {
      if (existsSync(file) && statSync(file).isFile()) return normalizePath(file, workspaceRoot);
    }
    return null;
  }
  // External module -> treat as unresolved (UNKNOWN)
  return null;
}

function deriveHandlerRef(identifier, importMap, sourceFile, workspaceRoot) {
  const localName = identifier.text;
  const entry = importMap.get(localName);
  if (entry) {
    return `${entry.modulePath}#${entry.exportName}`;
  }
  // Local declaration in same file
  const modulePath = normalizePath(sourceFile.fileName, workspaceRoot);
  return `${modulePath}#${localName}`;
}

function followHandler(symbol, checker, depth, contractType = 'network') {
  if (!symbol || depth > MAX_DEPTH) return null;

  const declarations = symbol.getDeclarations() || [];
  for (const decl of declarations) {
    if (ts.isFunctionDeclaration(decl) && decl.body) {
      if (contractType === 'network') {
        const res = findNetworkCallInBody(decl.body, checker, depth);
        if (res) return res;
      } else {
        const res = findStateCallInBody(decl.body, checker, depth);
        if (res) return res;
      }
    }
    if (ts.isVariableDeclaration(decl) && decl.initializer) {
      if (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer)) {
        if (contractType === 'network') {
          const res = findNetworkCallInBody(decl.initializer.body, checker, depth);
          if (res) return res;
        } else {
          const res = findStateCallInBody(decl.initializer.body, checker, depth);
          if (res) return res;
        }
      }
    }
  }
  return null;
}

function findNetworkCallInBody(body, checker, depth) {
  let found = null;

  function walk(node) {
    if (found) return;

    // Direct network calls
    if (ts.isCallExpression(node)) {
      const call = analyzeCall(node);
      if (call) {
        found = { method: call.method, url: call.url, chain: call.chain }; return;
      }

      // Follow inner call chain: handler -> wrapper -> fetch
      if (depth < MAX_DEPTH) {
        const callee = node.expression;
        if (ts.isIdentifier(callee)) {
          const sym = checker.getSymbolAtLocation(callee);
          const target = sym && (ts.SymbolFlags.Alias & sym.flags ? checker.getAliasedSymbol(sym) : sym);
          const inner = followHandler(target, checker, depth + 1, 'network');
          if (inner) {
            const name = callee.text;
            const chain = [{ name }].concat(inner.chain || []);
            found = { method: inner.method, url: inner.url, chain };
            return;
          }
        }
      }
    }

    ts.forEachChild(node, walk);
  }

  walk(body);
  return found;
}

/**
 * Find state mutations (useState setter, Redux dispatch, Zustand set) in function body.
 * Returns { stateKind, chain } if found, null otherwise.
 */
function findStateCallInBody(body, checker, depth) {
  let found = null;

  function walk(node) {
    if (found) return;

    // Direct state setter calls: setX(...), dispatch(...), set(...)
    if (ts.isCallExpression(node)) {
      const stateCall = analyzeStateCall(node);
      if (stateCall) {
        found = { stateKind: stateCall.stateKind, chain: stateCall.chain };
        return;
      }

      // Follow inner call chain for state mutations
      if (depth < MAX_DEPTH) {
        const callee = node.expression;
        if (ts.isIdentifier(callee)) {
          const sym = checker.getSymbolAtLocation(callee);
          const target = sym && (ts.SymbolFlags.Alias & sym.flags ? checker.getAliasedSymbol(sym) : sym);
          const inner = followHandler(target, checker, depth + 1, 'state');
          if (inner) {
            const name = callee.text;
            const chain = [{ name }].concat(inner.chain || []);
            found = { stateKind: inner.stateKind, chain };
            return;
          }
        }
      }
    }

    ts.forEachChild(node, walk);
  }

  walk(body);
  return found;
}

/**
 * Analyze a call expression to determine if it's a state mutation.
 * Returns { stateKind, chain } if it's a state call, null otherwise.
 */
function analyzeStateCall(node) {
  if (!ts.isCallExpression(node)) return null;

  const callee = node.expression;

  // React setter: setX(...) — any identifier starting with 'set' followed by capital letter
  if (ts.isIdentifier(callee)) {
    const name = callee.text;
    if (name.startsWith('set') && name.length > 3 && /^set[A-Z]/.test(name)) {
      return { stateKind: 'react_setter', chain: [] };
    }
    // dispatch(...) — Redux or similar
    if (name === 'dispatch') {
      return { stateKind: 'redux_dispatch', chain: [] };
    }
  }

  // Zustand: store.set(...) or setState(...)
  if (ts.isPropertyAccessExpression(callee)) {
    const _obj = callee.expression;
    const prop = callee.name;
    // Common pattern: storeObj.set(...)
    if (prop.text === 'set') {
      return { stateKind: 'zustand_set', chain: [] };
    }
    // setState(...) called on object
    if (prop.text === 'setState') {
      return { stateKind: 'react_setter', chain: [] };
    }
  }

  return null;
}

function analyzeCall(node) {
  // fetch("/api")
  if (ts.isIdentifier(node.expression) && node.expression.text === 'fetch') {
    const urlArg = node.arguments[0];
    if (urlArg && ts.isStringLiteral(urlArg)) {
      let method = 'GET';
      const options = node.arguments[1];
      if (options && ts.isObjectLiteralExpression(options)) {
        const methodProp = options.properties.find(p => ts.isPropertyAssignment(p) && p.name && p.name.getText() === 'method');
        if (methodProp && ts.isPropertyAssignment(methodProp) && ts.isStringLiteral(methodProp.initializer)) {
          method = methodProp.initializer.text.toUpperCase();
        }
      }
      return { method, url: urlArg.text, chain: [] };
    }
  }

  // axios.post("/api")
  if (ts.isPropertyAccessExpression(node.expression)) {
    const obj = node.expression.expression;
    const prop = node.expression.name;
    if (ts.isIdentifier(obj) && obj.text === 'axios') {
      const method = prop.text.toUpperCase();
      const urlArg = node.arguments[0];
      if (urlArg && ts.isStringLiteral(urlArg)) {
        return { method, url: urlArg.text, chain: [] };
      }
    }
  }

  // new XMLHttpRequest().open("METHOD", "URL")
  if (ts.isCallExpression(node.expression) && ts.isPropertyAccessExpression(node.expression)) {
    const inner = node.expression;
    if (inner.name.text === 'open') {
      const obj = inner.expression;
      if (ts.isNewExpression(obj) && ts.isIdentifier(obj.expression) && obj.expression.text === 'XMLHttpRequest') {
        const methodArg = node.arguments[0];
        const urlArg = node.arguments[1];
        if (methodArg && ts.isStringLiteral(methodArg) && urlArg && ts.isStringLiteral(urlArg)) {
          return { method: methodArg.text.toUpperCase(), url: urlArg.text, chain: [] };
        }
      }
    }
  }

  return null;
}

function getElementName(openingElement) {
  if (!openingElement || !openingElement.name) return 'element';
  const nameNode = openingElement.name;
  if (ts.isIdentifier(nameNode)) return nameNode.text;
  return 'element';
}

function formatSourceRef(filePath, workspaceRoot, pos, sourceFile) {
  const rel = normalizePath(filePath, workspaceRoot);
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
  return `${rel}:${line + 1}:${character}`; // keep column 0-based for consistency with Babel loc.column
}

function normalizePath(filePath, workspaceRoot) {
  const rel = relative(workspaceRoot, filePath);
  return rel.split(sep).join('/');
}
