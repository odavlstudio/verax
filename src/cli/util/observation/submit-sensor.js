/**
 * Submit Sensor — installs a capture-phase submit listener.
 *
 * Stores only counters in window, never form values.
 */

/**
 * @param {import('playwright').Page} page
 * @returns {Promise<{ injected: boolean, error?: string }>}
 */
export async function injectSubmitSensor(page) {
  try {
    const injected = await page.evaluate(() => {
      // @ts-ignore
      if (window.__veraxSubmitSensorInjected === true) return true;
      // @ts-ignore
      window.__veraxSubmitSensorInjected = true;
      // @ts-ignore
      window.__veraxSubmitEvents = 0;

      document.addEventListener('submit', () => {
        try {
          // @ts-ignore
          window.__veraxSubmitEvents = (window.__veraxSubmitEvents || 0) + 1;
        } catch {
          // ignore
        }
      }, true);

      return true;
    });
    return { injected: injected === true };
  } catch (error) {
    return { injected: false, error: error?.message || String(error) };
  }
}

/**
 * @param {import('playwright').Page} page
 * @returns {Promise<number|null>}
 */
export async function readSubmitEventCount(page) {
  try {
    const count = await page.evaluate(() => {
      // @ts-ignore
      return typeof window.__veraxSubmitEvents === 'number' ? window.__veraxSubmitEvents : null;
    });
    return (typeof count === 'number') ? count : null;
  } catch {
    return null;
  }
}

