/**
 * ARCHITECTURE BOUNDARIES TEST
 * 
 * This test enforces strict module layer boundaries to prevent regressions.
 * It validates that the import graph respects directional rules:
 * 
 * Layer        MAY IMPORT FROM    MAY NOT IMPORT FROM
 * learn/       shared/            observe/, detect/, core/confidence
 * observe/     shared/, core/     detect/
 * detect/      core/, shared/     learn/, observe internals
 * core/        shared/ ONLY       detect/, observe/, learn/
 * cli/         ALL (orchestrator) -
 * 
 * ENFORCEMENT POINTS:
 * 1. Confidence computation: ONLY via core/confidence/index.js
 * 2. Module isolation: No cross-layer imports violating hierarchy
 * 3. Legacy bypass prevention: No direct imports of legacy engines
 * 
 * RUN: node --test test/architecture-boundaries.test.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

/**
 * Reads a file and extracts all import statements
 */
function extractImports(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const importRegex = /import\s+(?:.*?)\s+from\s+['"]([^'"]+)['"]/g;
  const imports = [];
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

/**
 * Recursively scans directory for JS files
 */
function getAllJsFiles(dir, exclude = []) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(rootDir, fullPath);
    
    // Skip excluded patterns
    if (exclude.some(pattern => relativePath.includes(pattern))) {
      continue;
    }
    
    if (entry.isDirectory()) {
      files.push(...getAllJsFiles(fullPath, exclude));
    } else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Determines which layer a file belongs to
 */
function getLayerFromPath(filePath) {
  const relative = path.relative(rootDir, filePath);
  
  if (relative.startsWith('src/verax/core')) return 'core';
  if (relative.startsWith('src/verax/detect')) return 'detect';
  if (relative.startsWith('src/verax/observe')) return 'observe';
  if (relative.startsWith('src/verax/learn')) return 'learn';
  if (relative.startsWith('src/verax/cli') || relative.startsWith('src/cli')) return 'cli';
  
  return 'other';
}

/**
 * Resolves an import path to absolute file path
 */
function resolveImportPath(importStr, fromFile) {
  const fromDir = path.dirname(fromFile);
  
  // Skip external packages
  if (!importStr.startsWith('.') && !importStr.startsWith('/')) {
    return null;
  }
  
  // Try without extension
  let resolved = path.resolve(fromDir, importStr);
  if (fs.existsSync(resolved)) {
    return resolved;
  }
  
  // Try with .js
  resolved = path.resolve(fromDir, importStr + '.js');
  if (fs.existsSync(resolved)) {
    return resolved;
  }
  
  // Try as directory/index.js
  resolved = path.resolve(fromDir, importStr, 'index.js');
  if (fs.existsSync(resolved)) {
    return resolved;
  }
  
  return null;
}

/**
 * Checks if import violates layer boundary rules
 */
function checkBoundaryViolation(fromFile, importedPath) {
  const fromLayer = getLayerFromPath(fromFile);
  const toLayer = getLayerFromPath(importedPath);
  
  // Allow same-layer imports
  if (fromLayer === toLayer) {
    return null;
  }
  
  // Allow shared imports (utility, types, etc)
  if (toLayer === 'other' && importedPath.includes('shared')) {
    return null;
  }
  
  // ENFORCE: learn/ cannot import from observe, detect, or core/confidence
  if (fromLayer === 'learn') {
    if (toLayer === 'observe' || toLayer === 'detect') {
      return `learn/ cannot import from ${toLayer}/`;
    }
    if (importedPath.includes('core/confidence')) {
      return 'learn/ cannot import from core/confidence';
    }
  }
  
  // ENFORCE: observe/ cannot import from detect/
  if (fromLayer === 'observe' && toLayer === 'detect') {
    return 'observe/ cannot import from detect/';
  }
  
  // ENFORCE: observe/ can import from core/ (but must be public API)
  if (fromLayer === 'observe' && toLayer === 'core') {
    // This is allowed
    return null;
  }
  
  // ENFORCE: detect/ can import from core/ and shared/
  if (fromLayer === 'detect') {
    if (toLayer === 'learn' || toLayer === 'observe') {
      return `detect/ cannot import from ${toLayer}/`;
    }
    if (toLayer === 'core') {
      // This is allowed
      return null;
    }
  }
  
  // ENFORCE: core/ cannot import from detect/, observe/, or learn/
  if (fromLayer === 'core') {
    if (toLayer === 'detect' || toLayer === 'observe' || toLayer === 'learn') {
      return `core/ cannot import from ${toLayer}/`;
    }
  }
  
  // ENFORCE: No backward imports (except cli as orchestrator)
  if (fromLayer === 'cli') {
    // cli can import from anywhere
    return null;
  }
  
  return null;
}

/**
 * TEST 1: Confidence Computation Authority
 */
test('architecture: confidence computation routes through core/confidence/index.js only', async () => {
  const confidencePath = path.resolve(rootDir, 'src/verax/core/confidence/index.js');
  assert.ok(fs.existsSync(confidencePath), 'core/confidence/index.js exists');
  
  // Check that computeConfidence is exported
  const content = fs.readFileSync(confidencePath, 'utf8');
  assert.match(content, /export\s+function\s+computeConfidence/, 'computeConfidence is exported');
  
  // Check that it has a canonical export
  assert.match(content, /export.*computeConfidenceForFinding/, 'backward-compatible export exists');
});

/**
 * TEST 2: Detect modules use canonical API
 */
test('architecture: detect/ modules import confidence from core/confidence', async () => {
  const detectDir = path.resolve(rootDir, 'src/verax/detect');
  const detectFiles = getAllJsFiles(detectDir)
    .filter(f => !f.includes('node_modules'))
    .filter(f => !f.includes('test'));
  
  const violations = [];
  
  for (const file of detectFiles) {
    const imports = extractImports(file);
    
    for (const imp of imports) {
      // Check for direct imports of legacy confidence-engine
      if (imp.includes('confidence-engine.js') && !imp.includes('core/confidence')) {
        violations.push({
          file: path.relative(rootDir, file),
          import: imp,
          issue: 'Imports legacy confidence-engine from detect/ instead of core/confidence'
        });
      }
      
      // Check for imports of deprecated modules
      if (imp.includes('confidence-engine.deprecated')) {
        violations.push({
          file: path.relative(rootDir, file),
          import: imp,
          issue: 'Imports deprecated confidence-engine.deprecated'
        });
      }
    }
  }
  
  if (violations.length > 0) {
    assert.fail(`Confidence bypass violations found:\n${
      violations.map(v => `  ${v.file}: ${v.import}\n    → ${v.issue}`).join('\n')
    }`);
  }
});

/**
 * TEST 3: Module layer boundaries
 */
test('architecture: module imports respect layer boundaries', async () => {
  const srcDir = path.resolve(rootDir, 'src/verax');
  const sourceFiles = getAllJsFiles(srcDir)
    .filter(f => !f.includes('node_modules'))
    .filter(f => !f.includes('test'));
  
  const violations = [];
  
  for (const file of sourceFiles) {
    const imports = extractImports(file);
    
    for (const importStr of imports) {
      const resolved = resolveImportPath(importStr, file);
      
      if (!resolved) {
        // Skip unresolved imports (external packages, etc)
        continue;
      }
      
      const violation = checkBoundaryViolation(file, resolved);
      
      if (violation) {
        violations.push({
          file: path.relative(rootDir, file),
          import: importStr,
          issue: violation
        });
      }
    }
  }
  
  if (violations.length > 0) {
    assert.fail(`Architecture boundary violations found:\n${
      violations.map(v => `  ${v.file}: import '${v.import}'\n    → ${v.issue}`).join('\n')
    }`);
  }
});

/**
 * TEST 4: No legacy confidence engine direct imports in production code
 */
test('architecture: legacy confidence-engine not directly imported by detection code', async () => {
  const detectDir = path.resolve(rootDir, 'src/verax/detect');
  const detectFiles = getAllJsFiles(detectDir)
    .filter(f => !f.includes('node_modules'))
    .filter(f => !f.includes('test'));
  
  const legacyImports = [];
  
  for (const file of detectFiles) {
    const imports = extractImports(file);
    
    for (const imp of imports) {
      // Allow imports from core/confidence (the canonical API)
      if (imp.includes('core/confidence')) {
        continue;
      }
      
      // Block direct imports of legacy modules
      if (imp.includes('detect/confidence') || imp.includes('confidence-engine')) {
        legacyImports.push({
          file: path.relative(rootDir, file),
          import: imp
        });
      }
    }
  }
  
  if (legacyImports.length > 0) {
    assert.fail(`Illegal legacy confidence imports found:\n${
      legacyImports.map(v => `  ${v.file}: ${v.import}`).join('\n')
    }\n\nUse: import { computeConfidence } from '../core/confidence/index.js'`);
  }
});

/**
 * TEST 5: Core modules only import shared utilities
 */
test('architecture: core/ only imports from shared/; prohibits detect/observe/learn imports', async () => {
  const coreDir = path.resolve(rootDir, 'src/verax/core');
  const coreFiles = getAllJsFiles(coreDir)
    .filter(f => !f.includes('node_modules'))
    .filter(f => !f.includes('test'));
  
  const violations = [];
  
  for (const file of coreFiles) {
    const imports = extractImports(file);
    
    for (const imp of imports) {
      if (imp.startsWith('.') || imp.startsWith('/')) {
        const resolved = resolveImportPath(imp, file);
        
        if (!resolved) continue;
        
        const importedLayer = getLayerFromPath(resolved);
        
        if (importedLayer === 'detect' || importedLayer === 'observe' || importedLayer === 'learn') {
          violations.push({
            file: path.relative(rootDir, file),
            import: imp,
            layer: importedLayer
          });
        }
      }
    }
  }
  
  if (violations.length > 0) {
    assert.fail(`Core boundary violations (importing from detection/observation layers):\n${
      violations.map(v => `  ${v.file}: ${v.import} (${v.layer}/)`).join('\n')
    }`);
  }
});

/**
 * TEST 6: Canonical confidence export is properly documented
 */
test('architecture: confidence exports are documented with canonical usage instructions', async () => {
  const confidencePath = path.resolve(rootDir, 'src/verax/core/confidence/index.js');
  const content = fs.readFileSync(confidencePath, 'utf8');
  
  // Must document canonical usage
  assert.match(content, /CANONICAL.*CONFIDENCE/i, 'Canonical confidence computation is documented');
  assert.match(content, /ONLY.*function.*should.*be.*called/i, 'Export restriction is documented');
  assert.match(content, /detect\/\*.*modules.*must.*import.*from.*here/i, 'Usage instructions documented');
});

/**
 * TEST 7: Confidence imports use canonical entry point
 */
test('architecture: confidence imports use canonical entry point only', async () => {
  const srcDir = path.resolve(rootDir, 'src');
  const sourceFiles = getAllJsFiles(srcDir)
    .filter(f => !f.includes('node_modules'))
    .filter(f => !f.includes('test'));

  const allowedFiles = new Set([
    'src/verax/core/confidence/index.js',
    'src/verax/core/confidence-engine.js',
    'src/verax/core/confidence-engine.deprecated.js',
    'src/verax/core/confidence/confidence-compute.js',
    'src/verax/core/guardrails/truth-reconciliation.js'
  ]);

  const forbiddenImportPatterns = [
    { pattern: /detect\/confidence-engine/, reason: 'Use core/confidence/index.js (canonical entry)' },
    { pattern: /detect\/confidence\/index/, reason: 'Use core/confidence/index.js (canonical entry)' },
    { pattern: /core\/confidence-engine\.deprecated/, reason: 'Use core/confidence/index.js (canonical entry)' },
    { pattern: /core\/confidence-engine(\.js)?/, reason: 'Use core/confidence/index.js (canonical entry)' }
  ];

  const violations = [];

  for (const file of sourceFiles) {
    const relativeFile = path.relative(rootDir, file).replace(/\\/g, '/');
    const imports = extractImports(file).map(i => i.replace(/\\/g, '/'));

    for (const imp of imports) {
      for (const rule of forbiddenImportPatterns) {
        if (rule.pattern.test(imp) && !allowedFiles.has(relativeFile)) {
          violations.push({
            file: relativeFile,
            import: imp,
            reason: rule.reason
          });
        }
      }
    }
  }

  if (violations.length > 0) {
    assert.fail(`Canonical confidence import violations found:\n${
      violations.map(v => `  ${v.file}: import '${v.import}'\n    → ${v.reason}`).join('\n')
    }`);
  }
});

/**
 * TEST 8: Detect modules never call legacy confidence directly
 */
test('architecture: detect/ modules never directly call legacy computeConfidence', async () => {
  const detectDir = path.resolve(rootDir, 'src/verax/detect');
  const detectFiles = getAllJsFiles(detectDir)
    .filter(f => !f.includes('node_modules'))
    .filter(f => !f.includes('test'));
  
  const violations = [];
  
  for (const file of detectFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const imports = extractImports(file);
    
    // Check if file imports from legacy locations
    const importsLegacy = imports.some(imp => 
      (imp.includes('confidence-engine') && !imp.includes('core/confidence')) ||
      imp.includes('confidence-engine.deprecated') ||
      imp.includes('confidence-engine.legacy')
    );
    
    if (importsLegacy) {
      // Check if it's calling the legacy function
      if (content.match(/computeConfidenceLegacy|computeConfidenceRefactor|computeConfidence\s*\(/)) {
        violations.push({
          file: path.relative(rootDir, file),
          issue: 'Imports and calls legacy confidence function'
        });
      }
    }
  }
  
  if (violations.length > 0) {
    assert.fail(`Direct legacy confidence calls found:\n${
      violations.map(v => `  ${v.file}: ${v.issue}`).join('\n')
    }`);
  }
});

/**
 * TEST 9: Cross-layer reference violations
 */
test('architecture: no cross-layer reference violations (no learn->observe, observe->detect, etc)', async () => {
  const srcDir = path.resolve(rootDir, 'src/verax');
  const sourceFiles = getAllJsFiles(srcDir)
    .filter(f => !f.includes('node_modules'))
    .filter(f => !f.includes('test'));
  
  const violations = [];
  
  // Forbidden import patterns
  const forbiddenPatterns = [
    { pattern: /^src\/verax\/learn\//, canImport: ['shared', 'core'] },
    { pattern: /^src\/verax\/observe\//, canImport: ['shared', 'core'] },
    { pattern: /^src\/verax\/detect\//, canImport: ['shared', 'core', 'observe'] }
  ];
  
  for (const file of sourceFiles) {
    const relative = path.relative(rootDir, file);
    const imports = extractImports(file);
    
    for (const rule of forbiddenPatterns) {
      if (!rule.pattern.test(relative)) continue;
      
      for (const imp of imports) {
        const resolved = resolveImportPath(imp, file);
        if (!resolved) continue;
        
        const importedRelative = path.relative(rootDir, resolved);
        
        // Check if import is forbidden
        const allowed = rule.canImport.some(allowed => 
          importedRelative.startsWith(`src/verax/${allowed}`)
        );
        
        if (!allowed && imp.startsWith('.')) {
          const importedLayer = getLayerFromPath(resolved);
          if (importedLayer !== 'other') {
            violations.push({
              file: relative,
              import: imp,
              fromLayer: getLayerFromPath(file),
              toLayer: importedLayer
            });
          }
        }
      }
    }
  }
  
  if (violations.length > 0) {
    assert.fail(`Cross-layer import violations:\n${
      violations.map(v => `  ${v.fromLayer}/ → ${v.toLayer}/ (forbidden)\n    File: ${v.file}\n    Import: ${v.import}`).join('\n')
    }`);
  }
});
