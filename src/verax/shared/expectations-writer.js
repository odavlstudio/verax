/**
 * Wave 2 — Expectations Writer
 * 
 * Writes expectations.json artifact with full explainability.
 */

import { writeFileSync } from 'fs';

/**
 * Write expectations.json artifact
 * @param {Object} paths - Artifact paths
 * @param {Array} expectations - Tracked expectations
 */
export function writeExpectations(paths, expectations) {
  // Count by type
  const byType = {
    navigation: 0,
    network_action: 0,
    state_action: 0
  };
  
  let skipped = 0;
  
  const expectationsList = expectations.map(exp => {
    byType[exp.type] = (byType[exp.type] || 0) + 1;
    
    if (!exp.used) {
      skipped++;
    }
    
    return {
      id: exp.id,
      type: exp.type,
      proof: exp.proof,
      reason: exp.reason,
      source: {
        file: exp.source.file,
        line: exp.source.line,
        column: exp.source.column
      },
      used: exp.used,
      usedReason: exp.usedReason || null
    };
  });
  
  const data = {
    summary: {
      total: expectations.length,
      byType: byType,
      skipped: skipped
    },
    expectations: expectationsList
  };
  
  const expectationsPath = paths.expectations || paths.summary.replace('summary.json', 'expectations.json');
  writeFileSync(expectationsPath, JSON.stringify(data, null, 2) + '\n');
  
  return expectationsPath;
}

