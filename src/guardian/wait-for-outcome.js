/**
 * Signal-based wait helper for actions.
 * Prefers navigation/network/DOM quiet signals; falls back to bounded timeout.
 */

const DEFAULT_MAX_WAIT = 3500; // bounded cap
const QUIET_WINDOW_MS = 300; // DOM must be quiet for this window

async function waitForOutcome(page, options = {}) {
  const {
    actionType = 'click',
    baseOrigin = null,
    initialUrl = null,
    expectNavigation = false,
    includeUrlChange = true,
    maxWait = DEFAULT_MAX_WAIT,
  } = options;

  let resolved = false;
  const cleanupFns = [];

  const resolveWith = (reason, details = {}) => {
    if (resolved) return;
    resolved = true;
    cleanupFns.forEach((fn) => {
      try { fn(); } catch {}
    });
    return { reason, details };
  };

  const tasks = [];
  const start = Date.now();

  // Navigation signal
  if (expectNavigation) {
    const navPromise = page.waitForNavigation({ timeout: maxWait }).then(() => resolveWith('navigation')).catch(() => {});
    tasks.push(navPromise);
  }

  // URL change signal (even without full nav event)
  if (expectNavigation && includeUrlChange && initialUrl) {
    const urlPromise = page.waitForURL((u) => u !== initialUrl, { timeout: maxWait }).then(() => resolveWith('url-change')).catch(() => {});
    tasks.push(urlPromise);
  }

  // Network signal: watch for POST/PUT same-origin
  const networkPromise = new Promise((res) => {
    const handler = (response) => {
      try {
        const req = response.request();
        const method = (req.method() || '').toUpperCase();
        const url = req.url();
        const status = response.status();
        const originOk = baseOrigin ? new URL(url).origin === baseOrigin : true;
        if ((method === 'POST' || method === 'PUT') && originOk) {
          const out = resolveWith('network', { method, status, url });
          if (out) res(out);
        }
      } catch {}
    };
    page.on('response', handler);
    cleanupFns.push(() => page.off('response', handler));
  });
  tasks.push(networkPromise);

  // DOM quiet signal via MutationObserver
  const domPromise = new Promise((res) => {
    let lastMutation = Date.now();
    let hasMutated = false;
    const quietCheck = () => {
      if (!hasMutated) return;
      if (Date.now() - lastMutation >= QUIET_WINDOW_MS) {
        const out = resolveWith('dom-quiet');
        if (out) res(out);
      }
    };
    const interval = setInterval(quietCheck, 80);
    cleanupFns.push(() => clearInterval(interval));
    page.evaluate(() => {
      window.__guardianLastMutation = Date.now();
      window.__guardianHasMutated = false;
      if (window.__guardianDomObserver) {
        try { window.__guardianDomObserver.disconnect(); } catch (_e) {}
      }
      const obs = new MutationObserver(() => {
        window.__guardianLastMutation = Date.now();
        window.__guardianHasMutated = true;
      });
      obs.observe(document.documentElement || document.body, { childList: true, subtree: true, attributes: true, characterData: true });
      window.__guardianDomObserver = obs;
    }).catch(() => {});
    const pollMutation = setInterval(async () => {
      try {
        const data = await page.evaluate(() => ({
          last: window.__guardianLastMutation || Date.now(),
          mutated: !!window.__guardianHasMutated
        }));
        lastMutation = data.last;
        if (data.mutated) hasMutated = true;
      } catch {}
    }, 120);
    cleanupFns.push(() => clearInterval(pollMutation));
  });
  tasks.push(domPromise);

  // Bounded fallback
  const timeoutPromise = new Promise((res) => {
    const t = setTimeout(() => {
      const out = resolveWith('timeout', { elapsedMs: Date.now() - start });
      if (out) res(out);
    }, maxWait);
    cleanupFns.push(() => clearTimeout(t));
  });
  tasks.push(timeoutPromise);

  const first = await Promise.race(tasks);
  return first || { reason: 'timeout', details: { elapsedMs: maxWait } };
}

module.exports = { waitForOutcome };