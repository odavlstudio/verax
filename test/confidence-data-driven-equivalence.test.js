import assert from 'node:assert';
import test from 'node:test';
import { computeConfidence } from '../src/verax/detect/confidence/index.js';
import { determineExpectationStrength, getBaseScoreFromExpectationStrength } from '../src/verax/detect/confidence/expectation-strength.js';
import { hasNetworkData, hasConsoleData, hasUiData } from '../src/verax/detect/confidence/sensor-presence.js';
import { extractEvidenceSignals } from '../src/verax/detect/confidence/evidence-signals.js';
import { generateExplanations, generateConfidenceExplanation } from '../src/verax/detect/confidence/finalize.js';
// eslint-disable-next-line no-unused-vars
import { scoreMissingFeedbackFailure, penalizeMissingFeedbackFailure } from '../src/verax/detect/confidence/scoring/missing_feedback_failure.js';
// eslint-disable-next-line no-unused-vars
import { scoreNoEffectSilentFailure, penalizeNoEffectSilentFailure } from '../src/verax/detect/confidence/scoring/no_effect_silent_failure.js';
// eslint-disable-next-line no-unused-vars
import { scoreMissingNetworkAction, penalizeMissingNetworkAction } from '../src/verax/detect/confidence/scoring/missing_network_action.js';
// eslint-disable-next-line no-unused-vars
import { scoreMissingStateAction, penalizeMissingStateAction } from '../src/verax/detect/confidence/scoring/missing_state_action.js';
// eslint-disable-next-line no-unused-vars
import { scoreNavigationSilentFailure, penalizeNavigationSilentFailure } from '../src/verax/detect/confidence/scoring/navigation_silent_failure.js';
// eslint-disable-next-line no-unused-vars
import { scorePartialNavigationFailure, penalizePartialNavigationFailure } from '../src/verax/detect/confidence/scoring/partial_navigation_failure.js';

const LEGACY_BASE_SCORES = {
  network_silent_failure: 70,
  validation_silent_failure: 60,
  missing_feedback_failure: 55,
  no_effect_silent_failure: 50,
  missing_network_action: 65,
  missing_state_action: 60,
  navigation_silent_failure: 75,
  partial_navigation_failure: 65,
  flow_silent_failure: 70,
  observed_break: 50
};

function legacyScoreNetworkSilentFailure({ evidenceSignals, boosts }) {
  let total = 0;

  if (evidenceSignals.networkFailed) {
    total += 10;
    boosts.push('Network request failed');
  }

  if (evidenceSignals.consoleErrors) {
    total += 8;
    boosts.push('Console errors present');
  }

  if (evidenceSignals.networkFailed && !evidenceSignals.uiFeedbackDetected) {
    total += 6;
    boosts.push('Silent failure: no user feedback on network error');
  }

  return total;
}

function legacyPenalizeNetworkSilentFailure({ evidenceSignals, penalties }) {
  let total = 0;

  if (evidenceSignals.uiFeedbackDetected) {
    total += 10;
    penalties.push('UI feedback detected (suggests not silent)');
  }

  return total;
}

function legacyScoreValidationSilentFailure({ evidenceSignals, boosts }) {
  let total = 0;

  if (evidenceSignals.consoleErrors) {
    total += 10;
    boosts.push('Validation errors in console');
  }

  if (evidenceSignals.consoleErrors && !evidenceSignals.uiFeedbackDetected) {
    total += 8;
    boosts.push('Silent validation: errors logged but no visible feedback');
  }

  return total;
}

function legacyPenalizeValidationSilentFailure({ evidenceSignals, penalties }) {
  let total = 0;

  if (evidenceSignals.uiFeedbackDetected) {
    total += 10;
    penalties.push('Error feedback visible (not silent)');
  }

  return total;
}

function legacyScoreMissingFeedbackFailure({ evidenceSignals, boosts }) {
  let total = 0;

  if (evidenceSignals.slowRequests) {
    total += 10;
    boosts.push('Slow requests detected');
  }

  if (evidenceSignals.networkFailed && !evidenceSignals.uiFeedbackDetected) {
    total += 8;
    boosts.push('Network activity without user feedback');
  }

  return total;
}

function legacyPenalizeMissingFeedbackFailure({ evidenceSignals, penalties }) {
  let total = 0;

  if (evidenceSignals.uiFeedbackDetected) {
    total += 10;
    penalties.push('Loading indicator detected');
  }

  return total;
}

function legacyScoreNavigationSilentFailure({ evidenceSignals, boosts }) {
  let total = 0;

  if (!evidenceSignals.urlChanged) {
    total += 10;
    boosts.push('Expected URL change did not occur');
  }

  if (!evidenceSignals.uiFeedbackDetected) {
    total += 8;
    boosts.push('No user-visible feedback on navigation failure');
  }

  if (evidenceSignals.consoleErrors) {
    total += 6;
    boosts.push('Navigation errors in console');
  }

  return total;
}

function legacyPenalizeNavigationSilentFailure({ evidenceSignals, penalties }) {
  let total = 0;

  if (evidenceSignals.uiFeedbackDetected) {
    total += 10;
    penalties.push('UI feedback detected (suggests navigation feedback provided)');
  }

  if (evidenceSignals.urlChanged) {
    total += 5;
    penalties.push('URL changed (navigation may have succeeded)');
  }

  return total;
}

function legacyScorePartialNavigationFailure({ evidenceSignals, boosts }) {
  let total = 0;

  if (evidenceSignals.urlChanged && !evidenceSignals.uiFeedbackDetected) {
    total += 10;
    boosts.push('Navigation started but target not reached');
  }

  if (!evidenceSignals.uiFeedbackDetected) {
    total += 8;
    boosts.push('No user-visible feedback on partial navigation');
  }

  return total;
}

function legacyPenalizePartialNavigationFailure({ evidenceSignals, penalties }) {
  let total = 0;

  if (evidenceSignals.uiFeedbackDetected) {
    total += 10;
    penalties.push('UI feedback detected (suggests navigation feedback provided)');
  }

  return total;
}

function legacyScoreNoEffectSilentFailure({ evidenceSignals, boosts }) {
  let total = 0;

  if (!evidenceSignals.urlChanged) {
    total += 10;
    boosts.push('Expected URL change did not occur');
  }

  if (!evidenceSignals.domChanged) {
    total += 6;
    boosts.push('DOM state unchanged');
  }

  if (!evidenceSignals.screenshotChanged) {
    total += 5;
    boosts.push('No visible changes');
  }

  return total;
}

function legacyPenalizeNoEffectSilentFailure({ evidenceSignals, penalties }) {
  let total = 0;

  if (evidenceSignals.networkFailed) {
    total += 10;
    penalties.push('Network activity detected (potential effect)');
  }

  if (evidenceSignals.uiFeedbackDetected) {
    total += 8;
    penalties.push('UI feedback changed (potential effect)');
  }

  return total;
}

function legacyScoreMissingNetworkAction({ expectation, expectationStrength, evidenceSignals, boosts }) {
  let total = 0;

  if (expectationStrength === 'PROVEN') {
    total += 10;
    boosts.push('Code promise verified via AST analysis');
  }

  if (!evidenceSignals.networkFailed && (expectation?.totalRequests || 0) === 0) {
    total += 8;
    boosts.push('Zero network activity despite code promise');
  }

  if (evidenceSignals.consoleErrors) {
    total += 6;
    boosts.push('Console errors may have prevented action');
  }

  return total;
}

function legacyPenalizeMissingNetworkAction({ evidenceSignals, penalties }) {
  let total = 0;

  if (evidenceSignals.networkFailed) {
    total += 15;
    penalties.push('Other network requests occurred');
  }

  return total;
}

function legacyScoreMissingStateAction({ expectationStrength, evidenceSignals, boosts }) {
  let total = 0;

  if (expectationStrength === 'PROVEN') {
    total += 10;
    boosts.push('State mutation proven via cross-file analysis');
  }

  if (!evidenceSignals.domChanged) {
    total += 8;
    boosts.push('DOM unchanged (no state mutation visible)');
  }

  return total;
}

function legacyPenalizeMissingStateAction({ evidenceSignals, penalties }) {
  let total = 0;

  if (evidenceSignals.networkFailed) {
    total += 10;
    penalties.push('Network activity (deferred state update possible)');
  }

  if (evidenceSignals.uiFeedbackDetected) {
    total += 8;
    penalties.push('UI feedback suggests state managed differently');
  }

  return total;
}

function legacyScoreFlowSilentFailure() {
  return 0;
}

function legacyPenalizeFlowSilentFailure() {
  return 0;
}

function legacyScoreObservedBreak() {
  return 0;
}

function legacyPenalizeObservedBreak() {
  return 0;
}

function legacyScoreByFindingType({
  findingType,
  expectation,
  expectationStrength,
  evidenceSignals,
  comparisons: _comparisons,
  attemptMeta: _attemptMeta,
  boosts,
  penalties
}) {
  let totalBoosts = 0;
  let totalPenalties = 0;

  switch (findingType) {
    case 'network_silent_failure':
      totalBoosts = legacyScoreNetworkSilentFailure({ evidenceSignals, boosts });
      totalPenalties = legacyPenalizeNetworkSilentFailure({ evidenceSignals, penalties });
      break;
    case 'validation_silent_failure':
      totalBoosts = legacyScoreValidationSilentFailure({ evidenceSignals, boosts });
      totalPenalties = legacyPenalizeValidationSilentFailure({ evidenceSignals, penalties });
      break;
    case 'missing_feedback_failure':
      totalBoosts = legacyScoreMissingFeedbackFailure({ evidenceSignals, boosts });
      totalPenalties = legacyPenalizeMissingFeedbackFailure({ evidenceSignals, penalties });
      break;
    case 'no_effect_silent_failure':
      totalBoosts = legacyScoreNoEffectSilentFailure({ evidenceSignals, boosts });
      totalPenalties = legacyPenalizeNoEffectSilentFailure({ evidenceSignals, penalties });
      break;
    case 'missing_network_action':
      totalBoosts = legacyScoreMissingNetworkAction({ expectation, expectationStrength, evidenceSignals, boosts });
      totalPenalties = legacyPenalizeMissingNetworkAction({ evidenceSignals, penalties });
      break;
    case 'missing_state_action':
      totalBoosts = legacyScoreMissingStateAction({ expectationStrength, evidenceSignals, boosts });
      totalPenalties = legacyPenalizeMissingStateAction({ evidenceSignals, penalties });
      break;
    case 'navigation_silent_failure':
      totalBoosts = legacyScoreNavigationSilentFailure({ evidenceSignals, boosts });
      totalPenalties = legacyPenalizeNavigationSilentFailure({ evidenceSignals, penalties });
      break;
    case 'partial_navigation_failure':
      totalBoosts = legacyScorePartialNavigationFailure({ evidenceSignals, boosts });
      totalPenalties = legacyPenalizePartialNavigationFailure({ evidenceSignals, penalties });
      break;
    case 'flow_silent_failure':
      totalBoosts = legacyScoreFlowSilentFailure();
      totalPenalties = legacyPenalizeFlowSilentFailure();
      break;
    case 'observed_break':
      totalBoosts = legacyScoreObservedBreak();
      totalPenalties = legacyPenalizeObservedBreak();
      break;
    default:
      totalBoosts = 0;
      totalPenalties = 0;
      break;
  }

  return { totalBoosts, totalPenalties };
}

function computeConfidenceWithLegacyScorers(params = {}) {
  const { findingType, expectation, sensors = {}, comparisons = {}, attemptMeta = {} } = params;
  const boosts = [];
  const penalties = [];

  const networkSummary = sensors.network || {};
  const consoleSummary = sensors.console || {};
  const uiSignals = sensors.uiSignals || {};

  const expectationStrength = determineExpectationStrength(expectation);

  let baseScore = LEGACY_BASE_SCORES[findingType] || 50;
  const strengthBasedScore = getBaseScoreFromExpectationStrength(expectationStrength);
  if (strengthBasedScore > 0) {
    baseScore = strengthBasedScore;
  }

  const evidenceSignals = extractEvidenceSignals({
    networkSummary,
    consoleSummary,
    uiSignals,
    comparisons
  });

  const sensorObjectsProvided = {
    network: sensors.network !== undefined,
    console: sensors.console !== undefined,
    ui: sensors.uiSignals !== undefined
  };

  const sensorsWithData = {
    network: hasNetworkData(networkSummary),
    console: hasConsoleData(consoleSummary),
    ui: hasUiData(uiSignals)
  };

  const allSensorObjectsProvided = sensorObjectsProvided.network && sensorObjectsProvided.console && sensorObjectsProvided.ui;
  const allSensorsWithData = sensorsWithData.network && sensorsWithData.console && sensorsWithData.ui;

  const { totalBoosts, totalPenalties } = legacyScoreByFindingType({
    findingType,
    expectation,
    expectationStrength,
    networkSummary,
    consoleSummary,
    uiSignals,
    evidenceSignals,
    comparisons,
    attemptMeta,
    boosts,
    penalties
  });

  let cumulativeBoosts = totalBoosts;
  let cumulativePenalties = totalPenalties;

  if (!allSensorObjectsProvided) {
    const missingSensors = [];
    if (!sensorObjectsProvided.network) missingSensors.push('network');
    if (!sensorObjectsProvided.console) missingSensors.push('console');
    if (!sensorObjectsProvided.ui) missingSensors.push('ui');

    const penalty = 25;
    cumulativePenalties += penalty;
    penalties.push(`Missing sensor data: ${missingSensors.join(', ')}`);
  }

  if (expectationStrength !== 'PROVEN') {
    cumulativePenalties += 10;
    penalties.push(`Expectation strength is ${expectationStrength}, not PROVEN`);
  }

  let score = baseScore + cumulativeBoosts - cumulativePenalties;
  score = Math.max(0, Math.min(100, score));

  let level = 'LOW';
  let boundaryExplanation = null;

  if (score >= 80) {
    if (expectationStrength === 'PROVEN' && allSensorsWithData) {
      level = 'HIGH';
      if (score < 82) {
        boundaryExplanation = `Near threshold: score ${score.toFixed(1)} >= 80 threshold, assigned HIGH (proven expectation + all sensors)`;
      }
    } else {
      level = 'MEDIUM';
      if (allSensorObjectsProvided) {
        score = Math.min(score, 79);
      }
      const anySensorWithData = sensorsWithData.network || sensorsWithData.console || sensorsWithData.ui;
      if (!anySensorWithData) {
        score = Math.max(score, 76);
      }

      if (expectationStrength !== 'PROVEN') {
        boundaryExplanation = `Assigned MEDIUM: score ${score.toFixed(1)} >= 80 but expectation not proven`;
      } else if (!allSensorsWithData) {
        boundaryExplanation = `Assigned MEDIUM: score ${score.toFixed(1)} >= 80 but sensors lack data`;
      }
    }
  } else if (score >= 55) {
    level = 'MEDIUM';

    if (score < 57) {
      boundaryExplanation = `Near threshold: score ${score.toFixed(1)} >= 55 threshold, assigned MEDIUM (above LOW boundary)`;
    } else if (score > 77) {
      boundaryExplanation = `Near threshold: score ${score.toFixed(1)} < 80 threshold, kept MEDIUM (below HIGH boundary)`;
    }
  } else {
    level = 'LOW';

    if (score > 52) {
      boundaryExplanation = `Near threshold: score ${score.toFixed(1)} < 55 threshold, kept LOW (below MEDIUM boundary)`;
    }
  }

  const explain = generateExplanations(boosts, penalties, expectationStrength);

  if (expectationStrength === 'OBSERVED') {
    if (!attemptMeta?.repeated) {
      level = 'LOW';
      score = Math.min(score, 49);
    } else if (level === 'HIGH') {
      level = 'MEDIUM';
      score = Math.min(score, 79);
    }
  }

  const finalExplain = explain.slice(0, 8);

  const confidenceExplanation = generateConfidenceExplanation({
    level,
    score: Math.round(score),
    expectationStrength,
    sensorsWithData,
    allSensorsWithData,
    evidenceSignals,
    boosts,
    penalties,
    attemptMeta,
    boundaryExplanation
  });

  return {
    score: Math.round(score),
    level,
    explain: finalExplain,
    factors: {
      expectationStrength,
      sensorsPresent: sensorsWithData,
      evidenceSignals,
      penalties,
      boosts
    },
    confidenceExplanation,
    boundaryExplanation
  };
}

function summarizeDiff(newOutput, legacyOutput) {
  const keys = new Set([...Object.keys(newOutput), ...Object.keys(legacyOutput)]);
  const diffs = [];
  for (const key of keys) {
    const newVal = JSON.stringify(newOutput[key]);
    const legacyVal = JSON.stringify(legacyOutput[key]);
    if (newVal !== legacyVal) {
      diffs.push(key);
    }
  }
  return diffs.length > 0 ? `Fields differ: ${diffs.join(', ')}` : 'Outputs differ';
}

const scenarios = [
  {
    name: 'network_proven_no_feedback_all_sensors',
    input: {
      findingType: 'network_silent_failure',
      expectation: { proof: 'PROVEN_EXPECTATION', totalRequests: 1 },
      sensors: {
        network: { failedRequests: 1, totalRequests: 1 },
        console: { hasErrors: true, errors: 1 },
        uiSignals: { before: {}, after: {}, diff: { hasAnyDelta: true } }
      },
      comparisons: { hasUrlChange: false, hasDomChange: true, hasVisibleChange: false },
      attemptMeta: { repeated: true }
    }
  },
  {
    name: 'network_weak_missing_console_with_feedback',
    input: {
      findingType: 'network_silent_failure',
      expectation: { expectationStrength: 'WEAK' },
      sensors: {
        network: { failedRequests: 2, totalRequests: 2 },
        uiSignals: { before: { hasErrorSignal: true }, after: {}, diff: { hasAnyDelta: true } }
      },
      comparisons: { hasUrlChange: false, hasDomChange: false, hasVisibleChange: false },
      attemptMeta: { repeated: false }
    }
  },
  {
    name: 'validation_observed_not_repeated_no_feedback',
    input: {
      findingType: 'validation_silent_failure',
      expectation: { expectationStrength: 'OBSERVED' },
      sensors: {
        network: { totalRequests: 1 },
        console: { hasErrors: true, errors: 2 },
        uiSignals: { before: {}, after: {}, diff: { hasAnyDelta: true } }
      },
      comparisons: { hasUrlChange: false, hasDomChange: true, hasVisibleChange: true },
      attemptMeta: { repeated: false }
    }
  },
  {
    name: 'validation_observed_repeated_with_feedback',
    input: {
      findingType: 'validation_silent_failure',
      expectation: { expectationStrength: 'OBSERVED' },
      sensors: {
        network: { totalRequests: 3 },
        console: { hasErrors: true, errors: 1 },
        uiSignals: { before: { hasLoadingIndicator: true }, after: {}, diff: { hasAnyDelta: true } }
      },
      comparisons: { hasUrlChange: false, hasDomChange: false, hasVisibleChange: false },
      attemptMeta: { repeated: true }
    }
  },
  {
    name: 'validation_weak_missing_ui_sensor',
    input: {
      findingType: 'validation_silent_failure',
      expectation: { expectationStrength: 'WEAK' },
      sensors: {
        network: { totalRequests: 1 },
        console: { hasErrors: true, errors: 1 }
      },
      comparisons: { hasUrlChange: false, hasDomChange: false, hasVisibleChange: false },
      attemptMeta: { repeated: false }
    }
  },
  {
    name: 'missing_feedback_proven_slow_no_feedback',
    input: {
      findingType: 'missing_feedback_failure',
      expectation: { proof: 'PROVEN_EXPECTATION', totalRequests: 2 },
      sensors: {
        network: { slowRequestsCount: 1, totalRequests: 2 },
        console: { errors: 0 },
        uiSignals: { before: {}, after: {}, diff: { hasAnyDelta: true } }
      },
      comparisons: { hasUrlChange: false, hasDomChange: true, hasVisibleChange: false },
      attemptMeta: { repeated: true }
    }
  },
  {
    name: 'missing_feedback_weak_feedback_present_missing_console',
    input: {
      findingType: 'missing_feedback_failure',
      expectation: { expectationStrength: 'WEAK' },
      sensors: {
        network: { failedRequests: 1, totalRequests: 1 },
        uiSignals: { before: { hasLoadingIndicator: true }, after: {}, diff: { hasAnyDelta: true } }
      },
      comparisons: { hasUrlChange: false, hasDomChange: false, hasVisibleChange: false },
      attemptMeta: { repeated: false }
    }
  },
  {
    name: 'navigation_proven_no_feedback_no_url_change',
    input: {
      findingType: 'navigation_silent_failure',
      expectation: { proof: 'PROVEN_EXPECTATION' },
      sensors: {
        network: { totalRequests: 1 },
        console: { hasErrors: true, errors: 1 },
        uiSignals: { before: {}, after: {}, diff: { hasAnyDelta: true } }
      },
      comparisons: { hasUrlChange: false, hasDomChange: false, hasVisibleChange: false },
      attemptMeta: { repeated: true }
    }
  },
  {
    name: 'navigation_weak_feedback_and_url_change_missing_ui',
    input: {
      findingType: 'navigation_silent_failure',
      expectation: { expectationStrength: 'WEAK' },
      sensors: {
        network: { totalRequests: 1 },
        console: { errors: 0 },
        uiSignals: { before: { hasErrorSignal: true }, after: {} }
      },
      comparisons: { hasUrlChange: true, hasDomChange: false, hasVisibleChange: false },
      attemptMeta: { repeated: false }
    }
  },
  {
    name: 'partial_navigation_observed_not_repeated_no_feedback',
    input: {
      findingType: 'partial_navigation_failure',
      expectation: { expectationStrength: 'OBSERVED' },
      sensors: {
        network: { totalRequests: 1 },
        console: { errors: 0 },
        uiSignals: { before: {}, after: {}, diff: { hasAnyDelta: true } }
      },
      comparisons: { hasUrlChange: true, hasDomChange: false, hasVisibleChange: false },
      attemptMeta: { repeated: false }
    }
  },
  {
    name: 'partial_navigation_observed_repeated_with_feedback',
    input: {
      findingType: 'partial_navigation_failure',
      expectation: { expectationStrength: 'OBSERVED' },
      sensors: {
        network: { totalRequests: 1 },
        console: { errors: 0 },
        uiSignals: { before: { hasStatusSignal: true }, after: {}, diff: { hasAnyDelta: true } }
      },
      comparisons: { hasUrlChange: true, hasDomChange: true, hasVisibleChange: true },
      attemptMeta: { repeated: true }
    }
  },
  {
    name: 'no_effect_proven_no_url_no_dom_no_screenshot',
    input: {
      findingType: 'no_effect_silent_failure',
      expectation: { proof: 'PROVEN_EXPECTATION' },
      sensors: {
        network: { totalRequests: 1 },
        console: { errors: 0 },
        uiSignals: { before: {}, after: {}, diff: { hasAnyDelta: false } }
      },
      comparisons: { hasUrlChange: false, hasDomChange: false, hasVisibleChange: false },
      attemptMeta: { repeated: true }
    }
  },
  {
    name: 'no_effect_weak_with_network_and_feedback',
    input: {
      findingType: 'no_effect_silent_failure',
      expectation: { expectationStrength: 'WEAK' },
      sensors: {
        network: { failedRequests: 1, totalRequests: 1 },
        console: { errors: 0 },
        uiSignals: { before: { hasLoadingIndicator: true }, after: {}, diff: { hasAnyDelta: true } }
      },
      comparisons: { hasUrlChange: false, hasDomChange: false, hasVisibleChange: false },
      attemptMeta: { repeated: false }
    }
  },
  {
    name: 'no_effect_observed_partial_changes_missing_network',
    input: {
      findingType: 'no_effect_silent_failure',
      expectation: { expectationStrength: 'OBSERVED' },
      sensors: {
        network: { totalRequests: 0 },
        console: { errors: 0 },
        uiSignals: { before: {}, after: {}, diff: { domChanged: true, visibleChanged: false } }
      },
      comparisons: { hasUrlChange: false, hasDomChange: true, hasVisibleChange: false },
      attemptMeta: { repeated: false }
    }
  },
  {
    name: 'missing_network_action_proven_no_network_no_console',
    input: {
      findingType: 'missing_network_action',
      expectation: { proof: 'PROVEN_EXPECTATION', totalRequests: 0 },
      sensors: {
        network: { totalRequests: 0, failedRequests: 0 },
        console: { errors: 0 },
        uiSignals: { before: {}, after: {}, diff: { hasAnyDelta: true } }
      },
      comparisons: { hasUrlChange: false, hasDomChange: true, hasVisibleChange: false },
      attemptMeta: { repeated: true }
    }
  },
  {
    name: 'missing_network_action_weak_with_console_and_network_failed',
    input: {
      findingType: 'missing_network_action',
      expectation: { expectationStrength: 'WEAK', totalRequests: 1 },
      sensors: {
        network: { failedRequests: 1, totalRequests: 1 },
        console: { hasErrors: true, errors: 1 },
        uiSignals: { before: {}, after: {}, diff: { hasAnyDelta: true } }
      },
      comparisons: { hasUrlChange: false, hasDomChange: false, hasVisibleChange: false },
      attemptMeta: { repeated: false }
    }
  },
  {
    name: 'missing_network_action_observed_no_network_no_console_missing_ui',
    input: {
      findingType: 'missing_network_action',
      expectation: { expectationStrength: 'OBSERVED', totalRequests: 2 },
      sensors: {
        network: { failedRequests: 0, totalRequests: 0 },
        console: { errors: 0 }
      },
      comparisons: { hasUrlChange: false, hasDomChange: true, hasVisibleChange: false },
      attemptMeta: { repeated: false }
    }
  },
  {
    name: 'missing_state_action_proven_no_dom_change_no_network',
    input: {
      findingType: 'missing_state_action',
      expectation: { proof: 'PROVEN_EXPECTATION' },
      sensors: {
        network: { totalRequests: 1 },
        console: { errors: 0 },
        uiSignals: { before: {}, after: {}, diff: { hasAnyDelta: false } }
      },
      comparisons: { hasUrlChange: true, hasDomChange: false, hasVisibleChange: false },
      attemptMeta: { repeated: true }
    }
  },
  {
    name: 'missing_state_action_weak_with_feedback_and_network',
    input: {
      findingType: 'missing_state_action',
      expectation: { expectationStrength: 'WEAK' },
      sensors: {
        network: { failedRequests: 1, totalRequests: 1 },
        console: { errors: 0 },
        uiSignals: { before: { hasStatusSignal: true }, after: {}, diff: { hasAnyDelta: true } }
      },
      comparisons: { hasUrlChange: false, hasDomChange: false, hasVisibleChange: false },
      attemptMeta: { repeated: false }
    }
  },
  {
    name: 'missing_state_action_observed_dom_unchanged_missing_console',
    input: {
      findingType: 'missing_state_action',
      expectation: { expectationStrength: 'OBSERVED' },
      sensors: {
        network: { totalRequests: 1 },
        uiSignals: { before: {}, after: {}, diff: { domChanged: false, hasAnyDelta: true } }
      },
      comparisons: { hasUrlChange: false, hasDomChange: false, hasVisibleChange: true },
      attemptMeta: { repeated: true }
    }
  },
  {
    name: 'flow_silent_failure_proven_all_sensors',
    input: {
      findingType: 'flow_silent_failure',
      expectation: { proof: 'PROVEN_EXPECTATION' },
      sensors: {
        network: { totalRequests: 3, failedRequests: 1 },
        console: { errors: 1, hasErrors: true },
        uiSignals: { before: {}, after: {}, diff: { hasAnyDelta: true } }
      },
      comparisons: { hasUrlChange: true, hasDomChange: true, hasVisibleChange: false },
      attemptMeta: { repeated: true }
    }
  },
  {
    name: 'flow_silent_failure_weak_missing_sensors',
    input: {
      findingType: 'flow_silent_failure',
      expectation: { expectationStrength: 'WEAK' },
      sensors: {
        network: { totalRequests: 1 }
      },
      comparisons: { hasUrlChange: false, hasDomChange: false, hasVisibleChange: false },
      attemptMeta: { repeated: false }
    }
  },
  {
    name: 'flow_silent_failure_observed_not_repeated',
    input: {
      findingType: 'flow_silent_failure',
      expectation: { expectationStrength: 'OBSERVED' },
      sensors: {
        network: { totalRequests: 1 },
        console: { errors: 0 },
        uiSignals: { before: {}, after: {}, diff: { hasAnyDelta: true } }
      },
      comparisons: { hasUrlChange: false, hasDomChange: true, hasVisibleChange: false },
      attemptMeta: { repeated: false }
    }
  },
  {
    name: 'observed_break_proven_all_signals_on',
    input: {
      findingType: 'observed_break',
      expectation: { proof: 'PROVEN_EXPECTATION' },
      sensors: {
        network: { failedRequests: 2, totalRequests: 2 },
        console: { hasErrors: true, errors: 2 },
        uiSignals: { before: { hasErrorSignal: true }, after: {}, diff: { hasAnyDelta: true } }
      },
      comparisons: { hasUrlChange: true, hasDomChange: true, hasVisibleChange: true },
      attemptMeta: { repeated: true }
    }
  },
  {
    name: 'observed_break_weak_all_signals_off',
    input: {
      findingType: 'observed_break',
      expectation: { expectationStrength: 'WEAK' },
      sensors: {
        network: { totalRequests: 0 },
        console: { errors: 0 },
        uiSignals: { before: {}, after: {}, diff: { hasAnyDelta: false } }
      },
      comparisons: { hasUrlChange: false, hasDomChange: false, hasVisibleChange: false },
      attemptMeta: { repeated: false }
    }
  },
  {
    name: 'observed_break_observed_repeated_mixed_signals',
    input: {
      findingType: 'observed_break',
      expectation: { expectationStrength: 'OBSERVED' },
      sensors: {
        network: { failedRequests: 1, totalRequests: 1 },
        console: { errors: 0 },
        uiSignals: { before: { hasLoadingIndicator: true }, after: {}, diff: { hasAnyDelta: true } }
      },
      comparisons: { hasUrlChange: true, hasDomChange: false, hasVisibleChange: false },
      attemptMeta: { repeated: true }
    }
  }
];

for (const scenario of scenarios) {
  test(`data-driven matches legacy for ${scenario.name}`, () => {
    const newOutput = computeConfidence(scenario.input);
    const legacyOutput = computeConfidenceWithLegacyScorers(scenario.input);

    const newString = JSON.stringify(newOutput);
    const legacyString = JSON.stringify(legacyOutput);

    if (newString !== legacyString) {
      assert.fail(`${scenario.name}: ${summarizeDiff(newOutput, legacyOutput)}`);
    }
  });
}
