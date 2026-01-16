/**
 * PHASE 21.3 — Network Observer
 * 
 * Responsibilities:
 * - Network idle tracking
 * - In-flight request tracking
 * - Network-related observation signals
 * 
 * MUST NOT intercept requests (safety-observer owns that)
 * NO file I/O
 * NO side effects outside its scope
 */

import { NetworkSensor } from '../network-sensor.js';

/**
 * Observe network state on current page
 * 
 * @param {Object} context - Observe context
 * @param {Object} _runState - Current run state
 * @returns {Promise<Array<Object>>} Array of network observations
 */
export async function observe(context, _runState) {
  const { page, currentUrl, timestamp } = context;
  const observations = [];
  
  try {
    // Create a network sensor to observe current state
    const networkSensor = new NetworkSensor();
    const windowId = networkSensor.startWindow(page);
    
    // Wait a short time to capture any in-flight requests
    await page.waitForTimeout(100);
    
    // Stop monitoring and get summary
    const summary = networkSensor.stopWindow(windowId);
    
    // Create observation for network state
    observations.push({
      type: 'network_state',
      scope: 'page',
      data: {
        totalRequests: summary.totalRequests,
        failedRequests: summary.failedRequests,
        successfulRequests: summary.successfulRequests,
        unfinishedCount: summary.unfinishedCount,
        hasNetworkActivity: summary.hasNetworkActivity,
        slowRequestsCount: summary.slowRequestsCount,
        failedByStatus: summary.failedByStatus
      },
      timestamp,
      url: currentUrl
    });
    
    // If there are in-flight requests, create an observation
    if (summary.unfinishedCount > 0) {
      observations.push({
        type: 'network_in_flight',
        scope: 'page',
        data: {
          inFlightCount: summary.unfinishedCount
        },
        timestamp,
        url: currentUrl
      });
    }
    
    // If network is idle (no requests), create observation
    if (!summary.hasNetworkActivity && summary.unfinishedCount === 0) {
      observations.push({
        type: 'network_idle',
        scope: 'page',
        data: {
          idle: true
        },
        timestamp,
        url: currentUrl
      });
    }
  } catch (error) {
    // Propagate error - no silent catch
    throw new Error(`Network observer failed: ${error.message}`);
  }
  
  return observations;
}

