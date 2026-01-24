/**
 * Internal: Detect UI feedback signals
 */

import { FEEDBACK_TYPE } from './types.js';

export function detectUIFeedbackSignals(trace) {
  const signals = [];
  const sensors = trace.sensors || {};
  const uiSignals = sensors.uiSignals || {};
  const uiFeedback = sensors.uiFeedback || {};
  const _before = trace.before || {};
  const _after = trace.after || {};
  
  const beforeSignals = uiSignals.before || {};
  const afterSignals = uiSignals.after || {};
  const diff = uiSignals.diff || {};
  
  // 1. Loading indicators
  if (afterSignals.hasLoadingIndicator || 
      uiFeedback.signals?.loading?.appeared === true ||
      uiFeedback.signals?.loading?.disappeared === true) {
    signals.push({
      type: FEEDBACK_TYPE.LOADING,
      selector: findLoadingSelector(afterSignals),
      confidence: 0.9,
      evidence: {
        before: beforeSignals.hasLoadingIndicator || false,
        after: afterSignals.hasLoadingIndicator || false,
        appeared: uiFeedback.signals?.loading?.appeared === true,
        disappeared: uiFeedback.signals?.loading?.disappeared === true,
      },
    });
  }
  
  // 2. Disabled/blocked states
  const disabledChanged = diff.buttonStateChanged === true ||
                          (beforeSignals.disabledElements?.length || 0) !== (afterSignals.disabledElements?.length || 0) ||
                          uiFeedback.signals?.buttonStateTransition?.happened === true;
  
  if (disabledChanged) {
    signals.push({
      type: FEEDBACK_TYPE.DISABLED,
      selector: findDisabledSelector(afterSignals),
      confidence: 0.85,
      evidence: {
        beforeCount: beforeSignals.disabledElements?.length || 0,
        afterCount: afterSignals.disabledElements?.length || 0,
        buttonStateChanged: diff.buttonStateChanged === true,
      },
    });
  }
  
  // 3. Toast/snackbar notifications
  if (afterSignals.hasStatusSignal || 
      afterSignals.hasLiveRegion ||
      uiFeedback.signals?.notification?.happened === true) {
    signals.push({
      type: FEEDBACK_TYPE.TOAST,
      selector: findToastSelector(afterSignals),
      confidence: 0.9,
      evidence: {
        hasStatusSignal: afterSignals.hasStatusSignal || false,
        hasLiveRegion: afterSignals.hasLiveRegion || false,
        notification: uiFeedback.signals?.notification?.happened === true,
      },
    });
  }
  
  // 4. Modal/dialog confirmations
  if (afterSignals.hasDialog || 
      uiFeedback.signals?.domChange?.happened === true) {
    const dialogAppeared = !beforeSignals.hasDialog && afterSignals.hasDialog;
    
    if (dialogAppeared) {
      signals.push({
        type: FEEDBACK_TYPE.MODAL,
        selector: findDialogSelector(afterSignals),
        confidence: 0.95,
        evidence: {
          before: beforeSignals.hasDialog || false,
          after: afterSignals.hasDialog || false,
          appeared: dialogAppeared,
        },
      });
    }
  }
  
  // 5. Inline success/error messages
  if (afterSignals.hasErrorSignal || 
      afterSignals.validationFeedbackDetected ||
      uiFeedback.signals?.domChange?.happened === true) {
    signals.push({
      type: FEEDBACK_TYPE.INLINE_MESSAGE,
      selector: findInlineMessageSelector(afterSignals),
      confidence: 0.85,
      evidence: {
        hasErrorSignal: afterSignals.hasErrorSignal || false,
        validationFeedbackDetected: afterSignals.validationFeedbackDetected || false,
      },
    });
  }
  
  // 6. Meaningful DOM changes
  const domChanged = trace.dom?.beforeHash !== trace.dom?.afterHash ||
                     uiFeedback.signals?.domChange?.happened === true ||
                     diff.changed === true;
  
  if (domChanged) {
    const isMeaningful = isMeaningfulDOMChange(trace, uiFeedback);
    
    if (isMeaningful) {
      signals.push({
        type: FEEDBACK_TYPE.DOM_CHANGE,
        selector: null,
        confidence: 0.7,
        evidence: {
          domHashChanged: trace.dom?.beforeHash !== trace.dom?.afterHash,
          uiFeedbackDomChange: uiFeedback.signals?.domChange?.happened === true,
          uiSignalsChanged: diff.changed === true,
        },
      });
    }
  }
  
  return signals;
}

function findLoadingSelector(_signals) {
  return '[aria-busy="true"], [data-loading], [role="status"]';
}

function findDisabledSelector(_signals) {
  return '[disabled], [aria-disabled="true"]';
}

function findToastSelector(_signals) {
  return '[role="alert"], [role="status"], [aria-live], .toast, .snackbar';
}

function findDialogSelector(_signals) {
  return '[role="dialog"], [aria-modal="true"]';
}

function findInlineMessageSelector(_signals) {
  return '[role="alert"], .error, .success, [class*="message"]';
}

function isMeaningfulDOMChange(trace, uiFeedback) {
  if (uiFeedback.signals?.domChange?.happened === true) {
    return true;
  }
  if (trace.dom?.beforeHash !== trace.dom?.afterHash) {
    const uiSignals = trace.sensors?.uiSignals || {};
    if (uiSignals.diff?.changed === true) {
      return true;
    }
  }
  return false;
}
