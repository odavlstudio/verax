import { hasAnyFeedback } from './sensor-presence.js';

export function extractEvidenceSignals({ networkSummary, consoleSummary, uiSignals, comparisons }) {
  const signals = {
    urlChanged: comparisons?.hasUrlChange === true,
    domChanged: comparisons?.hasDomChange === true,
    screenshotChanged: comparisons?.hasVisibleChange === true,
    networkFailed: (networkSummary?.failedRequests || 0) > 0,
    consoleErrors: consoleSummary?.hasErrors === true,
    uiFeedbackDetected: hasAnyFeedback(uiSignals),
    slowRequests: (networkSummary?.slowRequestsCount || 0) > 0
  };

  return signals;
}
