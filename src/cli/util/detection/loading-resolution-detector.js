/**
 * Loading Resolution Detector
 * 
 * Detects loading lifecycle patterns:
 * - Loading start (spinner, progress bar, aria-busy appears)
 * - Loading resolution (indicators disappear, content loads)
 * - Stalled loading (indicators present but content unchanged)
 * 
 * Observable only; tracks loading state transitions deterministically.
 */

export class LoadingResolutionDetector {
  /**
   * Detect loading indicators in HTML
   * @param {string} html - HTML content
   * @returns {Object} Loading indicator presence
   */
  static detectLoadingIndicators(html) {
    if (!html) {
      return { hasLoadingIndicators: false, indicators: {} };
    }

    const indicators = {
      ariaBusy: (html.match(/aria-busy\s*=\s*["']true["']/gi) || []).length > 0,
      progressBar: (html.match(/role\s*=\s*["']progressbar["']/gi) || []).length > 0,
      spinner: (html.match(/class\s*=\s*["'][^"']*(?:spin|load|progress)[^"']*["']/gi) || []).length > 0,
      skeleton: (html.match(/class\s*=\s*["'][^"']*skeleton[^"']*["']/gi) || []).length > 0,
      indeterminate: (html.match(/aria-busy\s*=\s*["']true["']|role\s*=\s*["']status["']/gi) || []).length > 0
    };

    const hasLoadingIndicators = Object.values(indicators).some(v => v === true || (typeof v === 'number' && v > 0));

    return { hasLoadingIndicators, indicators };
  }

  /**
   * Detect loading start: indicator present in after but not in before
   * @param {string} beforeHtml - HTML before
   * @param {string} afterHtml - HTML after
   * @returns {Object} Loading start signals
   */
  static detectLoadingStart(beforeHtml, afterHtml) {
    const before = this.detectLoadingIndicators(beforeHtml);
    const after = this.detectLoadingIndicators(afterHtml);

    const loadingStarted = !before.hasLoadingIndicators && after.hasLoadingIndicators;

    return {
      loadingStarted,
      beforeHadLoading: before.hasLoadingIndicators,
      afterHasLoading: after.hasLoadingIndicators,
      indicators: after.indicators
    };
  }

  /**
   * Detect loading resolution: indicator present in before but not in after
   * @param {string} beforeHtml - HTML before
   * @param {string} afterHtml - HTML after
   * @returns {Object} Loading resolution signals
   */
  static detectLoadingResolution(beforeHtml, afterHtml) {
    const before = this.detectLoadingIndicators(beforeHtml);
    const after = this.detectLoadingIndicators(afterHtml);

    const loadingResolved = before.hasLoadingIndicators && !after.hasLoadingIndicators;

    return {
      loadingResolved,
      beforeHadLoading: before.hasLoadingIndicators,
      afterHasLoading: after.hasLoadingIndicators
    };
  }

  /**
   * Detect stalled loading: indicator present in both before and after, no content change
   * Implies loading started but did not resolve
   * @param {string} beforeHtml - HTML before
   * @param {string} afterHtml - HTML after
   * @param {boolean} contentChanged - Whether content/DOM changed
   * @returns {Object} Stalled loading signals
   */
  static detectStalledLoading(beforeHtml, afterHtml, contentChanged) {
    const before = this.detectLoadingIndicators(beforeHtml);
    const after = this.detectLoadingIndicators(afterHtml);

    // Stalled: loading present before and after, but no content change
    const loadingStalled = before.hasLoadingIndicators && after.hasLoadingIndicators && !contentChanged;

    return {
      loadingStalled,
      beforeHadLoading: before.hasLoadingIndicators,
      afterHasLoading: after.hasLoadingIndicators,
      indicators: after.indicators
    };
  }

  /**
   * Comprehensive loading resolution detection
   * @param {string} beforeHtml - HTML before
   * @param {string} afterHtml - HTML after
   * @param {boolean} contentChanged - Whether meaningful content changed
   * @returns {Object} Combined loading state signals
   */
  static detectLoadingResolutionState(beforeHtml, afterHtml, contentChanged) {
    const start = this.detectLoadingStart(beforeHtml, afterHtml);
    const resolved = this.detectLoadingResolution(beforeHtml, afterHtml);
    const stalled = this.detectStalledLoading(beforeHtml, afterHtml, contentChanged);

    const loadingStateTransition = start.loadingStarted || resolved.loadingResolved || stalled.loadingStalled;

    return {
      loadingStateTransition,
      start,
      resolved,
      stalled
    };
  }
}








