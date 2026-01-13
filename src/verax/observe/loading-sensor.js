/**
 * Loading State Sensor
 * Detects and tracks loading indicators like spinners, aria-busy, and disabled buttons
 * Deterministically detects unresolved loading states
 */

export class LoadingSensor {
  constructor(options = {}) {
    this.loadingTimeout = options.loadingTimeout || 5000; // 5s deterministic timeout
  }

  /**
   * Start monitoring loading state and return a window ID
   */
  startWindow(page) {
    const windowId = `loading_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const state = {
      id: windowId,
      loadingStartTime: null,
      isCurrentlyLoading: false,
      loadingIndicators: [],
      resolveTime: null,
      unresolved: false,
      maxLoadingDuration: 0
    };

    // Monitor for loading indicators
    const checkLoading = async () => {
      try {
        const indicators = await page.evaluate(() => {
          const found = [];

          // Check aria-busy
          const ariaBusy = document.querySelectorAll('[aria-busy="true"]');
          if (ariaBusy.length > 0) {
            found.push({ type: 'aria-busy', count: ariaBusy.length });
          }

          // Check progress bars
          const progressBars = document.querySelectorAll('[role="progressbar"]');
          if (progressBars.length > 0) {
            found.push({ type: 'progressbar', count: progressBars.length });
          }

          // Check spinners/loaders by class
          const spinners = document.querySelectorAll(
            '[class*="spin"], [class*="load"], [class*="progress"], [class*="skeleton"]'
          );
          if (spinners.length > 0) {
            found.push({ type: 'spinner-class', count: spinners.length });
          }

          // Check disabled submit buttons (often indicates pending submission)
          const disabledSubmits = document.querySelectorAll('button[type="submit"]:disabled');
          if (disabledSubmits.length > 0) {
            found.push({ type: 'disabled-submit', count: disabledSubmits.length });
          }

          return found;
        });

        const hasLoading = indicators.length > 0;

        if (hasLoading && !state.isCurrentlyLoading) {
          // Loading started
          state.isCurrentlyLoading = true;
          state.loadingStartTime = Date.now();
          state.loadingIndicators = indicators;
        } else if (!hasLoading && state.isCurrentlyLoading) {
          // Loading resolved
          state.isCurrentlyLoading = false;
          state.resolveTime = Date.now();
          state.maxLoadingDuration = state.resolveTime - state.loadingStartTime;
        } else if (hasLoading && state.isCurrentlyLoading) {
          // Still loading, update indicators
          state.loadingIndicators = indicators;
        }
      } catch (e) {
        // Silently ignore evaluation errors
      }
    };

    // Set up interval to check loading state (every 100ms for deterministic detection)
    const intervalId = setInterval(checkLoading, 100);

    // CRITICAL: Unref the interval so it doesn't keep the process alive
    // This allows tests to exit cleanly even if stopWindow() is not called
    if (intervalId && intervalId.unref) {
      intervalId.unref();
    }

    // Immediately check once
    checkLoading();

    // Store interval for cleanup
    state._intervalId = intervalId;
    state._checkLoading = checkLoading;

    return { windowId, state };
  }

  /**
   * Stop monitoring and get the loading state summary
   */
  async stopWindow(windowId, state) {
    if (!state || !state._intervalId) {
      return {
        id: windowId,
        loadingIndicators: [],
        isLoading: false,
        unresolved: false,
        duration: 0,
        timeout: false,
        hasLoadingIndicators: false
      };
    }

    clearInterval(state._intervalId);

    // Final check
    if (state._checkLoading) {
      await state._checkLoading();
    }

    // Determine if loading is unresolved (exceeded timeout)
    const isStillLoading = state.isCurrentlyLoading === true;
    const now = Date.now();
    const loadingDuration = state.loadingStartTime ? (now - state.loadingStartTime) : 0;
    const exceededTimeout = state.loadingStartTime && (now - state.loadingStartTime) > this.loadingTimeout;
    const unresolved = isStillLoading && exceededTimeout;
    const timeout = exceededTimeout;

    return {
      id: state.id,
      loadingIndicators: state.loadingIndicators || [],
      isLoading: state.isCurrentlyLoading,
      unresolved: unresolved,
      duration: state.resolveTime ? state.maxLoadingDuration : loadingDuration,
      timeout: timeout,
      resolveTime: state.resolveTime,
      hasLoadingIndicators: (state.loadingIndicators && state.loadingIndicators.length > 0) || isStillLoading
    };
  }
}
