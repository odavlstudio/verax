/**
 * PHASE 21.3 — Console Observer
 * 
 * Responsibilities:
 * - Console error / warning capture
 * - JS runtime error signals
 * 
 * NO file I/O
 * NO side effects outside its scope
 */

import { ConsoleSensor } from '../console-sensor.js';

/**
 * Observe console errors and warnings on current page
 * 
 * @param {Object} context - Observe context
 * @param {Object} _runState - Current run state
 * @returns {Promise<Array<Object>>} Array of console observations
 */
export async function observe(context, _runState) {
  const { page, currentUrl, timestamp, silenceTracker } = context;
  const observations = [];
  
  try {
    // Create a console sensor to observe current state
    const consoleSensor = new ConsoleSensor();
    const windowId = consoleSensor.startWindow(page);
    
    // Wait a short time to capture any console messages
    await page.waitForTimeout(100);
    
    // Stop monitoring and get summary
    const summary = consoleSensor.stopWindow(windowId, page);
    
    // Create observation for console state
    if (summary.hasErrors) {
      observations.push({
        type: 'console_errors',
        scope: 'page',
        data: {
          errorCount: summary.errorCount,
          consoleErrorCount: summary.consoleErrorCount,
          pageErrorCount: summary.pageErrorCount,
          unhandledRejectionCount: summary.unhandledRejectionCount,
          lastErrors: summary.lastErrors
        },
        timestamp,
        url: currentUrl
      });
      
      // Record console errors as silence
      if (summary.consoleErrorCount > 0) {
        silenceTracker.record({
          scope: 'console',
          reason: 'console_error',
          description: `Console errors detected on page`,
          context: {
            errorCount: summary.consoleErrorCount,
            pageUrl: currentUrl
          },
          impact: 'unknown_behavior',
          count: summary.consoleErrorCount
        });
      }
      
      if (summary.pageErrorCount > 0) {
        silenceTracker.record({
          scope: 'console',
          reason: 'page_error',
          description: `Page errors detected`,
          context: {
            errorCount: summary.pageErrorCount,
            pageUrl: currentUrl
          },
          impact: 'unknown_behavior',
          count: summary.pageErrorCount
        });
      }
      
      if (summary.unhandledRejectionCount > 0) {
        silenceTracker.record({
          scope: 'console',
          reason: 'unhandled_rejection',
          description: `Unhandled promise rejections detected`,
          context: {
            errorCount: summary.unhandledRejectionCount,
            pageUrl: currentUrl
          },
          impact: 'unknown_behavior',
          count: summary.unhandledRejectionCount
        });
      }
    }
  } catch (error) {
    // Propagate error - no silent catch
    throw new Error(`Console observer failed: ${error.message}`);
  }
  
  return observations;
}




