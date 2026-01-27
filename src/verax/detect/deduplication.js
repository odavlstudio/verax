/**
 * Phase 6: Finding Deduplication
 * 
 * Prevents flooding from repeated failures at same location.
 * Merge findings that share:
 * - same type
 * - same sourceRef (file:line:col)
 * - same promise.kind and promise.value
 * 
 * Keep highest severity and confidence.
 * Merge evidence deterministically.
 * 
 * No guessing. Pure data transformation.
 */

const SEVERITY_ORDER = { HIGH: 3, MEDIUM: 2, LOW: 1 };

/**
 * Generate deduplication key for a finding
 * @param {Object} finding 
 * @returns {string}
 */
export function getDeduplicationKey(finding) {
  const type = finding.type || 'unknown';
  const sourceRef = finding.evidence?.sourceRef || 'no-source';
  const promiseKind = finding.promise?.kind || 'unknown';
  const promiseValue = finding.promise?.value || 'unknown';  // Only dedupe when we have actual source location
  if (!finding.evidence?.sourceRef) {
    const findingId = finding.id || 'no-id';
    return `${type}|no-source|${promiseKind}|${promiseValue}|${findingId}`;
  }
  
  return `${type}|${sourceRef}|${promiseKind}|${promiseValue}`;
}

/**
 * Compare severity levels
 * @param {string} a 
 * @param {string} b 
 * @returns {number} - 1 if a > b, -1 if a < b, 0 if equal
 */
function compareSeverity(a, b) {
  const aOrder = SEVERITY_ORDER[a] || 0;
  const bOrder = SEVERITY_ORDER[b] || 0;
  return aOrder - bOrder;
}

/**
 * Merge evidence from multiple findings
 * Keep all unique evidence references, sorted deterministically
 * @param {Array<Object>} findings 
 * @returns {Object}
 */
function mergeEvidence(findings) {
  const merged = {};
  const evidenceFields = new Set();
  
  // Collect all evidence fields
  for (const finding of findings) {
    if (finding.evidence && typeof finding.evidence === 'object') {
      for (const key of Object.keys(finding.evidence)) {
        evidenceFields.add(key);
      }
    }
  }
  
  // Merge each field
  for (const field of evidenceFields) {
    const values = [];
    for (const finding of findings) {
      if (finding.evidence && finding.evidence[field] !== undefined) {
        values.push(finding.evidence[field]);
      }
    }
    
    // Deduplicate arrays
    if (Array.isArray(values[0])) {
      const uniqueValues = new Set();
      for (const arr of values) {
        if (Array.isArray(arr)) {
          for (const item of arr) {
            uniqueValues.add(typeof item === 'string' ? item : JSON.stringify(item));
          }
        }
      }
      merged[field] = Array.from(uniqueValues)
        .map(v => {
          try {
            return JSON.parse(v);
          } catch {
            return v;
          }
        })
        .sort((a, b) => String(a).localeCompare(String(b)));
    } else {
      // Take first non-null value
      merged[field] = values.find(v => v !== null && v !== undefined);
    }
  }
  
  return merged;
}

/**
 * Deduplicate findings array
 * @param {Array<Object>} findings 
 * @returns {{findings: Array<Object>, deduplicatedCount: number}}
 */
export function deduplicateFindings(findings) {
  if (!findings || findings.length === 0) {
    return { findings: [], deduplicatedCount: 0 };
  }
  
  const groups = new Map();
  
  // Group by deduplication key
  for (const finding of findings) {
    const key = getDeduplicationKey(finding);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(finding);
  }
  
  const deduplicated = [];
  let deduplicatedCount = 0;
  
  // Process each group
  for (const [_key, group] of groups) {
    if (group.length === 1) {
      deduplicated.push(group[0]);
      continue;
    }
    
    // Multiple findings with same key - merge them
    deduplicatedCount += group.length - 1;
    
    // Find highest severity
    let highest = group[0];
    for (const finding of group) {
      const severityComp = compareSeverity(
        finding.severity || 'LOW',
        highest.severity || 'LOW'
      );
      if (severityComp > 0) {
        highest = finding;
      } else if (severityComp === 0) {
        // Same severity, pick highest confidence
        const findingConf = finding.confidence?.score || 0;
        const highestConf = highest.confidence?.score || 0;
        if (findingConf > highestConf) {
          highest = finding;
        }
      }
    }
    
    // Merge evidence from all findings in group
    const mergedEvidence = mergeEvidence(group);
    
    deduplicated.push({
      ...highest,
      evidence: mergedEvidence,
      // Preserve original ID from highest severity/confidence finding
    });
  }
  
  return {
    findings: deduplicated,
    deduplicatedCount,
  };
}
