/**
 * FLOW INTELLIGENCE v1 — Flow Matcher
 * 
 * Matches discovered interactions to PROVEN flow steps.
 * NO HEURISTICS: Only executes flows with explicit PROVEN expectations.
 */

/**
 * Match an interaction to a flow step expectation.
 * Uses same logic as expectation-model but for flow context.
 */
function matchesFlowStep(interaction, step) {
  // Navigation: match by type
  if (step.expectationType === 'navigation' && interaction.type === 'link') {
    return true;
  }
  
  // Network action: match form or button
  if (step.expectationType === 'network_action') {
    if (interaction.type === 'form' || interaction.type === 'button') {
      return true;
    }
  }
  
  // State action: match button
  if (step.expectationType === 'state_action' && interaction.type === 'button') {
    return true;
  }
  
  return false;
}

/**
 * Find which flow a set of interactions matches.
 * Returns the best matching flow or null.
 */
function findMatchingFlow(interactions, flows) {
  if (!flows || flows.length === 0) return null;
  if (!interactions || interactions.length < 2) return null;
  
  // Try to match each flow
  for (const flow of flows) {
    let matchedSteps = 0;
    
    // Check if we have enough interactions for this flow
    if (interactions.length < flow.stepCount) continue;
    
    // Try to match flow steps to interactions in order
    for (let i = 0; i < flow.stepCount; i++) {
      const step = flow.steps[i];
      const interaction = interactions[i];
      
      if (matchesFlowStep(interaction, step)) {
        matchedSteps++;
      }
    }
    
    // If all steps matched, return this flow
    if (matchedSteps === flow.stepCount) {
      return flow;
    }
  }
  
  return null;
}

/**
 * Build flow-aware execution plan from discovered interactions and PROVEN flows.
 * 
 * @param {Array} interactions - Discovered interactions
 * @param {Array} flows - PROVEN flows from manifest
 * @returns {Array} Array of flow execution plans
 */
export function buildFlowExecutionPlan(interactions, flows = []) {
  const executionPlan = [];
  
  // If no PROVEN flows, fall back to simple grouping (original behavior)
  if (!flows || flows.length === 0) {
    let cursor = 0;
    while (cursor < interactions.length && executionPlan.length < 3) {
      const remaining = interactions.length - cursor;
      const size = Math.min(Math.max(2, Math.min(5, remaining)), remaining);
      const flowInteractions = interactions.slice(cursor, cursor + size);
      executionPlan.push({
        flowId: `flow-${executionPlan.length + 1}`,
        stepCount: flowInteractions.length,
        interactions: flowInteractions,
        proven: false
      });
      cursor += size;
    }
    return executionPlan;
  }
  
  // PROVEN FLOW EXECUTION: Match interactions to PROVEN flows
  const usedInteractions = new Set();
  
  for (const flow of flows) {
    if (executionPlan.length >= 3) break; // Max 3 flows per run
    
    // Find unused interactions that match this flow
    const availableInteractions = interactions.filter((_, idx) => !usedInteractions.has(idx));
    
    if (availableInteractions.length < flow.stepCount) continue;
    
    const matchingFlow = findMatchingFlow(availableInteractions, [flow]);
    
    if (matchingFlow) {
      const flowInteractions = availableInteractions.slice(0, flow.stepCount);
      
      // Mark these interactions as used
      flowInteractions.forEach((interaction) => {
        const idx = interactions.indexOf(interaction);
        if (idx >= 0) usedInteractions.add(idx);
      });
      
      executionPlan.push({
        flowId: flow.flowId,
        stepCount: flow.stepCount,
        interactions: flowInteractions,
        proven: true,
        provenFlow: flow
      });
    }
  }
  
  // If no PROVEN flows matched, execute remaining interactions as fallback flows
  if (executionPlan.length === 0) {
    const unusedInteractions = interactions.filter((_, idx) => !usedInteractions.has(idx));
    if (unusedInteractions.length >= 2) {
      const size = Math.min(5, unusedInteractions.length);
      const flowInteractions = unusedInteractions.slice(0, size);
      executionPlan.push({
        flowId: `flow-fallback-1`,
        stepCount: flowInteractions.length,
        interactions: flowInteractions,
        proven: false
      });
    }
  }
  
  return executionPlan;
}



