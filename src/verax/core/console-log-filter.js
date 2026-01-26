/**
 * GATE 4: Console Log Filtering
 * 
 * Filters sensitive patterns from console output while preserving error structure
 * and debugging information.
 */

import { defaultSecurityPolicy } from './evidence-security-policy.js';

/**
 * Filter sensitive patterns from console logs
 * @param {string} logText - Original log text
 * @returns {string} Filtered log text
 */
export function filterConsoleLog(logText) {
  if (!logText) return logText;
  
  return defaultSecurityPolicy.filterSensitiveLog(logText);
}

/**
 * Create a filtered console for use during observation
 * Wraps console methods to apply redaction
 */
export function createFilteredConsole() {
  const original = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
    debug: console.debug
  };

  return {
    log: (...args) => {
      const filtered = args.map(arg => {
        if (typeof arg === 'string') {
          return filterConsoleLog(arg);
        }
        return arg;
      });
      original.log(...filtered);
    },
    warn: (...args) => {
      const filtered = args.map(arg => {
        if (typeof arg === 'string') {
          return filterConsoleLog(arg);
        }
        return arg;
      });
      original.warn(...filtered);
    },
    error: (...args) => {
      const filtered = args.map(arg => {
        if (typeof arg === 'string') {
          return filterConsoleLog(arg);
        }
        return arg;
      });
      original.error(...filtered);
    },
    info: (...args) => {
      const filtered = args.map(arg => {
        if (typeof arg === 'string') {
          return filterConsoleLog(arg);
        }
        return arg;
      });
      original.info(...filtered);
    },
    debug: (...args) => {
      const filtered = args.map(arg => {
        if (typeof arg === 'string') {
          return filterConsoleLog(arg);
        }
        return arg;
      });
      original.debug(...filtered);
    }
  };
}

/**
 * Filter console logs from traces
 * @param {Array} traces - Execution traces
 * @returns {Array} Filtered traces
 */
export function filterTracesConsole(traces) {
  if (!defaultSecurityPolicy.consoleLogFiltering.enabled) {
    return traces;
  }

  return traces.map(trace => {
    const filtered = { ...trace };

    // Filter console logs if present
    if (filtered.console && Array.isArray(filtered.console)) {
      filtered.console = filtered.console.map(logEntry => {
        const filteredEntry = { ...logEntry };

        if (typeof filteredEntry.text === 'string') {
          filteredEntry.text = filterConsoleLog(filteredEntry.text);
        }

        if (typeof filteredEntry.message === 'string') {
          filteredEntry.message = filterConsoleLog(filteredEntry.message);
        }

        // Filter args array if present
        if (Array.isArray(filteredEntry.args)) {
          filteredEntry.args = filteredEntry.args.map(arg => {
            if (typeof arg === 'string') {
              return filterConsoleLog(arg);
            }
            return arg;
          });
        }

        return filteredEntry;
      });
    }

    return filtered;
  });
}

/**
 * Check if console log contains sensitive information.
 * @param {string} logText - Log text to check
 * @returns {boolean} - True if contains sensitive patterns
 */
export function hasSensitivePatterns(logText) {
  if (!logText || typeof logText !== 'string') {
    return false;
  }
  
  const sensitivePatterns = [
    /\btoken[=:]/i,
    /\bauth[=:]/i,
    /\bpassword[=:]/i,
    /\bsecret[=:]/i,
    /\bapi[_-]?key[=:]/i,
    /\bemail[=:]/i,
    /\bphone[=:]/i,
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
    /Bearer\s+[a-zA-Z0-9._-]+/
  ];
  
  return sensitivePatterns.some(pattern => pattern.test(logText));
}

/**
 * Validate that console logs are safe for canonical artifacts.
 * @param {string} consoleLog - Console log to validate
 * @returns {Object} - { safe: boolean, issues: Array<string> }
 */
export function validateConsoleLogIsSafe(consoleLog) {
  const issues = [];
  
  if (!consoleLog || typeof consoleLog !== 'string') {
    return { safe: true, issues: [] };
  }
  
  const lines = consoleLog.split('\n');
  for (let i = 0; i < lines.length && issues.length < 10; i++) {
    const line = lines[i];
    
    if (hasSensitivePatterns(line)) {
      issues.push(`Line ${i + 1}: Contains sensitive pattern - ${line.slice(0, 80)}...`);
    }
  }
  
  return {
    safe: issues.length === 0,
    issues
  };
}

/**
 * Get a summary of filtering applied to console output.
 * @param {string} before - Original output
 * @param {string} after - Filtered output
 * @returns {Object} - Summary of changes
 */
export function getFilteringSummary(before, after) {
  if (!before || !after) {
    return { linesRemoved: 0, redactionInstances: 0 };
  }
  
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  
  return {
    originalLineCount: beforeLines.length,
    filteredLineCount: afterLines.length,
    linesRemoved: beforeLines.length - afterLines.length,
    redactionInstances: (after.match(/\[REDACTED[^\]]*\]/g) || []).length
  };
}
