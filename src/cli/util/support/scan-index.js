import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { atomicWriteJson } from './atomic-write.js';
import { getTimeProvider } from './time-provider.js';

function loadIndex(indexPath) {
  if (!existsSync(indexPath)) {
    return { runs: [] };
  }
  try {
    const parsed = JSON.parse(String(readFileSync(indexPath, 'utf-8')));
    if (Array.isArray(parsed)) {
      return { runs: parsed };
    }
    if (Array.isArray(parsed?.runs)) {
      return { runs: parsed.runs };
    }
  } catch {
    return { runs: [] };
  }
  return { runs: [] };
}

function buildEntry(paths, meta) {
  return {
    runId: meta.runId,
    runName: paths.displayRunName || meta.runId,
    scanId: paths.displayScanName || paths.scanId,
    baseDir: paths.baseDir,
    startedAt: meta.startedAt || null,
    completedAt: meta.completedAt || null,
    exitCode: meta.exitCode ?? null,
    status: meta.status || null,
  };
}

function sortEntries(entries) {
  return entries.sort((a, b) => {
    const aStart = a.startedAt || '';
    const bStart = b.startedAt || '';
    if (aStart && bStart && aStart !== bStart) {
      return aStart.localeCompare(bStart);
    }
    return String(a.runId || '').localeCompare(String(b.runId || ''));
  });
}

export function updateScanPointers(paths, meta) {
  const now = getTimeProvider().iso();
  const latestPayload = {
    runId: meta.runId,
    runName: paths.displayRunName || meta.runId,
    scanId: paths.displayScanName || paths.scanId,
    baseDir: paths.baseDir,
    startedAt: meta.startedAt || null,
    completedAt: meta.completedAt || null,
    exitCode: meta.exitCode ?? null,
    status: meta.status || null,
    updatedAt: now,
  };

  atomicWriteJson(paths.latestPointerJson, latestPayload);

  const indexPath = join(paths.scanBaseDir, 'index.json');
  const indexData = loadIndex(indexPath);
  const filtered = indexData.runs.filter((r) => r.runId !== meta.runId);
  const next = sortEntries([...filtered, buildEntry(paths, meta)]);

  atomicWriteJson(indexPath, {
    runs: next,
    updatedAt: now,
  });

  return { latestPath: paths.latestPointerJson, indexPath };
}
