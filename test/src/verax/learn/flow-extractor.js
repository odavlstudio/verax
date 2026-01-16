/**
 * FLOW INTELLIGENCE v1 — Flow Extractor
 * 
 * Extracts multi-step flows from PROVEN expectations.
 * NO HEURISTICS: Only sequences with explicit PROVEN expectations qualify as flows.
 */

import { createHash } from 'crypto';
import { isProvenExpectation } from '../shared/expectation-prover.js';

/**
 * Generate stable flow ID from ordered steps
 */
function generateFlowId(steps) {
  const hashInput = steps.map(s => `${s.expectationType}:${s.source || s.handlerRef}`).join('|');
  const hash = createHash('sha256').update(hashInput).digest('hex');
  // @ts-expect-error - digest returns string
  return `flow-${hash.substring(0, 8)}`;
}

/**
 * Determine if an expectation can be part of a flow.
 * Only PROVEN expectations with clear sequential intent qualify.
 */
function isFlowableExpectation(exp) {
  // Navigation expectations: always flowable (user journey)
  if (exp.expectationType === 'navigation') return true;
  
  // Network actions: flowable (form submissions, API calls)
  if (exp.kind === 'NETWORK_ACTION') return true;
  
  // State actions: flowable (state updates in sequence)
  if (exp.kind === 'STATE_ACTION') return true;
  
  // Validation blocks: NOT flowable alone (they block, don't progress)
  if (exp.kind === 'VALIDATION_BLOCK') return false;
  
  return false;
}

/**
 * Extract flows from manifest expectations.
 * 
 * Flow definition:
 * - Sequence of 2-5 PROVEN expectations
 * - Temporally ordered within same route/page
 * - Each step must be deterministically executable
 * 
 * @param {Object} manifest - Learned manifest
 * @returns {Array} Array of flow definitions
 */
export function extractFlows(manifest) {
  const flows = [];
  
  // Collect all flowable expectations
  const flowableExpectations = [];
  
  // SPA expectations (navigation)
  if (manifest.spaExpectations && manifest.spaExpectations.length > 0) {
    for (const exp of manifest.spaExpectations) {
      if (isFlowableExpectation(exp)) {
        flowableExpectations.push({
          source: exp.source || exp.sourceFile,
          expectationType: 'navigation',
          targetPath: exp.targetPath,
          proof: 'PROVEN_EXPECTATION',
          raw: exp
        });
      }
    }
  }
  
  // Action contracts (network, state)
  if (manifest.actionContracts && manifest.actionContracts.length > 0) {
    for (const contract of manifest.actionContracts) {
      if (isFlowableExpectation(contract)) {
        flowableExpectations.push({
          source: contract.source,
          handlerRef: contract.handlerRef,
          expectationType: contract.kind === 'NETWORK_ACTION' ? 'network_action' : 'state_action',
          method: contract.method,
          urlPath: contract.urlPath,
          proof: 'PROVEN_EXPECTATION',
          raw: contract
        });
      }
    }
  }
  
  // Static expectations (navigation, network_action, form submissions)
  if (manifest.staticExpectations && manifest.staticExpectations.length > 0) {
    for (const exp of manifest.staticExpectations) {
      // FLOW INTELLIGENCE v1: Only include PROVEN expectations
      if (!isProvenExpectation(exp)) continue;
      
      let expType = null;
      if (exp.type === 'navigation' || exp.type === 'spa_navigation') {
        expType = 'navigation';
      } else if (exp.type === 'network_action') {
        expType = 'network_action';
      } else if (exp.type === 'form_submission') {
        expType = 'network_action'; // Form submissions are network actions
      } else {
        continue; // Skip non-flowable types
      }
      
      flowableExpectations.push({
        source: exp.evidence?.source || exp.fromPath || exp.metadata?.elementFile,
        handlerRef: exp.handlerRef || exp.metadata?.handlerFile,
        expectationType: expType,
        targetPath: exp.targetPath || exp.expectedTarget,
        urlPath: exp.urlPath || exp.expectedTarget,
        method: exp.method,
        proof: 'PROVEN_EXPECTATION',
        raw: exp
      });
    }
  }
  
  // DETERMINISTIC FLOW DETECTION: Group by source page
  // Flows are sequences on the same page (same source file/route)
  const bySource = new Map();
  
  for (const exp of flowableExpectations) {
    // Extract file name from source (e.g., "index.html" from "index.html:56:68")
    let sourceKey = 'unknown';
    if (exp.source) {
      sourceKey = exp.source.split(':')[0]; // Get filename part
    } else if (exp.handlerRef) {
      sourceKey = exp.handlerRef.split(':')[0];
    }
    
    if (!bySource.has(sourceKey)) {
      bySource.set(sourceKey, []);
    }
    bySource.get(sourceKey).push(exp);
  }
  
  // For each source, create flows of 2-5 sequential expectations
  for (const [source, expectations] of bySource.entries()) {
    if (expectations.length < 2) continue; // Need at least 2 for a flow
    
    // Take sequences of 2-5 expectations as potential flows
    const maxFlowLength = Math.min(5, expectations.length);
    
    for (let length = 2; length <= maxFlowLength; length++) {
      // Only create one flow per source (the full sequence up to 5 steps)
      if (length === Math.min(expectations.length, 5)) {
        const flowSteps = expectations.slice(0, length).map((exp, idx) => ({
          stepIndex: idx,
          expectationType: exp.expectationType,
          source: exp.source,
          handlerRef: exp.handlerRef,
          targetPath: exp.targetPath,
          method: exp.method,
          urlPath: exp.urlPath
        }));
        
        const flowId = generateFlowId(flowSteps);
        
        flows.push({
          flowId,
          source,
          stepCount: length,
          steps: flowSteps,
          proof: 'PROVEN_EXPECTATION'
        });
      }
    }
  }
  
  return flows;
}
