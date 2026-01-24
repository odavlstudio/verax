import { scoreNetworkSilentFailure, penalizeNetworkSilentFailure } from './network_silent_failure.js';
import { scoreValidationSilentFailure, penalizeValidationSilentFailure } from './validation_silent_failure.js';
import { scoreMissingFeedbackFailure, penalizeMissingFeedbackFailure } from './missing_feedback_failure.js';
import { scoreNoEffectSilentFailure, penalizeNoEffectSilentFailure } from './no_effect_silent_failure.js';
import { scoreMissingNetworkAction, penalizeMissingNetworkAction } from './missing_network_action.js';
import { scoreMissingStateAction, penalizeMissingStateAction } from './missing_state_action.js';
import { scoreNavigationSilentFailure, penalizeNavigationSilentFailure } from './navigation_silent_failure.js';
import { scorePartialNavigationFailure, penalizePartialNavigationFailure } from './partial_navigation_failure.js';
import { scoreFlowSilentFailure, penalizeFlowSilentFailure } from './flow_silent_failure.js';
import { scoreObservedBreak, penalizeObservedBreak } from './observed_break.js';

export function scoreByFindingType({
  findingType,
  expectation,
  expectationStrength,
  networkSummary: _networkSummary,
  consoleSummary: _consoleSummary,
  uiSignals: _uiSignals,
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
      totalBoosts = scoreNetworkSilentFailure({ evidenceSignals, boosts });
      totalPenalties = penalizeNetworkSilentFailure({ evidenceSignals, penalties });
      break;

    case 'validation_silent_failure':
      totalBoosts = scoreValidationSilentFailure({ evidenceSignals, boosts });
      totalPenalties = penalizeValidationSilentFailure({ evidenceSignals, penalties });
      break;

    case 'missing_feedback_failure':
      totalBoosts = scoreMissingFeedbackFailure({ evidenceSignals, boosts });
      totalPenalties = penalizeMissingFeedbackFailure({ evidenceSignals, penalties });
      break;

    case 'no_effect_silent_failure':
      totalBoosts = scoreNoEffectSilentFailure({ evidenceSignals, boosts });
      totalPenalties = penalizeNoEffectSilentFailure({ evidenceSignals, penalties });
      break;

    case 'missing_network_action':
      totalBoosts = scoreMissingNetworkAction({ expectation, expectationStrength, evidenceSignals, boosts });
      totalPenalties = penalizeMissingNetworkAction({ evidenceSignals, penalties });
      break;

    case 'missing_state_action':
      totalBoosts = scoreMissingStateAction({ expectationStrength, evidenceSignals, boosts });
      totalPenalties = penalizeMissingStateAction({ evidenceSignals, penalties });
      break;

    case 'navigation_silent_failure':
      totalBoosts = scoreNavigationSilentFailure({ evidenceSignals, boosts });
      totalPenalties = penalizeNavigationSilentFailure({ evidenceSignals, penalties });
      break;

    case 'partial_navigation_failure':
      totalBoosts = scorePartialNavigationFailure({ evidenceSignals, boosts });
      totalPenalties = penalizePartialNavigationFailure({ evidenceSignals, penalties });
      break;

    case 'flow_silent_failure':
      totalBoosts = scoreFlowSilentFailure({ boosts });
      totalPenalties = penalizeFlowSilentFailure({ penalties });
      break;

    case 'observed_break':
      totalBoosts = scoreObservedBreak({ boosts });
      totalPenalties = penalizeObservedBreak({ penalties });
      break;
  }

  return { totalBoosts, totalPenalties };
}
