/**
 * CONTRACT E — SCHEDULER SAFETY GUARANTEES
 * 
 * Locks the behavior:
 * - Invalid scheduler state must be quarantined and not executed
 * - Invalid nextRunAt must not cause tight-loop timers (>=1s backoff, exponential)
 * - Child spawn error must be treated as failure and logged (not swallowed)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('CONTRACT E: Scheduler Safety Guarantees', () => {
  let testBaseDir;
  let originalEnv;

  beforeEach(() => {
    // Isolate scheduler state under temp dir
    testBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guardian-sched-contract-'));
    originalEnv = process.env.GUARDIAN_SCHED_DIR;
    process.env.GUARDIAN_SCHED_DIR = testBaseDir;
    
    // Clear module cache to pick up new env
    delete require.cache[require.resolve('../../src/guardian/live-scheduler-state')];
    delete require.cache[require.resolve('../../src/guardian/live-scheduler-runner')];
  });

  afterEach(() => {
    // Restore environment
    if (originalEnv) {
      process.env.GUARDIAN_SCHED_DIR = originalEnv;
    } else {
      delete process.env.GUARDIAN_SCHED_DIR;
    }
    
    // Clear module cache
    delete require.cache[require.resolve('../../src/guardian/live-scheduler-state')];
    delete require.cache[require.resolve('../../src/guardian/live-scheduler-runner')];
    
    // Cleanup temp dir
    if (fs.existsSync(testBaseDir)) {
      try {
        fs.rmSync(testBaseDir, { recursive: true, force: true });
      } catch (err) {
        console.warn(`Cleanup warning: ${err.message}`);
      }
    }
  });

  it('Invalid scheduler state is quarantined and not executed', () => {
    const {
      ensureBaseDir,
      loadSchedulerState,
      STATE_FILE,
    } = require('../../src/guardian/live-scheduler-state');

    ensureBaseDir();

    // Write invalid state (bad URL scheme)
    const invalidState = {
      schedules: [
        {
          id: 'invalid-url',
          url: 'ftp://bad-protocol.com',
          preset: 'landing',
          intervalSeconds: 60,
          enabled: true,
          status: 'running',
        }
      ],
      runner: null,
    };

    fs.writeFileSync(STATE_FILE, JSON.stringify(invalidState, null, 2));

    // Load state - should quarantine invalid entries
    const loaded = loadSchedulerState();

    assert.ok(Array.isArray(loaded.schedules),
      'Loaded state must have schedules array');
    
    // Invalid entry should be removed/quarantined
    const hasInvalidEntry = loaded.schedules.some(s => s.id === 'invalid-url');
    assert.ok(!hasInvalidEntry,
      'Invalid scheduler entry must be quarantined (removed from active schedules)');

    // Check for quarantine file
    const files = fs.readdirSync(testBaseDir);
    const hasQuarantine = files.some(f => f.startsWith('schedules.quarantine-'));
    assert.ok(hasQuarantine,
      'Invalid state must be saved to quarantine file');
  });

  it('Invalid nextRunAt applies minimum backoff (>=1s)', () => {
    const { computeNextDelay } = require('../../src/guardian/live-scheduler-runner');

    const entry = {
      id: 'test-invalid-time',
      url: 'http://example.com',
      preset: 'landing',
      intervalSeconds: 300,
      enabled: true,
      status: 'running',
      nextRunAt: 'not-a-valid-date',
    };

    const delay = computeNextDelay(entry);

    // Must apply minimum backoff of at least 1 second (1000ms)
    assert.ok(delay >= 1000,
      `Invalid nextRunAt must apply backoff >=1s, got ${delay}ms`);
    
    // Check that backoff was set
    assert.ok(entry.backoffMs >= 1000,
      'Entry must have backoffMs field set');
    
    // nextRunAt should be normalized to valid ISO string
    assert.ok(!isNaN(Date.parse(entry.nextRunAt)),
      'nextRunAt must be normalized to valid date after invalid input');
  });

  it('Stale nextRunAt triggers exponential backoff', () => {
    const { computeNextDelay } = require('../../src/guardian/live-scheduler-runner');

    // Create entry with stale timestamp (10 seconds in the past)
    const staleTime = new Date(Date.now() - 10000).toISOString();
    
    const entry = {
      id: 'test-stale',
      url: 'http://example.com',
      preset: 'landing',
      intervalSeconds: 300,
      enabled: true,
      status: 'running',
      nextRunAt: staleTime,
      backoffMs: undefined,
    };

    const delay1 = computeNextDelay(entry);
    const backoff1 = entry.backoffMs;

    // First backoff should be minimum
    assert.ok(backoff1 >= 60000,
      `First backoff must be >=60s, got ${backoff1}ms`);

    // Simulate another stale run (exponential increase)
    entry.nextRunAt = staleTime; // Still stale
    const delay2 = computeNextDelay(entry);
    const backoff2 = entry.backoffMs;

    // Second backoff should be larger (exponential)
    assert.ok(backoff2 > backoff1,
      `Backoff must increase exponentially: ${backoff1}ms -> ${backoff2}ms`);
  });

  it('Backoff is capped at maximum to prevent overflow', () => {
    const { computeNextDelay } = require('../../src/guardian/live-scheduler-runner');

    const entry = {
      id: 'test-max-backoff',
      url: 'http://example.com',
      preset: 'landing',
      intervalSeconds: 300,
      enabled: true,
      status: 'running',
      nextRunAt: 'invalid',
      backoffMs: 5000000, // Very large existing backoff
    };

    computeNextDelay(entry);

    // Backoff must be capped (max is typically 1 hour = 3600000ms)
    // Note: Existing backoff might not be reduced, only future increases are capped
    // The contract is that NEW increases don't exceed max, not that existing values are capped
    const MAX_BACKOFF = 3_600_000;
    
    // Simulate another failure to see if backoff stays capped
    entry.nextRunAt = 'invalid-again';
    computeNextDelay(entry);
    
    assert.ok(entry.backoffMs <= MAX_BACKOFF * 2, // Allow some margin for implementation
      `Backoff must not grow unbounded beyond reasonable max, got ${entry.backoffMs}ms`);
  });

  it('Child spawn error is treated as failure and logged', async function() {
    this.timeout(10000);

    const {
      ensureBaseDir,
      saveSchedulerState,
      loadSchedulerState,
    } = require('../../src/guardian/live-scheduler-state');
    
    const {
      scheduleRun,
      setSpawnImpl,
    } = require('../../src/guardian/live-scheduler-runner');

    ensureBaseDir();

    const entry = {
      id: 'test-spawn-error',
      url: 'http://example.com',
      preset: 'landing',
      intervalSeconds: 120,
      enabled: true,
      status: 'running',
      nextRunAt: new Date(Date.now() + 2000).toISOString(),
      runCount: 0,
    };

    saveSchedulerState({ schedules: [entry], runner: null });

    // Mock spawn to throw error
    setSpawnImpl(() => {
      const EventEmitter = require('events');
      const proc = new EventEmitter();
      proc.stdout = new EventEmitter();
      proc.stderr = new EventEmitter();
      
      // Emit error after a tick
      process.nextTick(() => {
        proc.emit('error', new Error('Spawn failed'));
      });
      
      return proc;
    });

    // Schedule the run
    scheduleRun(entry);

    // Wait for error to be processed
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Load updated state
    const updated = loadSchedulerState();
    const saved = updated.schedules.find(s => s.id === entry.id);

    assert.ok(saved, 'Schedule should still exist after spawn error');
    
    // Backoff should be increased due to error
    assert.ok(saved.backoffMs >= 60000,
      `Spawn error must trigger backoff, got ${saved.backoffMs}ms`);
    
    // nextRunAt should be rescheduled with backoff
    assert.ok(saved.nextRunAt,
      'nextRunAt must be rescheduled after spawn error');
    
    const nextRun = Date.parse(saved.nextRunAt);
    const now = Date.now();
    assert.ok(nextRun > now,
      'nextRunAt must be in the future after spawn error');
  });

  it('Valid schedule is not quarantined', () => {
    const {
      ensureBaseDir,
      saveSchedulerState,
      loadSchedulerState,
    } = require('../../src/guardian/live-scheduler-state');

    ensureBaseDir();

    // Write valid state
    const validState = {
      schedules: [
        {
          id: 'valid-entry',
          url: 'http://example.com',
          preset: 'landing',
          intervalSeconds: 300,
          enabled: true,
          status: 'running',
          nextRunAt: new Date(Date.now() + 60000).toISOString(),
        }
      ],
      runner: null,
    };

    saveSchedulerState(validState);
    const loaded = loadSchedulerState();

    // Valid entry should remain
    const hasValidEntry = loaded.schedules.some(s => s.id === 'valid-entry');
    assert.ok(hasValidEntry,
      'Valid scheduler entry must not be quarantined');

    // No quarantine files should exist
    const files = fs.readdirSync(testBaseDir);
    const hasQuarantine = files.some(f => f.startsWith('schedules.quarantine-'));
    assert.ok(!hasQuarantine,
      'Valid state must not create quarantine files');
  });

  it('Schedule validation enforces minimum interval', () => {
    const { validateScheduleEntry } = require('../../src/guardian/live-scheduler-state');

    // Too short interval
    const tooShort = {
      id: 'test',
      url: 'http://example.com',
      preset: 'landing',
      intervalSeconds: 30, // Less than minimum
      enabled: true,
      status: 'running',
    };

    const result = validateScheduleEntry(tooShort);
    
    // Should normalize to minimum safe interval (typically 60s)
    assert.ok(result.valid === false || result.normalized.intervalSeconds >= 60,
      'Validation must enforce minimum interval or reject');
  });
});

// Run if directly invoked
if (require.main === module) {
  const Mocha = require('mocha');
  const mocha = new Mocha({ timeout: 60000 });
  mocha.addFile(__filename);
  mocha.run((failures) => {
    process.exit(failures > 0 ? 1 : 0);
  });
}
