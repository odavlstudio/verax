/**
 * Internal: Score feedback presence/absence
 */

import { FEEDBACK_SCORE } from './types.js';

export function scoreUIFeedback(signals, expectation, trace) {
  const sensors = trace.sensors || {};
  const networkSensor = sensors.network || {};
  const uiFeedback = sensors.uiFeedback || {};
  
  const expectedFeedbackTypes = [];
  const matchingSignals = signals.filter(s => expectedFeedbackTypes.includes(s.type));
  const overallScore = uiFeedback.overallUiFeedbackScore || 0;
  const hasNetworkActivity = networkSensor.hasNetworkActivity === true ||
                            (networkSensor.totalRequests || 0) > 0;
  const hasNetworkFailure = networkSensor.failedRequests > 0 ||
                            networkSensor.topFailedUrls?.length > 0;
  
  if (matchingSignals.length > 0 || overallScore > 0.5) {
    return {
      score: FEEDBACK_SCORE.CONFIRMED,
      confidence: matchingSignals.length > 0
        ? Math.max(...matchingSignals.map(s => s.confidence))
        : overallScore,
      explanation: buildFeedbackExplanation(matchingSignals, overallScore, 'confirmed'),
      signals: matchingSignals,
      topSignals: matchingSignals.slice(0, 3).map(s => ({
        type: s.type,
        confidence: s.confidence,
        selector: s.selector,
      })),
    };
  }
  
  if (hasNetworkActivity && signals.length === 0 && overallScore < 0.3) {
    return {
      score: FEEDBACK_SCORE.MISSING,
      confidence: hasNetworkFailure ? 0.9 : 0.7,
      explanation: buildFeedbackExplanation([], overallScore, 'missing', {
        hasNetworkActivity,
        hasNetworkFailure,
      }),
      signals: [],
      topSignals: [],
    };
  }
  
  if (signals.length > 0 && overallScore > 0 && overallScore < 0.5) {
    return {
      score: FEEDBACK_SCORE.AMBIGUOUS,
      confidence: 0.6,
      explanation: buildFeedbackExplanation(signals, overallScore, 'ambiguous'),
      signals: signals,
      topSignals: signals.slice(0, 3).map(s => ({
        type: s.type,
        confidence: s.confidence,
        selector: s.selector,
      })),
    };
  }
  
  return {
    score: FEEDBACK_SCORE.MISSING,
    confidence: 0.5,
    explanation: buildFeedbackExplanation([], overallScore, 'missing'),
    signals: [],
    topSignals: [],
  };
}

export function buildFeedbackExplanation(signals, overallScore, outcome, context = {}) {
  const parts = [];
  
  if (outcome === 'confirmed') {
    if (signals.length > 0) {
      parts.push(`Detected ${signals.length} feedback signal(s): ${signals.map(s => s.type).join(', ')}`);
    }
    if (overallScore > 0.5) {
      parts.push(`Overall UI feedback score: ${overallScore.toFixed(2)}`);
    }
  } else if (outcome === 'missing') {
    parts.push('No feedback signals detected');
    if (context.hasNetworkActivity) {
      parts.push('Network activity occurred but no feedback');
    }
    if (context.hasNetworkFailure) {
      parts.push('Network failure occurred but no error feedback');
    }
    if (overallScore < 0.3) {
      parts.push(`Low UI feedback score: ${overallScore.toFixed(2)}`);
    }
  } else if (outcome === 'ambiguous') {
    parts.push('Feedback signals present but confidence is low');
    if (signals.length > 0) {
      parts.push(`Detected ${signals.length} signal(s) but overall score is ${overallScore.toFixed(2)}`);
    }
  }
  
  return parts.join('. ');
}
