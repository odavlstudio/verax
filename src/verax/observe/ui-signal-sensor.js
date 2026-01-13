/**
 * WAVE 3: UI Signal Sensor
 * Detects user-visible feedback signals: loading states, dialogs, error messages
 * Conservative: only count signals with accessibility semantics or explicit attributes
 */

export class UISignalSensor {
  /**
   * Snapshot current UI signals on the page.
   * Returns: { hasLoadingIndicator, hasDialog, buttonStateChanged, errorSignals, explanation }
   */
  async snapshot(page) {
    const signals = await page.evaluate(() => {
      const result = {
        hasLoadingIndicator: false,
        hasDialog: false,
        hasErrorSignal: false,
        hasStatusSignal: false,
        hasLiveRegion: false,
        validationFeedbackDetected: false,
        disabledElements: [],
        explanation: []
      };

      // Check for loading indicators with accessibility semantics
      // aria-busy="true"
      const ariaBusy = document.querySelector('[aria-busy="true"]');
      if (ariaBusy) {
        result.hasLoadingIndicator = true;
        result.explanation.push('Found [aria-busy="true"]');
      }

      // [data-loading] or [aria-label] with "loading" text
      const dataLoading = document.querySelector('[data-loading]');
      if (dataLoading) {
        result.hasLoadingIndicator = true;
        result.explanation.push('Found [data-loading]');
      }

      // role=status or role=alert with aria-live (visible only)
      const statusRegions = Array.from(document.querySelectorAll('[role="status"], [role="alert"]'));
      const visibleStatusRegions = statusRegions.filter((el) => {
        const style = window.getComputedStyle(el);
        // @ts-expect-error - offsetParent exists on HTMLElement in browser context
        return el.offsetParent !== null && style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0';
      });
      if (visibleStatusRegions.length > 0) {
        result.hasStatusSignal = true;
        result.explanation.push(`Found ${visibleStatusRegions.length} visible status/alert region(s)`);
      }

      // aria-live region (legacy check - will be checked again for visibility below)
      const allLiveRegions = document.querySelectorAll('[aria-live]');
      if (allLiveRegions.length > 0) {
        result.hasLiveRegion = true;
        result.explanation.push(`Found ${allLiveRegions.length} aria-live region(s)`);
      }

      // Check for dialogs
      const dialog = document.querySelector('[role="dialog"], [aria-modal="true"]');
      // @ts-expect-error - offsetParent exists on HTMLElement in browser context
      if (dialog && dialog.offsetParent !== null) {
        // offsetParent is null if element is hidden
        result.hasDialog = true;
        result.explanation.push('Found dialog/modal');
      }

      // Check for disabled/loading buttons
      const disabledButtons = document.querySelectorAll('button[disabled], button[aria-busy="true"]');
      disabledButtons.forEach((btn) => {
        result.disabledElements.push({
          type: 'button',
          text: (btn.textContent || '').trim().slice(0, 50),
          attributes: {
            disabled: btn.hasAttribute('disabled'),
            ariaBusy: btn.getAttribute('aria-busy'),
            class: btn.className.slice(0, 100)
          }
        });
      });

      if (result.disabledElements.length > 0) {
        result.explanation.push(
          `Found ${result.disabledElements.length} disabled/loading button(s)`
        );
      }

      // VALIDATION INTELLIGENCE v1: Detect visible validation feedback
      // Check for aria-invalid="true" with visible error text nearby
      const invalidElements = Array.from(document.querySelectorAll('[aria-invalid="true"]'));
      let hasVisibleValidationError = false;
      
      for (const invalidEl of invalidElements) {
        const style = window.getComputedStyle(invalidEl);
        // @ts-expect-error - offsetParent exists on HTMLElement in browser context
        const isVisible = invalidEl.offsetParent !== null && 
                         style.visibility !== 'hidden' && 
                         style.display !== 'none' && 
                         style.opacity !== '0';
        
        if (isVisible) {
          // Check for visible error text near this input
          // Look in parent, next sibling, or aria-describedby target
          const describedBy = invalidEl.getAttribute('aria-describedby');
          if (describedBy) {
            const errorTarget = document.getElementById(describedBy);
            if (errorTarget) {
              const targetStyle = window.getComputedStyle(errorTarget);
              const targetVisible = errorTarget.offsetParent !== null && 
                                   targetStyle.visibility !== 'hidden' && 
                                   targetStyle.display !== 'none' && 
                                   targetStyle.opacity !== '0';
              if (targetVisible && errorTarget.textContent.trim().length > 0) {
                hasVisibleValidationError = true;
                break;
              }
            }
          }
          
          // Check parent for error text
          const parent = invalidEl.parentElement;
          if (parent) {
            const errorText = Array.from(parent.querySelectorAll('[role="alert"], .error, .invalid-feedback'))
              .find(el => {
                const elStyle = window.getComputedStyle(el);
                // @ts-expect-error - offsetParent exists on HTMLElement in browser context
                return el.offsetParent !== null && 
                       elStyle.visibility !== 'hidden' && 
                       elStyle.display !== 'none' && 
                       elStyle.opacity !== '0' &&
                       el.textContent.trim().length > 0;
              });
            if (errorText) {
              hasVisibleValidationError = true;
              break;
            }
          }
        }
      }
      
      // Check for visible role="alert" or role="status" regions
      const alertRegions = Array.from(document.querySelectorAll('[role="alert"], [role="status"]'));
      const visibleAlertRegions = alertRegions.filter((el) => {
        const style = window.getComputedStyle(el);
        // @ts-expect-error - offsetParent exists on HTMLElement in browser context
        const isVisible = el.offsetParent !== null && 
                         style.visibility !== 'hidden' && 
                         style.display !== 'none' && 
                         style.opacity !== '0';
        return isVisible && el.textContent.trim().length > 0;
      });
      
      // Check for visible aria-live regions with content
      const liveRegions = Array.from(document.querySelectorAll('[aria-live]'));
      const visibleLiveRegions = liveRegions.filter((el) => {
        const style = window.getComputedStyle(el);
        // @ts-expect-error - offsetParent exists on HTMLElement in browser context
        const isVisible = el.offsetParent !== null && 
                         style.visibility !== 'hidden' && 
                         style.display !== 'none' && 
                         style.opacity !== '0';
        return isVisible && el.textContent.trim().length > 0;
      });
      
      // VALIDATION INTELLIGENCE v1: Set validationFeedbackDetected
      result.validationFeedbackDetected = hasVisibleValidationError || 
                                         visibleAlertRegions.length > 0 || 
                                         visibleLiveRegions.length > 0;
      
      if (result.validationFeedbackDetected) {
        result.explanation.push('Visible validation feedback detected');
      }
      
      // Legacy: Check for error signals
      if (invalidElements.length > 0) {
        result.hasErrorSignal = true;
        result.explanation.push(`Found ${invalidElements.length} invalid element(s)`);
      }

      // Check for common error message patterns with accessibility attributes
      const errorMessages = document.querySelectorAll(
        '[role="alert"], [class*="error"], [class*="danger"]'
      );
      if (errorMessages.length > 0) {
        // @ts-expect-error - NodeListOf is iterable in browser context
        for (const elem of errorMessages) {
          const text = elem.textContent.trim().slice(0, 50);
          if (text && (text.toLowerCase().includes('error') || text.toLowerCase().includes('fail'))) {
            result.hasErrorSignal = true;
            result.explanation.push(`Found error message: "${text}"`);
            break;
          }
        }
      }

      return result;
    });

    return signals;
  }

  /**
   * Compute diff between two snapshots.
   * Returns: { changed: boolean, explanation: string[], summary: {...} }
   */
  diff(before, after) {
    const defaults = {
      hasLoadingIndicator: false,
      hasDialog: false,
      hasErrorSignal: false,
      hasStatusSignal: false,
      hasLiveRegion: false,
      disabledElements: [],
      validationFeedbackDetected: false
    };

    const safeBefore = { ...defaults, ...(before || {}) };
    const safeAfter = { ...defaults, ...(after || {}) };

    const result = {
      changed: false,
      explanation: [],
      summary: {
        loadingStateChanged: safeBefore.hasLoadingIndicator !== safeAfter.hasLoadingIndicator,
        dialogStateChanged: safeBefore.hasDialog !== safeAfter.hasDialog,
        errorSignalChanged: safeBefore.hasErrorSignal !== safeAfter.hasErrorSignal,
        statusSignalChanged: safeBefore.hasStatusSignal !== safeAfter.hasStatusSignal,
        liveRegionStateChanged: safeBefore.hasLiveRegion !== safeAfter.hasLiveRegion,
        disabledButtonsChanged: safeBefore.disabledElements.length !== safeAfter.disabledElements.length,
        validationFeedbackChanged: safeBefore.validationFeedbackDetected !== safeAfter.validationFeedbackDetected // VALIDATION INTELLIGENCE v1
      }
    };

    // Check what changed
    if (result.summary.loadingStateChanged) {
      result.changed = true;
      result.explanation.push(
        `Loading indicator: ${before.hasLoadingIndicator} → ${after.hasLoadingIndicator}`
      );
    }

    if (result.summary.dialogStateChanged) {
      result.changed = true;
      result.explanation.push(
        `Dialog present: ${before.hasDialog} → ${after.hasDialog}`
      );
    }

    if (result.summary.errorSignalChanged) {
      result.changed = true;
      result.explanation.push(
        `Error signal: ${before.hasErrorSignal} → ${after.hasErrorSignal}`
      );
    }

    if (result.summary.statusSignalChanged) {
      result.changed = true;
      result.explanation.push(
        `Status signal: ${before.hasStatusSignal} → ${after.hasStatusSignal}`
      );
    }

    if (result.summary.liveRegionStateChanged) {
      result.changed = true;
      result.explanation.push(
        `Live region: ${before.hasLiveRegion} → ${after.hasLiveRegion}`
      );
    }
    
    // Also check if status signal content changed (text added to role=status)
    if (!result.changed && before.hasStatusSignal && after.hasStatusSignal) {
      // Both have status signals, but content might have changed
      // This is a conservative check - if status signal exists and is visible, consider it feedback
      result.changed = true;
      result.explanation.push('Status signal content changed');
    }

    if (result.summary.disabledButtonsChanged) {
      result.changed = true;
      result.explanation.push(
        `Disabled buttons: ${before.disabledElements.length} → ${after.disabledElements.length}`
      );
    }

    // VALIDATION INTELLIGENCE v1: Check for validation feedback changes
    if (result.summary.validationFeedbackChanged) {
      result.changed = true;
      result.explanation.push(
        `Validation feedback: ${before.validationFeedbackDetected} → ${after.validationFeedbackDetected}`
      );
    }

    return {
      ...result,
      explanation: result.explanation.join(' | ')
    };
  }

  /**
   * Check if any feedback signal is present.
   */
  hasAnyFeedback(signals) {
    return (
      signals.hasLoadingIndicator ||
      signals.hasDialog ||
      signals.hasErrorSignal ||
      signals.hasStatusSignal ||
      signals.hasLiveRegion ||
      signals.disabledElements.length > 0
    );
  }

  /**
   * Check if any error/failure feedback is present.
   */
  hasErrorFeedback(signals) {
    return (
      signals.hasErrorSignal ||
      signals.hasDialog || // Dialog might be error confirmation
      (signals.hasStatusSignal && signals.explanation.some((ex) => ex.includes('error')))
    );
  }
}
