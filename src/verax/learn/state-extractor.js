import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import { readFileSync } from 'fs';
import { glob } from 'glob';
import { resolve } from 'path';
import { ExpectationProof } from '../shared/expectation-proof.js';

const MAX_FILES_TO_SCAN = 200;

/**
 * Extracts static string value from call expression arguments.
 * Returns null if value is dynamic.
 */
function _extractStaticActionName(node) {
  if (!node) return null;
  
  // String literal: dispatch('increment')
  if (node.type === 'StringLiteral') {
    return node.value;
  }
  
  // Template literal without interpolation: `increment`
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    if (node.quasis.length === 1) {
      return node.quasis[0].value.cooked;
    }
  }
  
  return null;
}

/**
 * Extracts PROVEN state action expectations from Redux and Zustand patterns.
 * 
 * Supported patterns (all require static string literals):
 * - Redux Toolkit: dispatch(increment()), dispatch(decrement())
 * - Redux Toolkit: dispatch(slice.actions.increment())
 * - Zustand: set((state) => ({ ... })) with key names
 * 
 * Returns array of state expectations with:
 * - type: 'state_action'
 * - expectedTarget: action name or store key
 * - storeType: 'redux' | 'zustand'
 * - sourceFile: string
 * - proof: PROVEN_EXPECTATION
 * - line: number
 */
function extractStateExpectations(filePath, fileContent) {
  const expectations = [];
  
  try {
    const ast = parse(fileContent, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript']
    });
    
    traverse.default(ast, {
      // Redux dispatch(action())
      CallExpression(path) {
        const callee = path.node.callee;
        
        // dispatch(someAction())
        if (callee.type === 'Identifier' && callee.name === 'dispatch') {
          const firstArg = path.node.arguments[0];
          
          // dispatch(increment()) - action creator call
          if (firstArg && firstArg.type === 'CallExpression') {
            let actionName = null;
            
            // Simple action creator: increment()
            if (firstArg.callee.type === 'Identifier') {
              actionName = firstArg.callee.name;
            }
            
            // Slice action: counterSlice.actions.increment()
            else if (firstArg.callee.type === 'MemberExpression') {
              const property = firstArg.callee.property;
              if (property.type === 'Identifier') {
                actionName = property.name;
              }
            }
            
            if (actionName) {
              expectations.push({
                type: 'state_action',
                expectedTarget: actionName,
                storeType: 'redux',
                sourceFile: filePath,
                proof: ExpectationProof.PROVEN_EXPECTATION,
                line: path.node.loc?.start.line || null
              });
            }
          }
        }
        
        // Zustand set((state) => ({ key: value }))
        if (callee.type === 'Identifier' && callee.name === 'set') {
          const firstArg = path.node.arguments[0];
          
          // set((state) => ({ ... })) - arrow function returning object
          if (firstArg && firstArg.type === 'ArrowFunctionExpression') {
            const body = firstArg.body;
            
            // Arrow function body is object expression
            if (body.type === 'ObjectExpression') {
              for (const prop of body.properties) {
                if (prop.type === 'ObjectProperty' && prop.key.type === 'Identifier') {
                  const keyName = prop.key.name;
                  expectations.push({
                    type: 'state_action',
                    expectedTarget: keyName,
                    storeType: 'zustand',
                    sourceFile: filePath,
                    proof: ExpectationProof.PROVEN_EXPECTATION,
                    line: path.node.loc?.start.line || null
                  });
                }
              }
            }
          }
        }
      }
    });
  } catch (error) {
    // Parse error - skip this file
    return [];
  }
  
  return expectations;
}

/**
 * Detects if project uses Redux or Zustand by scanning package.json and imports.
 */
function detectStateStores(projectDir) {
  const stores = {
    redux: false,
    zustand: false
  };
  
  try {
    const pkgPath = resolve(projectDir, 'package.json');
    const pkgContent = readFileSync(pkgPath, 'utf-8');
    const pkg = JSON.parse(pkgContent);
    
    const allDeps = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {})
    };
    
    if (allDeps['@reduxjs/toolkit'] || allDeps['redux']) {
      stores.redux = true;
    }
    if (allDeps['zustand']) {
      stores.zustand = true;
    }
  } catch (error) {
    // No package.json or parse error
  }
  
  return stores;
}

/**
 * Scans project for state action expectations.
 * Returns { expectations: [], storesDetected: { redux: bool, zustand: bool } }
 */
export async function extractStateExpectationsFromAST(projectDir) {
  const storesDetected = detectStateStores(projectDir);
  const expectations = [];
  
  // Only scan if supported stores are detected
  if (!storesDetected.redux && !storesDetected.zustand) {
    return { expectations: [], storesDetected };
  }
  
  try {
    const files = await glob('**/*.{js,jsx,ts,tsx}', {
      cwd: projectDir,
      absolute: false,
      ignore: ['node_modules/**', 'dist/**', 'build/**', '.next/**', 'out/**']
    });
    
    const filesToScan = files.slice(0, MAX_FILES_TO_SCAN);
    
    for (const file of filesToScan) {
      try {
        const filePath = resolve(projectDir, file);
        const content = readFileSync(filePath, 'utf-8');
        const fileExpectations = extractStateExpectations(file, content);
        expectations.push(...fileExpectations);
      } catch (error) {
        continue;
      }
    }
  } catch (error) {
    return { expectations: [], storesDetected };
  }
  
  // Deduplicate by target name
  const seen = new Set();
  const unique = [];
  for (const exp of expectations) {
    const key = `${exp.storeType}:${exp.expectedTarget}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(exp);
    }
  }
  
  return { expectations: unique, storesDetected };
}
