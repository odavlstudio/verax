import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';
import { expIdFromHash, compareExpectations } from './idgen.js';
import { extractPromisesFromAST } from './ast-promise-extractor.js';

/**
 * Static Expectation Extractor
 * PHASE H2/M2: AST-based promise extraction
 * Extracts explicit, static expectations from source files using AST parsing
 */

export async function extractExpectations(projectProfile, _srcPath) {
  const expectations = [];
  const skipped = {
    dynamic: 0,
    computed: 0,
    external: 0,
    parseError: 0,
    other: 0,
  };
  
  const sourceRoot = resolve(projectProfile.sourceRoot);
  const scanPaths = getScanPaths(projectProfile, sourceRoot);
  
  for (const scanPath of scanPaths) {
    const fileExpectations = await scanDirectory(scanPath, sourceRoot, skipped);
    expectations.push(...fileExpectations);
  }
  
  // Sort expectations deterministically by file, line, column, kind, value
  expectations.sort(compareExpectations);
  
  // Generate deterministic IDs based on content (order-independent)
  expectations.forEach((exp) => {
    exp.id = expIdFromHash(
      exp.source.file,
      exp.source.line,
      exp.source.column,
      exp.promise.kind,
      exp.promise.value
    );
  });
  
  return {
    expectations,
    skipped,
  };
}

/**
 * Get directories to scan based on framework
 */
function getScanPaths(projectProfile, sourceRoot) {
  const { framework, router } = projectProfile;
  
  if (framework === 'nextjs') {
    if (router === 'app') {
      return [resolve(sourceRoot, 'app')];
    } else if (router === 'pages') {
      return [resolve(sourceRoot, 'pages')];
    }
    return [];
  }
  
  if (framework === 'react-vite' || framework === 'react-cra') {
    const srcPath = resolve(sourceRoot, 'src');
    try {
      if (statSync(srcPath).isDirectory()) {
        return [srcPath];
      }
    } catch (error) {
      // src doesn't exist - scan root for React files
    }
    // Fallback: scan root directory for React files
    return [sourceRoot];
  }
  
  if (framework === 'static-html') {
    return [sourceRoot];
  }
  
  // Unknown framework or no framework detected - check if it's a static HTML project
  // (This handles cases where framework detection failed but HTML files exist)
  if (framework === 'unknown') {
    const htmlFiles = readdirSync(sourceRoot, { withFileTypes: true })
      .filter(e => e.isFile() && e.name.endsWith('.html'));
    if (htmlFiles.length > 0) {
      return [sourceRoot];
    }
  }
  
  // Unknown framework - scan src if it exists, otherwise scan root
  const srcPath = resolve(sourceRoot, 'src');
  try {
    if (statSync(srcPath).isDirectory()) {
      return [srcPath];
    }
  } catch (error) {
    // src doesn't exist
  }
  
  // Fallback: scan root directory
  return [sourceRoot];
}

/**
 * Recursively scan directory for expectations
 */
async function scanDirectory(dirPath, sourceRoot, skipped) {
  const expectations = [];
  
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      // Skip node_modules, .next, dist, build, etc.
      if (shouldSkipDirectory(entry.name)) {
        continue;
      }
      
      const fullPath = join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        const dirExpectations = await scanDirectory(fullPath, sourceRoot, skipped);
        expectations.push(...dirExpectations);
      } else if (entry.isFile() && shouldScanFile(entry.name)) {
        const fileExpectations = scanFile(fullPath, sourceRoot, skipped);
        expectations.push(...fileExpectations);
      }
    }
  } catch (error) {
    // Silently skip directories we can't read
  }
  
  return expectations;
}

/**
 * Check if directory should be skipped
 */
function shouldSkipDirectory(name) {
  const skipPatterns = [
    'node_modules',
    '.next',
    'dist',
    'build',
    '.git',
    '.venv',
    '__pycache__',
    '.env',
    'public',
    '.cache',
    'coverage',
  ];
  
  return skipPatterns.includes(name) || name.startsWith('.');
}

/**
 * Check if file should be scanned
 */
function shouldScanFile(name) {
  const extensions = ['.js', '.jsx', '.ts', '.tsx', '.html', '.mjs'];
  return extensions.some(ext => name.endsWith(ext));
}

/**
 * Scan a single file for expectations
 */
function scanFile(filePath, sourceRoot, skipped) {
  const expectations = [];
  
  try {
    const content = readFileSync(filePath, 'utf8');
    const relPath = relative(sourceRoot, filePath);
    
    if (filePath.endsWith('.html')) {
      // HTML files: Use regex-based extraction (static HTML fallback)
      const htmlExpectations = extractHtmlExpectations(content, filePath, relPath);
      expectations.push(...htmlExpectations);
    } else {
      // JS/JSX/TS/TSX files: Use AST-based extraction (PHASE H2)
      const astPromises = extractPromisesFromAST(content, filePath, relPath);
      expectations.push(...astPromises);
      
      // Legacy regex-based extraction (preserved for navigation/network/state)
      const jsExpectations = extractJsExpectations(content, filePath, relPath, skipped);
      expectations.push(...jsExpectations);
    }
  } catch (error) {
    skipped.parseError++;
  }
  
  return expectations;
}

/**
 * Extract expectations from HTML files
 * PHASE H2: Enhanced with button, form, and validation detection
 */
function extractHtmlExpectations(content, filePath, relPath) {
  const expectations = [];
  
  // Extract <a href="/path"> links (navigation)
  const hrefRegex = /<a\s+[^>]*href=["']([^"']+)["']/gi;
  let match;
  
  while ((match = hrefRegex.exec(content)) !== null) {
    const href = match[1];
    const lineNum = content.substring(0, match.index).split('\n').length;
    
    // Skip dynamic/absolute URLs
    if (!href.startsWith('#') && !href.startsWith('http') && !href.includes('${')) {
      expectations.push({
        type: 'navigation',
        promise: {
          kind: 'navigate',
          value: href,
        },
        source: {
          file: relPath,
          line: lineNum,
          column: match.index - content.lastIndexOf('\n', match.index),
        },
        confidence: 1.0,
      });
    }
  }
  
  // Extract <button> elements (interaction promise)
  const buttonRegex = /<button\s+[^>]*>/gi;
  while ((match = buttonRegex.exec(content)) !== null) {
    const lineNum = content.substring(0, match.index).split('\n').length;
    const buttonText = extractTextFromTag(content, match.index, 'button');
    
    expectations.push({
      category: 'button',
      type: 'interaction',
      promise: {
        kind: 'click',
        value: buttonText || 'button click',
      },
      source: {
        file: relPath,
        line: lineNum,
        column: match.index - content.lastIndexOf('\n', match.index),
      },
      selector: buttonText ? `button:contains("${buttonText}")` : 'button',
      action: 'click',
      expectedOutcome: 'ui-change',
      confidenceHint: 'low',
    });
  }
  
  // Extract <form> elements (submission promise)
  const formRegex = /<form\s+[^>]*>/gi;
  while ((match = formRegex.exec(content)) !== null) {
    const lineNum = content.substring(0, match.index).split('\n').length;
    const formTag = match[0];
    
    // Check for action attribute
    const actionMatch = /action=["']([^"']+)["']/.exec(formTag);
    const hasAction = actionMatch && actionMatch[1];
    
    expectations.push({
      category: 'form',
      type: 'interaction',
      promise: {
        kind: 'submit',
        value: hasAction ? `form submit to ${actionMatch[1]}` : 'form submission',
      },
      source: {
        file: relPath,
        line: lineNum,
        column: match.index - content.lastIndexOf('\n', match.index),
      },
      selector: hasAction ? `form[action="${actionMatch[1]}"]` : 'form',
      action: 'submit',
      expectedOutcome: hasAction ? 'navigation' : 'ui-change',
      confidenceHint: hasAction ? 'medium' : 'low',
    });
  }
  
  // Extract required input fields (validation promise)
  const requiredRegex = /<input\s+[^>]*required[^>]*>/gi;
  while ((match = requiredRegex.exec(content)) !== null) {
    const lineNum = content.substring(0, match.index).split('\n').length;
    const inputTag = match[0];
    
    // Extract name or id for selector
    const nameMatch = /name=["']([^"']+)["']/.exec(inputTag);
    const idMatch = /id=["']([^"']+)["']/.exec(inputTag);
    const selector = nameMatch ? `input[name="${nameMatch[1]}"]` : 
                     idMatch ? `input#${idMatch[1]}` : 'input[required]';
    
    expectations.push({
      category: 'validation',
      type: 'feedback',
      promise: {
        kind: 'validation',
        value: 'required field validation',
      },
      source: {
        file: relPath,
        line: lineNum,
        column: match.index - content.lastIndexOf('\n', match.index),
      },
      selector,
      action: 'observe',
      expectedOutcome: 'feedback',
      confidenceHint: 'medium',
    });
  }
  
  // Extract aria-live regions (feedback promise)
  const ariaLiveRegex = /<[^>]+aria-live=["']([^"']+)["'][^>]*>/gi;
  while ((match = ariaLiveRegex.exec(content)) !== null) {
    const lineNum = content.substring(0, match.index).split('\n').length;
    
    expectations.push({
      category: 'feedback',
      type: 'feedback',
      promise: {
        kind: 'ui-feedback',
        value: 'live region update',
      },
      source: {
        file: relPath,
        line: lineNum,
        column: match.index - content.lastIndexOf('\n', match.index),
      },
      selector: '[aria-live]',
      action: 'observe',
      expectedOutcome: 'feedback',
      confidenceHint: 'medium',
    });
  }
  
  return expectations;
}

/**
 * Extract text content from HTML tag
 */
function extractTextFromTag(content, startIndex, tagName) {
  const closeTagRegex = new RegExp(`</${tagName}>`, 'i');
  const closeMatch = closeTagRegex.exec(content.substring(startIndex));
  
  if (!closeMatch) return '';
  
  const endOfOpenTag = content.indexOf('>', startIndex);
  if (endOfOpenTag === -1) return '';
  
  const textContent = content.substring(endOfOpenTag + 1, startIndex + closeMatch.index);
  
  // Strip HTML tags and trim
  return textContent.replace(/<[^>]+>/g, '').trim();
}

/**
 * Extract expectations from JavaScript/TypeScript files
 */
function extractJsExpectations(content, filePath, relPath, skipped) {
  const expectations = [];
  const lines = content.split('\n');
  
  lines.forEach((line, lineIdx) => {
    const lineNum = lineIdx + 1;
    
    // Skip comments
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
      return;
    }
    
    // Extract Next.js <Link href="/path">
    const linkRegex = /<Link\s+[^>]*href=["']([^"']+)["']/g;
    let match;
    while ((match = linkRegex.exec(line)) !== null) {
      const href = match[1];
      
      // Skip dynamic hrefs
      if (!href.includes('${') && !href.includes('+') && !href.includes('`')) {
        expectations.push({
          type: 'navigation',
          promise: {
            kind: 'navigate',
            value: href,
          },
          source: {
            file: relPath,
            line: lineNum,
            column: match.index,
          },
          confidence: 1.0,
        });
      } else {
        skipped.dynamic++;
      }
    }
    
    // Extract router.push("/path")
    const routerPushRegex = /router\.push\(["']([^"']+)["']\)/g;
    while ((match = routerPushRegex.exec(line)) !== null) {
      const path = match[1];
      
      if (!path.includes('${') && !path.includes('+') && !path.includes('`')) {
        expectations.push({
          type: 'navigation',
          promise: {
            kind: 'navigate',
            value: path,
          },
          source: {
            file: relPath,
            line: lineNum,
            column: match.index,
          },
          confidence: 1.0,
        });
      } else {
        skipped.dynamic++;
      }
    }
    
    // Extract fetch("https://...")
    const fetchRegex = /fetch\(["']([^"']+)["']\)/g;
    while ((match = fetchRegex.exec(line)) !== null) {
      const url = match[1];
      
      // Only extract absolute URLs (https://)
      if (url.startsWith('http://') || url.startsWith('https://')) {
        expectations.push({
          type: 'network',
          promise: {
            kind: 'request',
            value: url,
          },
          source: {
            file: relPath,
            line: lineNum,
            column: match.index,
          },
          confidence: 1.0,
        });
      } else if (!url.includes('${') && !url.includes('+') && !url.includes('`')) {
        skipped.external++;
      } else {
        skipped.dynamic++;
      }
    }
    
    // Extract axios.get/post("https://...")
    const axiosRegex = /axios\.(get|post|put|delete|patch)\(["']([^"']+)["']\)/g;
    while ((match = axiosRegex.exec(line)) !== null) {
      const url = match[2];
      
      if (url.startsWith('http://') || url.startsWith('https://')) {
        expectations.push({
          type: 'network',
          promise: {
            kind: 'request',
            value: url,
          },
          source: {
            file: relPath,
            line: lineNum,
            column: match.index,
          },
          confidence: 1.0,
        });
      } else if (!url.includes('${') && !url.includes('+') && !url.includes('`')) {
        skipped.external++;
      } else {
        skipped.dynamic++;
      }
    }
    
    // Extract useState setters
    const useStateRegex = /useState\([^)]*\)/g;
    if ((match = useStateRegex.exec(line)) !== null) {
      expectations.push({
        type: 'state',
        promise: {
          kind: 'state_mutation',
          value: 'state management',
        },
        source: {
          file: relPath,
          line: lineNum,
          column: match.index,
        },
        confidence: 0.8,
      });
    }
    
    // Extract Redux dispatch calls
    const dispatchRegex = /dispatch\(\{/g;
    if ((match = dispatchRegex.exec(line)) !== null) {
      expectations.push({
        type: 'state',
        promise: {
          kind: 'state_mutation',
          value: 'state management',
        },
        source: {
          file: relPath,
          line: lineNum,
          column: match.index,
        },
        confidence: 0.8,
      });
    }
    
    // Extract Zustand set() calls
    const zustandRegex = /set\(\{/g;
    if ((match = zustandRegex.exec(line)) !== null && line.includes('zustand') || line.includes('store')) {
      expectations.push({
        type: 'state',
        promise: {
          kind: 'state_mutation',
          value: 'state management',
        },
        source: {
          file: relPath,
          line: lineNum,
          column: match.index,
        },
        confidence: 0.8,
      });
    }
  });
  
  return expectations;
}
