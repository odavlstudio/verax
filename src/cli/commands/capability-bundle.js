/*
Command: verax capability-bundle
Purpose: Produce a diagnostic-only bundle with minimized data (supports --anonymize-host).
Required: --url <url>
Optional: --out <dir>, --zip, --timeout-ms <ms>
Outputs: Writes <out>/capability-bundles/<timestamp>/capability.json and capability-summary.txt (default out is OS temp)
Exit Codes: Always 0 (not a CI signal).
Forbidden: source code, repo paths, cookies/auth headers, selectors, run artifacts, verdicts.
*/

import { mkdirSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';
import { getTimeProvider } from '../util/support/time-provider.js';
import { analyzeSiteReadiness, formatReadinessHuman } from '../util/readiness/site-readiness.js';
import { writeAndVerifyBundleIntegrityManifest, verifyBundleIntegrityOrThrow } from '../util/bundles/bundle-integrity.js';
import { validateCapabilityBundleJsonOrThrow } from '../util/bundles/capability-bundle-schema.js';
import { validateCapabilityBundleDirOrThrow } from '../util/bundles/capability-bundle-validator.js';
import { resolveVeraxOutDir } from '../util/support/default-output-dir.js';
import { VERSION } from '../../version.js';

function parseArg(args, name) {
  const idx = args.indexOf(name);
  if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  return null;
}

function safeTimestampForPath(iso) {
  return String(iso || '').replaceAll(':', '-').replaceAll('.', '-');
}

// Minimal CRC32 for ZIP (store method)
function crc32(buf) {
  let crc = 0 ^ -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function u16(n) {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n & 0xffff, 0);
  return b;
}

function u32(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0, 0);
  return b;
}

function makeZipStore(entries) {
  // entries: [{ name, data: Buffer }]
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, 'utf8');
    const dataBuf = Buffer.isBuffer(e.data) ? e.data : Buffer.from(String(e.data || ''), 'utf8');
    const crc = crc32(dataBuf);

    // Local file header
    const localHeader = Buffer.concat(/** @type {any} */ ([
      u32(0x04034b50),
      u16(20), // version needed
      u16(0), // flags
      u16(0), // compression = store
      u16(0), // mod time
      u16(0), // mod date
      u32(crc),
      u32(dataBuf.length),
      u32(dataBuf.length),
      u16(nameBuf.length),
      u16(0), // extra length
      nameBuf,
    ]));

    localParts.push(localHeader, dataBuf);

    // Central directory header
    const centralHeader = Buffer.concat(/** @type {any} */ ([
      u32(0x02014b50),
      u16(20), // version made by
      u16(20), // version needed
      u16(0), // flags
      u16(0), // compression
      u16(0), // mod time
      u16(0), // mod date
      u32(crc),
      u32(dataBuf.length),
      u32(dataBuf.length),
      u16(nameBuf.length),
      u16(0), // extra
      u16(0), // comment
      u16(0), // disk start
      u16(0), // internal attrs
      u32(0), // external attrs
      u32(offset),
      nameBuf,
    ]));

    centralParts.push(centralHeader);
    offset += localHeader.length + dataBuf.length;
  }

  const centralStart = offset;
  const centralDir = Buffer.concat(/** @type {any} */ (centralParts));
  offset += centralDir.length;

  const end = Buffer.concat(/** @type {any} */ ([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(centralDir.length),
    u32(centralStart),
    u16(0), // comment length
  ]));

  return Buffer.concat(/** @type {any} */ ([...localParts, centralDir, end]));
}

function redactBundleReport(report) {
  // Defensive: ensure no forbidden keys ever appear.
  const originHash = report?.signals?.http?.originHash || null;
  const scheme = report?.signals?.http?.scheme || null;
  return {
    header: report?.header,
    command: 'capability-bundle',
    generatedAt: report?.generatedAt,
    target: report?.url
      ? { url: report.url }
      : { url: null, originHash, scheme },
    readiness: {
      readinessLevel: report?.readinessLevel,
      estimatedValuePercent: report?.estimatedValuePercent,
      reasons: Array.isArray(report?.reasons) ? report.reasons : [],
    },
    signals: report?.signals || {},
    interactionSurfaceSummary: report?.interactionSurfaceSummary || { links: 0, buttons: 0, forms: 0, inputs: 0 },
    stopPoints: Array.isArray(report?.stopPoints) ? report.stopPoints : [],
    _noUserData: true,
    _noSelectors: true,
    _noAuth: true,
    _noSource: true,
    _noVerdicts: true,
    _schemaVersion: 1,
  };
}

export async function capabilityBundleCommand(args = []) {
  const url = parseArg(args, '--url');
  const zip = args.includes('--zip');
  const anonymizeHost = args.includes('--anonymize-host');
  const outArg = parseArg(args, '--out');
  const timeoutMsRaw = parseArg(args, '--timeout-ms');
  const timeoutMs = timeoutMsRaw ? Number(timeoutMsRaw) : 15000;
  const timeProvider = getTimeProvider();
  const projectRoot = resolve(process.cwd());
  const outBase = resolveVeraxOutDir(projectRoot, outArg);

  if (!url) {
    return {
      exitCode: 0,
      text:
        'VERAX Capability Bundle (pilot, diagnostic-only)\n' +
        'This bundle does NOT evaluate site quality or correctness.\n\n' +
        'Usage: verax capability-bundle --url <url> [--out <dir>] [--zip] [--timeout-ms <ms>] [--anonymize-host]\n',
      bundlePath: null,
      zipPath: null,
    };
  }

  const report = await analyzeSiteReadiness(url, {
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 15000,
    anonymizeHost,
  });
  const capability = redactBundleReport(report);

  const stamp = safeTimestampForPath(timeProvider.iso());
  const bundleDir = join(outBase, 'capability-bundles', stamp);
  mkdirSync(bundleDir, { recursive: true });

  const header =
    'This bundle is diagnostic-only. It does NOT evaluate site quality or correctness. ' +
    'URLs are stored origin-only (path=/, no query/fragment); use --anonymize-host to avoid storing hostnames.';
  const capabilityJsonPath = join(bundleDir, 'capability.json');
  const capabilitySummaryPath = join(bundleDir, 'capability-summary.txt');

  const capabilityJson = { ...capability, header };
  validateCapabilityBundleJsonOrThrow(capabilityJson);
  writeFileSync(capabilityJsonPath, JSON.stringify(capabilityJson, null, 2) + '\n', { encoding: 'utf8' });

  const summaryText =
    'VERAX Capability Bundle (pilot, diagnostic-only)\n' +
    `${header}\n\n` +
    formatReadinessHuman(report) +
    '\n';

  writeFileSync(capabilitySummaryPath, summaryText, { encoding: 'utf8' });

  let zipPath = null;
  if (zip) {
    const zipBuf = makeZipStore([
      { name: 'capability.json', data: Buffer.from(JSON.stringify({ ...capability, header }, null, 2) + '\n', 'utf8') },
      { name: 'capability-summary.txt', data: Buffer.from(summaryText, 'utf8') },
    ]);
    zipPath = join(bundleDir, 'capability-bundle.zip');
    writeFileSync(zipPath, zipBuf);
  }

  // Phase 5: Cryptographic integrity manifest for capability bundles
  writeAndVerifyBundleIntegrityManifest(bundleDir, { bundleId: stamp, toolVersion: `verax ${VERSION}` });
  verifyBundleIntegrityOrThrow(bundleDir);
  validateCapabilityBundleDirOrThrow(bundleDir);

  const text =
    'VERAX Capability Bundle (pilot, diagnostic-only)\n' +
    `${header}\n\n` +
    `Wrote: ${capabilityJsonPath}\n` +
    `Wrote: ${capabilitySummaryPath}\n` +
    (zipPath ? `Wrote: ${zipPath}\n` : '') +
    '\n';

  return { exitCode: 0, text, bundlePath: bundleDir, zipPath };
}

export function _capabilityBundleTestHelpers() {
  // For contract tests: ensure bundle dir contains only expected artifacts.
  return {
    listFiles(dir) {
      if (!existsSync(dir)) return [];
      return readdirSync(dir)
        .map((f) => ({ f, p: join(dir, f) }))
        .filter((x) => statSync(x.p).isFile())
        .map((x) => x.f)
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    },
  };
}
