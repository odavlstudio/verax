/*
Command: verax readiness
Purpose: Diagnostic-only applicability check (no scan, no verdicts).
Required: --url <url>
Optional: --json, --timeout-ms <ms>
Outputs: Human summary (default) OR a single JSON object (--json).
Exit Codes: Always 0 (not a CI signal).
Forbidden: writing run artifacts, collecting credentials, producing SUCCESS/FINDINGS/INCOMPLETE.
*/

import { analyzeSiteReadiness, formatReadinessHuman } from '../util/readiness/site-readiness.js';
import { getTimeProvider } from '../util/support/time-provider.js';

function parseArg(args, name) {
  const idx = args.indexOf(name);
  if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  return null;
}

export async function readinessCommand(args = []) {
  const url = parseArg(args, '--url');
  const json = args.includes('--json');
  const anonymizeHost = args.includes('--anonymize-host');
  const timeoutMsRaw = parseArg(args, '--timeout-ms');
  const timeoutMs = timeoutMsRaw ? Number(timeoutMsRaw) : 15000;
  const timeProvider = getTimeProvider();

  if (!url) {
    const report = {
      header:
        'This report is diagnostic-only. It does NOT evaluate site quality or correctness. ' +
        'URLs are stored origin-only (path=/, no query/fragment); use --anonymize-host to avoid storing hostnames.',
      command: 'readiness',
      generatedAt: timeProvider.iso(),
      url: null,
      readinessLevel: 'PARTIAL',
      estimatedValuePercent: 20,
      reasons: ['Missing required --url <url>.'],
      signals: {},
      interactionSurfaceSummary: { links: 0, buttons: 0, forms: 0, inputs: 0 },
      stopPoints: [{ phase: 'input', reason: 'missing_url' }],
    };
    if (json) {
      return { exitCode: 0, json: true, payload: report };
    }
    return {
      exitCode: 0,
      json: false,
      text:
        'VERAX Readiness (pilot, diagnostic-only)\n' +
        'This does NOT evaluate site quality or correctness.\n\n' +
        'Usage: verax readiness --url <url> [--json] [--timeout-ms <ms>] [--anonymize-host]\n',
    };
  }

  const report = await analyzeSiteReadiness(url, {
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 15000,
    anonymizeHost,
  });
  if (json) {
    return { exitCode: 0, json: true, payload: report };
  }
  return { exitCode: 0, json: false, text: formatReadinessHuman(report) + '\n' };
}
