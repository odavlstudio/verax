import { DataError } from '../support/errors.js';

export const CAPABILITY_SCHEMA_VERSION = 1;

const ALLOWED_TOP_LEVEL_KEYS = new Set([
  'header',
  'command',
  'generatedAt',
  'target',
  'readiness',
  'signals',
  'interactionSurfaceSummary',
  'stopPoints',
  '_noUserData',
  '_noSelectors',
  '_noAuth',
  '_noSource',
  '_noVerdicts',
  '_schemaVersion',
]);

const FORBIDDEN_KEYS = new Set([
  'truth',
  'truthState',
  'verdict',
  'exitCode',
  'findings',
  'judgments',
  'cookies',
  'headers',
  'auth',
  'storageState',
  'selector',
  'selectors',
  'src',
  'repo',
  'path',
]);

function hasForbiddenKey(obj) {
  if (!obj || typeof obj !== 'object') return null;
  for (const k of Object.keys(obj)) {
    if (FORBIDDEN_KEYS.has(k)) return k;
    const nested = hasForbiddenKey(obj[k]);
    if (nested) return nested;
  }
  return null;
}

export function validateCapabilityBundleJsonOrThrow(json) {
  if (!json || typeof json !== 'object') {
    throw new DataError('Capability bundle schema invalid: not an object.');
  }

  const schemaVersion = json._schemaVersion;
  if (schemaVersion !== CAPABILITY_SCHEMA_VERSION) {
    const err = new DataError(`Capability bundle schema version mismatch: ${String(schemaVersion)}.`);
    err.action = `Expected _schemaVersion=${CAPABILITY_SCHEMA_VERSION}. Regenerate the capability bundle with this VERAX version.`;
    throw err;
  }

  const keys = Object.keys(json);
  for (const k of keys) {
    if (!ALLOWED_TOP_LEVEL_KEYS.has(k)) {
      const err = new DataError(`Capability bundle schema invalid: unknown top-level key '${k}'.`);
      err.action = 'Regenerate the capability bundle. Do not hand-edit capability.json.';
      throw err;
    }
  }

  const forbidden = hasForbiddenKey(json);
  if (forbidden) {
    const err = new DataError(`Capability bundle rejected: forbidden key '${forbidden}' present.`);
    err.action = 'Regenerate the capability bundle without sensitive inputs.';
    throw err;
  }

  return { ok: true };
}

