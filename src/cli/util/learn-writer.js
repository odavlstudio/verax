import { resolve } from 'path';
import { atomicWriteJson } from './atomic-write.js';
import { compareExpectations } from './idgen.js';

/**
 * Write learn.json artifact
 * Maintains deterministic ordering for stable output
 */
export function writeLearnJson(runPaths, expectations, skipped) {
  const learnJsonPath = resolve(runPaths.baseDir, 'learn.json');
  
  // Sort expectations deterministically for stable output
  const sortedExpectations = [...expectations].sort(compareExpectations);
  
  const learnJson = {
    expectations: sortedExpectations,
    stats: {
      totalExpectations: sortedExpectations.length,
      byType: {
        navigation: sortedExpectations.filter(e => e.type === 'navigation').length,
        network: sortedExpectations.filter(e => e.type === 'network').length,
        state: sortedExpectations.filter(e => e.type === 'state').length,
      },
    },
    skipped: {
      dynamic: skipped.dynamic,
      computed: skipped.computed,
      external: skipped.external,
      parseError: skipped.parseError,
      other: skipped.other,
      total: Object.values(skipped).reduce((a, b) => a + b, 0),
    },
    learnedAt: new Date().toISOString(),
  };
  
  atomicWriteJson(learnJsonPath, learnJson);
  
  return learnJsonPath;
}
