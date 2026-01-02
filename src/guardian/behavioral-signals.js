/**
 * Phase 5 — Behavioral Signal Detector
 * Detects non-visual but UI-affecting changes that break user trust
 */

/**
 * Detect behavioral changes (missing elements, layout shifts, disabled CTAs)
 */
class BehavioralSignalDetector {
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * Check if critical element is visible and accessible
   */
  async checkElementVisibility(page, selector) {
    try {
      const element = await page.$(selector);
      if (!element) {
        return {
          visible: false,
          accessible: false,
          signal: 'ELEMENT_MISSING',
          severity: 'CRITICAL',
          description: `Critical element not found: ${selector}`
        };
      }

      const boundingBox = await element.boundingBox();
      if (!boundingBox) {
        return {
          visible: false,
          accessible: false,
          signal: 'OFFSCREEN_ELEMENT',
          severity: 'CRITICAL',
          description: `Element off-screen: ${selector}`
        };
      }

      const isHidden = await element.isHidden();
      if (isHidden) {
        return {
          visible: false,
          accessible: false,
          signal: 'HIDDEN_ELEMENT',
          severity: 'CRITICAL',
          description: `Element hidden: ${selector}`
        };
      }

      const isDisabled = await element.isDisabled();
      if (isDisabled) {
        return {
          visible: true,
          accessible: false,
          signal: 'DISABLED_ELEMENT',
          severity: 'WARNING',
          description: `Element disabled: ${selector}`
        };
      }

      return {
        visible: true,
        accessible: true,
        signal: null,
        severity: 'INFO'
      };
    } catch (err) {
      return {
        visible: false,
        accessible: false,
        signal: 'CHECK_FAILED',
        severity: 'INFO',
        description: `Check failed: ${err.message}`
      };
    }
  }

  /**
   * Detect layout shifts - elements that moved unexpectedly
   */
  async detectLayoutShift(page, selectors) {
    const shifts = [];

    for (const selector of selectors) {
      try {
        const element = await page.$(selector);
        if (!element) continue;

        const boundingBox = await element.boundingBox();
        if (!boundingBox) continue;

        // Check if element is near viewport edges (shifted)
        const viewportSize = page.viewportSize();
        if (viewportSize) {
          const { x, y, width, height } = boundingBox;

          // Completely off-screen
          if (x + width <= 0 || x >= viewportSize.width || y + height <= 0 || y >= viewportSize.height) {
            shifts.push({
              selector,
              signal: 'OFFSCREEN_SHIFT',
              severity: 'CRITICAL',
              description: `Element shifted off-screen: ${selector}`,
              position: { x, y, width, height }
            });
          }
          // Partially off-screen
          else if (x < 0 || y < 0 || x + width > viewportSize.width) {
            shifts.push({
              selector,
              signal: 'PARTIAL_SHIFT',
              severity: 'WARNING',
              description: `Element partially shifted: ${selector}`,
              position: { x, y, width, height }
            });
          }
        }
      } catch (_err) {
        // Silently skip errors
      }
    }

    return shifts;
  }

  /**
   * Check if critical CTA (button, link) is clickable
   */
  async checkCTAAccessibility(page, selector) {
    try {
      const element = await page.$(selector);
      if (!element) {
        return {
          clickable: false,
          signal: 'CTA_MISSING',
          severity: 'CRITICAL',
          description: `Call-to-action not found: ${selector}`
        };
      }

      const isDisabled = await element.isDisabled();
      if (isDisabled) {
        return {
          clickable: false,
          signal: 'CTA_DISABLED',
          severity: 'CRITICAL',
          description: `CTA disabled unexpectedly: ${selector}`
        };
      }

      const isHidden = await element.isHidden();
      if (isHidden) {
        return {
          clickable: false,
          signal: 'CTA_HIDDEN',
          severity: 'CRITICAL',
          description: `CTA hidden unexpectedly: ${selector}`
        };
      }

      const isEnabled = await element.isEnabled();
      if (!isEnabled) {
        return {
          clickable: false,
          signal: 'CTA_UNAVAILABLE',
          severity: 'CRITICAL',
          description: `CTA unavailable: ${selector}`
        };
      }

      return {
        clickable: true,
        signal: null,
        severity: 'INFO'
      };
    } catch (err) {
      return {
        clickable: false,
        signal: 'CHECK_FAILED',
        severity: 'INFO',
        description: `CTA check failed: ${err.message}`
      };
    }
  }

  /**
   * Detect color/styling changes on critical elements
   */
  async detectStyleChanges(page, selector, expectedStyles = {}) {
    const changes = [];

    try {
      const element = await page.$(selector);
      if (!element) return changes;

      for (const [property, expectedValue] of Object.entries(expectedStyles)) {
        const actualValue = await element.evaluate((el, prop) => {
          return window.getComputedStyle(el).getPropertyValue(prop);
        }, property);

        if (actualValue !== expectedValue) {
          changes.push({
            selector,
            property,
            expectedValue,
            actualValue,
            signal: 'STYLE_CHANGE',
            severity: 'WARNING',
            description: `Style changed: ${property} from ${expectedValue} to ${actualValue}`
          });
        }
      }
    } catch (_err) {
      // Silently skip
    }

    return changes;
  }

  /**
   * Comprehensive behavioral audit
   */
  async auditBehavior(page, config) {
    const signals = [];

    // Check critical elements
    if (config.criticalElements) {
      for (const selector of config.criticalElements) {
        const check = await this.checkElementVisibility(page, selector);
        if (check.signal) signals.push(check);
      }
    }

    // Check CTAs
    if (config.criticalCTAs) {
      for (const selector of config.criticalCTAs) {
        const check = await this.checkCTAAccessibility(page, selector);
        if (check.signal) signals.push(check);
      }
    }

    // Check layout shifts
    if (config.monitoredElements) {
      const shifts = await this.detectLayoutShift(page, config.monitoredElements);
      signals.push(...shifts);
    }

    return {
      hasSignals: signals.length > 0,
      signals,
      criticalCount: signals.filter(s => s.severity === 'CRITICAL').length,
      warningCount: signals.filter(s => s.severity === 'WARNING').length
    };
  }
}

module.exports = {
  BehavioralSignalDetector
};
