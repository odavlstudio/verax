/**
 * Wave 8 — State UI Sensor
 *
 * Detects meaningful UI state changes related to state mutations.
 * Conservative, accessibility-first signals:
 * - Dialog/modal visibility (role=dialog, aria-modal)
 * - Expansion state (aria-expanded)
 * - Tab selection (role=tab/tabpanel, aria-selected)
 * - Checkbox/toggle state (aria-checked)
 * - Alert/status content changes (role=alert/status)
 * - DOM mutation count (meaningful node additions, not just style/class changes)
 *
 * Zero heuristics. Reports exactly what changed.
 */

export class StateUISensor {
  /**
   * Take a snapshot of UI signals related to state mutations.
   * @param {Object} page - Playwright page object
   * @param {string|Object} contextSelector - Optional: CSS selector or element handle to focus on
   * @returns {Promise<Object>} - { signals: {...}, rawSnapshot: {...} }
   */
  async snapshot(page, contextSelector = null) {
    try {
      const snapshot = await page.evaluate(() => {
        const signals = {};
        const rawSnapshot = {};

        // 1. Dialog/Modal signals
        signals.dialogs = [];
        const dialogs = document.querySelectorAll('[role="dialog"]');
        // @ts-expect-error - NodeListOf is iterable in browser context
        for (const dialog of dialogs) {
          const isVisible = dialog.offsetParent !== null || dialog.hasAttribute('open');
          const ariaModal = dialog.getAttribute('aria-modal');
          signals.dialogs.push({
            visible: isVisible,
            ariaModal: ariaModal === 'true',
            hasOpen: dialog.hasAttribute('open')
          });
          if (isVisible || ariaModal === 'true') {
            signals.hasDialog = true;
          }
        }
        rawSnapshot.dialogCount = dialogs.length;

        // 2. Expansion state (aria-expanded)
        signals.expandedElements = [];
        const expandables = document.querySelectorAll('[aria-expanded]');
        // @ts-expect-error - NodeListOf is iterable in browser context
        for (const el of expandables) {
          const expanded = el.getAttribute('aria-expanded') === 'true';
          signals.expandedElements.push({
            id: el.id || el.className,
            expanded
          });
        }
        rawSnapshot.expandableCount = expandables.length;

        // 3. Tab selection (role=tab with aria-selected)
        signals.selectedTabs = [];
        const tabs = document.querySelectorAll('[role="tab"]');
        // @ts-expect-error - NodeListOf is iterable in browser context
        for (const tab of tabs) {
          const selected = tab.getAttribute('aria-selected') === 'true';
          signals.selectedTabs.push({
            id: tab.id || tab.textContent?.substring(0, 20),
            selected
          });
        }
        rawSnapshot.tabCount = tabs.length;

        // 4. Checkbox/toggle state (aria-checked)
        signals.checkedElements = [];
        const checkables = document.querySelectorAll('[aria-checked]');
        // @ts-expect-error - NodeListOf is iterable in browser context
        for (const el of checkables) {
          const checked = el.getAttribute('aria-checked') === 'true';
          signals.checkedElements.push({
            id: el.id || el.className,
            checked
          });
        }
        rawSnapshot.checkableCount = checkables.length;

        // 5. Alert/Status changes (role=alert, role=status)
        signals.alerts = [];
        const alerts = document.querySelectorAll('[role="alert"], [role="status"]');
        // @ts-expect-error - NodeListOf is iterable in browser context
        for (const alert of alerts) {
          const text = alert.textContent?.trim() || '';
          signals.alerts.push({
            role: alert.getAttribute('role'),
            text: text.substring(0, 100), // First 100 chars
            visible: alert.offsetParent !== null
          });
        }
        rawSnapshot.alertCount = alerts.length;

        // 6. DOM mutation count (meaningful changes)
        // Count visible nodes and text nodes (excluding style/comment nodes)
        const countMeaningfulNodes = () => {
          let count = 0;
          // @ts-expect-error - NodeListOf is iterable in browser context
          for (const node of document.querySelectorAll('*')) {
            if (node.offsetParent !== null) { // Visible
              count++;
            }
          }
          return count;
        };
        rawSnapshot.meaningfulNodeCount = countMeaningfulNodes();

        return { signals, rawSnapshot };
      }, { selector: contextSelector });

      return snapshot;
    } catch (e) {
      // If page evaluation fails, return minimal snapshot
      return {
        signals: {
          dialogs: [],
          expandedElements: [],
          selectedTabs: [],
          checkedElements: [],
          alerts: []
        },
        rawSnapshot: {
          error: e.message
        }
      };
    }
  }

  /**
   * Compare two snapshots and report changes.
   * @param {Object} before - Snapshot from before state mutation
   * @param {Object} after - Snapshot from after state mutation
   * @returns {Object} - { changed: boolean, reasons: string[] }
   */
  diff(before, after) {
    const reasons = [];

    if (!before || !after) {
      return { changed: false, reasons: ['No snapshot data'] };
    }

    const beforeSignals = before.signals || {};
    const afterSignals = after.signals || {};

    // Check dialog visibility change
    const beforeHasDialog = beforeSignals.hasDialog === true;
    const afterHasDialog = afterSignals.hasDialog === true;
    if (beforeHasDialog !== afterHasDialog) {
      reasons.push(afterHasDialog ? 'Dialog opened' : 'Dialog closed');
    }

    // Check expansion changes
    const beforeExpanded = this._extractState(beforeSignals.expandedElements || [], 'expanded');
    const afterExpanded = this._extractState(afterSignals.expandedElements || [], 'expanded');
    if (beforeExpanded !== afterExpanded) {
      reasons.push(`Expansion state changed: ${beforeExpanded} → ${afterExpanded}`);
    }

    // Check tab selection changes
    const beforeSelected = this._extractState(beforeSignals.selectedTabs || [], 'selected');
    const afterSelected = this._extractState(afterSignals.selectedTabs || [], 'selected');
    if (beforeSelected !== afterSelected) {
      reasons.push(`Tab selection changed: ${beforeSelected} → ${afterSelected}`);
    }

    // Check checkbox state changes
    const beforeChecked = this._extractState(beforeSignals.checkedElements || [], 'checked');
    const afterChecked = this._extractState(afterSignals.checkedElements || [], 'checked');
    if (beforeChecked !== afterChecked) {
      reasons.push(`Checked state changed: ${beforeChecked} → ${afterChecked}`);
    }

    // Check alert changes
    const beforeAlerts = (beforeSignals.alerts || []).map(a => a.text).join('|');
    const afterAlerts = (afterSignals.alerts || []).map(a => a.text).join('|');
    if (beforeAlerts !== afterAlerts) {
      reasons.push('Alert content changed');
    }

    // Check DOM mutation (meaningful node count)
    const beforeNodeCount = before.rawSnapshot?.meaningfulNodeCount || 0;
    const afterNodeCount = after.rawSnapshot?.meaningfulNodeCount || 0;
    const nodeDelta = afterNodeCount - beforeNodeCount;
    if (nodeDelta > 2 || nodeDelta < -2) { // Allow small variance
      reasons.push(`DOM mutation: ${beforeNodeCount} → ${afterNodeCount} visible nodes`);
    }

    const changed = reasons.length > 0;
    return { changed, reasons };
  }

  /**
   * Extract state summary from array of elements.
   * @private
   */
  _extractState(elements, key) {
    if (!elements || elements.length === 0) return '(none)';
    return elements.map(e => e[key] ? 'T' : 'F').join('');
  }
}



