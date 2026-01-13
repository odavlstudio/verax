/**
 * WAVE 3: Network Truth Sensor
 * Monitors network requests, responses, failures via Playwright page events
 */

export class NetworkSensor {
  constructor(options = {}) {
    this.slowThresholdMs = options.slowThresholdMs || 2000;
    this.windows = new Map(); // windowId -> window state
    this.nextWindowId = 0;
  }

  /**
   * Start monitoring network activity and return a window ID.
   * Call stopWindow(windowId) to get the summary.
   */
  startWindow(page) {
    const windowId = this.nextWindowId++;

    const state = {
      id: windowId,
      startTime: Date.now(),
      requests: new Map(), // url -> { startTime, endTime, status, failed, duration }
      failedRequests: [],
      failedByStatus: {}, // status code -> count
      unfinishedRequests: new Set(), // urls still pending
      lastErrors: [],
      requestOrder: []
    };

    // Track all requests
    const onRequest = (request) => {
      const url = this.redactUrl(request.url());
      state.unfinishedRequests.add(url);

      if (!state.requests.has(url)) {
        state.requests.set(url, {
          url: url,
          startTime: Date.now(),
          endTime: null,
          status: null,
          failed: false,
          duration: 0,
          count: 0,
          completed: false
        });
        state.requestOrder.push(url);
      }

      const reqData = state.requests.get(url);
      reqData.count = (reqData.count || 0) + 1;
    };

    // Track responses and failures
    const onResponse = (response) => {
      const url = this.redactUrl(response.url());
      const status = response.status();

      if (state.requests.has(url)) {
        const reqData = state.requests.get(url);
        reqData.endTime = Date.now();
        reqData.status = status;
        reqData.duration = reqData.endTime - reqData.startTime;
        reqData.completed = true;

        if (status >= 400) {
          reqData.failed = true;
          state.failedRequests.push({ url, status, duration: reqData.duration });
          state.failedByStatus[status] = (state.failedByStatus[status] || 0) + 1;
        } else if (status >= 200 && status < 300) {
          // Track successful 2xx responses explicitly
          reqData.successful = true;
        }
      }

      state.unfinishedRequests.delete(url);
    };

    const onRequestFailed = (request) => {
      const url = this.redactUrl(request.url());

      if (state.requests.has(url)) {
        const reqData = state.requests.get(url);
        reqData.endTime = Date.now();
        reqData.duration = reqData.endTime - reqData.startTime;
        reqData.failed = true;
      } else {
        state.requests.set(url, {
          url: url,
          startTime: Date.now(),
          endTime: Date.now(),
          status: null,
          failed: true,
          duration: 0,
          count: 1
        });
      }

      state.failedRequests.push({ url, status: 'FAILED', duration: 0 });
      state.failedByStatus['FAILED'] = (state.failedByStatus['FAILED'] || 0) + 1;
      state.unfinishedRequests.delete(url);
    };

    page.on('request', onRequest);
    page.on('response', onResponse);
    page.on('requestfailed', onRequestFailed);

    state.cleanup = () => {
      page.removeListener('request', onRequest);
      page.removeListener('response', onResponse);
      page.removeListener('requestfailed', onRequestFailed);
    };

    this.windows.set(windowId, state);
    return windowId;
  }

  /**
   * Stop monitoring and return a summary for the window.
   */
  stopWindow(windowId) {
    const state = this.windows.get(windowId);
    if (!state) {
      return this.getEmptySummary();
    }

    state.cleanup();

    const endTime = Date.now();
    const duration = endTime - state.startTime;

    // Count failed requests: requests that had 4xx/5xx status or failed completely
    // Note: incomplete requests are NOT counted as failed - they might just be slow
    const failedCount = Array.from(state.requests.values()).filter(
      (r) => r.failed === true
    ).length;

    // Find slow requests (completed requests that took longer than threshold)
    // Also include incomplete requests that have been pending longer than threshold
    const now = Date.now();
    const slowRequests = Array.from(state.requests.values())
      .filter((r) => {
        if (r.completed && r.duration && r.duration > this.slowThresholdMs) {
          return true;
        }
        // Incomplete request that's been pending longer than threshold
        if (!r.completed && r.startTime && (now - r.startTime) > this.slowThresholdMs) {
          // Estimate duration as time since start
          if (!r.duration) {
            r.duration = now - r.startTime;
          }
          return true;
        }
        return false;
      })
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, 5);

    // Get top failed URLs (limit to 5)
    const topFailedUrls = state.failedRequests
      .slice(0, 5)
      .map((f) => ({ url: f.url, status: f.status, duration: f.duration }));

    // Count successful 2xx requests
    const successfulRequests = Array.from(state.requests.values()).filter(
      (r) => r.successful === true && r.status >= 200 && r.status < 300
    );

    const summary = {
      windowId,
      totalRequests: state.requests.size,
      failedRequests: failedCount,
      successfulRequests: successfulRequests.length,
      failedByStatus: state.failedByStatus,
      hasNetworkActivity: state.requests.size > 0,
      slowRequestsCount: slowRequests.length,
      slowRequests: slowRequests.map((r) => ({
        url: r.url,
        duration: r.duration
      })),
      topFailedUrls: topFailedUrls,
      duration: duration,
      unfinishedCount: state.unfinishedRequests.size,
      firstRequestUrl: state.requestOrder[0] || null,
      observedRequestUrls: state.requestOrder.slice(0, 5)
    };

    this.windows.delete(windowId);
    return summary;
  }

  /**
   * Redact query strings from URLs to reduce noise.
   */
  redactUrl(url) {
    try {
      const parsed = new URL(url);
      // Keep only scheme + host + pathname, drop query
      return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
    } catch {
      // If URL parsing fails, return as-is with first 100 chars
      return url.slice(0, 100);
    }
  }

  getEmptySummary() {
    return {
      windowId: -1,
      totalRequests: 0,
      failedRequests: 0,
      successfulRequests: 0,
      failedByStatus: {},
      hasNetworkActivity: false,
      slowRequestsCount: 0,
      slowRequests: [],
      topFailedUrls: [],
      duration: 0,
      unfinishedCount: 0
    };
  }
}
