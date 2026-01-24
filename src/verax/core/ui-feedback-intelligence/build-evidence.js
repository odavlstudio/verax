/**
 * Internal: Build evidence for UI feedback finding
 */

export function buildUIFeedbackEvidence(feedbackScore, correlation, trace, expectation) {
  const evidence = {
    feedback: {
      score: feedbackScore.score,
      confidence: feedbackScore.confidence,
      explanation: feedbackScore.explanation,
      signals: feedbackScore.signals.map(s => ({
        type: s.type,
        selector: s.selector,
        confidence: s.confidence,
      })),
      topSignals: feedbackScore.topSignals,
    },
    beforeAfter: {
      beforeScreenshot: trace.before?.screenshot || null,
      afterScreenshot: trace.after?.screenshot || null,
      beforeUrl: trace.before?.url || null,
      afterUrl: trace.after?.url || null,
      beforeDomHash: trace.dom?.beforeHash || null,
      afterDomHash: trace.dom?.afterHash || null,
    },
    promise: {
      type: expectation?.type || null,
      value: expectation?.promise?.value || expectation?.targetPath || null,
      source: expectation?.source || null,
      context: expectation?.source?.context || null,
      astSource: expectation?.source?.astSource || null,
    },
    sensors: {
      uiSignals: trace.sensors?.uiSignals || null,
      uiFeedback: trace.sensors?.uiFeedback || null,
      network: trace.sensors?.network || null,
      navigation: trace.sensors?.navigation || null,
    },
    correlation: {
      outcome: correlation.outcome,
      confidence: correlation.confidence,
      reason: correlation.reason,
    },
    timing: {
      stabilizationWindow: trace.sensors?.uiFeedback?.timing || null,
    },
  };
  
  return evidence;
}
