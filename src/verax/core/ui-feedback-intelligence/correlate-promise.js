/**
 * Internal: Correlate promise with UI feedback
 */

import { FEEDBACK_SCORE } from './types.js';

export function correlatePromiseWithFeedback(expectation, feedbackScore, trace) {
  const sensors = trace.sensors || {};
  const networkSensor = sensors.network || {};
  const hasNetworkFailure = networkSensor.failedRequests > 0 ||
                            networkSensor.topFailedUrls?.length > 0;
  
  if (expectation.type === 'network_action' || expectation.type === 'network') {
    if (hasNetworkFailure && feedbackScore.score === FEEDBACK_SCORE.MISSING) {
      return {
        outcome: 'CONFIRMED',
        confidence: 0.9,
        reason: 'Network request failed but no error feedback provided to user',
        requiresEvidence: true,
      };
    }
    
    const hasNetworkSuccess = networkSensor.successfulRequests > 0;
    const hasDomChange = trace.dom?.beforeHash !== trace.dom?.afterHash;
    const hasUrlChange = trace.sensors?.navigation?.urlChanged === true;
    
    if (hasNetworkSuccess && 
        feedbackScore.score === FEEDBACK_SCORE.MISSING && 
        !hasDomChange && 
        !hasUrlChange) {
      return {
        outcome: 'SUSPECTED',
        confidence: 0.7,
        reason: 'Network request succeeded but no feedback or visible change',
        requiresEvidence: true,
      };
    }
  }
  
  if (expectation.type === 'navigation' || expectation.type === 'spa_navigation') {
    const urlChanged = trace.sensors?.navigation?.urlChanged === true;
    const hasDomChange = trace.dom?.beforeHash !== trace.dom?.afterHash;
    
    if (!urlChanged && !hasDomChange && feedbackScore.score === FEEDBACK_SCORE.MISSING) {
      return {
        outcome: 'CONFIRMED',
        confidence: 0.85,
        reason: 'Navigation promise not fulfilled - no URL change, DOM change, or feedback',
        requiresEvidence: true,
      };
    }
  }
  
  if (expectation.type === 'validation' || expectation.type === 'form_submission') {
    if (feedbackScore.score === FEEDBACK_SCORE.MISSING) {
      const formSubmitted = trace.interaction?.type === 'form';
      
      if (formSubmitted) {
        return {
          outcome: 'SUSPECTED',
          confidence: 0.7,
          reason: 'Form submission expected validation feedback but none detected',
          requiresEvidence: true,
        };
      }
    }
  }
  
  if (expectation.type === 'state_action' || expectation.type === 'state') {
    if (feedbackScore.score === FEEDBACK_SCORE.MISSING) {
      const stateChanged = trace.sensors?.state?.changed?.length > 0;
      
      if (stateChanged) {
        return {
          outcome: 'SUSPECTED',
          confidence: 0.75,
          reason: 'State changed but no UI feedback detected',
          requiresEvidence: true,
        };
      }
    }
  }
  
  return {
    outcome: null,
    confidence: 0,
    reason: null,
    requiresEvidence: false,
  };
}
