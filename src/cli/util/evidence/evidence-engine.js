import { getTimeProvider } from '../support/time-provider.js';
import { mkdirSync } from 'fs';
import { resolve } from 'path';
import { computeDOMDiff, hasFeedbackElements as _hasFeedbackElements, hasValidationErrors as _hasValidationErrors } from '../observation/dom-diff.js';
import { atomicWriteJson } from '../support/atomic-write.js';

/**
 * Evidence Engine
 * Captures and bundles evidence for each interaction attempt
 */

export class EvidenceBundle {
  constructor(promiseId, expNum, evidencePath) {
    this.promiseId = promiseId;
    this.expNum = expNum;
    this.evidencePath = evidencePath;
    this.beforeScreenshot = null;
    this.afterScreenshot = null;
    this.beforeHTML = null;
    this.afterHTML = null;
    this.domDiff = null;
    this.networkEvents = [];
    this.networkEventsByTime = new Map(); // For correlation
    this.consoleErrors = [];
    this.actionStartTime = null; // When action was executed
    this.timing = {
      startedAt: null,
      endedAt: null,
    };
    this.signals = {
      navigationChanged: false,
      domChanged: false,
      feedbackSeen: false,
      networkActivity: false,
      consoleErrors: false,
      meaningfulDomChange: false, // NEW: tracks only meaningful changes
      correlatedNetworkActivity: false, // NEW: tracks network within action window
      routeChanged: false,
      outcomeAcknowledged: false,
      delayedAcknowledgment: false,
      meaningfulUIChange: false,
      submissionTriggered: false,
      networkAttemptAfterSubmit: false,
    };
    this.files = [];
    this.correlatedRequests = []; // Network requests correlated to this action
    this.routeData = {
      before: null,
      after: null,
      transitions: [],
      signatureChanged: false
    };
    this.outcomeWatcher = null;
    this.mutationSummary = null;
    this.mutationAnalysis = null;
    this.interactionIntentRecord = null;
    this.interactionIntentClassification = null;
    this.interactionAcknowledgment = null;
  }
  
  /**
   * Capture before state
   */
  async captureBeforeState(page, suffix = '') {
    try {
      this.beforeScreenshot = `exp_${this.expNum}_before${suffix}.png`;
      const screenshotPath = resolve(this.evidencePath, this.beforeScreenshot);
      await page.screenshot({ path: screenshotPath });
      this.files.push(this.beforeScreenshot);
    } catch (e) {
      this.beforeScreenshot = null;
    }
    
    try {
      this.beforeHTML = await page.content();
    } catch (e) {
      this.beforeHTML = null;
    }
  }
  
  /**
   * Capture after state
   */
  async captureAfterState(page, suffix = '') {
    try {
      this.afterScreenshot = `exp_${this.expNum}_after${suffix}.png`;
      const screenshotPath = resolve(this.evidencePath, this.afterScreenshot);
      await page.screenshot({ path: screenshotPath });
      this.files.push(this.afterScreenshot);
    } catch (e) {
      this.afterScreenshot = null;
    }
    
    try {
      this.afterHTML = await page.content();
    } catch (e) {
      this.afterHTML = null;
    }
  }
  
  /**
   * Analyze changes between before and after
   */
  analyzeChanges(urlBefore, urlAfter, routeData = null, phase2Data = null) {
    // Navigation change (legacy URL comparison)
    if (urlBefore && urlAfter && urlBefore !== urlAfter) {
      this.signals.navigationChanged = true;
    }
    if (routeData) {
      this.routeData = routeData;
      if (routeData.signatureChanged || routeData.transitions.length > 0) {
        this.signals.routeChanged = true;
        // If route changed via History API or signature, count as navigation
        this.signals.navigationChanged = true;
      }
    }
    if (phase2Data?.outcomeWatcher) {
      this.outcomeWatcher = phase2Data.outcomeWatcher;
      if (phase2Data.outcomeWatcher.acknowledged) {
        this.signals.outcomeAcknowledged = true;
      }
      if (phase2Data.outcomeWatcher.latencyBucket && 
          (phase2Data.outcomeWatcher.latencyBucket === '6-10s' || phase2Data.outcomeWatcher.latencyBucket === '>10s')) {
        this.signals.delayedAcknowledgment = true;
      }
    }
    if (phase2Data?.mutationSummary && phase2Data?.mutationAnalysis) {
      this.mutationSummary = phase2Data.mutationSummary;
      this.mutationAnalysis = phase2Data.mutationAnalysis;
      
      if (phase2Data.mutationAnalysis.meaningful) {
        this.signals.meaningfulUIChange = true;
      }
    }
    
    // DOM change
    if (this.beforeHTML && this.afterHTML) {
      this.domDiff = computeDOMDiff(this.beforeHTML, this.afterHTML);
      if (this.domDiff.changed) {
        this.signals.domChanged = true;
      }
      
      // Track meaningful changes separately
      if (this.domDiff.isMeaningful) {
        this.signals.meaningfulDomChange = true;
      }
      
      // TRUST FIX 1: Text content changes in aria-live regions are user-visible feedback
      // If meaningful changes include text content updates (detected by detectTextContentChanges),
      // mark as feedback seen
      if (this.domDiff.contentChanged && this.domDiff.contentChanged.length > 0) {
        this.signals.feedbackSeen = true;
      }
      
      // Check for feedback elements visibility change
      if (detectNewFeedback(this.beforeHTML, this.afterHTML)) {
        this.signals.feedbackSeen = true;
      }
      
      // Check for validation error appearance
      if (detectNewValidationError(this.beforeHTML, this.afterHTML)) {
        this.signals.feedbackSeen = true;
      }
    }
  }
  
  /**
   * Record network events that occurred during this action
   */
  recordNetworkEvent(networkLog) {
    this.networkEvents.push(networkLog);
    
    // Track event time for correlation
    if (networkLog.startTime) {
      this.networkEventsByTime.set(networkLog.startTime, networkLog);
    }
    
    if (this.networkEvents.length > 0) {
      this.signals.networkActivity = true;
    }
  }
  
  /**
   * Correlate network events to this action
   * Captures requests that started within correlation window after action
   * Window: 0-2500ms after action starts
   */
  correlateNetworkRequests() {
    if (!this.actionStartTime || this.networkEvents.length === 0) {
      return;
    }
    
    const actionTime = Date.parse(this.actionStartTime);
    const correlationWindow = 2500; // milliseconds
    
    for (const event of this.networkEvents) {
      if (event.startTime) {
        const eventTime = Date.parse(event.startTime);
        if (eventTime >= actionTime && eventTime <= actionTime + correlationWindow) {
          this.correlatedRequests.push(event);
          this.signals.correlatedNetworkActivity = true;
        }
      }
    }
  }
  
  /**
   * Record console errors
   */
  recordConsoleError(error) {
    this.consoleErrors.push(error);
    if (this.consoleErrors.length > 0) {
      this.signals.consoleErrors = true;
    }
  }
  
  /**
   * Finalize evidence bundle
   */
  finalize(_page) {
    this.timing.endedAt = getTimeProvider().iso();
    
    // Persist evidence files
    try {
      mkdirSync(this.evidencePath, { recursive: true });
      
      // Save DOM diff if available
      if (this.domDiff) {
        const diffFile = `exp_${this.expNum}_dom_diff.json`;
        atomicWriteJson(
          resolve(this.evidencePath, diffFile),
          this.domDiff
        );
        this.files.push(diffFile);
      }
      
      // Save network events if any
      if (this.networkEvents.length > 0) {
        const netFile = `exp_${this.expNum}_network.json`;
        atomicWriteJson(
          resolve(this.evidencePath, netFile),
          this.networkEvents
        );
        this.files.push(netFile);
      }
      
      // Save console errors if any
      if (this.consoleErrors.length > 0) {
        const errFile = `exp_${this.expNum}_console_errors.json`;
        atomicWriteJson(
          resolve(this.evidencePath, errFile),
          this.consoleErrors
        );
        this.files.push(errFile);
      }
    } catch (e) {
      // Best effort
    }
  }
  
  /**
   * Check if we have meaningful evidence
   */
  hasEvidence() {
    return (
      this.beforeScreenshot ||
      this.afterScreenshot ||
      this.domDiff?.changed ||
      this.networkEvents.length > 0 ||
      this.consoleErrors.length > 0 ||
      Object.values(this.signals).some(v => v === true)
    );
  }
  
  /**
   * PHASE 3: Set interaction intent record
   */
  setInteractionIntentRecord(record) {
    this.interactionIntentRecord = record;
  }
  
  /**
   * PHASE 3: Set interaction intent classification
   */
  setInteractionIntentClassification(classification) {
    this.interactionIntentClassification = classification;
  }
  
  /**
   * Summarize signals for observation
   */
  getSummary() {
    return {
      files: this.files,
      timing: this.timing,
      signals: this.signals,
      routeData: this.routeData,
      outcomeWatcher: this.outcomeWatcher,
      mutationSummary: this.mutationSummary,
      mutationAnalysis: this.mutationAnalysis,
      correlatedRequests: this.correlatedRequests,
      hasEvidence: this.hasEvidence(),
      interactionIntent: this.interactionIntentRecord ? {
        record: this.interactionIntentRecord,
        classification: this.interactionIntentClassification
      } : null,
    };
  }
}

/**
 * Create a bundle for a promise
 */
export function createEvidenceBundle(promise, expNum, evidencePath) {
  return new EvidenceBundle(promise.id, expNum, evidencePath);
}

/**
 * Detect if new feedback elements appeared
 */
function detectNewFeedback(htmlBefore, htmlAfter) {
  const feedbackPatterns = [
    'role="alert"',
    'role="status"',
    'aria-live="polite"',
    'aria-live="assertive"',
    'class="toast"',
    'class="modal"',
    'class="dialog"',
  ];
  
  for (const pattern of feedbackPatterns) {
    if (!htmlBefore.includes(pattern) && htmlAfter.includes(pattern)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Detect if new validation errors appeared
 */
function detectNewValidationError(htmlBefore, htmlAfter) {
  const errorPatterns = [
    'aria-invalid="true"',
    'aria-invalid=\'true\'',
    'class="error"',
    'class="invalid"',
    '[data-error]',
  ];
  
  for (const pattern of errorPatterns) {
    if (!htmlBefore.includes(pattern) && htmlAfter.includes(pattern)) {
      return true;
    }
  }
  
  return false;
}



