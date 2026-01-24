/**
 * PHASE 21.3 — UI Feedback Observer
 * 
 * Responsibilities:
 * - DOM mutation observation
 * - Loading / disabled / feedback signals
 * - UI settle signals (NO adaptive waiting - that's in settle.js)
 * 
 * NO file I/O
 * NO side effects outside its scope
 */

import { UISignalSensor } from '../ui-signal-sensor.js';
import { captureDomSignature } from '../dom-signature.js';

/**
 * Observe UI feedback and DOM state on current page
 * 
 * @param {Object} context - Observe context
 * @param {Object} _runState - Current run state
 * @returns {Promise<Array<Object>>} Array of UI feedback observations
 */
export async function observe(context, _runState) {
  const { page, currentUrl, timestamp } = context;
  const observations = [];
  
  try {
    // Capture current UI signals
    const uiSignalSensor = new UISignalSensor();
    const uiSignals = await uiSignalSensor.snapshot(page);
    
    // Capture DOM signature for mutation tracking
    const domSignature = await captureDomSignature(page);
    
    // Create observation for UI signals
    observations.push({
      type: 'ui_feedback',
      scope: 'page',
      data: {
        hasLoadingIndicator: uiSignals.hasLoadingIndicator,
        hasDialog: uiSignals.hasDialog,
        hasErrorSignal: uiSignals.hasErrorSignal,
        hasStatusSignal: uiSignals.hasStatusSignal,
        hasLiveRegion: uiSignals.hasLiveRegion,
        validationFeedbackDetected: uiSignals.validationFeedbackDetected,
        disabledElementsCount: uiSignals.disabledElements?.length || 0,
        explanation: uiSignals.explanation || []
      },
      timestamp,
      url: currentUrl
    });
    
    // Create observation for DOM state
    observations.push({
      type: 'dom_state',
      scope: 'page',
      data: {
        domHash: domSignature,
        hasDom: !!domSignature
      },
      timestamp,
      url: currentUrl
    });
    
    // If there are loading indicators, create specific observation
    if (uiSignals.hasLoadingIndicator) {
      observations.push({
        type: 'ui_loading',
        scope: 'page',
        data: {
          loading: true,
          explanation: uiSignals.explanation?.filter(e => e.includes('loading') || e.includes('busy')) || []
        },
        timestamp,
        url: currentUrl
      });
    }
    
    // If there are disabled elements, create observation
    if (uiSignals.disabledElements && uiSignals.disabledElements.length > 0) {
      observations.push({
        type: 'ui_disabled',
        scope: 'page',
        data: {
          disabledCount: uiSignals.disabledElements.length,
          disabledElements: uiSignals.disabledElements.slice(0, 10) // Limit to 10
        },
        timestamp,
        url: currentUrl
      });
    }
  } catch (error) {
    // Propagate error - no silent catch
    throw new Error(`UI feedback observer failed: ${error.message}`);
  }
  
  return observations;
}




