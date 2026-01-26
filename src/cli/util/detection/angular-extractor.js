// 🧪 EXPERIMENTAL — Behavior not guaranteed in VERAX v1
// Angular extraction partially implemented, observation support incomplete.

/**
 * Angular Framework-Specific Expectation Extractor
 * PHASE 3: Production-grade literal-only extraction with deterministic IDs
 * 
 * Supported patterns (literal-only):
 * - [routerLink]="'/path'" or routerLink="/path"
 * - [routerLink]="['/a', 'b']" with all segments as literals → '/a/b'
 * - router.navigateByUrl('/path')
 * - router.navigate(['/a', 'b']) with all segments as literals → '/a/b'
 * - <form action="/path">
 * 
 * Explicit skip policy:
 * - Dynamic: variables, function calls, ternaries, template strings
 * - Params: routes containing ':', '/:id', or bracket patterns
 * - Computed: any non-literal segment
 */

import { expIdFromHash } from '../support/idgen.js';

/**
 * Extract expectations from Angular files
 * @param {string} content - Angular file content
 * @param {string} filePath - File path for location tracking
 * @param {string} relPath - Relative path for reporting
 * @returns {Object} { expectations: Array, skipped: Object }
 */
export function extractAngularExpectations(content, filePath, relPath) {
  const expectations = [];
  const skipped = {
    dynamic: 0,
    computed: 0,
    params: 0,
  };
  
  // Extract [routerLink]="'/path'" or routerLink="/path" - static only
  const routerLinkBindingRegex = /\[routerLink\]=['""]([^'""]+)['""]|routerLink=['""]([^'""]+)['"]/gi;
  let match;
  
  while ((match = routerLinkBindingRegex.exec(content)) !== null) {
    const rawPath = match[1] || match[2];
    
    // Check for dynamic patterns (variables, template strings, function calls)
    if (rawPath.includes('$') || rawPath.includes('{') || rawPath.includes('(')) {
      skipped.dynamic++;
      continue;
    }
    
    // Check for computed segments (brackets indicate array binding but we need to parse)
    if (rawPath.includes('[')) {
      skipped.computed++;
      continue;
    }
    
    // Check for param segments like '/:id' or ':id'
    if (rawPath.includes('/:') || (rawPath.includes(':') && !rawPath.startsWith('http'))) {
      skipped.params++;
      continue;
    }
    
    const lineNum = content.substring(0, match.index).split('\n').length;
    const colNum = match.index - content.lastIndexOf('\n', match.index - 1);
    
    // Strip quotes if present
    const path = rawPath.replace(/^['"]|['"]$/g, '');
    
    // Only extract static paths starting with / or http
    if (path.startsWith('/') || path.startsWith('http')) {
      const expId = expIdFromHash(relPath, lineNum, colNum, 'navigation', path);
      expectations.push({
        id: expId,
        kind: 'navigation',
        value: path,
        confidence: 0.95,
        source: {
          file: relPath,
          filePath,
          line: lineNum,
          column: colNum,
          pattern: '[routerLink]',
        },
        promise: {
          kind: 'navigation',
          value: path,
          description: `Angular routerLink navigation to ${path}`,
        },
        type: 'navigation',
        category: 'navigation',
      });
    }
  }
  
  // Extract [routerLink]="['/a', 'b']" with all segments as string literals
  const routerLinkArrayRegex = /\[routerLink\]=['""]?\[([^\]]+)\]['""]?/gi;
  
  while ((match = routerLinkArrayRegex.exec(content)) !== null) {
    const arrayContent = match[1];
    
    // Check for dynamic patterns
    if (arrayContent.includes('$') || arrayContent.includes('{') || arrayContent.includes('(')) {
      skipped.dynamic++;
      continue;
    }
    
    // Extract string literals from array
    const segments = arrayContent.split(',').map(s => {
      const trimmed = s.trim();
      // Match string literals only
      const literalMatch = trimmed.match(/^['"]([^'"]+)['"]$/);
      return literalMatch ? literalMatch[1] : null;
    });
    
    // If any segment is not a literal, skip
    if (segments.some(s => s === null)) {
      skipped.computed++;
      continue;
    }
    
    // Join segments into path
    const path = segments.join('/');
    
    // Check for params
    if (path.includes('/:') || (path.includes(':') && !path.startsWith('http'))) {
      skipped.params++;
      continue;
    }
    
    const lineNum = content.substring(0, match.index).split('\n').length;
    const colNum = match.index - content.lastIndexOf('\n', match.index - 1);
    
    if (path.startsWith('/') || path.startsWith('http')) {
      const expId = expIdFromHash(relPath, lineNum, colNum, 'navigation', path);
      expectations.push({
        id: expId,
        kind: 'navigation',
        value: path,
        confidence: 0.95,
        source: {
          file: relPath,
          filePath,
          line: lineNum,
          column: colNum,
          pattern: '[routerLink] array',
        },
        promise: {
          kind: 'navigation',
          value: path,
          description: `Angular routerLink array navigation to ${path}`,
        },
        type: 'navigation',
        category: 'navigation',
      });
    }
  }
  
  // Extract router.navigateByUrl('/path') - static only
  const navigateByUrlRegex = /\.navigateByUrl\(["']([^"']+)["']\)/gi;
  
  while ((match = navigateByUrlRegex.exec(content)) !== null) {
    const path = match[1];
    
    // Check for dynamic patterns
    if (path.includes('$') || path.includes('{') || path.includes('(')) {
      skipped.dynamic++;
      continue;
    }
    
    // Check for params
    if (path.includes('/:') || (path.includes(':') && !path.startsWith('http'))) {
      skipped.params++;
      continue;
    }
    
    const lineNum = content.substring(0, match.index).split('\n').length;
    const colNum = match.index - content.lastIndexOf('\n', match.index - 1);
    
    if (path.startsWith('/') || path.startsWith('http')) {
      const expId = expIdFromHash(relPath, lineNum, colNum, 'navigation', path);
      expectations.push({
        id: expId,
        kind: 'navigation',
        value: path,
        confidence: 0.90,
        source: {
          file: relPath,
          filePath,
          line: lineNum,
          column: colNum,
          pattern: 'router.navigateByUrl',
        },
        promise: {
          kind: 'navigation',
          value: path,
          description: `Angular navigateByUrl to ${path}`,
        },
        type: 'navigation',
        category: 'navigation',
      });
    }
  }
  
  // Extract router.navigate(['/a', 'b']) with all segments as string literals
  const navigateArrayRegex = /\.navigate\(\s*\[([^\]]+)\]/gi;
  
  while ((match = navigateArrayRegex.exec(content)) !== null) {
    const arrayContent = match[1];
    
    // Check for dynamic patterns
    if (arrayContent.includes('$') || arrayContent.includes('{') || arrayContent.includes('(')) {
      skipped.dynamic++;
      continue;
    }
    
    // Extract string literals from array
    const segments = arrayContent.split(',').map(s => {
      const trimmed = s.trim();
      // Match string literals only
      const literalMatch = trimmed.match(/^['"]([^'"]+)['"]$/);
      return literalMatch ? literalMatch[1] : null;
    });
    
    // If any segment is not a literal, skip
    if (segments.some(s => s === null)) {
      skipped.computed++;
      continue;
    }
    
    // Join segments into path
    const path = segments.join('/');
    
    // Check for params
    if (path.includes('/:') || (path.includes(':') && !path.startsWith('http'))) {
      skipped.params++;
      continue;
    }
    
    const lineNum = content.substring(0, match.index).split('\n').length;
    const colNum = match.index - content.lastIndexOf('\n', match.index - 1);
    
    if (path.startsWith('/') || path.startsWith('http')) {
      const expId = expIdFromHash(relPath, lineNum, colNum, 'navigation', path);
      expectations.push({
        id: expId,
        kind: 'navigation',
        value: path,
        confidence: 0.85,
        source: {
          file: relPath,
          filePath,
          line: lineNum,
          column: colNum,
          pattern: 'router.navigate',
        },
        promise: {
          kind: 'navigation',
          value: path,
          description: `Angular navigate to ${path}`,
        },
        type: 'navigation',
        category: 'navigation',
      });
    }
  }
  
  // Extract <form action="/path"> - static only
  const formActionRegex = /<form\s+[^>]*action=["']([^"']+)["']/gi;
  
  while ((match = formActionRegex.exec(content)) !== null) {
    const path = match[1];
    
    // Check for dynamic patterns
    if (path.includes('$') || path.includes('{') || path.includes('(')) {
      skipped.dynamic++;
      continue;
    }
    
    // Check for params
    if (path.includes('/:') || (path.includes(':') && !path.startsWith('http'))) {
      skipped.params++;
      continue;
    }
    
    const lineNum = content.substring(0, match.index).split('\n').length;
    const colNum = match.index - content.lastIndexOf('\n', match.index - 1);
    
    if (path.startsWith('/') || path.startsWith('http')) {
      const expId = expIdFromHash(relPath, lineNum, colNum, 'form-submission', path);
      expectations.push({
        id: expId,
        kind: 'form-submission',
        value: path,
        confidence: 0.85,
        source: {
          file: relPath,
          filePath,
          line: lineNum,
          column: colNum,
          pattern: '<form action>',
        },
        promise: {
          kind: 'form-submission',
          value: path,
          description: `Angular form submission to ${path}`,
        },
        type: 'form-submission',
        category: 'form-submission',
      });
    }
  }
  
  return { expectations, skipped };
}
