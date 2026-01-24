import crypto from 'crypto';

/**
 * Deterministic ID Generation (Phase 8.3)
 * Generate stable, hash-based IDs independent of discovery order.
 */

/**
 * Generate deterministic expectation ID from stable attributes
 * ID format: exp_<6-character-hex-hash>
 * Input order-independent: hash only depends on content, not discovery order
 * 
 * @param {string} file - Source file path (relative)
 * @param {number} line - Line number
 * @param {number} column - Column number
 * @param {string} kind - Promise kind (e.g., 'navigate', 'click')
 * @param {string} value - Promise value (e.g., '/products', 'button.id')
 * @returns {string} Deterministic ID like 'exp_a1b2c3'
 */
export function expIdFromHash(file, line, column, kind, value) {
  // Create stable hash input: normalize file path and combine all attributes
  const normalizedFile = (file || '')
    .replace(/\\/g, '/') // Convert Windows backslashes to forward slashes
    .toLowerCase();
  
  const hashInput = JSON.stringify({
    file: normalizedFile,
    line: Number(line) || 0,
    column: Number(column) || 0,
    kind: String(kind || '').toLowerCase(),
    value: String(value || ''),
  });
  
  // Generate deterministic hash
  const hash = crypto.createHash('sha256').update(hashInput).digest('hex');
  
  // Use first 6 characters for brevity while maintaining low collision risk
  const hashSuffix = String(hash).substring(0, 6);
  
  return `exp_${hashSuffix}`;
}

/**
 * Generate deterministic finding ID from expectation ID
 * ID format: finding_<expectationId>
 * 
 * @param {string} expectationId - The parent expectation ID
 * @returns {string} Finding ID like 'finding_exp_a1b2c3'
 */
export function findingIdFromExpectationId(expectationId) {
  return `finding_${expectationId}`;
}

/**
 * Comparator for stable expectation ordering
 * Sort by: file, line, column, kind, value
 * Returns comparable value suitable for .sort()
 */
export function compareExpectations(a, b) {
  const aFile = (a.source?.file || '').toLowerCase();
  const bFile = (b.source?.file || '').toLowerCase();
  if (aFile !== bFile) {
    return aFile.localeCompare(bFile);
  }
  
  const aLine = a.source?.line || 0;
  const bLine = b.source?.line || 0;
  if (aLine !== bLine) {
    return aLine - bLine;
  }
  
  const aCol = a.source?.column || 0;
  const bCol = b.source?.column || 0;
  if (aCol !== bCol) {
    return aCol - bCol;
  }
  
  const aKind = (a.promise?.kind || '').toLowerCase();
  const bKind = (b.promise?.kind || '').toLowerCase();
  if (aKind !== bKind) {
    return aKind.localeCompare(bKind);
  }
  
  const aValue = String(a.promise?.value || '').toLowerCase();
  const bValue = String(b.promise?.value || '').toLowerCase();
  return aValue.localeCompare(bValue);
}



