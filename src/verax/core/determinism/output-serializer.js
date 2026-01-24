/**
 * Determinism Output Helper
 * 
 * Ensures all JSON output is deterministically serialized:
 * - Object keys are alphabetically sorted
 * - Arrays are sorted by stable key when applicable
 * - No insertion-order dependencies
 * 
 * Used by artifact writers to guarantee reproducible output.
 */

/**
 * Sort object keys recursively and return a new object
 * Ensures deterministic JSON serialization
 * 
 * @param {Object} obj - Object to sort keys for
 * @returns {Object} New object with sorted keys
 */
export function sortObjectKeys(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sortObjectKeys(item));
  }
  
  if (typeof obj !== 'object') {
    return obj;
  }
  
  const sorted = {};
  const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b, 'en'));
  
  for (const key of keys) {
    sorted[key] = sortObjectKeys(obj[key]);
  }
  
  return sorted;
}

/**
 * Sort array of objects by a stable key field
 * Used for findings, expectations, signals arrays
 * 
 * @param {Array} arr - Array to sort
 * @param {string} keyField - Field name to sort by (default: 'id' or 'key')
 * @returns {Array} Sorted array
 */
export function sortArrayByKey(arr, keyField = null) {
  if (!Array.isArray(arr)) {
    return arr;
  }
  
  if (arr.length === 0) {
    return arr;
  }
  
  // Detect stable key field if not provided
  let sortKey = keyField;
  if (!sortKey) {
    const firstItem = arr[0];
    if (typeof firstItem === 'object' && firstItem !== null) {
      if ('id' in firstItem) sortKey = 'id';
      else if ('key' in firstItem) sortKey = 'key';
      else if ('message' in firstItem) sortKey = 'message';
    }
  }
  
  if (!sortKey) {
    // If no stable key, sort objects by string representation
    return arr.slice().sort((a, b) => {
      const aStr = JSON.stringify(a);
      const bStr = JSON.stringify(b);
      return aStr.localeCompare(bStr);
    });
  }
  
  // Sort by the identified key field
  return arr.slice().sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return aVal.localeCompare(bVal);
    }
    
    return String(aVal).localeCompare(String(bVal));
  });
}

/**
 * Make a finding array deterministically sorted
 * 
 * @param {Array} findings - Findings array
 * @returns {Array} Sorted findings
 */
export function sortFindingsArray(findings) {
  if (!Array.isArray(findings)) {
    return findings;
  }
  return sortArrayByKey(findings, 'id');
}

/**
 * Make an expectations array deterministically sorted
 * 
 * @param {Array} expectations - Expectations array
 * @returns {Array} Sorted expectations
 */
export function sortExpectationsArray(expectations) {
  if (!Array.isArray(expectations)) {
    return expectations;
  }
  return sortArrayByKey(expectations, 'id');
}

/**
 * Serialize object to deterministic JSON
 * - Sorts all object keys
 * - Sorts arrays when appropriate
 * - Maintains readability with indentation
 * 
 * @param {Object} obj - Object to serialize
 * @param {Object} options - Serialization options
 * @returns {string} JSON string
 */
export function serializeDeterministic(obj, options = {}) {
  const { indent = 2, sortArrays = true } = options;
  
  let toSerialize = obj;
  
  // Sort all object keys
  toSerialize = sortObjectKeys(toSerialize);
  
  // Optionally sort arrays
  if (sortArrays && typeof toSerialize === 'object' && toSerialize !== null) {
    toSerialize = applyArraySorting(toSerialize);
  }
  
  return JSON.stringify(toSerialize, null, indent) + '\n';
}

/**
 * Apply array sorting to specific artifact arrays
 * 
 * @param {Object} obj - Object containing arrays
 * @returns {Object} Object with sorted arrays
 */
function applyArraySorting(obj) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  
  const result = Array.isArray(obj) ? [...obj] : { ...obj };
  
  for (const key in result) {
    if (Array.isArray(result[key])) {
      // Known array fields that should be sorted
      if (['findings', 'expectations', 'signals', 'traces', 'evidence', 'events'].includes(key)) {
        result[key] = sortArrayByKey(result[key]);
      } else if (key.includes('List') || key.includes('Array')) {
        result[key] = sortArrayByKey(result[key]);
      } else {
        // Recursively process nested objects
        result[key] = result[key].map(item => 
          typeof item === 'object' && item !== null ? applyArraySorting(item) : item
        );
      }
    } else if (typeof result[key] === 'object') {
      result[key] = applyArraySorting(result[key]);
    }
  }
  
  return result;
}

export default {
  sortObjectKeys,
  sortArrayByKey,
  sortFindingsArray,
  sortExpectationsArray,
  serializeDeterministic
};
