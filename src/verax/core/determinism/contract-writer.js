/**
 * PHASE 25 — Determinism Contract Writer
 * 
 * Writes determinism.contract.json artifact capturing adaptive events,
 * retries, timing adjustments, and other non-deterministic behaviors.
 */

import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { DecisionRecorder as _DecisionRecorder } from '../determinism-model.js';
import { ARTIFACT_REGISTRY } from '../artifacts/registry.js';

/**
 * Write determinism contract artifact
 * 
 * @param {string} runDir - Absolute run directory path
 * @param {Object} decisionRecorder - Decision recorder instance
 * @returns {string} Path to written contract
 */
export function writeDeterminismContract(runDir, decisionRecorder) {
  const contractPath = resolve(runDir, ARTIFACT_REGISTRY.determinismContract.filename);
  
  const adaptiveEvents = [];
  const retryEvents = [];
  const timingAdjustments = [];
  
  if (decisionRecorder) {
    // Extract adaptive stabilization events
    const adaptiveStabilization = decisionRecorder.getByCategory('ADAPTIVE_STABILIZATION');
    for (const decision of adaptiveStabilization) {
      adaptiveEvents.push({
        decision_id: decision.decision_id,
        category: decision.category,
        timestamp: decision.timestamp,
        reason: decision.reason,
        context: decision.context || null,
        chosen_value: decision.chosen_value,
        inputs: decision.inputs || {}
      });
    }
    
    // Extract retry events
    const retries = decisionRecorder.getByCategory('RETRY');
    for (const decision of retries) {
      retryEvents.push({
        decision_id: decision.decision_id,
        category: decision.category,
        timestamp: decision.timestamp,
        reason: decision.reason,
        context: decision.context || null,
        chosen_value: decision.chosen_value,
        inputs: decision.inputs || {}
      });
    }
    
    // Extract timing adjustments (timeout decisions)
    const timeouts = decisionRecorder.getByCategory('TIMEOUT');
    for (const decision of timeouts) {
      timingAdjustments.push({
        decision_id: decision.decision_id,
        category: decision.category,
        timestamp: decision.timestamp,
        reason: decision.reason,
        context: decision.context || null,
        chosen_value: decision.chosen_value,
        inputs: decision.inputs || {}
      });
    }
  }
  
  const contract = {
    version: 1,
    generatedAt: new Date().toISOString(),
    adaptiveEvents,
    retryEvents,
    timingAdjustments,
    summary: {
      adaptiveEventsCount: adaptiveEvents.length,
      retryEventsCount: retryEvents.length,
      timingAdjustmentsCount: timingAdjustments.length,
      isDeterministic: adaptiveEvents.length === 0 && retryEvents.length === 0
    }
  };
  
  writeFileSync(contractPath, JSON.stringify(contract, null, 2), 'utf8');
  
  return contractPath;
}

