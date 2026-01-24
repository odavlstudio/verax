/**
 * PHASE 21.4 — Guardrails Policy Defaults
 * 
 * Default guardrails policy extracted from hardcoded rules.
 * All rules are mandatory and cannot be disabled.
 */

/**
 * PHASE 17: Guardrails Rule Codes
 */
export const GUARDRAILS_RULE = {
  NET_SUCCESS_NO_UI: 'GUARD_NET_SUCCESS_NO_UI',
  ANALYTICS_ONLY: 'GUARD_ANALYTICS_ONLY',
  SHALLOW_ROUTING: 'GUARD_SHALLOW_ROUTING',
  UI_FEEDBACK_PRESENT: 'GUARD_UI_FEEDBACK_PRESENT',
  INTERACTION_BLOCKED: 'GUARD_INTERACTION_BLOCKED',
  VALIDATION_PRESENT: 'GUARD_VALIDATION_PRESENT',
  CONTRADICT_EVIDENCE: 'GUARD_CONTRADICT_EVIDENCE',
  VIEW_SWITCH_MINOR_CHANGE: 'GUARD_VIEW_SWITCH_MINOR_CHANGE',
  VIEW_SWITCH_ANALYTICS_ONLY: 'GUARD_VIEW_SWITCH_ANALYTICS_ONLY',
  VIEW_SWITCH_AMBIGUOUS: 'GUARD_VIEW_SWITCH_AMBIGUOUS',
};

/**
 * Default guardrails policy
 * 
 * This policy matches the current hardcoded behavior exactly.
 */
export const DEFAULT_GUARDRAILS_POLICY = {
  version: '21.4.0',
  source: 'default',
  rules: [
    {
      id: GUARDRAILS_RULE.NET_SUCCESS_NO_UI,
      category: 'network',
      trigger: 'Network request succeeded but no UI change observed',
      action: 'BLOCK',
      confidenceDelta: -0.3,
      appliesTo: ['silent_failure', 'network'],
      mandatory: true,
      evaluation: {
        type: 'network_success_no_ui',
        conditions: {
          networkSuccess: true,
          noUiChange: true,
          noErrors: true,
          isSilentFailure: true,
          isConfirmed: true
        }
      }
    },
    {
      id: GUARDRAILS_RULE.ANALYTICS_ONLY,
      category: 'network',
      trigger: 'Only analytics/beacon requests detected',
      action: 'BLOCK',
      confidenceDelta: -0.5,
      appliesTo: ['network', 'silent_failure'],
      mandatory: true,
      evaluation: {
        type: 'analytics_only',
        conditions: {
          isAnalyticsOnly: true,
          isNetworkFinding: true,
          isConfirmed: true,
          singleRequest: true
        }
      }
    },
    {
      id: GUARDRAILS_RULE.SHALLOW_ROUTING,
      category: 'navigation',
      trigger: 'Hash-only or shallow routing detected',
      action: 'BLOCK',
      confidenceDelta: -0.2,
      appliesTo: ['navigation', 'route'],
      mandatory: true,
      evaluation: {
        type: 'shallow_routing',
        conditions: {
          isHashOnly: true,
          isShallowRouting: true,
          isNavigationFinding: true,
          isConfirmed: true
        }
      }
    },
    {
      id: GUARDRAILS_RULE.UI_FEEDBACK_PRESENT,
      category: 'ui-feedback',
      trigger: 'UI feedback is present, contradicting silent failure claim',
      action: 'BLOCK',
      confidenceDelta: -0.4,
      appliesTo: ['silent_failure', 'feedback_missing'],
      mandatory: true,
      evaluation: {
        type: 'ui_feedback_present',
        conditions: {
          hasFeedback: true,
          isSilentFailure: true,
          isConfirmed: true
        }
      }
    },
    {
      id: GUARDRAILS_RULE.INTERACTION_BLOCKED,
      category: 'state',
      trigger: 'Interaction was disabled/blocked',
      action: 'INFO',
      confidenceDelta: -0.5,
      appliesTo: ['silent_failure'],
      mandatory: true,
      evaluation: {
        type: 'interaction_blocked',
        conditions: {
          isDisabled: true,
          isSilentFailure: true,
          isConfirmed: true
        }
      }
    },
    {
      id: GUARDRAILS_RULE.VALIDATION_PRESENT,
      category: 'validation',
      trigger: 'Validation feedback is present, contradicting validation failure claim',
      action: 'BLOCK',
      confidenceDelta: -0.3,
      appliesTo: ['validation', 'form'],
      mandatory: true,
      evaluation: {
        type: 'validation_present',
        conditions: {
          hasValidationFeedback: true,
          isValidationFailure: true,
          isConfirmed: true
        }
      }
    },
    {
      id: GUARDRAILS_RULE.CONTRADICT_EVIDENCE,
      category: 'state',
      trigger: 'Evidence package is incomplete',
      action: 'BLOCK',
      confidenceDelta: -0.2,
      appliesTo: ['*'], // Applies to all findings
      mandatory: true,
      evaluation: {
        type: 'contradict_evidence',
        conditions: {
          isConfirmed: true,
          evidenceIncomplete: true
        }
      }
    },
    {
      id: GUARDRAILS_RULE.VIEW_SWITCH_MINOR_CHANGE,
      category: 'view-switch',
      trigger: 'URL unchanged and change is minor (e.g. button text only)',
      action: 'BLOCK',
      confidenceDelta: -0.4,
      appliesTo: ['view_switch', 'state_action'],
      mandatory: true,
      evaluation: {
        type: 'view_switch_minor_change',
        conditions: {
          isViewSwitch: true,
          urlUnchanged: true,
          isMinorChange: true,
          isConfirmed: true
        }
      }
    },
    {
      id: GUARDRAILS_RULE.VIEW_SWITCH_ANALYTICS_ONLY,
      category: 'view-switch',
      trigger: 'Only analytics fired, no UI change',
      action: 'BLOCK',
      confidenceDelta: -0.5,
      appliesTo: ['view_switch', 'state_action'],
      mandatory: true,
      evaluation: {
        type: 'view_switch_analytics_only',
        conditions: {
          isViewSwitch: true,
          analyticsOnly: true,
          isConfirmed: true
        }
      }
    },
    {
      id: GUARDRAILS_RULE.VIEW_SWITCH_AMBIGUOUS,
      category: 'view-switch',
      trigger: 'State change promise exists but UI outcome ambiguous (one signal only)',
      action: 'DOWNGRADE',
      confidenceDelta: -0.3,
      appliesTo: ['view_switch', 'state_action'],
      mandatory: true,
      evaluation: {
        type: 'view_switch_ambiguous',
        conditions: {
          isViewSwitch: true,
          hasPromise: true,
          ambiguousOutcome: true,
          isConfirmed: true
        }
      }
    }
  ]
};




