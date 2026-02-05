const DETERMINISTIC_TIME = '1970-01-01T00:00:00.000Z';

export function isDeterministicOutputMode() {
  return process.env.VERAX_DETERMINISTIC_MODE === '1';
}

export function normalizeDeterministicArtifact(artifactName, payload) {
  if (!isDeterministicOutputMode()) return payload;
  const cloned = JSON.parse(JSON.stringify(payload));

  // Artifact-specific tightening to guarantee byte stability.
  switch (artifactName) {
    case 'summary':
      return normalizeSummary(cloned);
    case 'observe':
      return normalizeObserve(cloned);
    case 'learn':
    case 'findings':
      // Still strip volatile keys defensively (even if none expected).
      stripVolatileKeys(cloned);
      return cloned;
    default:
      stripVolatileKeys(cloned);
      return cloned;
  }
}

function normalizeSummary(summary) {
  // Preserve contract shape; replace volatile values with deterministic constants.
  summary.startedAt = DETERMINISTIC_TIME;
  summary.completedAt = DETERMINISTIC_TIME;

  if (summary.metrics && typeof summary.metrics === 'object') {
    summary.metrics.learnMs = 0;
    summary.metrics.observeMs = 0;
    summary.metrics.detectMs = 0;
    summary.metrics.totalMs = 0;
  }

  if (summary.meta && typeof summary.meta === 'object') {
    summary.meta.startedAt = DETERMINISTIC_TIME;
    summary.meta.completedAt = DETERMINISTIC_TIME;
    summary.meta.cwd = null;
    summary.meta.nodeVersion = null;
    summary.meta.platform = null;
  }

  stripVolatileKeys(summary);
  return summary;
}

function normalizeObserve(observe) {
  if (Array.isArray(observe.observations)) {
    // Deterministic ordering for byte-lock (do not rely on execution order).
    observe.observations = [...observe.observations].sort((a, b) => {
      return String(a?.id || '').localeCompare(String(b?.id || ''), 'en');
    });
    for (const obs of observe.observations) {
      if (obs && typeof obs === 'object') {
        obs.observedAt = DETERMINISTIC_TIME;
      }
    }
  }

  if (observe.stats && typeof observe.stats === 'object') {
    // Ensure stable ordering by key-sorted stringify; values are already stable.
    // No-op here beyond volatile stripping.
  }

  stripVolatileKeys(observe);
  return observe;
}

function stripVolatileKeys(node) {
  if (!node || typeof node !== 'object') return;

  if (Array.isArray(node)) {
    node.forEach(stripVolatileKeys);
    return;
  }

  for (const [key, value] of Object.entries(node)) {
    if (VOLATILE_NULL_KEYS.has(key)) {
      node[key] = (typeof value === 'number') ? 0 : DETERMINISTIC_TIME;
      continue;
    }
    if (VOLATILE_ZERO_KEYS.has(key)) {
      node[key] = 0;
      continue;
    }
    if (value && typeof value === 'object') {
      stripVolatileKeys(value);
    }
  }
}

const VOLATILE_NULL_KEYS = new Set([
  'startedAt',
  'completedAt',
  'endedAt',
  'observedAt',
  'capturedAt',
  'detectedAt',
  'generatedAt',
  'writtenAt',
  'timestamp',
  'actionStartTime',
  'startTime',
]);

const VOLATILE_ZERO_KEYS = new Set([
  'relativeMs',
  'durationMs',
  'totalMs',
  'learnMs',
  'observeMs',
  'detectMs',
]);

