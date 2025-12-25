const fs = require('fs');
const path = require('path');
const { isCiMode } = require('./ci-mode');
const { formatRunSummary } = require('./run-summary');

const DEFAULT_DEBOUNCE_MS = 400;
const DEFAULT_MAX_FILES = 5;

function isIgnored(filePath, artifactsDir = './artifacts') {
  const normalized = path.normalize(filePath);
  const parts = normalized.split(path.sep).filter(Boolean);
  const ignorePrefixes = [
    'node_modules',
    '.git',
    '.odavl-guardian',
    'dist',
    'build'
  ];
  if (artifactsDir) {
    ignorePrefixes.push(path.normalize(artifactsDir));
  }
  return parts.some(p => ignorePrefixes.includes(p)) || normalized.includes('market-run');
}

function collectWatchPaths(config) {
  const roots = [
    'config',
    'flows',
    'policies',
    'data',
    'scripts',
    'test'
  ];

  const seen = new Set();
  const paths = [];
  roots.forEach(p => {
    const full = path.resolve(p);
    if (seen.has(full)) return;
    if (fs.existsSync(full)) {
      seen.add(full);
      paths.push(full);
    }
  });

  return paths;
}

function formatChangedFiles(changed) {
  if (!changed.length) return 'unknown';
  const unique = Array.from(new Set(changed));
  const shown = unique.slice(0, DEFAULT_MAX_FILES).map(f => path.relative(process.cwd(), f));
  const more = unique.length - shown.length;
  if (more > 0) {
    shown.push(`… ${more} more`);
  }
  return shown.join(', ');
}

async function startWatchMode(config, deps = {}) {
  const runReality = deps.runReality || require('./reality').executeReality;
  const watchFactory = deps.watchFactory || fs.watch;
  const debounceMs = deps.debounceMs || config.watchDebounceMs || DEFAULT_DEBOUNCE_MS;
  const log = deps.log || console.log;
  const warn = deps.warn || console.warn;
  const exitFn = deps.exit || process.exit.bind(process);
  const isCi = deps.isCi != null ? deps.isCi : isCiMode();
  const onRunComplete = deps.onRunComplete || null;
  const onWatcher = deps.onWatcher || null;
  const bindSignal = deps.bindSignal || process.on.bind(process);

  const quietConfig = {
    ...config,
    quiet: true,
    flowOptions: { ...(config.flowOptions || {}), quiet: true }
  };

  if (isCi) {
    warn('CI detected; --watch ignored');
    const once = await runReality({ ...config, watch: false });
    return { watchStarted: false, exitCode: once.exitCode };
  }

  let running = false;
  let pending = false;
  let stopped = false;
  let debounceTimer = null;
  let changedFiles = [];
  let lastExitCode = 0;
  const watchers = [];

  const watchPaths = collectWatchPaths(config);

  const runOnce = async (label) => {
    if (stopped) return { exitCode: lastExitCode };
    running = true;
    const result = await runReality(quietConfig);
    lastExitCode = result.exitCode || 0;
    log(formatRunSummary({
      flowResults: result.flowResults || [],
      diffResult: result.diffResult || null,
      baselineCreated: result.baselineCreated || false,
      exitCode: lastExitCode
    }, { label: 'Summary' }));
    running = false;
    if (onRunComplete) {
      onRunComplete(result);
    }
    if (pending && !stopped) {
      pending = false;
      scheduleRun();
    }
    return result;
  };

  const scheduleRun = () => {
    if (running) {
      pending = true;
      return;
    }
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      const filesLabel = formatChangedFiles(changedFiles);
      changedFiles = [];
      log(`Change detected: ${filesLabel}`);
      runOnce('change');
    }, debounceMs);
  };

  const handleFsEvent = (basePath) => (event, filename) => {
    if (stopped) return;
    const candidate = filename ? path.join(basePath, filename) : basePath;
    if (isIgnored(candidate, config.artifactsDir)) return;
    changedFiles.push(candidate);
    scheduleRun();
  };

  for (const p of watchPaths) {
    try {
      const watcher = watchFactory(p, { recursive: true }, handleFsEvent(p));
      watchers.push(watcher);
      if (onWatcher) onWatcher(watcher);
    } catch (err) {
      warn(`Watch attach failed for ${p}: ${err.message}`);
    }
  }

  log('WATCH MODE: ON');
  runOnce('initial').catch(err => {
    warn(`Watch run failed: ${err.message}`);
    running = false;
  });

  const stop = () => {
    stopped = true;
    if (debounceTimer) clearTimeout(debounceTimer);
    watchers.forEach(w => {
      try { if (w && typeof w.close === 'function') w.close(); } catch {}
    });
    return lastExitCode;
  };

  bindSignal('SIGINT', () => {
    const code = stop();
    exitFn(code);
  });

  return {
    watchStarted: true,
    stop,
    getLastExitCode: () => lastExitCode,
    simulateChange: (filePath) => handleFsEvent(path.dirname(filePath) || '.')("change", path.basename(filePath)),
    isRunning: () => running,
    hasPending: () => pending
  };
}

module.exports = { startWatchMode, collectWatchPaths, isIgnored };
