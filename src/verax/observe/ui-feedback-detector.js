/**
 * Gap 5.1: Runtime UI Feedback Detection
 * 
 * Detects strong, evidence-backed UI feedback signals after interactions.
 * Conservative approach: prefers false negatives over false positives.
 * 
 * Signals Detected:
 * 1. DOM Change Significance - meaningful changes in viewport/target container
 * 2. Loading Indicators - spinners, skeletons, progressbars with aria/CSS evidence
 * 3. Button State Transitions - disabled/enabled changes, label changes
 * 4. Notifications - toasts, alerts, aria-live updates
 * 5. Navigation - URL changes, history state transitions
 * 6. Focus/Scroll Changes - meaningful focus movements, significant scrolls
 */

/**
 * UI Feedback Detector
 * Captures before/after state and computes feedback signals
 */
export class UIFeedbackDetector {
  constructor() {
    this.beforeState = null;
    this.afterState = null;
    this.interactionTarget = null;
  }

  /**
   * Capture UI state before interaction
   * @param {import('playwright').Page} page - Playwright page
   * @param {Object} options - { targetSelector?: string }
   */
  async captureBefore(page, options = {}) {
    this.beforeState = await this._captureState(page, options.targetSelector);
    this.interactionTarget = options.targetSelector || null;
  }

  /**
   * Capture UI state after interaction
   * @param {import('playwright').Page} page - Playwright page
   */
  async captureAfter(page) {
    this.afterState = await this._captureState(page, this.interactionTarget);
  }

  /**
   * Compute UI feedback signals from before/after states
   * @returns {Object} Feedback signals with evidence
   */
  computeFeedbackSignals() {
    if (!this.beforeState || !this.afterState) {
      return this._emptySignals();
    }

    const signals = {
      domChange: this._computeDomChangeSignal(),
      loading: this._computeLoadingSignal(),
      buttonStateTransition: this._computeButtonStateSignal(),
      notification: this._computeNotificationSignal(),
      navigation: this._computeNavigationSignal(),
      focusChange: this._computeFocusChangeSignal(),
      scrollChange: this._computeScrollChangeSignal()
    };

    // Compute overall feedback score (0..1)
    const overallScore = this._computeOverallScore(signals);

    return {
      interactionId: this.beforeState.timestamp,
      signals,
      overallUiFeedbackScore: overallScore,
      _metadata: {
        capturedAt: new Date().toISOString(),
        interactionTarget: this.interactionTarget
      }
    };
  }

  /**
   * Capture state snapshot from page
   * @private
   */
  async _captureState(page, targetSelector = null) {
    try {
      const state = await page.evaluate((selector) => {
        const result = {
          timestamp: Date.now(),
          url: window.location.href,
          
          // DOM Structure
          viewport: {
            elementCount: 0,
            textContent: '',
            visibleText: ''
          },
          targetContainer: selector ? {
            elementCount: 0,
            textContent: '',
            innerHTML: ''
          } : null,
          
          // Loading Indicators
          loading: {
            ariaBusy: [],
            progressBars: [],
            spinners: [],
            skeletons: []
          },
          
          // Button States
          buttons: [],
          
          // Notifications/Alerts
          notifications: {
            alerts: [],
            liveRegions: [],
            toasts: []
          },
          
          // Navigation
          navigation: {
            pathname: window.location.pathname,
            search: window.location.search,
            hash: window.location.hash
          },
          
          // Focus
          focus: {
            activeElement: null,
            hasFocus: document.hasFocus()
          },
          
          // Scroll
          scroll: {
            x: window.scrollX || window.pageXOffset || 0,
            y: window.scrollY || window.pageYOffset || 0
          }
        };

        // Capture viewport content (above-the-fold)
        const viewportHeight = window.innerHeight;
        const viewportElements = Array.from(document.body?.querySelectorAll('*') || []).filter(el => {
          const rect = el.getBoundingClientRect();
          return rect.top < viewportHeight && rect.bottom > 0;
        });
        result.viewport.elementCount = viewportElements.length;
        result.viewport.visibleText = viewportElements
          .map(el => (el.textContent || '').trim())
          .filter(t => t.length > 0 && t.length < 200)
          .slice(0, 10)
          .join(' | ');

        // Capture target container if selector provided
        if (selector) {
          try {
            const target = document.querySelector(selector);
            if (target) {
              const containerElements = target.querySelectorAll('*');
              result.targetContainer.elementCount = containerElements.length;
              result.targetContainer.textContent = (target.textContent || '').trim().slice(0, 500);
              result.targetContainer.innerHTML = target.innerHTML.slice(0, 1000);
            }
          } catch (e) {
            // Selector not found - leave null
          }
        }

        // Detect loading indicators
        // 1. aria-busy
        const ariaBusyElements = Array.from(document.querySelectorAll('[aria-busy="true"]'));
        ariaBusyElements.forEach(el => {
          const style = window.getComputedStyle(el);
          if (style.display !== 'none' && style.visibility !== 'hidden') {
            result.loading.ariaBusy.push({
              tag: el.tagName.toLowerCase(),
              text: (el.textContent || '').trim().slice(0, 50),
              role: el.getAttribute('role')
            });
          }
        });

        // 2. role="progressbar"
        const progressBars = Array.from(document.querySelectorAll('[role="progressbar"]'));
        progressBars.forEach(el => {
          const style = window.getComputedStyle(el);
          if (style.display !== 'none' && style.visibility !== 'hidden') {
            result.loading.progressBars.push({
              valueNow: el.getAttribute('aria-valuenow'),
              valueMin: el.getAttribute('aria-valuemin'),
              valueMax: el.getAttribute('aria-valuemax'),
              label: el.getAttribute('aria-label')
            });
          }
        });

        // 3. Common spinner/loading classes (conservative: require animation)
        const spinnerCandidates = Array.from(document.querySelectorAll(
          '[class*="spinner"], [class*="loading"], [class*="loader"], [data-loading]'
        ));
        spinnerCandidates.forEach(el => {
          const style = window.getComputedStyle(el);
          const hasAnimation = style.animationName !== 'none' || style.animationDuration !== '0s';
          if (style.display !== 'none' && style.visibility !== 'hidden' && hasAnimation) {
            result.loading.spinners.push({
              className: el.className.slice(0, 100),
              tag: el.tagName.toLowerCase()
            });
          }
        });

        // 4. Skeleton loaders (conservative: require specific patterns)
        const skeletonCandidates = Array.from(document.querySelectorAll(
          '[class*="skeleton"], [aria-label*="skeleton"], [aria-label*="placeholder"]'
        ));
        skeletonCandidates.forEach(el => {
          const style = window.getComputedStyle(el);
          if (style.display !== 'none' && style.visibility !== 'hidden') {
            result.loading.skeletons.push({
              className: el.className.slice(0, 100),
              ariaLabel: el.getAttribute('aria-label')
            });
          }
        });

        // Capture button states (all buttons + actionable elements)
        const actionableElements = Array.from(document.querySelectorAll(
          'button, [role="button"], input[type="submit"], input[type="button"], a[role="button"]'
        ));
        actionableElements.forEach(el => {
          const style = window.getComputedStyle(el);
          if (style.display !== 'none' && style.visibility !== 'hidden') {
            result.buttons.push({
              selector: el.id ? `#${el.id}` : (el.className ? `.${el.className.split(' ')[0]}` : el.tagName.toLowerCase()),
              text: (el.textContent || '').trim().slice(0, 100),
              disabled: el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true',
              ariaBusy: el.getAttribute('aria-busy'),
              tag: el.tagName.toLowerCase(),
              type: el.getAttribute('type')
            });
          }
        });

        // Capture notifications/alerts
        // 1. role="alert"
        const alerts = Array.from(document.querySelectorAll('[role="alert"]'));
        alerts.forEach(el => {
          const style = window.getComputedStyle(el);
          if (style.display !== 'none' && style.visibility !== 'hidden') {
            result.notifications.alerts.push({
              text: (el.textContent || '').trim().slice(0, 200),
              className: el.className.slice(0, 100)
            });
          }
        });

        // 2. aria-live regions
        const liveRegions = Array.from(document.querySelectorAll('[aria-live]'));
        liveRegions.forEach(el => {
          const style = window.getComputedStyle(el);
          if (style.display !== 'none' && style.visibility !== 'hidden') {
            result.notifications.liveRegions.push({
              text: (el.textContent || '').trim().slice(0, 200),
              liveValue: el.getAttribute('aria-live'),
              role: el.getAttribute('role')
            });
          }
        });

        // 3. Toast/snackbar patterns (conservative: require visibility + specific classes)
        const toastCandidates = Array.from(document.querySelectorAll(
          '[class*="toast"], [class*="snackbar"], [class*="notification"], [class*="alert"]'
        ));
        toastCandidates.forEach(el => {
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          // Toast should be visible and positioned (not in normal flow)
          const isPositioned = style.position === 'fixed' || style.position === 'absolute';
          if (style.display !== 'none' && style.visibility !== 'hidden' && isPositioned && rect.width > 0) {
            result.notifications.toasts.push({
              text: (el.textContent || '').trim().slice(0, 200),
              className: el.className.slice(0, 100),
              position: style.position
            });
          }
        });

        // Capture active element
        if (document.activeElement && document.activeElement !== document.body) {
          const activeEl = document.activeElement;
          result.focus.activeElement = {
            tag: activeEl.tagName.toLowerCase(),
            id: activeEl.id || null,
            className: activeEl.className ? activeEl.className.slice(0, 100) : null,
            type: activeEl.getAttribute('type'),
            name: activeEl.getAttribute('name'),
            role: activeEl.getAttribute('role'),
            ariaLabel: activeEl.getAttribute('aria-label')
          };
        }

        return result;
      }, targetSelector);

      return state;
    } catch (error) {
      // Return minimal state on error
      return {
        timestamp: Date.now(),
        url: '',
        viewport: { elementCount: 0, textContent: '', visibleText: '' },
        targetContainer: null,
        loading: { ariaBusy: [], progressBars: [], spinners: [], skeletons: [] },
        buttons: [],
        notifications: { alerts: [], liveRegions: [], toasts: [] },
        navigation: { pathname: '', search: '', hash: '' },
        focus: { activeElement: null, hasFocus: false },
        scroll: { x: 0, y: 0 },
        _error: error.message
      };
    }
  }

  /**
   * Compute DOM change signal
   * @private
   */
  _computeDomChangeSignal() {
    const before = this.beforeState;
    const after = this.afterState;

    // Check viewport changes
    const viewportElementDelta = Math.abs(after.viewport.elementCount - before.viewport.elementCount);
    const viewportTextChanged = before.viewport.visibleText !== after.viewport.visibleText;

    // Check target container changes (if available)
    let targetChanged = false;
    let targetScore = 0;
    const targetEvidence = [];

    if (before.targetContainer && after.targetContainer) {
      const targetElementDelta = Math.abs(after.targetContainer.elementCount - before.targetContainer.elementCount);
      const targetTextChanged = before.targetContainer.textContent !== after.targetContainer.textContent;
      
      targetChanged = targetElementDelta > 0 || targetTextChanged;
      
      if (targetElementDelta > 5) {
        targetScore += 0.4;
        targetEvidence.push(`${targetElementDelta} elements added/removed in target`);
      } else if (targetElementDelta > 0) {
        targetScore += 0.2;
        targetEvidence.push(`${targetElementDelta} element(s) changed in target`);
      }
      
      if (targetTextChanged) {
        targetScore += 0.3;
        targetEvidence.push('Text content changed in target');
      }
    }

    // Compute viewport score
    let viewportScore = 0;
    const viewportEvidence = [];
    
    if (viewportElementDelta > 10) {
      viewportScore += 0.3;
      viewportEvidence.push(`${viewportElementDelta} elements added/removed in viewport`);
    } else if (viewportElementDelta > 3) {
      viewportScore += 0.15;
      viewportEvidence.push(`${viewportElementDelta} element(s) changed in viewport`);
    }
    
    if (viewportTextChanged) {
      viewportScore += 0.2;
      viewportEvidence.push('Visible text changed in viewport');
    }

    // Overall DOM change score (prioritize target over viewport)
    const score = targetChanged ? Math.min(targetScore + viewportScore * 0.3, 1.0) : viewportScore;
    const happened = score > 0.1; // Conservative threshold

    return {
      happened,
      score,
      evidence: {
        viewport: {
          elementDelta: viewportElementDelta,
          textChanged: viewportTextChanged,
          changes: viewportEvidence
        },
        target: targetChanged ? {
          elementDelta: after.targetContainer.elementCount - before.targetContainer.elementCount,
          textChanged: before.targetContainer.textContent !== after.targetContainer.textContent,
          changes: targetEvidence
        } : null
      }
    };
  }

  /**
   * Compute loading indicator signal
   * @private
   */
  _computeLoadingSignal() {
    const before = this.beforeState.loading;
    const after = this.afterState.loading;

    const appeared = {
      ariaBusy: after.ariaBusy.length > before.ariaBusy.length,
      progressBars: after.progressBars.length > before.progressBars.length,
      spinners: after.spinners.length > before.spinners.length,
      skeletons: after.skeletons.length > before.skeletons.length
    };

    const disappeared = {
      ariaBusy: before.ariaBusy.length > after.ariaBusy.length,
      progressBars: before.progressBars.length > after.progressBars.length,
      spinners: before.spinners.length > after.spinners.length,
      skeletons: before.skeletons.length > after.skeletons.length
    };

    const evidence = [];
    
    if (appeared.ariaBusy) {
      evidence.push(`${after.ariaBusy.length - before.ariaBusy.length} aria-busy elements appeared`);
    }
    if (appeared.progressBars) {
      evidence.push(`${after.progressBars.length - before.progressBars.length} progress bars appeared`);
    }
    if (appeared.spinners) {
      evidence.push(`${after.spinners.length - before.spinners.length} spinners appeared`);
    }
    if (appeared.skeletons) {
      evidence.push(`${after.skeletons.length - before.skeletons.length} skeleton loaders appeared`);
    }
    
    if (disappeared.ariaBusy) {
      evidence.push(`${before.ariaBusy.length - after.ariaBusy.length} aria-busy elements disappeared`);
    }
    if (disappeared.progressBars) {
      evidence.push(`${before.progressBars.length - after.progressBars.length} progress bars disappeared`);
    }
    if (disappeared.spinners) {
      evidence.push(`${before.spinners.length - after.spinners.length} spinners disappeared`);
    }
    if (disappeared.skeletons) {
      evidence.push(`${before.skeletons.length - after.skeletons.length} skeleton loaders disappeared`);
    }

    const hasAppeared = appeared.ariaBusy || appeared.progressBars || appeared.spinners || appeared.skeletons;
    const hasDisappeared = disappeared.ariaBusy || disappeared.progressBars || disappeared.spinners || disappeared.skeletons;

    return {
      appeared: hasAppeared,
      disappeared: hasDisappeared,
      evidence: {
        appeared,
        disappeared,
        details: evidence,
        beforeCount: before.ariaBusy.length + before.progressBars.length + before.spinners.length + before.skeletons.length,
        afterCount: after.ariaBusy.length + after.progressBars.length + after.spinners.length + after.skeletons.length
      }
    };
  }

  /**
   * Compute button state transition signal
   * @private
   */
  _computeButtonStateSignal() {
    const before = this.beforeState.buttons;
    const after = this.afterState.buttons;

    const transitions = [];

    // Match buttons by selector+text (fuzzy matching)
    // First pass: exact selector match (for text changes)
    before.forEach(beforeBtn => {
      const afterBtn = after.find(a => a.selector === beforeBtn.selector);

      if (afterBtn) {
        // Check for state transitions
        if (beforeBtn.disabled !== afterBtn.disabled) {
          transitions.push({
            selector: beforeBtn.selector,
            type: 'disabled-toggle',
            before: beforeBtn.disabled,
            after: afterBtn.disabled,
            text: beforeBtn.text
          });
        }

        // Check for text changes (e.g., "Submit" -> "Saving...")
        if (beforeBtn.text !== afterBtn.text && beforeBtn.text.length > 0 && afterBtn.text.length > 0) {
          transitions.push({
            selector: beforeBtn.selector,
            type: 'text-change',
            before: beforeBtn.text,
            after: afterBtn.text
          });
        }

        // Check for aria-busy changes
        if (beforeBtn.ariaBusy !== afterBtn.ariaBusy) {
          transitions.push({
            selector: beforeBtn.selector,
            type: 'aria-busy-change',
            before: beforeBtn.ariaBusy,
            after: afterBtn.ariaBusy,
            text: beforeBtn.text
          });
        }
      }
    });

    return {
      happened: transitions.length > 0,
      evidence: {
        transitionCount: transitions.length,
        transitions: transitions.slice(0, 5) // Limit to first 5 transitions
      }
    };
  }

  /**
   * Compute notification signal
   * @private
   */
  _computeNotificationSignal() {
    const before = this.beforeState.notifications;
    const after = this.afterState.notifications;

    const newAlerts = after.alerts.filter(a => 
      !before.alerts.some(b => b.text === a.text)
    );

    const newLiveRegions = after.liveRegions.filter(a => 
      !before.liveRegions.some(b => b.text === a.text)
    );

    const newToasts = after.toasts.filter(a => 
      !before.toasts.some(b => b.text === a.text)
    );

    const happened = newAlerts.length > 0 || newLiveRegions.length > 0 || newToasts.length > 0;

    return {
      happened,
      evidence: {
        newAlerts: newAlerts.slice(0, 3),
        newLiveRegions: newLiveRegions.slice(0, 3),
        newToasts: newToasts.slice(0, 3),
        totalNew: newAlerts.length + newLiveRegions.length + newToasts.length
      }
    };
  }

  /**
   * Compute navigation signal
   * @private
   */
  _computeNavigationSignal() {
    const before = this.beforeState.navigation;
    const after = this.afterState.navigation;

    const pathnameChanged = before.pathname !== after.pathname;
    const searchChanged = before.search !== after.search;
    const hashChanged = before.hash !== after.hash;

    const happened = pathnameChanged || searchChanged || hashChanged;

    return {
      happened,
      from: `${before.pathname}${before.search}${before.hash}`,
      to: `${after.pathname}${after.search}${after.hash}`,
      evidence: {
        pathnameChanged,
        searchChanged,
        hashChanged,
        urlChanged: this.beforeState.url !== this.afterState.url
      }
    };
  }

  /**
   * Compute focus change signal
   * @private
   */
  _computeFocusChangeSignal() {
    const before = this.beforeState.focus;
    const after = this.afterState.focus;

    // Check if active element changed
    const beforeId = before.activeElement ? 
      `${before.activeElement.tag}#${before.activeElement.id || before.activeElement.name || ''}` : null;
    const afterId = after.activeElement ? 
      `${after.activeElement.tag}#${after.activeElement.id || after.activeElement.name || ''}` : null;

    const happened = beforeId !== afterId;

    // Conservative: only flag as meaningful if focus moved to form field or error element
    const isMeaningful = happened && after.activeElement && (
      after.activeElement.tag === 'input' ||
      after.activeElement.tag === 'textarea' ||
      after.activeElement.tag === 'select' ||
      (after.activeElement.ariaLabel && after.activeElement.ariaLabel.toLowerCase().includes('error')) || false
    );

    return {
      happened: isMeaningful,
      from: before.activeElement ? {
        tag: before.activeElement.tag,
        id: before.activeElement.id,
        name: before.activeElement.name,
        role: before.activeElement.role
      } : null,
      to: after.activeElement ? {
        tag: after.activeElement.tag,
        id: after.activeElement.id,
        name: after.activeElement.name,
        role: after.activeElement.role
      } : null,
      evidence: {
        focusMovedToFormField: isMeaningful,
        beforeHasFocus: before.hasFocus,
        afterHasFocus: after.hasFocus
      }
    };
  }

  /**
   * Compute scroll change signal
   * @private
   */
  _computeScrollChangeSignal() {
    const before = this.beforeState.scroll;
    const after = this.afterState.scroll;

    const deltaX = Math.abs(after.x - before.x);
    const deltaY = Math.abs(after.y - before.y);

    // Conservative threshold: 100px vertical scroll or 50px horizontal
    const isSignificant = deltaY > 100 || deltaX > 50;

    return {
      happened: isSignificant,
      delta: {
        x: after.x - before.x,
        y: after.y - before.y
      },
      evidence: {
        beforePosition: { x: before.x, y: before.y },
        afterPosition: { x: after.x, y: after.y },
        scrollDistance: Math.sqrt(deltaX * deltaX + deltaY * deltaY)
      }
    };
  }

  /**
   * Compute overall UI feedback score (0..1)
   * @private
   */
  _computeOverallScore(signals) {
    let score = 0;
    let weights = 0;

    // DOM change: weight 0.25
    if (signals.domChange.happened) {
      score += signals.domChange.score * 0.25;
      weights += 0.25;
    }

    // Loading indicators: weight 0.2
    if (signals.loading.appeared || signals.loading.disappeared) {
      score += 0.2;
      weights += 0.2;
    }

    // Button state: weight 0.2
    if (signals.buttonStateTransition.happened) {
      score += 0.2;
      weights += 0.2;
    }

    // Notifications: weight 0.15
    if (signals.notification.happened) {
      score += 0.15;
      weights += 0.15;
    }

    // Navigation: weight 0.15
    if (signals.navigation.happened) {
      score += 0.15;
      weights += 0.15;
    }

    // Focus change: weight 0.05 (lower weight, auxiliary signal)
    if (signals.focusChange.happened) {
      score += 0.05;
      weights += 0.05;
    }

    // Scroll change: weight 0.05 (lower weight, auxiliary signal)
    if (signals.scrollChange.happened) {
      score += 0.05;
      weights += 0.05;
    }

    // Normalize by weights (if no signals, score = 0)
    return weights > 0 ? score : 0;
  }

  /**
   * Return empty signals structure
   * @private
   */
  _emptySignals() {
    return {
      interactionId: null,
      signals: {
        domChange: { happened: false, score: 0, evidence: {} },
        loading: { appeared: false, disappeared: false, evidence: {} },
        buttonStateTransition: { happened: false, evidence: {} },
        notification: { happened: false, evidence: {} },
        navigation: { happened: false, from: '', to: '', evidence: {} },
        focusChange: { happened: false, from: null, to: null, evidence: {} },
        scrollChange: { happened: false, delta: { x: 0, y: 0 }, evidence: {} }
      },
      overallUiFeedbackScore: 0,
      _metadata: {
        error: 'No before/after state captured'
      }
    };
  }

  /**
   * Reset detector state
   */
  reset() {
    this.beforeState = null;
    this.afterState = null;
    this.interactionTarget = null;
  }
}
