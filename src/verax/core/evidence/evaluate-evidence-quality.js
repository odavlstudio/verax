// @ts-nocheck
/**
 * Evidence Quality Evaluator (metadata-only, no scoring impact).
 * Classification: NONE | WEAK | PARTIAL | STRONG
 * Inputs are existing signals; output is attached as metadata only.
 */
import { normalizeSensorState, SENSOR_STATE } from '../../shared/sensors/normalize-sensor-state.js';

const QUALITY = {
  NONE: 'NONE',
  WEAK: 'WEAK',
  PARTIAL: 'PARTIAL',
  STRONG: 'STRONG'
};

const SENSOR_STAGE_MAP = {
  NETWORK: 'network',
  UISIGNALS: 'uiSignals'
};

function mapFailuresBySensor(captureFailures = []) {
  const failures = {
    network: false,
    console: false,
    uiSignals: false
  };

  for (const failure of captureFailures || []) {
    const sensor = SENSOR_STAGE_MAP[failure.stage] || null;
    if (sensor) {
      failures[sensor] = true;
    }
  }

  return failures;
}

function determineSensorState(sensorData, hasDataPredicate, failedFlag) {
  return normalizeSensorState(sensorData, {
    failed: failedFlag === true,
    hasData: hasDataPredicate
  }).state;
}

function hasNetworkSignals(summary) {
  if (!summary || typeof summary !== 'object') return false;
  return (
    (summary.totalRequests || 0) > 0 ||
    (summary.failedRequests || 0) > 0 ||
    (summary.successfulRequests || 0) > 0 ||
    summary.hasNetworkActivity === true
  );
}

function hasConsoleSignals(summary) {
  if (!summary || typeof summary !== 'object') return false;
  return (
    (summary.errorCount || 0) > 0 ||
    (summary.consoleErrorCount || 0) > 0 ||
    (summary.pageErrorCount || 0) > 0 ||
    (summary.unhandledRejectionCount || 0) > 0 ||
    (summary.errors || 0) > 0 ||
    (summary.warnings || 0) > 0 ||
    (summary.logs || 0) > 0 ||
    summary.hasErrors === true
  );
}

function hasUiSignals(signals) {
  if (!signals || typeof signals !== 'object') return false;
  if (signals.diff && typeof signals.diff === 'object' && signals.diff.changed === true) return true;
  return Boolean(
    signals.validationFeedbackDetected === true ||
      signals.hasLoadingIndicator === true ||
      signals.hasDialog === true ||
      signals.hasErrorSignal === true ||
      signals.hasStatusSignal === true ||
      signals.hasLiveRegion === true ||
      (signals.disabledElements && signals.disabledElements.length > 0)
  );
}

function scoreEvidenceQuality(states, comparisons, evidence) {
  let score = 0;

  // Sensor presence
  if (states.network === SENSOR_STATE.PRESENT) score += 1;
  if (states.console === SENSOR_STATE.PRESENT) score += 1;
  if (states.uiSignals === SENSOR_STATE.PRESENT) score += 1;

  // Substantive evidence flags
  if (evidence?.isComplete === true) score += 2;
  if (comparisons?.hasUrlChange || comparisons?.urlChanged) score += 1;
  if (comparisons?.hasDomChange || comparisons?.hasVisibleChange) score += 1;
  const hasScreenshots = Boolean(evidence?.before?.screenshot && evidence?.after?.screenshot);
  if (hasScreenshots) score += 1;

  if (score >= 4) return QUALITY.STRONG;
  if (score >= 2) return QUALITY.PARTIAL;
  if (score >= 1) return QUALITY.WEAK;
  return QUALITY.NONE;
}

export function evaluateEvidenceQuality({ sensors = {}, evidence = {}, comparisons = {}, captureFailures = [], findingType = 'generic' } = {}) {
  const failures = mapFailuresBySensor(captureFailures);

  const networkState = determineSensorState(
    sensors.network || evidence?.signals?.network,
    hasNetworkSignals,
    failures.network
  );
  const consoleState = determineSensorState(
    sensors.console || evidence?.signals?.console,
    hasConsoleSignals,
    failures.console
  );
  const uiState = determineSensorState(
    sensors.uiSignals || evidence?.signals?.uiSignals,
    hasUiSignals,
    failures.uiSignals
  );

  const states = {
    network: networkState,
    console: consoleState,
    uiSignals: uiState
  };

  const quality = scoreEvidenceQuality(states, comparisons, evidence);

  const flags = [];
  if (networkState === SENSOR_STATE.FAILED) flags.push('NETWORK_CAPTURE_FAILED');
  if (consoleState === SENSOR_STATE.FAILED) flags.push('CONSOLE_CAPTURE_FAILED');
  if (uiState === SENSOR_STATE.FAILED) flags.push('UI_CAPTURE_FAILED');

  return {
    quality,
    states,
    flags,
    findingType,
    failures
  };
}

export { QUALITY as EVIDENCE_QUALITY };
