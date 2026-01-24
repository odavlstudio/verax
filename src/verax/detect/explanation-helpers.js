/**
 * PHASE 9: Reality Confidence & Explanation Layer
 * 
 * Helper functions to generate human-readable explanations for findings.
 */

/**
 * Generate a human summary - one short sentence describing what the USER experienced.
 * NO technical jargon.
 */
export function generateHumanSummary(finding, _trace) {
  const findingType = finding.type || '';
  const interaction = finding.interaction || {};
  const label = interaction.label || interaction.text || 'the button';
  const evidence = finding.evidence || {};
  
  switch (findingType) {
    case 'navigation_silent_failure':
      if (evidence.urlChanged) {
        return `The ${label} changed the page URL, but the visible content did not change.`;
      }
      return `Clicking ${label} should have navigated to a different page, but nothing happened.`;
      
    case 'network_silent_failure':
      return `The ${label} was clicked, but the expected network request was not sent.`;
      
    case 'validation_silent_failure':
      return `Submitting the form did not show any validation feedback, even though validation should have occurred.`;
      
    case 'state_silent_failure':
      return `The ${label} was clicked, but the expected state change did not happen.`;
      
    case 'reality_dead_interaction':
      return `The ${label} was clickable, but nothing happened after clicking it.`;
      
    case 'partial_navigation_failure':
      return `The ${label} started navigating, but did not reach the expected destination.`;
      
    case 'silent_failure':
    case 'flow_silent_failure':
      return `The ${label} was clicked, but the expected result did not occur.`;
      
    case 'observed_break':
      return `The ${label} behaved differently than expected based on previous observations.`;
      
    default:
      return `An unexpected issue occurred with ${label}.`;
  }
}

/**
 * Generate action hint for a finding.
 * Returns: { recommendedAction: 'FIX' | 'REVIEW' | 'IGNORE', reason, suggestedNextStep }
 */
export function generateActionHint(finding, confidence) {
  const findingType = finding.type || '';
  // Handle both full confidence object and simple confidence object
  const confidenceLevel = confidence?.level || finding.confidence?.level || 'UNKNOWN';
  const expectationStrength = confidence?.factors?.expectationStrength || 
                              finding.confidence?.factors?.expectationStrength || 
                              'UNKNOWN';
  
  // Rules:
  // - PROVEN silent_failure (MEDIUM/HIGH) → FIX
  // - reality_dead_interaction → REVIEW
  // - coverage_gap → IGNORE
  // - LOW confidence findings → REVIEW
  // - HIGH confidence findings → FIX
  
  if (findingType === 'reality_dead_interaction') {
    return {
      recommendedAction: 'REVIEW',
      reason: 'This is a dead interaction that may be intentional or a design issue',
      suggestedNextStep: 'Check if this button is supposed to do something. If yes, add a handler. If no, remove it or disable it.'
    };
  }
  
  // Coverage gaps are informational only
  if (findingType.includes('coverage') || findingType === 'coverage_gap') {
    return {
      recommendedAction: 'IGNORE',
      reason: 'This is a coverage gap, not a user-facing failure',
      suggestedNextStep: 'No action needed - this indicates incomplete test coverage, not a broken feature'
    };
  }
  
  // PROVEN expectations with MEDIUM/HIGH confidence → FIX
  if (expectationStrength === 'PROVEN' && (confidenceLevel === 'HIGH' || confidenceLevel === 'MEDIUM')) {
    return {
      recommendedAction: 'FIX',
      reason: 'Your code explicitly promises this behavior, and evidence shows it failed',
      suggestedNextStep: 'Fix the implementation to match what your code promises, or update the code if the promise changed'
    };
  }
  
  // HIGH confidence (even if not PROVEN) → FIX
  if (confidenceLevel === 'HIGH') {
    return {
      recommendedAction: 'FIX',
      reason: 'Strong evidence indicates this is a real failure',
      suggestedNextStep: 'Investigate and fix the issue'
    };
  }
  
  // MEDIUM confidence → REVIEW
  if (confidenceLevel === 'MEDIUM') {
    return {
      recommendedAction: 'REVIEW',
      reason: 'Evidence suggests a failure, but some uncertainty remains',
      suggestedNextStep: 'Review the finding and evidence to determine if this is a real issue or a false positive'
    };
  }
  
  // LOW confidence → REVIEW
  if (confidenceLevel === 'LOW') {
    return {
      recommendedAction: 'REVIEW',
      reason: 'Limited evidence - this may be a false positive',
      suggestedNextStep: 'Review manually to confirm if this is a real issue'
    };
  }
  
  // Default for unknown
  return {
    recommendedAction: 'REVIEW',
    reason: 'Insufficient information to determine action',
    suggestedNextStep: 'Review the finding and evidence manually'
  };
}

/**
 * Derive a confidence explanation structure for findings.
 * Ensures required fields exist even if upstream confidence missed them.
 */
export function deriveConfidenceExplanation(confidence = {}, findingType = 'unknown') {
  const base = confidence.confidenceExplanation || {};
  const factors = confidence.factors || {};
  const expectationStrength = factors.expectationStrength || 'UNKNOWN';
  const sensorsPresent = factors.sensorsPresent || {};

  const why = Array.isArray(base.whyThisConfidence) && base.whyThisConfidence.length > 0
    ? base.whyThisConfidence
    : [
        expectationStrength === 'PROVEN'
          ? 'Expectation is proven and failed in practice'
          : `Expectation strength is ${expectationStrength}, adding uncertainty`,
        sensorsPresent.network || sensorsPresent.console || sensorsPresent.ui
          ? 'Some evidence was captured from available sensors'
          : 'Limited evidence captured from sensors'
      ];

  const whatIncrease = Array.isArray(base.whatWouldIncreaseConfidence) && base.whatWouldIncreaseConfidence.length > 0
    ? base.whatWouldIncreaseConfidence
    : [
        expectationStrength === 'PROVEN'
          ? 'Capture more sensor evidence (network/console/UI) for this interaction'
          : 'Make this expectation PROVEN or capture more evidence to remove uncertainty'
      ];

  const whatReduce = Array.isArray(base.whatWouldReduceConfidence) && base.whatWouldReduceConfidence.length > 0
    ? base.whatWouldReduceConfidence
    : ['Confidence would drop if sensors were missing or expectation weakened'];

  return {
    whyThisConfidence: dedupeStrings(why),
    whatWouldIncreaseConfidence: dedupeStrings(whatIncrease),
    whatWouldReduceConfidence: dedupeStrings(whatReduce),
    expectationStrength,
    sensorsPresent,
    findingType
  };
}

function dedupeStrings(list = []) {
  const seen = new Set();
  const output = [];
  for (const item of list) {
    const val = String(item || '').trim();
    if (!val) continue;
    if (!seen.has(val)) {
      seen.add(val);
      output.push(val);
    }
  }
  return output;
}




