/**
 * ARIA Announcement Sensor
 * Tracks ARIA live regions, status/alert roles, and announcements
 */

export class AriaSensor {
  constructor() {
    this.ariaStateBefore = null;
    this.ariaStateAfter = null;
  }

  /**
   * Capture ARIA state before interaction
   */
  async captureBefore(page) {
    const ariaData = await page.evaluate(() => {
      const result = {
        liveRegions: [],
        statusRoles: [],
        alerts: [],
        ariaBusyElements: [],
        ariaLive: [],
        announcements: []
      };

      // Find all live regions
      const liveRegions = document.querySelectorAll('[aria-live]');
      liveRegions.forEach(el => {
        result.liveRegions.push({
          selector: generateSelector(el),
          ariaLive: el.getAttribute('aria-live'),
          text: el.textContent?.slice(0, 100) || '',
          ariaAtomic: el.getAttribute('aria-atomic'),
          ariaRelevant: el.getAttribute('aria-relevant')
        });
      });

      // Find status and alert roles
      const statusAlerts = document.querySelectorAll('[role="status"], [role="alert"]');
      statusAlerts.forEach(el => {
        result.statusRoles.push({
          selector: generateSelector(el),
          role: el.getAttribute('role'),
          text: el.textContent?.slice(0, 100) || '',
          ariaLive: el.getAttribute('aria-live')
        });
      });

      // Find aria-busy elements
      const busyElements = document.querySelectorAll('[aria-busy="true"]');
      busyElements.forEach(el => {
        result.ariaBusyElements.push({
          selector: generateSelector(el),
          ariaBusy: el.getAttribute('aria-busy')
        });
      });

      return result;

      function generateSelector(el) {
        if (el.id) return `#${el.id}`;
        if (el.className) {
          const classes = Array.from(el.classList || []).slice(0, 2).join('.');
          return el.tagName.toLowerCase() + (classes ? `.${classes}` : '');
        }
        return el.tagName.toLowerCase();
      }
    });

    this.ariaStateBefore = ariaData;
    return ariaData;
  }

  /**
   * Capture ARIA state after interaction
   */
  async captureAfter(page) {
    const ariaData = await page.evaluate(() => {
      const result = {
        liveRegions: [],
        statusRoles: [],
        alerts: [],
        ariaBusyElements: [],
        ariaLive: [],
        announcements: []
      };

      // Find all live regions
      const liveRegions = document.querySelectorAll('[aria-live]');
      liveRegions.forEach(el => {
        result.liveRegions.push({
          selector: generateSelector(el),
          ariaLive: el.getAttribute('aria-live'),
          text: el.textContent?.slice(0, 100) || '',
          ariaAtomic: el.getAttribute('aria-atomic'),
          ariaRelevant: el.getAttribute('aria-relevant')
        });
      });

      // Find status and alert roles
      const statusAlerts = document.querySelectorAll('[role="status"], [role="alert"]');
      statusAlerts.forEach(el => {
        result.statusRoles.push({
          selector: generateSelector(el),
          role: el.getAttribute('role'),
          text: el.textContent?.slice(0, 100) || '',
          ariaLive: el.getAttribute('aria-live')
        });
      });

      // Find aria-busy elements
      const busyElements = document.querySelectorAll('[aria-busy="true"]');
      busyElements.forEach(el => {
        result.ariaBusyElements.push({
          selector: generateSelector(el),
          ariaBusy: el.getAttribute('aria-busy')
        });
      });

      return result;

      function generateSelector(el) {
        if (el.id) return `#${el.id}`;
        if (el.className) {
          const classes = Array.from(el.classList || []).slice(0, 2).join('.');
          return el.tagName.toLowerCase() + (classes ? `.${classes}` : '');
        }
        return el.tagName.toLowerCase();
      }
    });

    this.ariaStateAfter = ariaData;
    return ariaData;
  }

  /**
   * Detect if ARIA state changed (live region updates, role changes, etc)
   */
  detectAriaChange() {
    if (!this.ariaStateBefore || !this.ariaStateAfter) {
      return false;
    }

    // Check if live region text changed
    const beforeLiveText = this.ariaStateBefore.liveRegions.map(r => r.text).join('|');
    const afterLiveText = this.ariaStateAfter.liveRegions.map(r => r.text).join('|');

    if (beforeLiveText !== afterLiveText) {
      return true;
    }

    // Check if status/alert role text changed
    const beforeStatusText = this.ariaStateBefore.statusRoles.map(r => r.text).join('|');
    const afterStatusText = this.ariaStateAfter.statusRoles.map(r => r.text).join('|');

    if (beforeStatusText !== afterStatusText) {
      return true;
    }

    // Check if aria-busy state changed
    const beforeBusy = this.ariaStateBefore.ariaBusyElements.length;
    const afterBusy = this.ariaStateAfter.ariaBusyElements.length;

    if (beforeBusy !== afterBusy) {
      return true;
    }

    return false;
  }

  /**
   * Check if ARIA announcement should have occurred but didn't
   */
  detectMissingAnnouncement(eventType) {
    // eventType: 'submit', 'network_success', 'network_error', 'validation_error', etc
    // These meaningful events should typically trigger ARIA announcements

    if (!this.ariaStateBefore || !this.ariaStateAfter) {
      return false;
    }

    // Check if any live region exists (at least one should for accessibility)
    const hasLiveRegion = this.ariaStateAfter.liveRegions.length > 0;
    const hasStatus = this.ariaStateAfter.statusRoles.length > 0;

    if (!hasLiveRegion && !hasStatus) {
      return true; // No ARIA announcement mechanism present
    }

    // Check if announcement actually changed
    const ariaChanged = this.detectAriaChange();

    // For meaningful events, ARIA should have changed
    if (!ariaChanged && (eventType === 'submit' || eventType === 'network_success' || eventType === 'network_error')) {
      return true;
    }

    return false;
  }

  /**
   * Get ARIA diff for evidence
   */
  getAriaDiff() {
    return {
      before: this.ariaStateBefore,
      after: this.ariaStateAfter,
      changed: this.detectAriaChange()
    };
  }
}



