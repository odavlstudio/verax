// Sensor presence checks (semantic normalization only; boolean outputs unchanged)
// eslint-disable-next-line no-unused-vars
import { normalizeSensorState, SENSOR_STATE } from '../../shared/sensors/normalize-sensor-state.js';

/**
 * Canonical network sensor presence check
 * @private
 */
function detectNetworkData(summary) {
  if (!summary || typeof summary !== 'object') return false;

  const hasRequests = (summary.totalRequests || 0) > 0;
  const hasFailures = (summary.failedRequests || 0) > 0;
  const hasSlow = (summary.slowRequests || 0) > 0;
  const hasFailedUrls = Array.isArray(summary.topFailedUrls) && summary.topFailedUrls.length > 0;
  const hasSlowUrls = Array.isArray(summary.topSlowUrls) && summary.topSlowUrls.length > 0;

  return hasRequests || hasFailures || hasSlow || hasFailedUrls || hasSlowUrls;
}

export function hasNetworkData(networkSummary) {
  const result = detectNetworkData(networkSummary);
  normalizeSensorState(networkSummary, { hasData: detectNetworkData });
  return result;
}

/**
 * Canonical console sensor presence check
 * @private
 */
function detectConsoleData(summary) {
  if (!summary || typeof summary !== 'object') return false;

  const hasMessages = (summary.totalMessages || 0) > 0;
  const hasErrors = (summary.errors || 0) > 0 || (summary.pageErrorCount || 0) > 0;
  const hasWarnings = (summary.warnings || 0) > 0;
  const hasEntries = Array.isArray(summary.entries) && summary.entries.length > 0;

  return hasMessages || hasErrors || hasWarnings || hasEntries;
}

export function hasConsoleData(consoleSummary) {
  const result = detectConsoleData(consoleSummary);
  normalizeSensorState(consoleSummary, { hasData: detectConsoleData });
  return result;
}

/**
 * Canonical UI change sensor presence check
 * @private
 */
function detectUiData(signals) {
  if (!signals || typeof signals !== 'object') return false;

  const diff = signals.diff || signals;

  const hasAnyDelta = diff.hasAnyDelta === true || diff.changed === true;
  const hasDomChange = diff.domChanged === true;
  const hasVisibleChange = diff.visibleChanged === true;
  const hasAriaChange = diff.ariaChanged === true;
  const hasFocusChange = diff.focusChanged === true;
  const hasTextChange = diff.textChanged === true;

  const hasChangesField = signals.changes && typeof signals.changes === 'object';
  return hasAnyDelta || hasDomChange || hasVisibleChange || hasAriaChange || hasFocusChange || hasTextChange || hasChangesField;
}

export function hasUiData(uiSignals) {
  const result = detectUiData(uiSignals);
  normalizeSensorState(uiSignals, { hasData: detectUiData });
  return result;
}

/**
 * Canonical feedback signal sensor presence check
 * @private
 */
function detectAnyFeedback(uiSignals = {}) {
  const before = uiSignals.before || {};
  const after = uiSignals.after || {};

  return (
    before.hasErrorSignal || after.hasErrorSignal ||
    before.hasLoadingIndicator || after.hasLoadingIndicator ||
    before.hasStatusSignal || after.hasStatusSignal ||
    before.hasLiveRegion || after.hasLiveRegion ||
    before.hasDialog || after.hasDialog ||
    (before.disabledElements?.length || 0) > 0 ||
    (after.disabledElements?.length || 0) > 0
  );
}

export function hasAnyFeedback(uiSignals = {}) {
  const result = detectAnyFeedback(uiSignals);
  normalizeSensorState(uiSignals, { hasData: detectAnyFeedback });
  return result;
}
