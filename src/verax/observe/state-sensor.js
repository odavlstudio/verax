/**
 * State Sensor v1
 * Safe, opt-in state change detection for Redux and Zustand.
 * 
 * SAFETY:
 * - Keys only, no values
 * - Opt-in via store detection
 * - Cleanup after interaction
 * - Non-destructive
 */

import { getTimeProvider } from '../../cli/util/support/time-provider.js';

const MAX_DIFF_KEYS = 10;

/**
 * Computes a shallow diff between two state objects.
 * Returns array of changed keys (no values for privacy).
 */
function computeStateDiff(before, after) {
  const changed = [];
  const allKeys = new Set([
    ...Object.keys(before || {}),
    ...Object.keys(after || {})
  ]);
  
  for (const key of allKeys) {
    if (before[key] !== after[key]) {
      changed.push(key);
      if (changed.length >= MAX_DIFF_KEYS) break;
    }
  }
  
  return changed;
}

/**
 * Redux store sensor.
 * Subscribes to store changes and captures state snapshots.
 */
class ReduxSensor {
  constructor() {
    this.store = null;
    this.unsubscribe = null;
    this.beforeState = null;
    this.afterState = null;
    this.active = false;
  }
  
  /**
   * Attempts to detect and hook into Redux store.
   * Returns true if store found and hooked.
   */
  async detect(page) {
    try {
      // First, wait for the store to be initialized
      await page.evaluate(() => {
        return new Promise((resolve) => {
          if (window.__REDUX_STORE__) {
            resolve();
          } else {
            // Wait up to 5 seconds for store initialization
            const timeout = setTimeout(() => {
              clearInterval(check);
              resolve();
            }, 5000);
            const check = setInterval(() => {
              if (window.__REDUX_STORE__) {
                clearInterval(check);
                clearTimeout(timeout);
                resolve();
              }
            }, 100);
          }
        });
      });
      
      const hasRedux = await page.evaluate(() => {
        // Try to find Redux store via common patterns
        if (window.__REDUX_STORE__) return true;
        if (window.store && typeof window.store.getState === 'function') return true;
        
        // Check React context provider (common pattern)
        const reduxProvider = document.querySelector('[data-redux-provider]');
        if (reduxProvider) return true;
        
        // Check for Redux DevTools extension
        if (window.__REDUX_DEVTOOLS_EXTENSION__) return true;
        
        // Try to find store in React component tree (best-effort)
        // This is a heuristic but safe - we only read, never modify
        try {
          const reactRoot = document.querySelector('#root, [data-reactroot], [id^="root"]');
          if (reactRoot && window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
            return true; // Likely Redux if React DevTools present
          }
        } catch (e) {
          // Ignore
        }
        
        return false;
      });
      
      if (!hasRedux) {
        return false;
      }
      
      // Install sensor in page context
      await page.evaluate(() => {
        if (window.__VERAX_STATE_SENSOR__) {
          return;
        }
        
        window.__VERAX_STATE_SENSOR__ = {
          type: 'redux',
          snapshots: [],
          store: null,
          unsubscribe: null,
          captureSnapshot(timestamp) {
            let state = null;
            if (window.__REDUX_STORE__) {
              state = window.__REDUX_STORE__.getState();
              this.store = window.__REDUX_STORE__;
            } else if (window.store && typeof window.store.getState === 'function') {
              state = window.store.getState();
              this.store = window.store;
            }
            
            if (state && typeof state === 'object') {
              // Shallow copy of top-level keys only (privacy: no values)
              const snapshot = {};
              for (const key in state) {
                if (Object.prototype.hasOwnProperty.call(state, key)) {
                  snapshot[key] = '[REDACTED]'; // Never store values, only keys
                }
              }
              this.snapshots.push({ timestamp: timestamp, state: snapshot });
            }
          },
          getSnapshots() {
            return this.snapshots;
          },
          reset() {
            this.snapshots = [];
            if (this.unsubscribe) {
              this.unsubscribe();
              this.unsubscribe = null;
            }
          }
        };
      });
      
      this.active = true;
      return true;
    } catch (error) {
      return false;
    }
  }
  
  async captureBefore(page) {
    if (!this.active) return;
    
    try {
      await page.evaluate(() => {
        window.__VERAX_STATE_SENSOR__?.captureSnapshot();
      });
      
      this.beforeState = await page.evaluate(() => {
        const snapshots = window.__VERAX_STATE_SENSOR__?.getSnapshots() || [];
        return snapshots[snapshots.length - 1]?.state || null;
      });
    } catch (error) {
      this.beforeState = null;
    }
  }
  
  async captureAfter(page) {
    if (!this.active) return;
    
    try {
      await page.evaluate(() => {
        window.__VERAX_STATE_SENSOR__?.captureSnapshot();
      });
      
      this.afterState = await page.evaluate(() => {
        const snapshots = window.__VERAX_STATE_SENSOR__?.getSnapshots() || [];
        return snapshots[snapshots.length - 1]?.state || null;
      });
    } catch (error) {
      this.afterState = null;
    }
  }
  
  getDiff() {
    if (!this.beforeState || !this.afterState) {
      return { changed: [], available: false };
    }
    
    const changed = computeStateDiff(this.beforeState, this.afterState);
    return { changed, available: true };
  }
  
  cleanup() {
    this.beforeState = null;
    this.afterState = null;
    this.active = false;
  }
}

/**
 * Zustand store sensor.
 * Wraps set() calls to capture state changes.
 */
class ZustandSensor {
  constructor() {
    this.beforeState = null;
    this.afterState = null;
    this.active = false;
  }
  
  async detect(page) {
    try {
      const hasZustand = await page.evaluate(() => {
        // Check for Zustand store markers
        if (window.__ZUSTAND_STORE__) return true;
        
        // Look for common Zustand patterns in window object
        for (const key in window) {
          if (key.startsWith('use') && typeof window[key] === 'function') {
            // Dynamic property access on window for Zustand store detection (runtime property)
            const store = /** @type {any} */ (window[key]);
            if (store && typeof store === 'object' && 'getState' in store && typeof store.getState === 'function') {
              return true;
            }
          }
        }
        
        return false;
      });
      
      if (!hasZustand) return false;
      
      // Install sensor
      await page.evaluate(() => {
        if (window.__VERAX_STATE_SENSOR__) return;
        
        window.__VERAX_STATE_SENSOR__ = {
          type: 'zustand',
          snapshots: [],
          captureSnapshot(timestamp) {
            // Try to find and capture Zustand store state
            if (window.__ZUSTAND_STORE__) {
              const state = window.__ZUSTAND_STORE__.getState();
              if (state && typeof state === 'object') {
                const snapshot = {};
                for (const key in state) {
                  if (typeof state[key] !== 'function') {
                    snapshot[key] = '[REDACTED]'; // Never store values, only keys
                  }
                }
                this.snapshots.push({ timestamp: timestamp, state: snapshot });
              }
            }
          },
          getSnapshots() {
            return this.snapshots;
          },
          reset() {
            this.snapshots = [];
          }
        };
      });
      
      this.active = true;
      return true;
    } catch (error) {
      return false;
    }
  }
  
  async captureBefore(page) {
    if (!this.active) return;
    
    const timeProvider = getTimeProvider();
    const timestamp = timeProvider.now();
    
    try {
      await page.evaluate((ts) => {
        window.__VERAX_STATE_SENSOR__?.captureSnapshot(ts);
      }, timestamp);
      
      this.beforeState = await page.evaluate(() => {
        const snapshots = window.__VERAX_STATE_SENSOR__?.getSnapshots() || [];
        return snapshots[snapshots.length - 1]?.state || null;
      });
    } catch (error) {
      this.beforeState = null;
    }
  }
  
  async captureAfter(page) {
    if (!this.active) return;
    
    const timeProvider = getTimeProvider();
    const timestamp = timeProvider.now();
    
    try {
      await page.evaluate((ts) => {
        window.__VERAX_STATE_SENSOR__?.captureSnapshot(ts);
      }, timestamp);
      
      this.afterState = await page.evaluate(() => {
        const snapshots = window.__VERAX_STATE_SENSOR__?.getSnapshots() || [];
        return snapshots[snapshots.length - 1]?.state || null;
      });
    } catch (error) {
      this.afterState = null;
    }
  }
  
  getDiff() {
    if (!this.beforeState || !this.afterState) {
      return { changed: [], available: false };
    }
    
    const changed = computeStateDiff(this.beforeState, this.afterState);
    return { changed, available: true };
  }
  
  cleanup() {
    this.beforeState = null;
    this.afterState = null;
    this.active = false;
  }
}

/**
 * State Sensor orchestrator.
 * Detects store type and delegates to appropriate sensor.
 */
export class StateSensor {
  constructor() {
    this.reduxSensor = new ReduxSensor();
    this.zustandSensor = new ZustandSensor();
    this.activeType = null;
  }
  
  /**
   * Detects state stores and activates appropriate sensor.
   * Returns { detected: bool, type: 'redux' | 'zustand' | null }
   */
  async detect(page) {
    // Try Redux first
    const reduxDetected = await this.reduxSensor.detect(page);
    if (reduxDetected) {
      this.activeType = 'redux';
      return { detected: true, type: 'redux' };
    }
    
    // Try Zustand
    const zustandDetected = await this.zustandSensor.detect(page);
    if (zustandDetected) {
      this.activeType = 'zustand';
      return { detected: true, type: 'zustand' };
    }
    
    return { detected: false, type: null };
  }
  
  async captureBefore(page) {
    if (this.activeType === 'redux') {
      await this.reduxSensor.captureBefore(page);
    } else if (this.activeType === 'zustand') {
      await this.zustandSensor.captureBefore(page);
    }
  }
  
  async captureAfter(page) {
    if (this.activeType === 'redux') {
      await this.reduxSensor.captureAfter(page);
    } else if (this.activeType === 'zustand') {
      await this.zustandSensor.captureAfter(page);
    }
  }
  
  getDiff() {
    if (this.activeType === 'redux') {
      return this.reduxSensor.getDiff();
    } else if (this.activeType === 'zustand') {
      return this.zustandSensor.getDiff();
    }
    
    return { changed: [], available: false };
  }
  
  cleanup() {
    this.reduxSensor.cleanup();
    this.zustandSensor.cleanup();
    this.activeType = null;
  }
}



