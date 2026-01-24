/**
 * WAVE 3: Console Truth Sensor
 * Captures console errors, warnings, page errors, unhandled rejections
 */

import { getTimeProvider } from '../../cli/util/support/time-provider.js';

export class ConsoleSensor {
  constructor(options = {}) {
    this.maxErrorsToKeep = options.maxErrorsToKeep || 10;
    this.windows = new Map(); // windowId -> window state
    this.nextWindowId = 0;
  }

  /**
   * Start monitoring console and page errors, return window ID.
   */
  startWindow(page) {
    const windowId = this.nextWindowId++;

    const timeProvider = getTimeProvider();

    const state = {
      id: windowId,
      startTime: timeProvider.now(),
      consoleErrors: [],
      consoleWarnings: [],
      pageErrors: [],
      unhandledRejections: []
    };

    // Capture console.error and console.warn
    const onConsoleMessage = (msg) => {
      const type = msg.type();
      const text = msg.text().slice(0, 200); // Limit message length

      if (type === 'error') {
        state.consoleErrors.push(text);
        if (state.consoleErrors.length > this.maxErrorsToKeep) {
          state.consoleErrors.shift();
        }
      } else if (type === 'warning') {
        state.consoleWarnings.push(text);
        if (state.consoleWarnings.length > this.maxErrorsToKeep) {
          state.consoleWarnings.shift();
        }
      }
    };

    // Capture uncaught page errors
    const onPageError = (error) => {
      const message = error?.toString().slice(0, 200) || 'Unknown error';
      state.pageErrors.push({
        message: message,
        name: error?.name || 'Error'
      });

      if (state.pageErrors.length > this.maxErrorsToKeep) {
        state.pageErrors.shift();
      }
    };

    // Capture unhandled promise rejections
    const _onUnhandledRejection = (promise, reason) => {
      const message = (reason?.toString?.() || String(reason)).slice(0, 200);
      state.unhandledRejections.push({
        message: message,
        type: typeof reason
      });

      if (state.unhandledRejections.length > this.maxErrorsToKeep) {
        state.unhandledRejections.shift();
      }
    };

    page.on('console', onConsoleMessage);
    page.on('pageerror', onPageError);

    // Inject listener for unhandledrejection (Playwright doesn't have direct event)
    try {
      page.evaluate(() => {
        if (typeof window !== 'undefined') {
          window.__unhandledRejections = [];
          window.addEventListener('unhandledrejection', (event) => {
            const reason = event.reason || {};
            window.__unhandledRejections.push({
              message: (reason?.toString?.() || String(reason)).slice(0, 200),
              type: typeof reason
            });
          });
        }
      }).catch(() => {
        // Page may not support this
      });
    } catch {
      // Ignore
    }

    state.cleanup = () => {
      page.removeListener('console', onConsoleMessage);
      page.removeListener('pageerror', onPageError);
    };

    this.windows.set(windowId, state);
    return windowId;
  }

  /**
   * Stop monitoring and return a summary for the window.
   */
  stopWindow(windowId, _page) {
    const state = this.windows.get(windowId);
    if (!state) {
      return this.getEmptySummary();
    }

    state.cleanup();

    const summary = {
      windowId,
      errorCount: state.consoleErrors.length + state.pageErrors.length,
      consoleErrorCount: state.consoleErrors.length,
      pageErrorCount: state.pageErrors.length,
      unhandledRejectionCount: state.unhandledRejections.length,
      lastErrors: [
        ...state.consoleErrors.map((msg) => ({ type: 'console.error', message: msg })),
        ...state.pageErrors.map((err) => ({ type: 'pageerror', message: err.message })),
        ...state.unhandledRejections.map((rej) => ({
          type: 'unhandledrejection',
          message: rej.message
        }))
      ].slice(0, this.maxErrorsToKeep),
      hasErrors:
        state.consoleErrors.length > 0 ||
        state.pageErrors.length > 0 ||
        state.unhandledRejections.length > 0
    };

    this.windows.delete(windowId);
    return summary;
  }

  getEmptySummary() {
    return {
      windowId: -1,
      errorCount: 0,
      consoleErrorCount: 0,
      pageErrorCount: 0,
      unhandledRejectionCount: 0,
      lastErrors: [],
      hasErrors: false
    };
  }
}



