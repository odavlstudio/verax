const fs = require('fs');
const path = require('path');
const os = require('os');
const { ensurePathWithinBase, resolveWithinBase } = require('./path-safety');
const { getStateDir } = require('./runtime-root');

// Use runtime state directory for scheduler state
const DEFAULT_BASE = getStateDir();
const BASE_DIR = path.resolve(process.env.GUARDIAN_SCHED_DIR || DEFAULT_BASE);
const STATE_FILE = resolveWithinBase(BASE_DIR, 'scheduler state file', BASE_DIR, 'schedules.json');
const QUARANTINE_PREFIX = 'schedules.quarantine-';
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
const MIN_INTERVAL_SECONDS = 60;
const MAX_INTERVAL_SECONDS = 24 * 60 * 60; // 24h

function ensureBaseDir() {
  if (!fs.existsSync(BASE_DIR)) {
    fs.mkdirSync(BASE_DIR, { recursive: true, mode: 0o700 });
  }
}

function validateUrl(url) {
  try {
    const parsed = new URL(url);
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return false;
    return Boolean(parsed.hostname);
  } catch (_) {
    return false;
  }
}

function isIsoString(value) {
  if (typeof value !== 'string' || value.trim() === '') return false;
  const ts = Date.parse(value);
  return Number.isFinite(ts);
}

function normalizeIntervalSeconds(entry) {
  if (typeof entry.intervalSeconds === 'number' && Number.isFinite(entry.intervalSeconds)) {
    return entry.intervalSeconds;
  }
  if (typeof entry.intervalMinutes === 'number' && Number.isFinite(entry.intervalMinutes)) {
    return entry.intervalMinutes * 60;
  }
  if (typeof entry.intervalMs === 'number' && Number.isFinite(entry.intervalMs)) {
    return entry.intervalMs / 1000;
  }
  return null;
}

function validateScheduleEntry(entry) {
  if (!entry || typeof entry !== 'object') return { valid: false, reason: 'entry is not an object' };
  const idOk = typeof entry.id === 'string' && entry.id.trim().length > 0;
  if (!idOk) return { valid: false, reason: 'id missing or invalid' };
  if (!validateUrl(entry.url)) return { valid: false, reason: 'url invalid' };

  const intervalSeconds = normalizeIntervalSeconds(entry);
  if (!intervalSeconds || intervalSeconds < MIN_INTERVAL_SECONDS || intervalSeconds > MAX_INTERVAL_SECONDS) {
    return { valid: false, reason: 'intervalSeconds out of bounds' };
  }

  if (entry.preset !== undefined && (typeof entry.preset !== 'string' || entry.preset.trim() === '')) {
    return { valid: false, reason: 'preset invalid' };
  }

  const enabled = entry.enabled === undefined ? true : Boolean(entry.enabled);
  const status = entry.status || (enabled ? 'running' : 'stopped');
  if (!['running', 'stopped', 'disabled'].includes(status)) {
    return { valid: false, reason: 'status invalid' };
  }

  if (entry.nextRunAt && !isIsoString(entry.nextRunAt)) {
    return { valid: false, reason: 'nextRunAt invalid' };
  }
  if (entry.createdAt && !isIsoString(entry.createdAt)) {
    return { valid: false, reason: 'createdAt invalid' };
  }
  if (entry.updatedAt && !isIsoString(entry.updatedAt)) {
    return { valid: false, reason: 'updatedAt invalid' };
  }

  return {
    valid: true,
    normalized: {
      id: entry.id,
      url: entry.url,
      preset: entry.preset,
      intervalSeconds,
      intervalMinutes: intervalSeconds / 60,
      intervalMs: intervalSeconds * 1000,
      nextRunAt: entry.nextRunAt || new Date(Date.now() + intervalSeconds * 1000).toISOString(),
      lastRunAt: entry.lastRunAt || null,
      status,
      enabled,
      createdAt: entry.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      backoffMs: entry.backoffMs && Number.isFinite(entry.backoffMs) ? entry.backoffMs : null,
      runCount: Number.isFinite(entry.runCount) ? entry.runCount : 0,
    }
  };
}

function quarantineState(reason) {
  ensureBaseDir();
  if (!fs.existsSync(STATE_FILE)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const quarantinePath = resolveWithinBase(BASE_DIR, 'quarantine state file', BASE_DIR, `${QUARANTINE_PREFIX}${stamp}.json`);
  fs.renameSync(STATE_FILE, quarantinePath);
  console.error(`Scheduler state quarantined (${reason}). Moved to ${quarantinePath}`);
  return quarantinePath;
}

function loadSchedulerState() {
  ensureBaseDir();
  if (!fs.existsSync(STATE_FILE)) {
    return { schedules: [], runner: null };
  }
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf-8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data.schedules)) {
      quarantineState('schedules not array');
      return { schedules: [], runner: null };
    }
    const validated = [];
    for (const entry of data.schedules) {
      const res = validateScheduleEntry(entry);
      if (!res.valid) {
        quarantineState(res.reason || 'invalid entry');
        return { schedules: [], runner: null };
      }
      validated.push(res.normalized);
    }
    return {
      schedules: validated,
      runner: data.runner || null,
      updatedAt: data.updatedAt || null,
    };
  } catch (err) {
    quarantineState(err.message || 'state parse error');
    return { schedules: [], runner: null };
  }
}

function saveSchedulerState(state) {
  ensureBaseDir();
  const payload = {
    schedules: state.schedules || [],
    runner: state.runner || null,
    updatedAt: new Date().toISOString(),
  };
  ensurePathWithinBase(BASE_DIR, STATE_FILE, 'scheduler state file');
  fs.writeFileSync(STATE_FILE, JSON.stringify(payload, null, 2), { encoding: 'utf-8', mode: 0o600 });
  return payload;
}

module.exports = {
  BASE_DIR,
  STATE_FILE,
  MIN_INTERVAL_SECONDS,
  MAX_INTERVAL_SECONDS,
  ALLOWED_PROTOCOLS,
  loadSchedulerState,
  saveSchedulerState,
  validateScheduleEntry,
  quarantineState,
  ensureBaseDir,
};
