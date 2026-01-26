/**
 * Output Normalization for Determinism Contract
 * 
 * Ensures all decision-relevant artifacts are byte-for-byte identical
 * across repeated runs with the same input.
 * 
 * Normalizations:
 * - Remove all timestamps (scannedAt, detectedAt, timestamp, createdAt)
 * - Quantize elapsed time to deterministic buckets (<1s, <5s, etc.)
 * - Round floating-point confidence values to fixed precision
 * - Deterministically order all object keys
 * - Sort arrays that don't represent user interaction order
 */

/**
 * Quantize elapsed milliseconds to deterministic buckets
 * @param {number} ms - Elapsed milliseconds
 * @returns {string} Quantized bucket label
 */
export function quantizeElapsedMs(ms) {
  if (typeof ms !== 'number' || ms < 0) return 'unknown';
  if (ms < 1000) return '<1s';
  if (ms < 5000) return '<5s';
  if (ms < 10000) return '<10s';
  if (ms < 30000) return '<30s';
  if (ms < 60000) return '<1min';
  if (ms < 300000) return '<5min';
  return '≥5min';
}

/**
 * Round confidence score to fixed precision (3 decimal places)
 * @param {number} score - Confidence score (0-1 or 0-100)
 * @returns {number} Rounded score
 */
export function roundConfidence(score) {
  if (typeof score !== 'number' || isNaN(score)) return 0;
  // Normalize to 0-1 range if appears to be percentage
  const normalized = score > 1 ? score / 100 : score;
  return Math.round(normalized * 1000) / 1000;
}

/**
 * Recursively sort object keys for deterministic output
 * @param {any} obj - Object to normalize
 * @returns {any} Object with sorted keys
 */
export function normalizeKeyOrdering(obj) {
  // Handle null/undefined
  if (obj === null || obj === undefined) return obj;
  
  // Handle primitives
  if (typeof obj !== 'object') return obj;
  
  // Handle arrays - recurse into elements but preserve order
  if (Array.isArray(obj)) {
    return obj.map(item => normalizeKeyOrdering(item));
  }
  
  // Handle objects - sort keys and recurse
  const sorted = {};
  const keys = Object.keys(obj).sort();
  for (const key of keys) {
    sorted[key] = normalizeKeyOrdering(obj[key]);
  }
  return sorted;
}

/**
 * Remove all timestamp fields from an object
 * @param {any} obj - Object to clean
 * @returns {any} Object without timestamp fields
 */
export function removeTimestamps(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => removeTimestamps(item));
  }
  
  // Handle objects
  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    // Skip timestamp fields
    if ([
      'timestamp',
      'observedAt',
      'scannedAt',
      'detectedAt',
      'createdAt',
      'updatedAt',
      'scanTime',
      'scanDate'
    ].includes(key)) {
      continue;
    }
    
    cleaned[key] = removeTimestamps(value);
  }
  return cleaned;
}

/**
 * Normalize elapsed time fields in metrics
 * @param {any} obj - Object with potential elapsed time fields
 * @returns {any} Object with quantized elapsed time
 */
export function normalizeElapsedTime(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => normalizeElapsedTime(item));
  }
  
  // Handle objects
  const normalized = {};
  for (const [key, value] of Object.entries(obj)) {
    // Quantize elapsed time fields
    if (key.endsWith('Ms') || key.endsWith('Duration') || key === 'elapsedMs' || key === 'elapsed') {
      if (typeof value === 'number') {
        normalized[key] = quantizeElapsedMs(value);
        continue;
      }
    }
    
    normalized[key] = normalizeElapsedTime(value);
  }
  return normalized;
}

/**
 * Normalize confidence values to fixed precision
 * @param {any} obj - Object with potential confidence fields
 * @returns {any} Object with rounded confidence values
 */
export function normalizeConfidence(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => normalizeConfidence(item));
  }
  
  // Handle objects
  const normalized = {};
  for (const [key, value] of Object.entries(obj)) {
    // Round confidence fields
    if (key.includes('confidence') || key.includes('score')) {
      if (typeof value === 'number') {
        normalized[key] = roundConfidence(value);
        continue;
      }
      
      // Handle nested confidence objects
      if (typeof value === 'object' && value !== null) {
        normalized[key] = normalizeConfidence(value);
        continue;
      }
    }
    
    normalized[key] = normalizeConfidence(value);
  }
  return normalized;
}

/**
 * Sort findings array deterministically
 * Preserves order only if findings represent interaction order (preserved by trace source)
 * @param {Array} findings - Array of finding objects
 * @returns {Array} Sorted findings
 */
export function sortFindingsDeterministically(findings) {
  if (!Array.isArray(findings)) return findings;
  
  return [...findings].sort((a, b) => {
    // Sort by: source file:line:col → type → severity → id
    const aSource = a.interaction?.sourceRef || `${a.source?.file || ''}:${a.source?.line || 0}:${a.source?.col || 0}`;
    const bSource = b.interaction?.sourceRef || `${b.source?.file || ''}:${b.source?.line || 0}:${b.source?.col || 0}`;
    
    if (aSource !== bSource) return aSource.localeCompare(bSource);
    
    const aType = a.type || '';
    const bType = b.type || '';
    if (aType !== bType) return aType.localeCompare(bType);
    
    const aSeverity = a.severity || '';
    const bSeverity = b.severity || '';
    if (aSeverity !== bSeverity) return aSeverity.localeCompare(bSeverity);
    
    const aId = a.id || '';
    const bId = b.id || '';
    return aId.localeCompare(bId);
  });
}

/**
 * Normalize a findings artifact for determinism
 * @param {Object} findingsObj - Findings artifact
 * @returns {Object} Normalized findings artifact
 */
export function normalizeFindings(findingsObj) {
  if (!findingsObj) return findingsObj;
  
  // Remove timestamps
  let normalized = removeTimestamps(findingsObj);
  
  // Normalize confidence in findings
  normalized = normalizeConfidence(normalized);
  
  // Sort findings array
  if (normalized.findings && Array.isArray(normalized.findings)) {
    normalized.findings = sortFindingsDeterministically(normalized.findings);
  }
  
  // Sort key order
  normalized = normalizeKeyOrdering(normalized);
  
  return normalized;
}

/**
 * Normalize a summary artifact for determinism
 * @param {Object} summaryObj - Summary artifact
 * @returns {Object} Normalized summary artifact
 */
export function normalizeSummary(summaryObj) {
  if (!summaryObj) return summaryObj;
  
  // Remove timestamps
  let normalized = removeTimestamps(summaryObj);
  
  // Normalize elapsed time in metrics
  normalized = normalizeElapsedTime(normalized);
  
  // Normalize confidence scores
  normalized = normalizeConfidence(normalized);
  
  // Sort key order
  normalized = normalizeKeyOrdering(normalized);
  
  return normalized;
}

/**
 * Normalize a coverage artifact for determinism
 * @param {Object} coverageObj - Coverage artifact
 * @returns {Object} Normalized coverage artifact
 */
export function normalizeCoverage(coverageObj) {
  if (!coverageObj) return coverageObj;
  
  // Remove timestamps
  let normalized = removeTimestamps(coverageObj);
  
  // Normalize elapsed time
  normalized = normalizeElapsedTime(normalized);
  
  // Normalize confidence
  normalized = normalizeConfidence(normalized);
  
  // Sort key order
  normalized = normalizeKeyOrdering(normalized);
  
  return normalized;
}

/**
 * Normalize a judgment artifact for determinism
 * @param {Object} judgmentObj - Judgment artifact
 * @returns {Object} Normalized judgment artifact
 */
export function normalizeJudgment(judgmentObj) {
  if (!judgmentObj) return judgmentObj;
  
  // Remove timestamps
  let normalized = removeTimestamps(judgmentObj);
  
  // Normalize confidence
  normalized = normalizeConfidence(normalized);
  
  // Sort evidence references if present
  if (normalized.evidenceRefs && Array.isArray(normalized.evidenceRefs)) {
    normalized.evidenceRefs = [...normalized.evidenceRefs].sort();
  }
  
  // Sort key order
  normalized = normalizeKeyOrdering(normalized);
  
  return normalized;
}

/**
 * Normalize array of judgments for determinism
 * @param {Array} judgments - Array of judgment objects
 * @returns {Array} Normalized judgments
 */
export function normalizeJudgments(judgments) {
  if (!Array.isArray(judgments)) return judgments;
  
  // Sort by deterministic key (promiseId, judgment type, etc.)
  const sorted = [...judgments].sort((a, b) => {
    const aPromiseId = a.promiseId || '';
    const bPromiseId = b.promiseId || '';
    if (aPromiseId !== bPromiseId) return aPromiseId.localeCompare(bPromiseId);
    
    const aJudgment = a.judgment || '';
    const bJudgment = b.judgment || '';
    if (aJudgment !== bJudgment) return aJudgment.localeCompare(bJudgment);
    
    const aId = a.id || '';
    const bId = b.id || '';
    return aId.localeCompare(bId);
  });
  
  // Normalize each judgment
  return sorted.map(normalizeJudgment);
}

/**
 * Master normalization function for any artifact
 * @param {Object} artifact - Artifact to normalize
 * @param {string} type - Artifact type (findings, summary, coverage, judgment, etc.)
 * @returns {Object} Normalized artifact
 */
export function normalizeArtifact(artifact, type) {
  if (!artifact) return artifact;
  
  switch (type) {
    case 'findings':
      return normalizeFindings(artifact);
    case 'summary':
      return normalizeSummary(artifact);
    case 'coverage':
      return normalizeCoverage(artifact);
    case 'judgment':
      return normalizeJudgment(artifact);
    case 'judgments':
      return normalizeJudgments(artifact);
    default: {
      // Generic normalization
      let normalized = removeTimestamps(artifact);
      normalized = normalizeElapsedTime(normalized);
      normalized = normalizeConfidence(normalized);
      normalized = normalizeKeyOrdering(normalized);
      return normalized;
    }
  }
}
