/**
 * Live Scheduler (Phase A)
 * Local-first, time-based scheduler with persisted state.
 *
 * Schedules are stored under ~/.odavl-guardian/scheduler/schedules.json
 * Background runner: live-scheduler-runner.js (detached child process).
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');

const SCHED_DIR = path.join(os.homedir(), '.odavl-guardian', 'scheduler');
const STATE_FILE = path.join(SCHED_DIR, 'schedules.json');
const RUNNER_FILE = path.join(__dirname, 'live-scheduler-runner.js');

function ensureSchedDir() {
  if (!fs.existsSync(SCHED_DIR)) {
    fs.mkdirSync(SCHED_DIR, { recursive: true });
  }
}

function loadState() {
  ensureSchedDir();
  if (!fs.existsSync(STATE_FILE)) {
    return { schedules: [], runner: null };
  }
  try {
    const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    if (!data.schedules) data.schedules = [];
    return data;
  } catch (_err) {
    return { schedules: [], runner: null };
  }
}

function saveState(state) {
  ensureSchedDir();
  const data = {
    schedules: state.schedules || [],
    runner: state.runner || null,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 2), 'utf-8');
  return data;
}

function genId() {
  return crypto.randomBytes(8).toString('hex');
}

/**
 * Create and register a new schedule
 */
function createSchedule({ url, preset = 'saas', intervalMinutes }) {
  if (!url || typeof url !== 'string') throw new Error('url is required');
  if (!intervalMinutes || intervalMinutes <= 0) throw new Error('intervalMinutes must be > 0');

  const state = loadState();
  const id = genId();
  const now = Date.now();
  const nextRunAt = new Date(now + intervalMinutes * 60 * 1000).toISOString();

  const entry = {
    id,
    url,
    preset,
    intervalMinutes,
    status: 'running',
    lastRunAt: null,
    nextRunAt,
    createdAt: new Date().toISOString(),
  };

  state.schedules.push(entry);
  saveState(state);
  return entry;
}

/**
 * Stop a schedule by id
 */
function stopSchedule(id) {
  const state = loadState();
  const s = state.schedules.find(x => x.id === id);
  if (!s) throw new Error(`Schedule not found: ${id}`);
  s.status = 'stopped';
  saveState(state);
  return s;
}

/**
 * List schedules
 */
function listSchedules() {
  const state = loadState();
  return state.schedules;
}

/**
 * Check if runner pid is active
 */
function isRunnerActive(pid) {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

/**
 * Start background runner (detached)
 */
function startBackgroundRunner() {
  ensureSchedDir();
  const state = loadState();

  // Avoid multiple runners
  if (state.runner && isRunnerActive(state.runner.pid)) {
    return state.runner;
  }

  const nodeExec = process.execPath;
  const child = spawn(nodeExec, [RUNNER_FILE], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  const runnerInfo = {
    pid: child.pid,
    startedAt: new Date().toISOString(),
  };
  child.unref();

  state.runner = runnerInfo;
  saveState(state);
  return runnerInfo;
}

module.exports = {
  createSchedule,
  stopSchedule,
  listSchedules,
  startBackgroundRunner,
  loadState,
  saveState,
};
