/**
 * NAVIGATION INTELLIGENCE v2 — Navigation Sensor
 * 
 * Captures navigation state changes per interaction:
 * - URL changes (beforeUrl → afterUrl)
 * - History API state (length, pushState, replaceState)
 * - SPA Router events (Next.js, React Router)
 * - Blocked navigation signals (preventDefault, guards)
 * 
 * Provides runtime evidence for navigation failure detection.
 */

import { getTimeProvider } from '../../cli/util/support/time-provider.js';

export class NavigationSensor {
  constructor() {
    this.windows = new Map();
    this.nextWindowId = 0;
  }

  /**
   * Start a navigation observation window.
   * 
   * @param {Object} page - Playwright page
   * @returns {number} - Window ID
   */
  startWindow(page) {
    const windowId = this.nextWindowId++;
    const timeProvider = getTimeProvider();
    
    const state = {
      windowId,
      beforeUrl: null,
      afterUrl: null,
      beforeHistoryLength: null,
      afterHistoryLength: null,
      historyChanges: [],
      routerEvents: [],
      blockedNavigations: [],
      started: timeProvider.now()
    };
    
    this.windows.set(windowId, state);
    
    // Capture initial state immediately
    this._captureBeforeState(page, state);
    
    // Set up listeners for navigation events
    this._attachListeners(page, state);
    
    return windowId;
  }

  /**
   * Capture before-state synchronously.
   * 
   * @param {Object} page - Playwright page
   * @param {Object} state - Window state
   */
  async _captureBeforeState(page, state) {
    try {
      state.beforeUrl = page.url();
      state.beforeHistoryLength = await page.evaluate(() => window.history.length).catch(() => null);
    } catch (e) {
      // Ignore errors during capture
    }
  }

  /**
   * Attach navigation listeners.
   * 
   * @param {Object} page - Playwright page
   * @param {Object} state - Window state
   */
  _attachListeners(page, state) {
    const timeProvider = getTimeProvider();
    
    // Listen for history API calls
    page.on('console', (msg) => {
      const text = msg.text();
      
      // Custom markers from injected tracking script
      if (text.startsWith('[NAV]')) {
        try {
          const data = JSON.parse(text.substring(5));
          if (data.type === 'history') {
            state.historyChanges.push({
              method: data.method,
              url: data.url,
              timestamp: timeProvider.now()
            });
          } else if (data.type === 'router') {
            state.routerEvents.push({
              event: data.event,
              url: data.url,
              timestamp: timeProvider.now()
            });
          } else if (data.type === 'blocked') {
            state.blockedNavigations.push({
              reason: data.reason,
              url: data.url,
              timestamp: timeProvider.now()
            });
          }
        } catch (e) {
          // Invalid JSON, ignore
        }
      }
    });
  }

  /**
   * Stop a navigation observation window.
   * 
   * @param {number} windowId - Window ID
   * @param {Object} page - Playwright page
   * @returns {Promise<any>} - Navigation summary
   */
  async stopWindow(windowId, page) {
    const state = this.windows.get(windowId);
    
    if (!state) {
      return this._emptyNavigationSummary(windowId);
    }
    
    // Capture after state
    try {
      state.afterUrl = page.url();
      state.afterHistoryLength = await page.evaluate(() => window.history.length).catch(() => null);
    } catch (e) {
      state.afterUrl = state.beforeUrl;
      state.afterHistoryLength = state.beforeHistoryLength;
    }
    
    const timeProvider = getTimeProvider();
    const duration = timeProvider.now() - state.started;
    
    // Compute deltas
    const urlChanged = state.beforeUrl !== state.afterUrl;
    const historyLengthDelta = (state.afterHistoryLength !== null && state.beforeHistoryLength !== null)
      ? state.afterHistoryLength - state.beforeHistoryLength
      : null;
    
    const summary = {
      windowId,
      beforeUrl: state.beforeUrl,
      afterUrl: state.afterUrl,
      urlChanged,
      beforeHistoryLength: state.beforeHistoryLength,
      afterHistoryLength: state.afterHistoryLength,
      historyLengthDelta,
      historyChanges: state.historyChanges,
      routerEvents: state.routerEvents,
      blockedNavigations: state.blockedNavigations,
      hasNavigationActivity: urlChanged || historyLengthDelta !== 0 || state.historyChanges.length > 0,
      duration
    };
    
    this.windows.delete(windowId);
    return summary;
  }

  /**
   * Return empty summary for invalid window ID.
   * 
   * @param {number} windowId - Window ID
   * @returns {Object} - Empty summary
   */
  _emptyNavigationSummary(windowId) {
    return {
      windowId,
      beforeUrl: null,
      afterUrl: null,
      urlChanged: false,
      beforeHistoryLength: null,
      afterHistoryLength: null,
      historyLengthDelta: null,
      historyChanges: [],
      routerEvents: [],
      blockedNavigations: [],
      hasNavigationActivity: false,
      duration: 0
    };
  }

  /**
   * Inject navigation tracking script into page.
   * Call this before interaction to capture history/router events.
   * 
   * @param {Object} page - Playwright page
   */
  async injectTrackingScript(page) {
    try {
      await page.evaluate(() => {
        // Skip if already injected
        if (window.__veraxNavTracking) return;
        window.__veraxNavTracking = true;
        
        // Intercept history API
        const originalPushState = window.history.pushState;
        const originalReplaceState = window.history.replaceState;
        
        window.history.pushState = function(...args) {
          console.log('[NAV]' + JSON.stringify({
            type: 'history',
            method: 'pushState',
            url: args[2] || window.location.href
          }));
          return originalPushState.apply(this, args);
        };
        
        window.history.replaceState = function(...args) {
          console.log('[NAV]' + JSON.stringify({
            type: 'history',
            method: 'replaceState',
            url: args[2] || window.location.href
          }));
          return originalReplaceState.apply(this, args);
        };
        
        // Listen for popstate (back/forward)
        window.addEventListener('popstate', () => {
          console.log('[NAV]' + JSON.stringify({
            type: 'history',
            method: 'popstate',
            url: window.location.href
          }));
        });
        
        // Next.js Router events
        if (window.next?.router) {
          window.next.router.events.on('routeChangeStart', (url) => {
            console.log('[NAV]' + JSON.stringify({
              type: 'router',
              event: 'routeChangeStart',
              url
            }));
          });
          
          window.next.router.events.on('routeChangeComplete', (url) => {
            console.log('[NAV]' + JSON.stringify({
              type: 'router',
              event: 'routeChangeComplete',
              url
            }));
          });
          
          window.next.router.events.on('routeChangeError', (err, url) => {
            console.log('[NAV]' + JSON.stringify({
              type: 'blocked',
              reason: 'routeChangeError',
              url
            }));
          });
        }
      });
    } catch (e) {
      // Ignore injection errors (page might not be ready)
    }
  }
}



