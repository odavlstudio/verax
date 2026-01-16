import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { computeDOMDiff, hasFeedbackElements as _hasFeedbackElements, hasValidationErrors as _hasValidationErrors } from './dom-diff.js';

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
    };
    this.files = [];
    this.correlatedRequests = []; // Network requests correlated to this action
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
  analyzeChanges(urlBefore, urlAfter) {
    // Navigation change
    if (urlBefore && urlAfter && urlBefore !== urlAfter) {
      this.signals.navigationChanged = true;
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
    
    const actionTime = new Date(this.actionStartTime).getTime();
    const correlationWindow = 2500; // milliseconds
    
    for (const event of this.networkEvents) {
      if (event.startTime) {
        const eventTime = new Date(event.startTime).getTime();
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
    this.timing.endedAt = new Date().toISOString();
    
    // Persist evidence files
    try {
      mkdirSync(this.evidencePath, { recursive: true });
      
      // Save DOM diff if available
      if (this.domDiff) {
        const diffFile = `exp_${this.expNum}_dom_diff.json`;
        writeFileSync(
          resolve(this.evidencePath, diffFile),
          JSON.stringify(this.domDiff, null, 2),
          'utf-8'
        );
        this.files.push(diffFile);
      }
      
      // Save network events if any
      if (this.networkEvents.length > 0) {
        const netFile = `exp_${this.expNum}_network.json`;
        writeFileSync(
          resolve(this.evidencePath, netFile),
          JSON.stringify(this.networkEvents, null, 2),
          'utf-8'
        );
        this.files.push(netFile);
      }
      
      // Save console errors if any
      if (this.consoleErrors.length > 0) {
        const errFile = `exp_${this.expNum}_console_errors.json`;
        writeFileSync(
          resolve(this.evidencePath, errFile),
          JSON.stringify(this.consoleErrors, null, 2),
          'utf-8'
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
   * Summarize signals for observation
   */
  getSummary() {
    return {
      files: this.files,
      timing: this.timing,
      signals: this.signals,
      hasEvidence: this.hasEvidence(),
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
