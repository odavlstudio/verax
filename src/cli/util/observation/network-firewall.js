import { getTimeProvider } from '../support/time-provider.js';

const MUTATING_METHODS = Object.freeze(['POST', 'PUT', 'PATCH', 'DELETE']);

function sanitizeUrlToOriginSlash(url) {
  const raw = String(url || '').trim();
  if (!raw) return null;
  const stripped = raw.split('#')[0].split('?')[0];
  try {
    const parsed = new URL(stripped);
    parsed.username = '';
    parsed.password = '';
    parsed.search = '';
    parsed.hash = '';
    parsed.pathname = '/';
    return `${parsed.origin}/`;
  } catch {
    return null;
  }
}

function normalizeBlockedCode(reason) {
  const r = String(reason || '').trim();
  if (!r) return 'write_blocked';
  if (r === 'write-blocked-read-only-mode') return 'write_blocked_read_only_mode';
  return r.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase() || 'write_blocked';
}

/**
 * Install a runtime firewall that blocks mutating HTTP methods at Playwright routing layer.
 * Returns { enabled } where enabled means the route handler installed successfully.
 *
 * @param {import('playwright').Page} page
 * @param {{
 *   shouldBlockRequest?: (method: string) => boolean;
 *   onBlocked?: (entry: { method: string, requestUrl: string, originUrl: string|null, code: string }) => void;
 * }} options
 */
export async function installNetworkWriteFirewall(page, options = {}) {
  const shouldBlockRequest = typeof options.shouldBlockRequest === 'function'
    ? options.shouldBlockRequest
    : (method) => MUTATING_METHODS.includes(String(method || 'GET').toUpperCase());

  try {
    await page.route('**/*', async (route) => {
      const request = route.request();
      const method = request.method();
      if (shouldBlockRequest(method)) {
        const requestUrl = request.url();
        const originUrl = sanitizeUrlToOriginSlash(requestUrl);
        const code = 'write_blocked_read_only_mode';
        try {
          options.onBlocked?.({ method: String(method || 'GET').toUpperCase(), requestUrl: String(requestUrl || ''), originUrl, code });
        } catch {
          // ignore telemetry failures
        }
        await route.abort('blockedbyclient');
        return;
      }
      await route.continue();
    });
    return { enabled: true };
  } catch {
    return { enabled: false };
  }
}

/**
 * Deterministic summary for observe.json.
 *
 * @param {{
 *   enabled: boolean;
 *   blockedWrites?: Array<{ method?: string, originUrl?: string|null, url?: string, reason?: string }>;
 * }} input
 */
export function summarizeNetworkFirewall(input) {
  const enabled = Boolean(input?.enabled);
  const blockedWrites = Array.isArray(input?.blockedWrites) ? input.blockedWrites : [];

  /** @type {Record<string, number>} */
  const blockedMethods = { POST: 0, PUT: 0, PATCH: 0, DELETE: 0 };

  /** @type {Array<{ method: string, url: string, code: string }>} */
  const samples = [];

  for (const bw of blockedWrites) {
    const method = String(bw?.method || '').toUpperCase();
    if (!(method in blockedMethods)) continue;
    blockedMethods[method] += 1;

    const urlCandidate = bw?.originUrl || sanitizeUrlToOriginSlash(bw?.url);
    if (!urlCandidate) continue;
    samples.push({
      method,
      url: urlCandidate,
      code: normalizeBlockedCode(bw?.reason),
    });
  }

  samples.sort((a, b) => {
    const ak = `${a.method} ${a.url} ${a.code}`;
    const bk = `${b.method} ${b.url} ${b.code}`;
    return ak < bk ? -1 : ak > bk ? 1 : 0;
  });

  const sampleBlocked = [];
  const seen = new Set();
  for (const s of samples) {
    const k = `${s.method} ${s.url} ${s.code}`;
    if (seen.has(k)) continue;
    seen.add(k);
    sampleBlocked.push(s);
    if (sampleBlocked.length >= 3) break;
  }

  const blockedCount = Object.values(blockedMethods).reduce((a, b) => a + Number(b || 0), 0);

  return {
    enabled,
    blockedCount,
    blockedMethods,
    sampleBlocked,
  };
}

/**
 * Record a blocked write in a minimal, deterministic-safe format.
 * This is intended for internal observeData only; observe.json uses summarizeNetworkFirewall().
 */
export function makeBlockedWriteRecord({ method, requestUrl, reason }) {
  const originUrl = sanitizeUrlToOriginSlash(requestUrl);
  return {
    method: String(method || 'GET').toUpperCase(),
    originUrl,
    url: String(requestUrl || ''),
    reason: String(reason || 'write-blocked-read-only-mode'),
    timestamp: getTimeProvider().iso(),
  };
}

export const NETWORK_FIREWALL_MUTATING_METHODS = MUTATING_METHODS;
