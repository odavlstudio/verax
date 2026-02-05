import { createHash } from 'crypto';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { atomicWriteJson } from '../support/atomic-write.js';
import { getTimeProvider } from '../support/time-provider.js';

export const MANIFEST_FILENAME = 'integrity.manifest.json';
export const MANIFEST_VERSION = '6B-1';

function manifestPath(runDir) {
  return join(runDir, MANIFEST_FILENAME);
}

function shouldIgnore(relPath) {
  if (!relPath) return true;
  if (relPath === MANIFEST_FILENAME) return true;
  if (relPath === '.staging' || relPath.startsWith('.staging/')) return true;
  return false;
}

function detectKind(relPath) {
  const parts = relPath.split('.');
  if (parts.length <= 1) return 'unknown';
  const ext = parts.pop();
  return (ext || 'unknown').toLowerCase();
}

function hashFile(filePath) {
  try {
    const content = readFileSync(filePath);
    const hash = createHash('sha256').update(content).digest('hex');
    const bytes = statSync(filePath).size;
    return { sha256: hash, bytes };
  } catch (error) {
    return { sha256: null, bytes: 0, error: error.message };
  }
}

function listArtifacts(runDir) {
  const pending = [runDir];
  const files = [];

  while (pending.length > 0) {
    const current = pending.pop();
    const entries = readdirSync(current, { withFileTypes: true })
      // @ts-ignore - Dirent has name property
      .sort((a, b) => a.name.localeCompare(b.name, 'en'));

    for (const entry of entries) {
      const fullPath = join(current, entry.name);
      const relPath = relative(runDir, fullPath).replace(/\\/g, '/');

      if (shouldIgnore(relPath)) {
        continue;
      }

      if (entry.isDirectory()) {
        pending.push(fullPath);
      } else if (entry.isFile()) {
        files.push(relPath);
      }
    }
  }

  files.sort((a, b) => a.localeCompare(b));
  return files;
}

export function generateRunIntegrityManifest(runDir, { runId = null, toolVersion = null } = {}) {
  const errors = [];
  const artifactEntries = [];
  const artifactPaths = listArtifacts(runDir);
  const timeProvider = getTimeProvider();

  for (const relPath of artifactPaths) {
    const filePath = join(runDir, relPath);
    const integrity = hashFile(filePath);

    if (integrity.error || !integrity.sha256) {
      errors.push(`Failed to hash ${relPath}: ${integrity.error || 'unknown error'}`);
      continue;
    }

    artifactEntries.push({
      path: relPath,
      sha256: integrity.sha256,
      bytes: integrity.bytes,
      kind: detectKind(relPath),
    });
  }

  const manifest = {
    manifestVersion: MANIFEST_VERSION,
    generatedAt: timeProvider.iso(),
    runId,
    toolVersion,
    artifactCount: artifactEntries.length,
    artifacts: artifactEntries,
  };

  return { manifest, errors };
}

export function writeRunIntegrityManifest(runDir, manifest) {
  try {
    const path = manifestPath(runDir);
    atomicWriteJson(path, manifest);
    return { ok: true, path };
  } catch (error) {
    return { ok: false, error };
  }
}

export function loadRunIntegrityManifest(runDir) {
  try {
    const path = manifestPath(runDir);
    const content = readFileSync(path, 'utf-8');
    // @ts-expect-error - readFileSync with encoding returns string, not Buffer
    const manifest = JSON.parse(content);
    if (!manifest || !Array.isArray(manifest.artifacts)) {
      return { ok: false, code: 'INVALID', error: 'Manifest missing artifacts array' };
    }
    return { ok: true, manifest };
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return { ok: false, code: 'MISSING', error: 'Manifest not found' };
    }
    return { ok: false, code: 'INVALID', error: error.message };
  }
}

export function verifyRunIntegrityManifest(runDir, manifest) {
  const missing = [];
  const mismatched = [];

  if (!manifest || !Array.isArray(manifest.artifacts)) {
    return {
      ok: false,
      status: 'FAILED',
      missing,
      mismatched,
      extraArtifacts: [],
      error: 'Invalid manifest format',
    };
  }

  const manifestPaths = new Set();
  for (const entry of manifest.artifacts) {
    if (!entry?.path) continue;
    manifestPaths.add(entry.path);
    const filePath = join(runDir, entry.path);
    const fileIntegrity = hashFile(filePath);

    if (fileIntegrity.error || !fileIntegrity.sha256) {
      missing.push({ path: entry.path, reason: fileIntegrity.error || 'missing' });
      continue;
    }

    if (fileIntegrity.bytes !== entry.bytes) {
      mismatched.push({
        path: entry.path,
        reason: 'size',
        expectedBytes: entry.bytes,
        actualBytes: fileIntegrity.bytes,
      });
      continue;
    }

    if (fileIntegrity.sha256 !== entry.sha256) {
      mismatched.push({
        path: entry.path,
        reason: 'hash',
        expectedSha256: entry.sha256,
        actualSha256: fileIntegrity.sha256,
      });
    }
  }

  const actualPaths = listArtifacts(runDir);
  const extraArtifacts = actualPaths.filter(p => !manifestPaths.has(p));

  const ok = missing.length === 0 && mismatched.length === 0 && extraArtifacts.length === 0;
  return {
    ok,
    status: ok ? 'PASSED' : 'FAILED',
    missing,
    mismatched,
    extraArtifacts,
  };
}

export function getManifestPath(runDir) {
  return manifestPath(runDir);
}








