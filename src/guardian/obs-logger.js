/**
 * Central structured logger for Guardian
 * Writes JSON lines into a safe artifacts base directory.
 * Now defaults to ~/.odavlguardian/logs instead of project-local .odavlguardian/logs
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { resolveBaseDir, ensurePathWithinBase } = require('./path-safety');
const { getLogDir } = require('./runtime-root');

function ensureDir(p) {
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true, mode: 0o700 });
  }
}

function createLogger(options = {}) {
  const {
    command = 'unknown',
    url = null,
    verdict = null,
    exitCode = null,
    runId = crypto.randomBytes(8).toString('hex'),
    artifactsDir = null,
    baseDir: rawBaseDir = null,
    logFileName = null,
  } = options;

  // Resolve base directory for artifacts (may be custom path for tests)
  const baseDir = resolveBaseDir(rawBaseDir || artifactsDir);
  ensureDir(baseDir);
  
  // Determine log directory:
  // - If baseDir was explicitly provided, use baseDir/logs (for tests)
  // - Otherwise, use runtime log directory (~/.odavlguardian/logs)
  const logDir = (rawBaseDir || artifactsDir) 
    ? path.join(baseDir, 'logs')
    : getLogDir();
  ensureDir(logDir);
  
  const chosenLogName = logFileName || `run-${runId}.log`;
  const logFilePath = ensurePathWithinBase(baseDir, path.join(logDir, chosenLogName), 'log file');

  const baseEntry = {
    command,
    url,
    verdict,
    exitCode,
    runId,
  };

  function write(level, message, meta = {}) {
    try {
      const err = meta.error;
      const stack = err?.stack || (err instanceof Error ? err.stack : null);
      const entry = {
        ...baseEntry,
        ...meta,
        level,
        message,
        timestamp: new Date().toISOString(),
      };
      if (stack) {
        entry.stack = stack;
      }
      const line = JSON.stringify(entry);
      fs.appendFileSync(logFilePath, line + '\n', { encoding: 'utf-8' });
    } catch (writeErr) {
      // Last line of defense: surface to console to avoid silent loss
      console.error(`[logger] failed to write log: ${writeErr.message}`);
    }
  }

  function info(message, meta) {
    write('info', message, meta);
  }

  function warn(message, meta) {
    write('warn', message, meta);
  }

  function error(messageOrError, meta = {}) {
    const err = messageOrError instanceof Error ? messageOrError : new Error(String(messageOrError));
    write('error', err.message, { ...meta, error: err });
  }

  function start(meta) {
    info('start', meta);
  }

  function end(meta) {
    info('end', meta);
  }

  return {
    info,
    warn,
    error,
    start,
    end,
    logPath: logFilePath,
    runId,
  };
}

module.exports = {
  createLogger,
};
