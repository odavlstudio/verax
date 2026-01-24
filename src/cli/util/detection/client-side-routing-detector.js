/**
 * Client-Side Routing Detector
 * 
 * Detects framework-agnostic client-side navigation patterns:
 * - history.pushState / replaceState API calls
 * - hash-based navigation (URL fragment changes)
 * - History API state changes (history length)
 * 
 * Observable only; no inference about routing intent.
 */

export class ClientSideRoutingDetector {
  /**
   * Detect pushState/replaceState calls and return signals
   * @param {Object} before - State before interaction
   * @param {Object} after - State after interaction
   * @returns {Object} Routing signals
   */
  static detectHistoryStateChanges(before, after) {
    if (!before || !after) {
      return { historyStateChanged: false, historyStateDiff: null };
    }

    const historyStateChanged = before.historyLength !== after.historyLength;
    const historyStateDiff = {
      beforeLength: before.historyLength || 0,
      afterLength: after.historyLength || 0,
      lengthDiff: (after.historyLength || 0) - (before.historyLength || 0)
    };

    return { historyStateChanged, historyStateDiff };
  }

  /**
   * Detect hash-based navigation (URL fragment changes)
   * @param {string} beforeUrl - URL before
   * @param {string} afterUrl - URL after
   * @returns {Object} Hash navigation signals
   */
  static detectHashNavigation(beforeUrl, afterUrl) {
    if (!beforeUrl || !afterUrl) {
      return { hashChanged: false, beforeHash: null, afterHash: null };
    }

    let beforeHash, afterHash;
    try {
      const beforeU = new URL(beforeUrl);
      const afterU = new URL(afterUrl);
      beforeHash = beforeU.hash;
      afterHash = afterU.hash;
    } catch (e) {
      return { hashChanged: false, beforeHash: null, afterHash: null };
    }

    const hashChanged = beforeHash !== afterHash;
    return { hashChanged, beforeHash, afterHash };
  }

  /**
   * Detect pathname/search changes (URL path and query changes)
   * @param {string} beforeUrl - URL before
   * @param {string} afterUrl - URL after
   * @returns {Object} Path navigation signals
   */
  static detectPathNavigation(beforeUrl, afterUrl) {
    if (!beforeUrl || !afterUrl) {
      return { pathChanged: false, beforePath: null, afterPath: null, queryChanged: false };
    }

    let beforePath, afterPath, beforeQuery, afterQuery;
    try {
      const beforeU = new URL(beforeUrl);
      const afterU = new URL(afterUrl);
      beforePath = beforeU.pathname;
      afterPath = afterU.pathname;
      beforeQuery = beforeU.search;
      afterQuery = afterU.search;
    } catch (e) {
      return { pathChanged: false, beforePath: null, afterPath: null, queryChanged: false };
    }

    const pathChanged = beforePath !== afterPath;
    const queryChanged = beforeQuery !== afterQuery;
    return { pathChanged, queryChanged, beforePath, afterPath, beforeQuery, afterQuery };
  }

  /**
   * Comprehensive routing detection combining all patterns
   * @param {Object} before - State before
   * @param {Object} after - State after
   * @param {string} beforeUrl - URL before
   * @param {string} afterUrl - URL after
   * @returns {Object} Combined routing signals
   */
  static detectAllRouting(before, after, beforeUrl, afterUrl) {
    const historySignals = this.detectHistoryStateChanges(before, after);
    const hashSignals = this.detectHashNavigation(beforeUrl, afterUrl);
    const pathSignals = this.detectPathNavigation(beforeUrl, afterUrl);

    const anyRouting = historySignals.historyStateChanged || hashSignals.hashChanged || pathSignals.pathChanged || pathSignals.queryChanged;

    return {
      clientSideRoutingDetected: anyRouting,
      history: historySignals,
      hash: hashSignals,
      path: pathSignals
    };
  }
}








