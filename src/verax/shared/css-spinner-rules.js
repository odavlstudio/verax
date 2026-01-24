/**
 * CSS SPINNER DETECTION RULES
 * 
 * Truth boundary for detecting CSS-only loading indicators (spinners)
 * without semantic attributes (aria-busy, data-loading, role).
 * 
 * Hard rules encoded as constants and predicates. No prose, only code.
 */

/**
 * Reason codes for CSS spinner detection decisions
 */
export const CSS_SPINNER_REASON_CODES = {
  DETECTED_BORDER_SPINNER: 'UI_CSS_SPINNER_DETECTED_BORDER',
  DETECTED_ROTATION_ANIMATION: 'UI_CSS_SPINNER_DETECTED_ROTATION',
  DETECTED_PULSE_ANIMATION: 'UI_CSS_SPINNER_DETECTED_PULSE',
  REJECTED_DECORATIVE: 'UI_CSS_SPINNER_REJECTED_DECORATIVE',
  REJECTED_TOO_LARGE: 'UI_CSS_SPINNER_REJECTED_TOO_LARGE',
  REJECTED_ALWAYS_PRESENT: 'UI_CSS_SPINNER_REJECTED_ALWAYS_PRESENT',
  REJECTED_NO_CORROBORATION: 'UI_CSS_SPINNER_REJECTED_NO_CORROBORATION',
  REJECTED_TIMING_WINDOW: 'UI_CSS_SPINNER_TIMED',
  ACCEPTED_WITH_CORROBORATION: 'UI_CSS_SPINNER_ACCEPTED_WITH_CORROBORATION'
};

/**
 * Maximum size for a spinner element (in pixels)
 * Larger elements are likely decorative, not loading indicators
 */
export const MAX_SPINNER_SIZE = 100; // pixels (width or height)

/**
 * Minimum size for a spinner element (in pixels)
 * Very small elements might be decorative dots
 */
export const MIN_SPINNER_SIZE = 8; // pixels

/**
 * Timing window for spinner appearance (milliseconds)
 * Spinner must appear within this window after interaction to count as loading feedback
 */
export const SPINNER_TIMING_WINDOW_MS = 2000; // 2 seconds

/**
 * Check if an element has border-based spinner pattern
 * Pattern: border + border-top (or border-left) with different color, creating circular spinner
 * 
 * @param {Object} computedStyle - Computed style object
 * @returns {boolean}
 */
export function isBorderSpinnerPattern(computedStyle) {
  if (!computedStyle) return false;
  
  const borderWidth = parseFloat(computedStyle.borderWidth) || 0;
  const borderTopWidth = parseFloat(computedStyle.borderTopWidth) || 0;
  const borderLeftWidth = parseFloat(computedStyle.borderLeftWidth) || 0;
  
  // Must have border
  if (borderWidth < 2 && borderTopWidth < 2 && borderLeftWidth < 2) {
    return false;
  }
  
  // Check for different border colors (spinner pattern)
  const borderColor = computedStyle.borderColor || '';
  const borderTopColor = computedStyle.borderTopColor || '';
  const borderLeftColor = computedStyle.borderLeftColor || '';
  
  // Border-top or border-left should have different color than main border
  const hasDifferentTopColor = borderTopColor && borderColor && borderTopColor !== borderColor && borderTopColor !== 'rgba(0, 0, 0, 0)';
  const hasDifferentLeftColor = borderLeftColor && borderColor && borderLeftColor !== borderColor && borderLeftColor !== 'rgba(0, 0, 0, 0)';
  
  // Check for circular shape (border-radius >= 50%)
  const borderRadius = computedStyle.borderRadius || '';
  const isCircular = borderRadius.includes('50%') || borderRadius.includes('999') || parseFloat(borderRadius) > 20;
  
  return (hasDifferentTopColor || hasDifferentLeftColor) && isCircular;
}

/**
 * Check if an element has rotation animation
 * Pattern: animation-name includes rotation, or transform: rotate() in keyframes
 * 
 * @param {Object} computedStyle - Computed style object
 * @param {Object} element - DOM element
 * @returns {boolean}
 */
export function isRotationAnimation(computedStyle, element) {
  if (!computedStyle || !element) return false;
  
  const animationName = computedStyle.animationName || '';
  const animation = computedStyle.animation || '';
  
  // Check animation name for spinner-related keywords (but don't rely only on names)
  const spinnerKeywords = ['spin', 'rotate', 'loading', 'loader'];
  const hasSpinnerKeyword = spinnerKeywords.some(keyword => 
    animationName.toLowerCase().includes(keyword) || animation.toLowerCase().includes(keyword)
  );
  
  // Check for transform: rotate() in computed style (indicates rotation)
  const transform = computedStyle.transform || '';
  const hasRotation = transform.includes('rotate');
  
  // Check for animation-duration (must be animated)
  const animationDuration = computedStyle.animationDuration || '';
  const isAnimated = animationDuration && animationDuration !== '0s' && !animationDuration.includes('none');
  
  // Must have rotation AND be animated
  return (hasRotation || hasSpinnerKeyword) && isAnimated;
}

/**
 * Check if an element has pulse animation (opacity or scale pulsing)
 * Pattern: animation that changes opacity or scale repeatedly
 * 
 * @param {Object} computedStyle - Computed style object
 * @returns {boolean}
 */
export function isPulseAnimation(computedStyle) {
  if (!computedStyle) return false;
  
  const animationName = computedStyle.animationName || '';
  const animation = computedStyle.animation || '';
  
  // Check for pulse-related keywords
  const pulseKeywords = ['pulse', 'fade', 'loading'];
  const hasPulseKeyword = pulseKeywords.some(keyword => 
    animationName.toLowerCase().includes(keyword) || animation.toLowerCase().includes(keyword)
  );
  
  // Check for animation-duration
  const animationDuration = computedStyle.animationDuration || '';
  const isAnimated = animationDuration && animationDuration !== '0s' && !animationDuration.includes('none');
  
  // Check for opacity animation (common in pulse patterns)
  const opacity = parseFloat(computedStyle.opacity) || 1;
  const hasOpacityVariation = opacity < 1; // Partially transparent suggests pulsing
  
  return hasPulseKeyword && isAnimated && hasOpacityVariation;
}

/**
 * Check if element size is within spinner bounds
 * 
 * @param {number} width - Element width in pixels
 * @param {number} height - Element height in pixels
 * @returns {boolean}
 */
export function isSpinnerSize(width, height) {
  const maxDim = Math.max(width, height);
  const minDim = Math.min(width, height);
  
  // Must be within size bounds
  if (maxDim > MAX_SPINNER_SIZE || minDim < MIN_SPINNER_SIZE) {
    return false;
  }
  
  // Should be roughly square (spinners are usually circular/square)
  const aspectRatio = maxDim / (minDim || 1);
  return aspectRatio <= 2.0; // Allow some rectangular tolerance
}

/**
 * Check if spinner appeared within timing window
 * 
 * @param {number} appearanceTime - Time when spinner appeared (ms since epoch)
 * @param {number} interactionTime - Time when interaction occurred (ms since epoch)
 * @returns {boolean}
 */
export function isWithinTimingWindow(appearanceTime, interactionTime) {
  if (!appearanceTime || !interactionTime) return false;
  const timeDiff = appearanceTime - interactionTime;
  return timeDiff >= 0 && timeDiff <= SPINNER_TIMING_WINDOW_MS;
}

/**
 * Check if element is likely decorative (always present, large, not near interaction)
 * 
 * @param {Object} element - DOM element
 * @param {Object} computedStyle - Computed style object
 * @param {boolean} wasPresentBefore - Whether element existed before interaction
 * @returns {boolean}
 */
export function isDecorativeElement(element, computedStyle, wasPresentBefore) {
  if (!element || !computedStyle) return false;
  
  // If element was always present, likely decorative
  if (wasPresentBefore) {
    return true;
  }
  
  // Check size
  const width = element.offsetWidth || 0;
  const height = element.offsetHeight || 0;
  if (!isSpinnerSize(width, height)) {
    return true;
  }
  
  // Check if element is very large (likely decorative)
  if (width > MAX_SPINNER_SIZE || height > MAX_SPINNER_SIZE) {
    return true;
  }
  
  return false;
}




