/**
 * UI Feedback Pattern Detector
 * 
 * Detects framework-agnostic UI feedback patterns:
 * - aria-live regions (announcements, alerts)
 * - role="alert" / role="status" elements
 * - Ephemeral DOM changes (nodes added and quickly removed)
 * 
 * Observable only; captures evidence of user-visible feedback.
 */

export class UIFeedbackPatternDetector {
  /**
   * Detect loading indicators in HTML (via regex patterns)
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
   * Detect aria-live regions and their content changes (via regex)
   * @param {string} beforeHtml - HTML before
   * @param {string} afterHtml - HTML after
   * @returns {Object} ARIA live signals
   */
  static detectAriaLiveUpdates(beforeHtml, afterHtml) {
    if (!beforeHtml || !afterHtml) {
      return { ariaLiveUpdated: false, regions: [] };
    }

    const regions = [];
    
    // Simple regex-based detection: look for aria-live regions and compare
    const ariaLivePattern = /aria-live\s*=\s*["'](polite|assertive|off)["']/gi;
    const beforeMatches = beforeHtml.match(ariaLivePattern) || [];
    const afterMatches = afterHtml.match(ariaLivePattern) || [];

    // If more aria-live regions in after, likely content was updated
    if (afterMatches.length > beforeMatches.length) {
      regions.push({
        type: 'aria-live-region',
        beforeCount: beforeMatches.length,
        afterCount: afterMatches.length
      });
    }

    const ariaLiveUpdated = regions.length > 0;
    return { ariaLiveUpdated, regions };
  }

  /**
   * Detect role="alert" and role="status" elements appearing or changing (via regex)
   * @param {string} beforeHtml - HTML before
   * @param {string} afterHtml - HTML after
   * @returns {Object} ARIA role signals
   */
  static detectAriaRoleAlerts(beforeHtml, afterHtml) {
    if (!beforeHtml || !afterHtml) {
      return { alertsDetected: false, alerts: [] };
    }

    const alerts = [];

    // Simple regex-based detection
    const alertPattern = /role\s*=\s*["']alert["']/gi;
    const statusPattern = /role\s*=\s*["']status["']/gi;

    const beforeAlerts = beforeHtml.match(alertPattern) || [];
    const afterAlerts = afterHtml.match(alertPattern) || [];
    const beforeStatus = beforeHtml.match(statusPattern) || [];
    const afterStatus = afterHtml.match(statusPattern) || [];

    if (afterAlerts.length > beforeAlerts.length) {
      alerts.push({ role: 'alert', beforeCount: beforeAlerts.length, afterCount: afterAlerts.length });
    }

    if (afterStatus.length > beforeStatus.length) {
      alerts.push({ role: 'status', beforeCount: beforeStatus.length, afterCount: afterStatus.length });
    }

    const alertsDetected = alerts.length > 0;
    return { alertsDetected, alerts };
  }

  /**
   * Detect ephemeral DOM changes (nodes added/removed quickly)
   * Identifies modal overlays, tooltips, toasts that appear and vanish
   * @param {string} beforeHtml - HTML before
   * @param {string} afterHtml - HTML after
   * @returns {Object} Ephemeral signals
   */
  static detectEphemeralDOM(beforeHtml, afterHtml) {
    if (!beforeHtml || !afterHtml) {
      return { ephemeralChangesDetected: false, patterns: [] };
    }

    const patterns = [];

    try {
      // Simple heuristic: count hidden/display:none elements
      // and elements with opacity:0 or visibility:hidden
      const hiddenPatterns = ['display:none', 'visibility:hidden', 'opacity:0', 'aria-hidden="true"'];

      let beforeHiddenCount = 0;
      let afterHiddenCount = 0;

      for (const pattern of hiddenPatterns) {
        beforeHiddenCount += (beforeHtml.match(new RegExp(pattern, 'g')) || []).length;
        afterHiddenCount += (afterHtml.match(new RegExp(pattern, 'g')) || []).length;
      }

      // If hidden elements increased, suggests ephemeral content appeared and was hidden
      if (afterHiddenCount > beforeHiddenCount) {
        patterns.push({
          type: 'ephemeral_hidden',
          beforeCount: beforeHiddenCount,
          afterCount: afterHiddenCount,
          diff: afterHiddenCount - beforeHiddenCount
        });
      }

      // Check for modal/dialog patterns
      const modalSelectors = ['[role="dialog"]', '[role="alertdialog"]', '.modal', '[class*="modal"]'];
      let beforeModalCount = 0;
      let afterModalCount = 0;

      for (const selector of modalSelectors) {
        beforeModalCount += (beforeHtml.match(new RegExp(selector.replace(/[[\].*+?^${}()|\\]/g, '\\$&'), 'g')) || []).length;
        afterModalCount += (afterHtml.match(new RegExp(selector.replace(/[[\].*+?^${}()|\\]/g, '\\$&'), 'g')) || []).length;
      }

      if (afterModalCount > beforeModalCount) {
        patterns.push({
          type: 'ephemeral_modal',
          beforeCount: beforeModalCount,
          afterCount: afterModalCount,
          diff: afterModalCount - beforeModalCount
        });
      }
    } catch (e) {
      // Graceful fallback on parsing error
    }

    const ephemeralChangesDetected = patterns.length > 0;
    return { ephemeralChangesDetected, patterns };
  }

  /**
   * Comprehensive UI feedback pattern detection
   * @param {string} beforeHtml - HTML before
   * @param {string} afterHtml - HTML after
   * @returns {Object} Combined UI feedback signals
   */
  static detectAllUIFeedbackPatterns(beforeHtml, afterHtml) {
    const ariaLive = this.detectAriaLiveUpdates(beforeHtml, afterHtml);
    const ariaRoles = this.detectAriaRoleAlerts(beforeHtml, afterHtml);
    const ephemeral = this.detectEphemeralDOM(beforeHtml, afterHtml);

    const anyUIFeedback = ariaLive.ariaLiveUpdated || ariaRoles.alertsDetected || ephemeral.ephemeralChangesDetected;

    return {
      uiFeedbackPatternsDetected: anyUIFeedback,
      ariaLive,
      ariaRoles,
      ephemeral
    };
  }
}








