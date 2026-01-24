import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import { readFileSync } from 'fs';
import { glob } from 'glob';
import { resolve } from 'path';
import { ExpectationProof } from '../shared/expectation-validation.js';
import { normalizeTemplateLiteral } from '../shared/dynamic-route-normalizer.js';
import { resolveScanConfig, rootsToGlobPatterns } from './scan-roots.js';

const MAX_FILES_TO_SCAN = 200;

/**
 * Extracts static string value from JSX attribute or expression.
 * Returns null if value is dynamic (variable, template with interpolation, etc.)
 * 
 * Wave 1 - CODE TRUTH ENGINE: Only static literals are PROVEN.
 */
function extractStaticStringValue(node) {
  if (!node) return null;
  
  // Direct string literal: href="/about"
  if (node.type === 'StringLiteral') {
    return node.value;
  }

  // Template literal without interpolation
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0 && node.quasis.length === 1) {
    return node.quasis[0].value.cooked;
  }
  
  // JSX expression: href={'/about'} or href={`/about`}
  if (node.type === 'JSXExpressionContainer') {
    const expr = node.expression;
    
    // String literal in expression: {'/about'}
    if (expr.type === 'StringLiteral') {
      return expr.value;
    }
    
    // Template literal WITHOUT interpolation: {`/about`}
    if (expr.type === 'TemplateLiteral' && expr.expressions.length === 0) {
      // Only if there are no ${...} expressions
      if (expr.quasis.length === 1) {
        return expr.quasis[0].value.cooked;
      }
    }
    
    // Anything else (variables, interpolated templates, etc.) is UNKNOWN
    return null;
  }
  
  return null;
}

function extractStaticPropValue(propsNode, propNames) {
  if (!propsNode || propsNode.type !== 'ObjectExpression') return { attributeName: null, targetPath: null };
  const names = new Set(propNames);
  for (const prop of propsNode.properties || []) {
    if (prop.type !== 'ObjectProperty') continue;
    const key = prop.key;
    const name = key.type === 'Identifier' ? key.name : (key.type === 'StringLiteral' ? key.value : null);
    if (!name || !names.has(name)) continue;
    const targetPath = extractStaticStringValue(prop.value);
    if (targetPath) {
      return { attributeName: name, targetPath };
    }
  }
  return { attributeName: null, targetPath: null };
}

/**
 * Extracts template literal pattern from Babel TemplateLiteral node.
 * Returns null if template has complex expressions that cannot be normalized.
 * 
 * Examples:
 * - `${id}` → { pattern: '${id}', examplePath: '/1' }
 * - `/users/${id}` → { pattern: '/users/${id}', examplePath: '/users/1' }
 * - `/posts/${slug}` → { pattern: '/posts/${slug}', examplePath: '/posts/example' }
 */
function extractTemplatePattern(templateNode) {
  if (!templateNode || templateNode.type !== 'TemplateLiteral') {
    return null;
  }
  
  // Build the template string with ${} placeholders
  let templateStr = templateNode.quasis[0]?.value?.cooked || '';
  
  for (let i = 0; i < templateNode.expressions.length; i++) {
    const expr = templateNode.expressions[i];
    
    // Only support simple identifiers: ${id}, ${slug}
    if (expr.type === 'Identifier') {
      templateStr += '${' + expr.name + '}';
    } else {
      // Complex expressions like function calls - cannot normalize
      return null;
    }
    
    // Add the next quasi
    if (templateNode.quasis[i + 1]) {
      templateStr += templateNode.quasis[i + 1].value.cooked || '';
    }
  }
  
  // Must be a valid route pattern (start with /)
  if (!templateStr.startsWith('/')) {
    return null;
  }
  
  // Normalize to example path
  const normalized = normalizeTemplateLiteral(templateStr);
  if (normalized) {
    return {
      pattern: templateStr,
      examplePath: normalized.examplePath,
      isDynamic: true,
      originalPattern: normalized.originalPattern
    };
  }
  
  return null;
}

/**
 * Extracts PROVEN navigation contracts from JSX elements and imperative calls.
 * 
 * Supported patterns (all require static string literals or template patterns):
 * - Next.js: <Link href="/about"> or <Link href={`/about`}>
 * - React Router: <Link to="/about"> or <RouterLink :to="`/users/${id}`">
 * - Plain JSX: <a href="/about">
 * - Imperative: navigate("/about"), router.push("/about"), router.push(`/users/${id}`)
 * 
 * Returns array of contracts with:
 * - kind: 'NAVIGATION'
 * - targetPath: string (example path for dynamic routes)
 * - originalPattern: string (original pattern for dynamic routes)
 * - isDynamic: boolean (true if dynamic route)
 * - sourceFile: string
 * - element: 'Link' | 'NavLink' | 'a' | 'navigate' | 'router'
 * - attribute: 'href' | 'to' (for runtime matching)
 * - proof: PROVEN_EXPECTATION
 * - line: number (optional)
 */
function extractContractsFromFile(filePath, fileContent) {
  const contracts = [];
  
  try {
    // Parse with Babel - support JSX and TypeScript
    const ast = parse(fileContent, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript']
    });
    
    traverse.default(ast, {
      // JSX elements: <Link href>, <a href>, <NavLink to>
      JSXElement(path) {
        const openingElement = path.node.openingElement;
        const elementName = openingElement.name.name;
        
        // Check for Link, NavLink, or a elements
        if (elementName === 'Link' || elementName === 'NavLink' || elementName === 'a') {
          let targetPath = null;
          let attributeName = null;
          
          // Find href or to attribute
          for (const attr of openingElement.attributes) {
            if (attr.type === 'JSXAttribute') {
              const attrName = attr.name.name;
              
              if (attrName === 'href' || attrName === 'to') {
                targetPath = extractStaticStringValue(attr.value);
                attributeName = attrName;
                break;
              }
            }
          }
          
          // Only create contract if we have a static target path
          if (targetPath && !targetPath.startsWith('http://') && !targetPath.startsWith('https://') && !targetPath.startsWith('mailto:') && !targetPath.startsWith('tel:')) {
            // Normalize path
            const normalized = targetPath.startsWith('/') ? targetPath : '/' + targetPath;
            
            contracts.push({
              kind: 'NAVIGATION',
              targetPath: normalized,
              sourceFile: filePath,
              element: elementName,
              attribute: attributeName,
              proof: ExpectationProof.PROVEN_EXPECTATION,
              line: openingElement.loc?.start.line || null
            });
          }
        }
      },
      
      // Imperative navigation calls: navigate("/about"), router.push("/about")
      // Note: These are recorded but not used for element-based expectations
      // since we cannot reliably tie them to clicked elements
      CallExpression(path) {
        const callee = path.node.callee;

        // React.createElement(Link, { to: '/about' }) or createElement('a', { href: '/about' })
        const isCreateElement = (
          (callee.type === 'MemberExpression' && callee.object.type === 'Identifier' && callee.object.name === 'React' && callee.property.type === 'Identifier' && callee.property.name === 'createElement') ||
          (callee.type === 'Identifier' && callee.name === 'createElement')
        );

        if (isCreateElement) {
          const [componentArg, propsArg] = path.node.arguments;
          let elementName = null;
          if (componentArg?.type === 'Identifier') {
            elementName = componentArg.name;
          } else if (componentArg?.type === 'StringLiteral') {
            elementName = componentArg.value;
          }
          if (elementName) {
            const { attributeName, targetPath } = extractStaticPropValue(propsArg, ['to', 'href']);
            if (targetPath && !targetPath.startsWith('http://') && !targetPath.startsWith('https://') && !targetPath.startsWith('mailto:') && !targetPath.startsWith('tel:')) {
              const normalized = targetPath.startsWith('/') ? targetPath : '/' + targetPath;
              contracts.push({
                kind: 'NAVIGATION',
                targetPath: normalized,
                sourceFile: filePath,
                element: elementName,
                attribute: attributeName,
                proof: ExpectationProof.PROVEN_EXPECTATION,
                line: path.node.loc?.start.line || null
              });
            }
          }
        }
        
        // navigate("/about") - useNavigate hook
        if (callee.type === 'Identifier' && callee.name === 'navigate') {
          const firstArg = path.node.arguments[0];
          if (firstArg && firstArg.type === 'StringLiteral') {
            const targetPath = firstArg.value;
            if (targetPath.startsWith('/')) {
              contracts.push({
                kind: 'NAVIGATION',
                targetPath: targetPath,
                sourceFile: filePath,
                element: 'navigate',
                attribute: null,
                proof: ExpectationProof.PROVEN_EXPECTATION,
                line: path.node.loc?.start.line || null,
                imperativeOnly: true // Cannot match to DOM element
              });
            }
          } else if (firstArg && firstArg.type === 'TemplateLiteral') {
            // Template literal: navigate(`/users/${id}`)
            const templatePattern = extractTemplatePattern(firstArg);
            if (templatePattern) {
              contracts.push({
                kind: 'NAVIGATION',
                targetPath: templatePattern.examplePath,
                originalPattern: templatePattern.pattern,
                isDynamic: true,
                sourceFile: filePath,
                element: 'navigate',
                attribute: null,
                proof: ExpectationProof.PROVEN_EXPECTATION,
                line: path.node.loc?.start.line || null,
                imperativeOnly: true // Cannot match to DOM element
              });
            }
          }
        }
        
        // router.push("/about") or router.replace("/about")
        if (callee.type === 'MemberExpression' && 
            callee.object.type === 'Identifier' && 
            callee.object.name === 'router' &&
            callee.property.type === 'Identifier' &&
            (callee.property.name === 'push' || callee.property.name === 'replace')) {
          const firstArg = path.node.arguments[0];
          if (firstArg && firstArg.type === 'StringLiteral') {
            const targetPath = firstArg.value;
            if (targetPath.startsWith('/')) {
              contracts.push({
                kind: 'NAVIGATION',
                targetPath: targetPath,
                sourceFile: filePath,
                element: 'router',
                attribute: null,
                proof: ExpectationProof.PROVEN_EXPECTATION,
                line: path.node.loc?.start.line || null,
                imperativeOnly: true // Cannot match to DOM element
              });
            }
          } else if (firstArg && firstArg.type === 'TemplateLiteral') {
            // Template literal: router.push(`/users/${id}`)
            const templatePattern = extractTemplatePattern(firstArg);
            if (templatePattern) {
              contracts.push({
                kind: 'NAVIGATION',
                targetPath: templatePattern.examplePath,
                originalPattern: templatePattern.pattern,
                isDynamic: true,
                sourceFile: filePath,
                element: 'router',
                attribute: null,
                proof: ExpectationProof.PROVEN_EXPECTATION,
                line: path.node.loc?.start.line || null,
                imperativeOnly: true // Cannot match to DOM element
              });
            }
          }
        }
      }
    });
  } catch (error) {
    // Parse error - skip this file
    // This is expected for files with syntax errors or unsupported syntax
    return [];
  }
  
  return contracts;
}

/**
 * Scans a project directory for navigation contracts using AST analysis.
 * Returns array of PROVEN navigation contracts.
 * 
 * Wave 1 - CODE TRUTH ENGINE: AST-derived PROVEN expectations only.
 * 
 * @param {string} projectDir - Project root directory
 * @param {string} projectType - Detected project type for scan root detection
 * @param {Object} [scanOptions] - Optional scan configuration overrides
 */
export async function extractASTContracts(projectDir, projectType = 'unknown', scanOptions = {}) {
  const contracts = [];
  
  try {
    // Resolve scan roots using framework-aware detection
    // Will throw if no roots found and allowEmptyLearn is false
    const scanConfig = resolveScanConfig(projectDir, projectType, scanOptions);
    const baseDir = scanConfig.cwd;
    
    // Generate glob patterns from scan roots
    const globPatterns = rootsToGlobPatterns(scanConfig.roots, '*.{js,jsx,ts,tsx}');
    
    // Collect files from all patterns
    let files = [];
    for (const pattern of globPatterns) {
      const matchedFiles = await glob(pattern, {
        cwd: baseDir,
        absolute: false,
        ignore: scanConfig.excludes
      });
      matchedFiles.sort((a, b) => a.localeCompare(b, 'en'));
      files = files.concat(matchedFiles);
    }
    files = Array.from(new Set(files)).sort((a, b) => a.localeCompare(b, 'en'));
    
    // Verbose logging (minimal)
    if (scanOptions.verbose) {
      console.log(`[AST Contracts] Scan roots: ${scanConfig.roots.join(', ')}, Files matched: ${files.length}`);
    }
    
    // Limit files to scan
    const filesToScan = files.slice(0, MAX_FILES_TO_SCAN);
    
    for (const file of filesToScan) {
      try {
        const filePath = resolve(baseDir, file);
        const content = readFileSync(filePath, 'utf-8');
        const fileContracts = extractContractsFromFile(file, content);
        contracts.push(...fileContracts);
      } catch (error) {
        // Skip files that can't be read
        continue;
      }
    }
  } catch (error) {
    // If glob fails, return empty
    return [];
  }
  
  return contracts;
}

/**
 * Converts AST contracts to manifest expectations format.
 * Only includes contracts that can be matched at runtime (excludes imperativeOnly).
 */
export function contractsToExpectations(contracts, _projectType) {
  const expectations = [];
  const seenPaths = new Set();
  
  for (const contract of contracts) {
    // Skip imperative-only contracts (navigate, router.push)
    // These cannot be reliably matched to DOM elements
    if (contract.imperativeOnly) {
      continue;
    }
    
    // Skip duplicates
    const key = `${contract.targetPath}:${contract.attribute}`;
    if (seenPaths.has(key)) {
      continue;
    }
    seenPaths.add(key);
    
    // Create expectation for runtime matching
    // We don't specify fromPath since we'll match by href/to attribute value
    expectations.push({
      type: 'spa_navigation',
      targetPath: contract.targetPath,
      proof: ExpectationProof.PROVEN_EXPECTATION,
      matchAttribute: contract.attribute, // 'href' or 'to'
      evidence: {
        source: contract.sourceFile,
        element: contract.element,
        line: contract.line
      }
    });
  }
  
  return expectations;
}



