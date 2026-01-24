/**
 * EXECUTION MODE DETECTOR
 * 
 * Automatically detects whether VERAX is running in:
 * 1. PROJECT_SCAN: Local source code is available for analysis
 * 2. WEB_SCAN_LIMITED: Only URL provided, no source code available
 * 
 * This determines:
 * - What analysis techniques can be used
 * - Maximum confidence ceiling (0.45 for WEB_SCAN_LIMITED)
 * - What explanations to provide to users
 * 
 * PRINCIPLES:
 * - Detection is automatic and implicit (no user configuration needed)
 * - Behavior changes based on what's available, not explicit flags
 * - Users understand limitations from generated explanations
 */

import { existsSync, readdirSync, statSync } from 'fs';
import { join as _join } from 'path';

/**
 * Execution mode constants
 */
export const EXECUTION_MODES = {
  PROJECT_SCAN: 'PROJECT_SCAN',           // Full analysis with source code
  WEB_SCAN_LIMITED: 'WEB_SCAN_LIMITED'    // URL-only analysis without source
};

/**
 * Confidence ceiling by mode
 */
export const CONFIDENCE_CEILINGS = {
  [EXECUTION_MODES.PROJECT_SCAN]: 1.0,      // No ceiling, full range [0, 1]
  [EXECUTION_MODES.WEB_SCAN_LIMITED]: 0.45  // Limited to 45% max confidence
};

/**
 * Detect execution mode based on available inputs
 * @param {string} srcPath - Path to source code directory
 * @param {string} _url - Target URL
 * @ts-expect-error - JSDoc param documented but unused
 * @returns {Object} - { mode, ceiling, explanation }
 */
export function detectExecutionMode(srcPath, _url) {
  // Check if source code is available and viable
  const hasSourceCode = isSourceCodeAvailable(srcPath);
  
  if (hasSourceCode) {
    return {
      mode: EXECUTION_MODES.PROJECT_SCAN,
      ceiling: CONFIDENCE_CEILINGS[EXECUTION_MODES.PROJECT_SCAN],
      explanation: 'Full project analysis: source code is available for static analysis, expectations extraction, and dynamic behavior correlation.',
      reason: 'Source code detected at ' + srcPath
    };
  } else {
    return {
      mode: EXECUTION_MODES.WEB_SCAN_LIMITED,
      ceiling: CONFIDENCE_CEILINGS[EXECUTION_MODES.WEB_SCAN_LIMITED],
      explanation: 'Limited web scan: no local source code available. Analysis is based solely on runtime behavior observation. Confidence is capped at 45% due to inability to correlate with code-level expectations.',
      reason: 'No source code available; analyzing runtime behavior only'
    };
  }
}

/**
 * Check if source code is available and viable for analysis
 * @param {string} srcPath - Path to source code directory
 * @returns {boolean} - True if source code appears to be available
 */
function isSourceCodeAvailable(srcPath) {
  // Check if path exists
  if (!existsSync(srcPath)) {
    return false;
  }
  
  // Check if it's a directory
  try {
    const stats = statSync(srcPath);
    if (!stats.isDirectory()) {
      return false;
    }
  } catch {
    return false;
  }
  
  // Check for minimum viable source indicators
  return hasSourceIndicators(srcPath);
}

/**
 * Check for presence of source code indicators
 * @param {string} srcPath - Path to potential source directory
 * @returns {boolean} - True if source indicators are present
 */
function hasSourceIndicators(srcPath) {
  try {
    const entries = readdirSync(srcPath, { withFileTypes: true })
      // @ts-ignore - Dirent has name property
      .sort((a, b) => a.name.localeCompare(b.name));
    
    // Look for common source code patterns
    const indicators = {
      hasJs: false,      // .js, .jsx, .ts, .tsx files
      hasSrc: false,     // src/ directory
      hasPackageJson: false,
      hasPythonFiles: false,
      hasGoFiles: false
    };
    
    for (const entry of entries) {
      const name = entry.name;
      const lowerName = name.toLowerCase();
      
      // Check for source directories
      if (entry.isDirectory() && 
          (lowerName === 'src' || lowerName === 'lib' || lowerName === 'app' || 
           lowerName === 'pages' || lowerName === 'components' || lowerName === 'python')) {
        indicators.hasSrc = true;
      }
      
      // Check for package.json (Node.js projects)
      if (name === 'package.json') {
        indicators.hasPackageJson = true;
      }
      
      // Check for JS/TS files
      if (lowerName.endsWith('.js') || lowerName.endsWith('.jsx') || 
          lowerName.endsWith('.ts') || lowerName.endsWith('.tsx') ||
          lowerName.endsWith('.mjs') || lowerName.endsWith('.cjs')) {
        indicators.hasJs = true;
      }
      
      // Check for Python files
      if (lowerName.endsWith('.py')) {
        indicators.hasPythonFiles = true;
      }
      
      // Check for Go files
      if (lowerName.endsWith('.go')) {
        indicators.hasGoFiles = true;
      }
    }
    
    // Multiple indicators needed to confirm source code is present
    const indicatorCount = Object.values(indicators).filter(Boolean).length;
    return indicatorCount >= 2; // Need at least 2 indicators
    
  } catch (error) {
    return false;
  }
}

/**
 * Apply confidence ceiling to a score
 * @param {number} score - Confidence score (0..1 float)
 * @param {string} mode - Execution mode
 * @returns {number} - Capped confidence score (0..1 float)
 */
export function applyConfidenceCeiling(score, mode) {
  const ceiling = CONFIDENCE_CEILINGS[mode] || 1.0;
  return Math.min(score, ceiling);
}

/**
 * Generate execution mode explanation for output
 * @param {string} mode - Execution mode
 * @param {string} ceiling - Confidence ceiling
 * @returns {string} - Human-readable explanation
 */
export function generateModeExplanation(mode, ceiling) {
  switch (mode) {
    case EXECUTION_MODES.PROJECT_SCAN:
      return `Running in PROJECT_SCAN mode. Full analysis enabled with source code available.`;
    
    case EXECUTION_MODES.WEB_SCAN_LIMITED:
      // @ts-expect-error - Arithmetic on constant
      return `Running in WEB_SCAN_LIMITED mode. No source code available; analysis limited to runtime observation. Confidence capped at ${Math.round(ceiling * 100)}%.`;
    
    default:
      return 'Execution mode unknown.';
  }
}

/**
 * Format execution mode info for CLI output
 * @param {Object} modeInfo - Result from detectExecutionMode()
 * @returns {string} - Formatted text for console output
 */
export function formatModeForOutput(modeInfo) {
  return `Execution Mode: ${modeInfo.mode}
Confidence Ceiling: ${Math.round(modeInfo.ceiling * 100)}%
Reason: ${modeInfo.reason}`;
}



