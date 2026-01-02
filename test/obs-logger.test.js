const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createLogger } = require('../src/guardian/obs-logger');

let BASE_DIR = null;

beforeEach(() => {
  BASE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'guardian-logs-'));
});

test('basic command logging writes start and end entries', () => {
  const logger = createLogger({ command: 'smoke', url: 'http://example.com', runId: 't-basic', baseDir: BASE_DIR });
  logger.start({ command: 'smoke', url: 'http://example.com' });
  logger.end({ exitCode: 0 });

  assert.ok(logger.logPath.startsWith(BASE_DIR), 'log path must stay within base');
  assert.ok(fs.existsSync(logger.logPath), 'log file should exist');

  const lines = fs.readFileSync(logger.logPath, 'utf-8').trim().split(/\r?\n/);
  const start = JSON.parse(lines[0]);
  const end = JSON.parse(lines[lines.length - 1]);

  assert.ok(start.timestamp, 'start entry should include timestamp');
  assert.strictEqual(start.command, 'smoke');
  assert.strictEqual(end.exitCode, 0);
  assert.strictEqual(end.command, 'smoke');
});

test('error logging captures stack traces', () => {
  const logger = createLogger({ command: 'reality', runId: 't-error', baseDir: BASE_DIR });
  logger.error(new Error('boom'), { exitCode: 1 });

  const lines = fs.readFileSync(logger.logPath, 'utf-8').trim().split(/\r?\n/);
  const last = JSON.parse(lines[lines.length - 1]);

  assert.strictEqual(last.command, 'reality');
  assert.strictEqual(last.exitCode, 1);
  assert.ok(last.stack && last.stack.includes('boom'), 'stack trace must be present');
});

test('path containment is enforced for log file', () => {
  assert.throws(() => createLogger({ baseDir: BASE_DIR, logFileName: '../../escape.log' }), /artifacts base directory/i);
});
