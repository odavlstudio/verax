/**
 * Focus Sensor
 * Tracks focus changes and detects focus-related silent failures
 */

export class FocusSensor {
  constructor() {
    this.focusHistory = [];
  }

  /**
   * Capture current focus state before interaction
   */
  async captureBefore(page) {
    const focusData = await page.evaluate(() => {
      const active = document.activeElement;
      let selector = 'unknown';
      
      if (active === document.body) {
        selector = 'body';
      } else if (active === document.documentElement) {
        selector = 'html';
      } else if (!active) {
        selector = 'null';
      } else {
        if (active.id) {
          selector = `#${active.id}`;
        } else if (active.className) {
          const classes = Array.from(active.classList || []).slice(0, 2).join('.');
          selector = active.tagName.toLowerCase() + (classes ? `.${classes}` : '');
        } else {
          selector = active.tagName.toLowerCase();
        }
      }
      
      return {
        selector,
        tagName: active?.tagName || 'null',
        id: active?.id || null,
        role: active?.getAttribute('role') || null,
        ariaLabel: active?.getAttribute('aria-label') || null
      };
    });

    this.focusBefore = focusData;
    return focusData;
  }

  /**
   * Capture focus state after interaction and track history
   */
  async captureAfter(page) {
    const focusData = await page.evaluate(() => {
      const active = document.activeElement;
      let selector = 'unknown';
      
      if (active === document.body) {
        selector = 'body';
      } else if (active === document.documentElement) {
        selector = 'html';
      } else if (!active) {
        selector = 'null';
      } else {
        if (active.id) {
          selector = `#${active.id}`;
        } else if (active.className) {
          const classes = Array.from(active.classList || []).slice(0, 2).join('.');
          selector = active.tagName.toLowerCase() + (classes ? `.${classes}` : '');
        } else {
          selector = active.tagName.toLowerCase();
        }
      }
      
      // Check if there's a modal present
      const modal = document.querySelector('[role="dialog"], [aria-modal="true"], .modal, [data-modal]');
      const hasModal = Boolean(modal);
      
      // Check if focus is within modal
      const focusInModal = active?.closest('[role="dialog"], [aria-modal="true"], .modal, [data-modal]');
      const isWithinModal = Boolean(focusInModal);
      
      return {
        selector,
        tagName: active?.tagName || 'null',
        id: active?.id || null,
        role: active?.getAttribute('role') || null,
        ariaLabel: active?.getAttribute('aria-label') || null,
        hasModal: hasModal,
        focusInModal: isWithinModal
      };
    });

    this.focusAfter = focusData;
    this.focusHistory.push(focusData);
    return focusData;
  }

  /**
   * Perform keyboard navigation and track focus sequence to detect traps
   */
  async captureKeyboardSequence(page, steps = 10) {
    const sequence = [];

    // Start with current focus
    let current = await page.evaluate(() => {
      const active = document.activeElement;
      if (active === document.body) return 'body';
      if (active === document.documentElement) return 'html';
      if (!active) return 'null';
      if (active.id) return `#${active.id}`;
      return active.tagName.toLowerCase();
    });

    sequence.push(current);

    // Tab through elements and record focus changes
    for (let i = 0; i < steps; i++) {
      await page.press('body', 'Tab');
      await page.waitForTimeout(50); // Small delay for focus to settle

      const next = await page.evaluate(() => {
        const active = document.activeElement;
        if (active === document.body) return 'body';
        if (active === document.documentElement) return 'html';
        if (!active) return 'null';
        if (active.id) return `#${active.id}`;
        return active.tagName.toLowerCase();
      });

      sequence.push(next);

      // Check for trap: if we've cycled the same elements
      if (i >= 3) {
        const recentUnique = new Set(sequence.slice(-3));
        if (recentUnique.size <= 2) {
          // Likely in a trap
          break;
        }
      }
    }

    return sequence;
  }

  /**
   * Detect if focus is lost or stuck
   */
  detectFocusLoss() {
    if (!this.focusAfter) return false;
    
    // Focus lost to body/null after interaction
    return this.focusAfter.selector === 'body' || this.focusAfter.selector === 'null';
  }

  /**
   * Detect if focus didn't move into modal (expected but didn't happen)
   */
  detectModalFocusFailure(_page) {
    // This is checked via modal detection - focus should move to modal
    // Presence of modal without focus change = failure
    return false; // Caller will check if modal opened
  }

  /**
   * Detect keyboard trap: focus cycles within small set
   */
  detectKeyboardTrap(sequence, threshold = 4) {
    if (!sequence || sequence.length < 3) return false;

    // If same focus element repeats consecutively, it's a trap
    for (let i = 1; i < sequence.length; i++) {
      if (sequence[i] === sequence[i - 1]) {
        return true;
      }
    }

    // If we cycle through same 2-3 elements repeatedly
    const recentSet = new Set(sequence.slice(-threshold));
    if (recentSet.size <= 2 && sequence.length >= threshold) {
      return true;
    }

    return false;
  }

  /**
   * Get focus diff for evidence
   */
  getFocusDiff() {
    return {
      before: this.focusBefore,
      after: this.focusAfter,
      changed: this.focusBefore?.selector !== this.focusAfter?.selector
    };
  }
}
