/**
 * PHASE 6A: Semantic Determinism Comparison
 * 
 * Provides deep semantic comparison of runs with field normalization.
 * Ignores non-deterministic fields (timestamps, IDs, paths).
 */

import { readFileSync } from 'fs';
import { join, normalize } from 'path';
import { createHash } from 'crypto';

/**
 * Normalize non-deterministic fields for comparison
 * 
 * @param {any} obj - Object to normalize
 * @param {string} basePath - Base path for path normalization
 * @returns {any} Normalized object
 */
function normalizeObject(obj, basePath = '') {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => normalizeObject(item, basePath));
  }
  
  if (typeof obj !== 'object') {
    return obj;
  }
  
  const normalized = {};
  const sortedKeys = Object.keys(obj).sort((a, b) => a.localeCompare(b, 'en'));
  
  for (const key of sortedKeys) {
    const value = obj[key];
    
    // Skip non-deterministic fields
    if (isNonDeterministicField(key)) {
      continue;
    }
    
    // Normalize paths
    if (isPathField(key) && typeof value === 'string') {
      normalized[key] = normalizePath(value, basePath);
      continue;
    }
    
    // Recursively normalize
    normalized[key] = normalizeObject(value, basePath);
  }
  
  return normalized;
}

/**
 * Check if field name indicates non-deterministic data
 * 
 * @param {string} fieldName - Field name
 * @returns {boolean} True if non-deterministic
 */
function isNonDeterministicField(fieldName) {
  const nonDeterministicFields = [
    'timestamp',
    'createdAt',
    'updatedAt',
    'startedAt',
    'completedAt',
    'observedAt',
    'detectedAt',
    'generatedAt',
    'verifiedAt',
    'writtenAt',
    'learnedAt',
    'failedAt',
    'runId',
    'pid',
    'duration',
    'durationMs',
    'totalMs',
    'learnMs',
    'observeMs',
    'detectMs',
    'relativeTime',
    'sequence',
  ];
  
  return nonDeterministicFields.includes(fieldName) ||
         fieldName.endsWith('At') ||
         fieldName.endsWith('Time') ||
         fieldName.endsWith('Ms') ||
         fieldName.includes('timestamp') ||
         fieldName.includes('Timestamp');
}

/**
 * Check if field name indicates path data
 * 
 * @param {string} fieldName - Field name
 * @returns {boolean} True if path field
 */
function isPathField(fieldName) {
  return fieldName.endsWith('Path') ||
         fieldName.endsWith('Dir') ||
         fieldName === 'cwd' ||
         fieldName === 'src';
}

/**
 * Normalize path for comparison (make relative to base)
 * 
 * @param {string} path - Path to normalize
 * @param {string} basePath - Base path
 * @returns {string} Normalized path
 */
function normalizePath(path, basePath) {
  if (!path || !basePath) {
    return path;
  }
  
  // Normalize separators
  const normalizedPath = normalize(path).replace(/\\/g, '/');
  const normalizedBase = normalize(basePath).replace(/\\/g, '/');
  
  // Make relative if starts with base
  if (normalizedPath.startsWith(normalizedBase)) {
    return normalizedPath.substring(normalizedBase.length).replace(/^\//, '');
  }
  
  return normalizedPath;
}

/**
 * Compute semantic hash of normalized object
 * 
 * @param {Object} obj - Object to hash
 * @returns {string} Semantic hash
 */
function computeSemanticHash(obj) {
  // Use JSON.stringify with replacer that sorts all object keys recursively
  const sortedReplacer = (key, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value)
        .sort((a, b) => a.localeCompare(b, 'en'))
        .reduce((sorted, key) => {
          sorted[key] = value[key];
          return sorted;
        }, {});
    }
    return value;
  };
  
  const normalized = JSON.stringify(obj, sortedReplacer);
  // @ts-expect-error - digest returns string
  return createHash('sha256').update(normalized).digest('hex');
}

/**
 * Compare two run summaries semantically
 * 
 * @param {Object} summary1 - First run summary
 * @param {Object} summary2 - Second run summary
 * @param {string} basePath - Base path for normalization
 * @returns {{ identical: boolean, differences: Object[] }} Comparison result
 */
export function compareRunsSemantically(summary1, summary2, basePath = '') {
  const norm1 = normalizeObject(summary1, basePath);
  const norm2 = normalizeObject(summary2, basePath);
  
  const hash1 = computeSemanticHash(norm1);
  const hash2 = computeSemanticHash(norm2);
  
  if (hash1 === hash2) {
    return { identical: true, differences: [] };
  }
  
  // Find differences
  const differences = findDifferences(norm1, norm2, '');
  
  return { identical: false, differences };
}

/**
 * Find differences between two normalized objects
 * 
 * @param {any} obj1 - First object
 * @param {any} obj2 - Second object
 * @param {string} path - Current path in object tree
 * @returns {Object[]} List of differences
 */
function findDifferences(obj1, obj2, path) {
  const differences = [];
  
  if (typeof obj1 !== typeof obj2) {
    differences.push({
      path,
      type: 'type-mismatch',
      value1: typeof obj1,
      value2: typeof obj2,
    });
    return differences;
  }
  
  if (obj1 === null || obj2 === null) {
    if (obj1 !== obj2) {
      differences.push({
        path,
        type: 'null-mismatch',
        value1: obj1,
        value2: obj2,
      });
    }
    return differences;
  }
  
  if (typeof obj1 !== 'object') {
    if (obj1 !== obj2) {
      differences.push({
        path,
        type: 'value-mismatch',
        value1: obj1,
        value2: obj2,
      });
    }
    return differences;
  }
  
  if (Array.isArray(obj1) !== Array.isArray(obj2)) {
    differences.push({
      path,
      type: 'array-mismatch',
      value1: Array.isArray(obj1),
      value2: Array.isArray(obj2),
    });
    return differences;
  }
  
  if (Array.isArray(obj1)) {
    if (obj1.length !== obj2.length) {
      differences.push({
        path,
        type: 'length-mismatch',
        value1: obj1.length,
        value2: obj2.length,
      });
    }
    
    const maxLen = Math.max(obj1.length, obj2.length);
    for (let i = 0; i < maxLen; i++) {
      differences.push(...findDifferences(
        obj1[i],
        obj2[i],
        `${path}[${i}]`
      ));
    }
    
    return differences;
  }
  
  // Object comparison
  const keys1 = Object.keys(obj1).sort((a, b) => a.localeCompare(b, 'en'));
  const keys2 = Object.keys(obj2).sort((a, b) => a.localeCompare(b, 'en'));
  
  const allKeys = new Set([...keys1, ...keys2]);
  
  for (const key of allKeys) {
    const subPath = path ? `${path}.${key}` : key;
    
    if (!(key in obj1)) {
      differences.push({
        path: subPath,
        type: 'missing-in-first',
        value2: obj2[key],
      });
      continue;
    }
    
    if (!(key in obj2)) {
      differences.push({
        path: subPath,
        type: 'missing-in-second',
        value1: obj1[key],
      });
      continue;
    }
    
    differences.push(...findDifferences(obj1[key], obj2[key], subPath));
  }
  
  return differences;
}

/**
 * Load and compare two runs
 * 
 * @param {string} runDir1 - First run directory
 * @param {string} runDir2 - Second run directory
 * @param {string} basePath - Base path for normalization
 * @returns {{ ok: boolean, identical?: boolean, differences?: Object[], error?: string }} Result
 */
export function loadAndCompareRuns(runDir1, runDir2, basePath) {
  try {
    const summary1Path = join(runDir1, 'summary.json');
    const summary2Path = join(runDir2, 'summary.json');
    
    const content1 = readFileSync(summary1Path, 'utf8');
    const content2 = readFileSync(summary2Path, 'utf8');
    
  // @ts-expect-error - readFileSync with encoding returns string
    const summary1 = JSON.parse(content1);
  // @ts-expect-error - readFileSync with encoding returns string
    const summary2 = JSON.parse(content2);
    
    const comparison = compareRunsSemantically(summary1, summary2, basePath);
    
    return {
      ok: true,
      identical: comparison.identical,
      differences: comparison.differences,
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message,
    };
  }
}

/**
 * Normalize findings for semantic comparison
 * 
 * @param {Object[]} findings - Findings array
 * @returns {Object[]} Normalized findings
 */
export function normalizeFindingsForComparison(findings) {
  return findings
    .map(f => normalizeObject(f, ''))
    .sort((a, b) => {
      // Sort by expectationId for stable comparison
      const idA = a.expectationId || '';
      const idB = b.expectationId || '';
      return idA.localeCompare(idB);
    });
}



