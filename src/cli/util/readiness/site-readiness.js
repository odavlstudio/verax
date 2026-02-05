import { parse as parseHtml } from 'node-html-parser';
import { createHash } from 'crypto';
import { getTimeProvider } from '../support/time-provider.js';
import { VERSION } from '../../../version.js';

const READINESS_LEVELS = Object.freeze({
  READY: 'READY',
  PARTIAL: 'PARTIAL',
  OUT_OF_SCOPE: 'OUT_OF_SCOPE',
});

const VALUE_BUCKETS = Object.freeze([0, 20, 40, 60, 80, 100]);

function clampValueBucket(value) {
  const v = Number.isFinite(value) ? value : 0;
  const sorted = [...VALUE_BUCKETS].sort((a, b) => a - b);
  let best = sorted[0];
  for (const bucket of sorted) {
    if (Math.abs(bucket - v) < Math.abs(best - v)) best = bucket;
  }
  return best;
}

function normalizeUrlForFetch(url) {
  try {
    const raw = String(url || '').trim();
    if (!raw) return '';
    if (raw.includes('://')) return new URL(raw).toString();
    // Normalize missing scheme to https:// for strict, provable reporting.
    return new URL(`https://${raw}`).toString();
  } catch {
    return String(url || '').trim();
  }
}

function sanitizeUrlForReport(url) {
  const raw = String(url || '').trim();
  if (!raw) return null;

  const stripped = raw.split('#')[0].split('?')[0];
  try {
    const parsed = new URL(stripped);
    // Never include credentials or deep paths in report outputs.
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

function sha256Hex(value) {
  return createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

function getOriginMetaFromSafeUrl(safeUrl) {
  try {
    const parsed = new URL(String(safeUrl || ''));
    const scheme = String(parsed.protocol || '').replace(':', '') || null;
    return { origin: parsed.origin || null, scheme };
  } catch {
    return { origin: null, scheme: null };
  }
}

function hasAnyText(node) {
  const text = (node?.text || '').replace(/\s+/g, ' ').trim();
  return text.length > 0;
}

function countElements(root) {
  const count = (selector) => root.querySelectorAll(selector).length;
  return {
    links: count('a[href]'),
    buttons: count('button, [role="button"]'),
    forms: count('form'),
    inputs: count('input, textarea, select'),
  };
}

function detectAuthBoundary(root, htmlLower) {
  const hasPasswordInput = root.querySelectorAll('input[type="password"]').length > 0;
  const authWords = /(\blogin\b|\bsign in\b|\bsign-in\b|\blog in\b|\bpassword\b|\bauth\b|\boauth\b)/i;
  const hasAuthText = authWords.test(htmlLower);
  return Boolean(hasPasswordInput || hasAuthText);
}

function detectSpaSignals(root, htmlLower) {
  const nextData = root.querySelector('#__NEXT_DATA__');
  const nextRoot = root.querySelector('#__next');
  const reactRoot = root.querySelector('#root, [data-reactroot]');
  const vueRoot = root.querySelector('#app, [data-v-app]');
  const angularRoot = root.querySelector('[ng-version], app-root');
  const hasSpaRoot = Boolean(nextData || nextRoot || reactRoot || vueRoot || angularRoot);
  const routerHints = /(react-router|vue-router|next\/router|history\.pushState|angular\/router)/i.test(htmlLower);
  return {
    isLikelySpa: Boolean(hasSpaRoot || routerHints),
    hints: {
      nextjs: Boolean(nextData || nextRoot),
      react: Boolean(reactRoot),
      vue: Boolean(vueRoot),
      angular: Boolean(angularRoot),
      routerScriptHints: Boolean(routerHints),
    },
  };
}

function detectClientRoutingSignals(root) {
  const hasHashLinks = root.querySelectorAll('a[href^="#"]').length > 0;
  const hasBaseTag = root.querySelectorAll('base[href]').length > 0;
  return {
    hasHashLinks,
    hasBaseTag,
  };
}

function detectJsOnlyRenderingBlocker(htmlLower) {
  const jsDisabledHints = /(enable javascript|requires javascript|turn on javascript|javascript must be enabled)/i;
  return jsDisabledHints.test(htmlLower);
}

function isHtmlContentType(contentType) {
  if (!contentType) return false;
  return String(contentType).toLowerCase().includes('text/html');
}

async function fetchDocument(url, { timeoutMs = 15000, userAgent = `verax-readiness/${VERSION}` } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'user-agent': userAgent,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
    });
    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      contentType,
      finalUrl: res.url || url,
      html: text,
    };
  } finally {
    clearTimeout(timer);
  }
}

function buildReasons({ htmlOk, isHtml, jsOnly, authBoundary, interactionCounts, spa }) {
  /** @type {string[]} */
  const reasons = [];
  if (!htmlOk) reasons.push('Target did not return a successful HTTP response.');
  if (!isHtml) reasons.push('Target did not return HTML (text/html).');
  if (jsOnly) reasons.push('Page appears to require JavaScript for meaningful content.');
  if (authBoundary) reasons.push('Page appears to include an authentication boundary (login/sign-in).');
  const surface = interactionCounts.forms + interactionCounts.buttons + interactionCounts.links;
  if (surface === 0) reasons.push('No obvious interaction surface found in the initial HTML.');
  if (spa.isLikelySpa) reasons.push('Client-side app signals detected (likely SPA).');
  return reasons;
}

function classifyReadiness({ htmlOk, isHtml, jsOnly, authBoundary, interactionCounts }) {
  if (!isHtml) return READINESS_LEVELS.OUT_OF_SCOPE;
  if (!htmlOk) return READINESS_LEVELS.PARTIAL;
  if (jsOnly) return READINESS_LEVELS.PARTIAL;
  if (authBoundary && interactionCounts.forms === 0 && interactionCounts.buttons === 0) {
    return READINESS_LEVELS.PARTIAL;
  }
  const surface = interactionCounts.forms + interactionCounts.buttons + interactionCounts.links;
  if (surface === 0) return READINESS_LEVELS.PARTIAL;
  return READINESS_LEVELS.READY;
}

function estimateValuePercent({ readinessLevel, interactionCounts }) {
  if (readinessLevel === READINESS_LEVELS.OUT_OF_SCOPE) return 0;
  const surface = interactionCounts.forms + interactionCounts.buttons + interactionCounts.links;
  if (surface === 0) return 20;
  if (interactionCounts.forms > 0 && interactionCounts.buttons > 0) return 100;
  if (interactionCounts.forms > 0) return 80;
  if (interactionCounts.buttons > 0) return 60;
  if (interactionCounts.links > 0) return 40;
  return 20;
}

export async function analyzeSiteReadiness(url, { timeoutMs = 15000, anonymizeHost = false } = {}) {
  const timeProvider = getTimeProvider();
  const normalizedUrl = normalizeUrlForFetch(url);
  const safeUrl = sanitizeUrlForReport(normalizedUrl);
  const { origin: safeOrigin, scheme: safeScheme } = safeUrl ? getOriginMetaFromSafeUrl(safeUrl) : { origin: null, scheme: null };
  const originHash = safeOrigin ? sha256Hex(safeOrigin) : null;
  const reportUrl = anonymizeHost ? null : safeUrl;

  const stopPoints = [];
  let fetchResult = null;
  try {
    fetchResult = await fetchDocument(normalizedUrl, { timeoutMs });
  } catch (err) {
    stopPoints.push({ phase: 'fetch', reason: err?.name === 'AbortError' ? 'timeout' : 'fetch_failed' });
    return {
      header:
        'This report is diagnostic-only. It does NOT evaluate site quality or correctness. ' +
        'URLs are stored origin-only (path=/, no query/fragment); use --anonymize-host to avoid storing hostnames.',
      command: 'readiness',
      generatedAt: timeProvider.iso(),
      url: reportUrl,
      readinessLevel: READINESS_LEVELS.PARTIAL,
      estimatedValuePercent: 20,
      reasons: ['Failed to fetch initial HTML for analysis.'],
      signals: {
        http: {
          ok: false,
          httpStatus: null,
          contentType: null,
          finalUrl: anonymizeHost ? null : (safeUrl || null),
          ...(anonymizeHost ? { originHash, scheme: safeScheme } : {}),
        },
        page: { isHtmlRendered: false, jsOnlyRenderingBlocker: false, authBoundaryLikely: false },
        app: { isLikelySpa: false, routingSignals: { hasHashLinks: false, hasBaseTag: false }, spaHints: {} },
      },
      interactionSurfaceSummary: { links: 0, buttons: 0, forms: 0, inputs: 0 },
      stopPoints,
    };
  }

  const html = String(fetchResult.html || '');
  const htmlLower = html.toLowerCase();
  const isHtml = isHtmlContentType(fetchResult.contentType) || /<html[\s>]/i.test(html);

  if (!isHtml) {
    stopPoints.push({ phase: 'parse', reason: 'non_html' });
  }

  const root = isHtml ? parseHtml(html) : null;

  const interactionCounts = root ? countElements(root) : { links: 0, buttons: 0, forms: 0, inputs: 0 };
  const authBoundary = root ? detectAuthBoundary(root, htmlLower) : false;
  const spa = root ? detectSpaSignals(root, htmlLower) : { isLikelySpa: false, hints: {} };
  const routingSignals = root ? detectClientRoutingSignals(root) : { hasHashLinks: false, hasBaseTag: false };
  const jsOnly = detectJsOnlyRenderingBlocker(htmlLower) || (root ? !hasAnyText(root.querySelector('body')) : false);

  const readinessLevel = classifyReadiness({
    htmlOk: Boolean(fetchResult.ok),
    isHtml,
    jsOnly,
    authBoundary,
    interactionCounts,
  });
  const estimatedValuePercent = clampValueBucket(
    estimateValuePercent({ readinessLevel, interactionCounts })
  );

  const reasons = buildReasons({
    htmlOk: Boolean(fetchResult.ok),
    isHtml,
    jsOnly,
    authBoundary,
    interactionCounts,
    spa,
  });

  return {
    header:
      'This report is diagnostic-only. It does NOT evaluate site quality or correctness. ' +
      'URLs are stored origin-only (path=/, no query/fragment); use --anonymize-host to avoid storing hostnames.',
    command: 'readiness',
    generatedAt: timeProvider.iso(),
    url: reportUrl,
    readinessLevel,
    estimatedValuePercent,
    reasons,
    signals: {
      http: {
        ok: Boolean(fetchResult.ok),
        httpStatus: Number.isFinite(fetchResult.status) ? fetchResult.status : null,
        contentType: fetchResult.contentType || null,
        finalUrl: anonymizeHost ? null : (fetchResult.finalUrl ? sanitizeUrlForReport(fetchResult.finalUrl) : null),
        ...(anonymizeHost ? { originHash, scheme: safeScheme } : {}),
      },
      page: {
        isHtmlRendered: isHtml,
        jsOnlyRenderingBlocker: Boolean(jsOnly),
        authBoundaryLikely: Boolean(authBoundary),
      },
      app: {
        isLikelySpa: Boolean(spa.isLikelySpa),
        routingSignals,
        spaHints: spa.hints || {},
      },
    },
    interactionSurfaceSummary: interactionCounts,
    stopPoints,
  };
}

export function formatReadinessHuman(report) {
  const lines = [];
  lines.push('VERAX Readiness (pilot, diagnostic-only)');
  lines.push('This does NOT evaluate site quality or correctness.');
  lines.push('URLs are stored origin-only (path=/, no query/fragment); use --anonymize-host to avoid storing hostnames.');
  lines.push('');
  if (report.url) {
    lines.push(`URL: ${report.url}`);
  } else if (report?.signals?.http?.originHash) {
    const scheme = report?.signals?.http?.scheme ? `${report.signals.http.scheme} ` : '';
    lines.push(`URL: (anonymized) ${scheme}sha256:${String(report.signals.http.originHash).slice(0, 12)}…`);
  } else {
    lines.push('URL: (unavailable)');
  }
  lines.push(`Readiness: ${report.readinessLevel}`);
  lines.push(`Estimated value: ~${report.estimatedValuePercent}%`);
  lines.push('');
  if (Array.isArray(report.reasons) && report.reasons.length > 0) {
    lines.push('Reasons:');
    for (const r of report.reasons.slice(0, 8)) lines.push(`- ${r}`);
    lines.push('');
  }
  const s = report.interactionSurfaceSummary || {};
  lines.push('Interaction surface (counts only):');
  lines.push(`- links: ${Number(s.links || 0)}`);
  lines.push(`- buttons: ${Number(s.buttons || 0)}`);
  lines.push(`- forms: ${Number(s.forms || 0)}`);
  lines.push(`- inputs: ${Number(s.inputs || 0)}`);
  lines.push('');
  lines.push('Note: Readiness is based on the initial HTML response only.');
  return lines.join('\n');
}

export const READINESS = Object.freeze({
  LEVELS: READINESS_LEVELS,
  VALUE_BUCKETS,
});
