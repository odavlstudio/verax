import { resolve } from 'path';
import { atomicWriteJson } from '../support/atomic-write.js';
import { compareExpectations } from '../support/idgen.js';
import { ARTIFACT_REGISTRY } from '../../../verax/core/artifacts/registry.js';
import { isDeterministicOutputMode, normalizeDeterministicArtifact } from '../support/deterministic-output.js';

/**
 * Write learn.json artifact
 * Maintains deterministic ordering for stable output
 */
export function writeLearnJson(runPaths, expectations, skipped) {
  const learnJsonPath = resolve(runPaths.baseDir, 'learn.json');
  
  // Sort expectations deterministically for stable output
  const sortedExpectations = [...expectations].sort(compareExpectations);
  
  // Determine extraction version (if any expectation has extractionVersion)
  const hasV2Extraction = sortedExpectations.some(e => e.extractionVersion === '2.0');
  
  const learnJson = {
    contractVersion: ARTIFACT_REGISTRY.learn.contractVersion,
    expectations: sortedExpectations,
    stats: {
      extractionVersion: hasV2Extraction ? '2.0' : '1.0',
      totalExpectations: sortedExpectations.length,
      byType: {
        navigation: sortedExpectations.filter(e => e.type === 'navigation').length,
        network: sortedExpectations.filter(e => e.type === 'network').length,
        state: sortedExpectations.filter(e => e.type === 'state').length,
        feedback: sortedExpectations.filter(e => e.type === 'feedback').length,
      },
    },
    skipped: {
      // Legacy skip reasons
      dynamic: skipped.dynamic || 0,
      computed: skipped.computed || 0,
      external: skipped.external || 0,
      parseError: skipped.parseError || 0,
      other: skipped.other || 0,
      
      // Promise Extraction 2.0 skip reasons
      dynamic_identifier: skipped.dynamic_identifier || 0,
      dynamic_template_expr: skipped.dynamic_template_expr || 0,
      dynamic_call: skipped.dynamic_call || 0,
      dynamic_array: skipped.dynamic_array || 0,
      dynamic_member: skipped.dynamic_member || 0,
      dynamic_conditional: skipped.dynamic_conditional || 0,
      dynamic_concat: skipped.dynamic_concat || 0,
      dynamic_logical: skipped.dynamic_logical || 0,
      dynamic_baseurl: skipped.dynamic_baseurl || 0,
      dynamic_other: skipped.dynamic_other || 0,
      max_depth_exceeded: skipped.max_depth_exceeded || 0,
      max_attempts_exceeded: skipped.max_attempts_exceeded || 0,
      no_matching_import: skipped.no_matching_import || 0,
      unknown_node_type: skipped.unknown_node_type || 0,
      parse_error: skipped.parse_error || 0,
      
      total: Object.values(skipped).reduce((a, b) => a + b, 0),
    },
  };
  
  const normalized = normalizeDeterministicArtifact('learn', learnJson);
  atomicWriteJson(learnJsonPath, normalized, { deterministic: isDeterministicOutputMode() });
  
  return learnJsonPath;
}



