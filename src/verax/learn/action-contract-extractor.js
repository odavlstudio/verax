/**
 * Wave 5 — Action Contract Extractor
 * 
 * Extracts PROVEN network action contracts from JSX/React source files.
 * Uses AST analysis to find onClick/onSubmit handlers that call fetch/axios
 * with static URL literals and template literals.
 * 
 * NO HEURISTICS. Only static, deterministic analysis.
 */

import { normalizeTemplateLiteral } from '../shared/dynamic-route-normalizer.js';import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import { readFileSync } from 'fs';
import { relative, sep } from 'path';

/**
 * Extract action contracts from a source file.
 * 
 * @param {string} filePath - Absolute path to source file
 * @param {string} workspaceRoot - Workspace root for relative paths
 * @returns {Array<Object>} - Array of contract objects
 */
export function extractActionContracts(filePath, workspaceRoot) {
  try {
    const code = readFileSync(filePath, 'utf-8');
    return extractActionContractsFromCode(filePath, workspaceRoot, code, 0);
  } catch (err) {
    console.warn(`Failed to parse ${filePath}: ${err.message}`);
    return [];
  }
}

function extractActionContractsFromCode(filePath, workspaceRoot, code, lineOffset = 0) {
  const contracts = [];

  // Track function declarations and arrow function assignments with location
  const functionBodies = new Map(); // name -> { body, loc }

  const ast = parse(code, {
    sourceType: 'unambiguous',
    plugins: ['jsx', 'typescript'],
  });

  traverse.default(ast, {
    FunctionDeclaration(path) {
      if (path.node.id && path.node.id.name) {
        functionBodies.set(path.node.id.name, { body: path.node.body, loc: path.node.loc });
      }
    },

    VariableDeclarator(path) {
      if (
        path.node.id.type === 'Identifier' &&
        path.node.init &&
        path.node.init.type === 'ArrowFunctionExpression'
      ) {
        functionBodies.set(path.node.id.name, { body: path.node.init.body, loc: path.node.loc });
      }
    },

    // JSX handlers (React)
    JSXAttribute(path) {
      const attrName = path.node.name.name;
      if (attrName !== 'onClick' && attrName !== 'onSubmit') {
        return;
      }
      
      const isSubmitHandler = attrName === 'onSubmit';

      const value = path.node.value;
      if (!value) return;

      if (
        value.type === 'JSXExpressionContainer' &&
        value.expression.type === 'ArrowFunctionExpression'
      ) {
        const handlerBody = value.expression.body;
        const networkCalls = findNetworkCallsInNode(handlerBody);

        for (const call of networkCalls) {
          const loc = path.node.loc;
          const sourceRef = formatSourceRef(filePath, workspaceRoot, loc, lineOffset);

          if (call.kind === 'VALIDATION_BLOCK' && isSubmitHandler) {
            contracts.push({
              kind: 'VALIDATION_BLOCK',
              method: call.method,
              urlPath: null,
              source: sourceRef,
              elementType: path.parent.name.name,
              handlerRef: sourceRef,
              selectorHint: null
            });
          } else if (call.kind !== 'VALIDATION_BLOCK') {
            contracts.push({
              kind: call.kind || 'NETWORK_ACTION',
              method: call.method,
              urlPath: call.url,
              source: sourceRef,
              elementType: path.parent.name.name,
              handlerRef: sourceRef
            });
          }
        }
      } else if (
        value.type === 'JSXExpressionContainer' &&
        value.expression.type === 'Identifier'
      ) {
        const refName = value.expression.name;
        const handlerRecord = functionBodies.get(refName);

        if (handlerRecord) {
          const networkCalls = findNetworkCallsInNode(handlerRecord.body);

          for (const call of networkCalls) {
            const loc = path.node.loc;
            const sourceRef = formatSourceRef(filePath, workspaceRoot, loc, lineOffset);

            if (call.kind === 'VALIDATION_BLOCK' && isSubmitHandler) {
              contracts.push({
                kind: 'VALIDATION_BLOCK',
                method: call.method,
                urlPath: null,
                source: sourceRef,
                elementType: path.parent.name.name,
                handlerRef: sourceRef,
                selectorHint: null
              });
            } else if (call.kind !== 'VALIDATION_BLOCK') {
              contracts.push({
                kind: call.kind || 'NETWORK_ACTION',
                method: call.method,
                urlPath: call.url,
                source: sourceRef,
                elementType: path.parent.name.name,
                handlerRef: sourceRef
              });
            }
          }
        }
      }
    },

    // DOM addEventListener handlers (static HTML/JS)
    CallExpression(path) {
      const callee = path.node.callee;
      if (
        callee.type === 'MemberExpression' &&
        callee.property.type === 'Identifier' &&
        callee.property.name === 'addEventListener'
      ) {
        const args = path.node.arguments || [];
        if (args.length < 2) return;

        const eventArg = args[0];
        const handlerArg = args[1];
        const eventType = eventArg && eventArg.type === 'StringLiteral' ? eventArg.value : 'event';

        let handlerBody = null;
        let handlerLoc = handlerArg?.loc || path.node.loc;

        if (handlerArg && (handlerArg.type === 'ArrowFunctionExpression' || handlerArg.type === 'FunctionExpression')) {
          handlerBody = handlerArg.body;
          handlerLoc = handlerArg.loc || path.node.loc;
        } else if (handlerArg && handlerArg.type === 'Identifier') {
          const record = functionBodies.get(handlerArg.name);
          if (record) {
            handlerBody = record.body;
            handlerLoc = record.loc || path.node.loc;
          }
        }

        if (!handlerBody) return;

        const networkCalls = findNetworkCallsInNode(handlerBody);
        const isSubmitEvent = eventType === 'submit';
        
        for (const call of networkCalls) {
          const handlerRef = formatSourceRef(filePath, workspaceRoot, handlerLoc, lineOffset);
          
          if (call.kind === 'VALIDATION_BLOCK' && isSubmitEvent) {
            contracts.push({
              kind: 'VALIDATION_BLOCK',
              method: call.method,
              urlPath: null,
              source: handlerRef,
              handlerRef: `${handlerRef}#${eventType}`,
              elementType: 'dom',
              selectorHint: null
            });
          } else if (call.kind !== 'VALIDATION_BLOCK') {
            contracts.push({
              kind: call.kind || 'NETWORK_ACTION',
              method: call.method,
              urlPath: call.url,
              source: handlerRef,
              handlerRef: `${handlerRef}#${eventType}`,
              elementType: 'dom'
            });
          }
        }
      }
    }
  });

  return contracts;
}

/**
 * Extract template literal pattern from node.
 * Returns null if template has complex expressions.
 */
function extractTemplateLiteralPath(node) {
  if (!node || node.type !== 'TemplateLiteral') {
    return null;
  }
  
  // Build template string
  let templateStr = node.quasis[0]?.value?.cooked || '';
  
  for (let i = 0; i < node.expressions.length; i++) {
    const expr = node.expressions[i];
    
    // Only support simple identifiers
    if (expr.type === 'Identifier') {
      templateStr += '${' + expr.name + '}';
    } else {
      return null;
    }
    
    if (node.quasis[i + 1]) {
      templateStr += node.quasis[i + 1].value.cooked || '';
    }
  }
  
  return templateStr;
}

/**
 * Find action calls (fetch, axios, router.push, navigate) in an AST node by recursively scanning.
 * Only returns calls with static URL/path literals or template patterns.
 * 
 * @param {Object} node - AST node to scan
 * @returns {Array<Object>} - Array of {kind, method, url} where kind is 'NETWORK_ACTION' or 'NAVIGATION_ACTION'
 */
function findNetworkCallsInNode(node) {
  const calls = [];
  
  // Track if we found preventDefault or return false for validation block detection
  let hasPreventDefault = false;
  let hasReturnFalse = false;

  // Recursive function to scan all nodes
  function scan(n) {
    if (!n || typeof n !== 'object') return;
    
    // Check if this is a CallExpression
    if (n.type === 'CallExpression') {
      const callee = n.callee;

      // Case 1: fetch(url, options)
      if (callee.type === 'Identifier' && callee.name === 'fetch') {
       const urlArg = n.arguments[0];
       const optionsArg = n.arguments[1];

        // Only accept static string literals
        if (urlArg && urlArg.type === 'StringLiteral') {
          let method = 'GET'; // default
          
          // Try to extract method from options
          if (optionsArg && optionsArg.type === 'ObjectExpression') {
            const methodProp = optionsArg.properties.find(
              (p) => p.key && p.key.name === 'method'
            );
            if (methodProp && methodProp.value.type === 'StringLiteral') {
              method = methodProp.value.value.toUpperCase();
            }
          }

          calls.push({ kind: 'NETWORK_ACTION', method, url: urlArg.value });
        }
      }

      // Case 2: axios.get(url), axios.post(url, data), etc.
      if (
        callee.type === 'MemberExpression' &&
        callee.object.type === 'Identifier' &&
        callee.object.name === 'axios' &&
        callee.property.type === 'Identifier'
      ) {
        const methodName = callee.property.name.toUpperCase();
       const urlArg = n.arguments[0];

        if (urlArg && urlArg.type === 'StringLiteral') {
          calls.push({ kind: 'NETWORK_ACTION', method: methodName, url: urlArg.value });
        }
      }

      // Case 3: XMLHttpRequest (optional, basic support)
      if (
        callee.type === 'MemberExpression' &&
        callee.property.type === 'Identifier' &&
        callee.property.name === 'open'
      ) {
        // xhr.open(method, url)
       const methodArg = n.arguments[0];
       const urlArg = n.arguments[1];

        if (
          methodArg && methodArg.type === 'StringLiteral' &&
          urlArg && urlArg.type === 'StringLiteral'
        ) {
          calls.push({
            kind: 'NETWORK_ACTION',
            method: methodArg.value.toUpperCase(),
            url: urlArg.value,
          });
        }
      }
      
      // Case 4: router.push(path), router.replace(path), history.push(path)
      if (
        callee.type === 'MemberExpression' &&
        callee.object.type === 'Identifier' &&
        (callee.object.name === 'router' || callee.object.name === 'history') &&
        callee.property.type === 'Identifier' &&
        ['push', 'replace', 'navigate'].includes(callee.property.name)
      ) {
        const pathArg = n.arguments[0];
        if (pathArg && pathArg.type === 'StringLiteral') {
          calls.push({
            kind: 'NAVIGATION_ACTION',
            method: `${callee.object.name}.${callee.property.name}`,
            url: pathArg.value
          });
        } else if (pathArg && pathArg.type === 'TemplateLiteral') {
          // Template literal: router.push(`/users/${id}`)
          const templatePath = extractTemplateLiteralPath(pathArg);
          if (templatePath && templatePath.startsWith('/')) {
            // Normalize to example path
            const normalized = normalizeTemplateLiteral(templatePath);
            calls.push({
              kind: 'NAVIGATION_ACTION',
              method: `${callee.object.name}.${callee.property.name}`,
              url: normalized ? normalized.examplePath : templatePath
            });
          }
        }
      }
      
      // Case 5: navigate(path) - standalone function
      if (callee.type === 'Identifier' && callee.name === 'navigate') {
        const pathArg = n.arguments[0];
        if (pathArg && pathArg.type === 'StringLiteral') {
          calls.push({
            kind: 'NAVIGATION_ACTION',
            method: 'navigate',
            url: pathArg.value
          });
        } else if (pathArg && pathArg.type === 'TemplateLiteral') {
          // Template literal: navigate(`/users/${id}`)
          const templatePath = extractTemplateLiteralPath(pathArg);
          if (templatePath && templatePath.startsWith('/')) {
            // Normalize to example path
            const normalized = normalizeTemplateLiteral(templatePath);
            calls.push({
              kind: 'NAVIGATION_ACTION',
              method: 'navigate',
              url: normalized ? normalized.examplePath : templatePath
            });
          }
        }
      }
      
      // Case 6: event.preventDefault() - validation block
      if (
        callee.type === 'MemberExpression' &&
        callee.property.type === 'Identifier' &&
        callee.property.name === 'preventDefault'
      ) {
        hasPreventDefault = true;
      }
   }
   
   // Check for return false statement
   if (n.type === 'ReturnStatement' && n.argument) {
     if (
       (n.argument.type === 'BooleanLiteral' && n.argument.value === false) ||
       (n.argument.type === 'Identifier' && n.argument.name === 'false')
     ) {
       hasReturnFalse = true;
     }
   }
   
   // Recursively scan all properties
   for (const key in n) {
     if (Object.prototype.hasOwnProperty.call(n, key)) {
       const value = n[key];
       if (Array.isArray(value)) {
         value.forEach(item => scan(item));
       } else if (value && typeof value === 'object') {
         scan(value);
       }
     }
   }
  }

  scan(node);
  
  // If validation block detected, add VALIDATION_BLOCK contract
  if (hasPreventDefault || hasReturnFalse) {
    calls.push({
      kind: 'VALIDATION_BLOCK',
      method: hasPreventDefault ? 'preventDefault' : 'return-false',
      url: null
    });
  }
  
  return calls;
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
function formatSourceRef(filePath, workspaceRoot, loc, lineOffset = 0) {
  let relPath = relative(workspaceRoot, filePath);
  
  // Normalize to forward slashes
  relPath = relPath.split(sep).join('/');
  
  const line = (loc?.start?.line || 1) + lineOffset;
  const col = loc?.start?.column || 0;
  
  return `${relPath}:${line}:${col}`;
}

/**
 * Scan a directory tree for source files and extract all contracts.
 * 
 * @param {string} rootPath - Root directory to scan
 * @param {string} workspaceRoot - Workspace root
 * @returns {Promise<Array<Object>>} - All contracts found
 */
export async function scanForContracts(rootPath, workspaceRoot) {
  const contracts = [];
  
  // Recursively scan known source file patterns while skipping common build/output directories
  const { readdirSync, statSync } = await import('fs');
  const { join } = await import('path');
  
  function walk(dir) {
    try {
      const entries = readdirSync(dir).sort((a, b) => a.localeCompare(b, 'en'));
      
      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Skip node_modules, .git, etc.
          const ignoredDirs = new Set([
            'node_modules',
            '.git',
            '.verax',
            'dist',
            'build',
            'out',
            'artifacts',
            'logs',
            'temp-installs',
            'tmp',
            'temp'
          ]);
          if (!entry.startsWith('.') && !ignoredDirs.has(entry)) {
            walk(fullPath);
          }
        } else if (stat.isFile()) {
          if (/\.(jsx?|tsx?)$/.test(entry)) {
            const fileContracts = extractActionContracts(fullPath, workspaceRoot);
            contracts.push(...fileContracts);
          } else if (/\.html?$/.test(entry)) {
            try {
              const html = readFileSync(fullPath, 'utf-8');
              const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
              let match;
  // @ts-expect-error - readFileSync with encoding returns string
              while ((match = scriptRegex.exec(html)) !== null) {
                const tagOpen = html.slice(match.index, html.indexOf('>', match.index) + 1);
  // @ts-expect-error - readFileSync with encoding returns string
                if (/\ssrc=/i.test(tagOpen)) continue; // skip external scripts
                const before = html.slice(0, match.index);
                // @ts-expect-error - readFileSync with encoding returns string
                const lineOffset = (before.match(/\n/g) || []).length;
                const code = match[1];
                const blockContracts = extractActionContractsFromCode(fullPath, workspaceRoot, code, lineOffset + 1);
                contracts.push(...blockContracts);
              }
            } catch (err) {
              console.warn(`Failed to parse HTML scripts in ${fullPath}: ${err.message}`);
            }
          }
        }
      }
    } catch (err) {
      // Ignore errors (permission issues, etc.)
    }
  }
  
  walk(rootPath);
  return contracts;
}



