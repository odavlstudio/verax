/**
 * Timing Sensor
 * Tracks timing of feedback signals (UI changes, ARIA, loading indicators)
 * Detects delayed or missing feedback after interactions
 */

export class TimingSensor {
  constructor(options = {}) {
    this.feedbackGapThresholdMs = options.feedbackGapThresholdMs || 1500;
    this.freezeLikeThresholdMs = options.freezeLikeThresholdMs || 3000;
    
    this.t0 = null; // Interaction start time
    this.tNetworkFirst = null; // First network request time
    this.tLoadingStart = null; // Loading indicator appears
    this.tAriaFirst = null; // First ARIA change
    this.tUiFirst = null; // First DOM/UI change
    this.tFeedback = null; // First feedback signal (min of above)
    
    this.networkActivityDetected = false;
    this.feedbackDetected = false;
    this.feedbackDelayMs = 0;
    this.workStartMs = 0;
  }

  /**
   * Start timing from interaction initiation
   */
  startTiming() {
    this.t0 = Date.now();
    return this.t0;
  }

  /**
   * Monitor for feedback signals during interaction
   * Call periodically or at key moments to track timing
   */
  async captureTimingSnapshot(page) {
    if (!this.t0) {
      this.t0 = Date.now();
    }

    const now = Date.now();
    const elapsedMs = now - this.t0;

    // Capture current state
    const state = await page.evaluate(() => {
      const result = {
        loadingPresent: false,
        ariaStatusPresent: false,
        ariaLivePresent: false,
        buttonDisabled: false,
        domChanged: false
      };

      // Check for loading indicators
      const loading = document.querySelectorAll('[aria-busy="true"], [class*="load"], [class*="spin"], .loader, .spinner');
      result.loadingPresent = loading.length > 0;

      // Check for ARIA status/alert
      const ariaStatus = document.querySelectorAll('[role="status"], [role="alert"]');
      ariaStatus.forEach(el => {
        if (el.textContent?.length > 0) {
          result.ariaStatusPresent = true;
        }
      });

      // Check for ARIA live regions
      const ariaLive = document.querySelectorAll('[aria-live]');
      ariaLive.forEach(el => {
        if (el.textContent?.length > 0) {
          result.ariaLivePresent = true;
        }
      });

      // Check for disabled submit buttons (common feedback)
      const disabledButtons = document.querySelectorAll('button[type="submit"]:disabled, button:disabled');
      result.buttonDisabled = disabledButtons.length > 0;

      return result;
    });

    // First loading indicator
    if (state.loadingPresent && !this.tLoadingStart) {
      this.tLoadingStart = now;
    }

    // First ARIA change
    if ((state.ariaStatusPresent || state.ariaLivePresent) && !this.tAriaFirst) {
      this.tAriaFirst = now;
    }

    // Record button disabled state as feedback signal
    if (state.buttonDisabled) {
      if (!this.tFeedback) {
        this.tFeedback = now;
      }
      // Also record as button disabled time
      this.recordButtonDisabled(now);
    }

    // Determine first feedback signal
    if (!this.tFeedback) {
      const signals = [this.tLoadingStart, this.tAriaFirst, this.tUiFirst].filter(t => t !== null);
      if (signals.length > 0) {
        this.tFeedback = Math.min(...signals);
      }
    }

    return {
      elapsedMs,
      state,
      hasLoadingIndicator: state.loadingPresent,
      hasAriaFeedback: state.ariaStatusPresent || state.ariaLivePresent,
      hasButtonDisabled: state.buttonDisabled
    };
  }

  /**
   * Analyze network summary to detect if work started
   * Records the time when first network request was detected
   */
  analyzeNetworkSummary(networkSummary) {
    if (!networkSummary || networkSummary.totalRequests === 0) {
      return;
    }
    
    if (!this.tNetworkFirst) {
      // Network requests started - estimate based on interaction start + small delay
      // Network sensor tracks when requests were made, but we estimate based on t0
      // Most network requests start within 50-200ms after interaction
      const estimatedNetworkStart = this.t0 + 100; // Conservative estimate
      this.tNetworkFirst = estimatedNetworkStart;
      this.networkActivityDetected = true;
    }
  }

  /**
   * Record when loading sensor detected activity
   * Called when loading indicators appear
   */
  recordLoadingStart(timestamp = null) {
    if (!this.tLoadingStart) {
      this.tLoadingStart = timestamp || Date.now();
      // Loading indicates work started even if network not detected yet
      if (!this.networkActivityDetected) {
        this.networkActivityDetected = true;
      }
    }
  }

  /**
   * Record when UI changed (from sensor)
   */
  recordUiChange(timestamp = null) {
    if (!this.tUiFirst) {
      this.tUiFirst = timestamp || Date.now();
    }
  }

  /**
   * Record when button disabled state detected (feedback signal)
   */
  recordButtonDisabled(timestamp = null) {
    if (!this.tFeedback) {
      const now = timestamp || Date.now();
      // Check if this is earlier than other feedback signals
      const signals = [this.tLoadingStart, this.tAriaFirst, this.tUiFirst].filter(t => t !== null);
      if (signals.length === 0 || now < Math.min(...signals)) {
        this.tFeedback = now;
      }
    }
  }

  /**
   * Get final timing analysis
   */
  getTimingAnalysis() {
    if (!this.t0) {
      return null;
    }

    const now = Date.now();

    // Determine when work started (network or loading indicator)
    const workStartTime = this.tNetworkFirst || this.tLoadingStart;
    this.workStartMs = workStartTime ? workStartTime - this.t0 : -1;

    // Determine when feedback appeared (first of: loading, ARIA, UI change, button disabled)
    const feedbackTimes = [this.tLoadingStart, this.tAriaFirst, this.tUiFirst].filter(t => t !== null);
    if (this.tFeedback && !feedbackTimes.includes(this.tFeedback)) {
      feedbackTimes.push(this.tFeedback);
    }
    this.tFeedback = feedbackTimes.length > 0 ? Math.min(...feedbackTimes) : null;
    this.feedbackDelayMs = this.tFeedback ? this.tFeedback - this.t0 : -1;

    // Check if feedback gap exists: work started but no feedback within threshold
    const hasFeedbackGap = 
      this.networkActivityDetected && 
      (!this.tFeedback || this.feedbackDelayMs > this.feedbackGapThresholdMs);

    // Check if freeze-like: significant delay (>3000ms) before feedback
    const isFreezeLike = 
      this.networkActivityDetected && 
      this.tFeedback !== null &&
      this.feedbackDelayMs > this.freezeLikeThresholdMs;

    return {
      t0: this.t0,
      tNetworkFirst: this.tNetworkFirst,
      tLoadingStart: this.tLoadingStart,
      tAriaFirst: this.tAriaFirst,
      tUiFirst: this.tUiFirst,
      tFeedback: this.tFeedback,
      
      elapsedMs: now - this.t0,
      workStartMs: this.workStartMs,
      feedbackDelayMs: this.feedbackDelayMs,
      
      networkActivityDetected: this.networkActivityDetected,
      feedbackDetected: this.tFeedback !== null,
      hasFeedbackGap,
      isFreezeLike,
      
      feedbackGapThreshold: this.feedbackGapThresholdMs,
      freezeLikeThreshold: this.freezeLikeThresholdMs
    };
  }
}
