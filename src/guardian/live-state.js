/**
 * Live Guardian State Management
 * Manages scheduler state: running/stopped, interval, last run, next run
 * Now stores state in ~/.odavlguardian/state instead of project-local .odavlguardian
 */

const fs = require('fs');
const path = require('path');
const { getStateDir } = require('./runtime-root');

class LiveState {
  constructor(stateFile = null) {
    // If no stateFile provided, use runtime state directory
    if (!stateFile) {
      const stateDir = getStateDir();
      this.stateFile = path.join(stateDir, 'live-state.json');
    } else {
      this.stateFile = stateFile;
    }
    this.state = this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.stateFile)) {
        const data = fs.readFileSync(this.stateFile, 'utf8');
        return JSON.parse(data);
      }
    } catch (_e) {
      // Ignore parse errors; start fresh
    }
    return {
      running: false,
      intervalMinutes: null,
      lastRunTime: null,
      nextRunTime: null,
      lastRunId: null,
      baselineRunId: null,
      lastAlert: null
    };
  }

  save() {
    const dir = path.dirname(this.stateFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2));
  }

  start(intervalMinutes) {
    this.state.running = true;
    this.state.intervalMinutes = intervalMinutes;
    this.state.nextRunTime = Date.now() + intervalMinutes * 60 * 1000;
    this.save();
  }

  stop() {
    this.state.running = false;
    this.state.nextRunTime = null;
    this.save();
  }

  updateLastRun(runId) {
    this.state.lastRunTime = Date.now();
    this.state.lastRunId = runId;
    if (this.state.intervalMinutes) {
      this.state.nextRunTime = this.state.lastRunTime + this.state.intervalMinutes * 60 * 1000;
    }
    this.save();
  }

  setBaseline(runId) {
    this.state.baselineRunId = runId;
    this.save();
  }

  recordAlert(alert) {
    this.state.lastAlert = {
      timestamp: Date.now(),
      ...alert
    };
    this.save();
  }

  getStatus() {
    return {
      running: this.state.running,
      intervalMinutes: this.state.intervalMinutes,
      lastRunTime: this.state.lastRunTime ? new Date(this.state.lastRunTime).toISOString() : null,
      nextRunTime: this.state.nextRunTime ? new Date(this.state.nextRunTime).toISOString() : null,
      lastRunId: this.state.lastRunId,
      baselineRunId: this.state.baselineRunId,
      lastAlert: this.state.lastAlert
    };
  }

  isTimeForRun() {
    if (!this.state.running || !this.state.nextRunTime) {
      return false;
    }
    return Date.now() >= this.state.nextRunTime;
  }

  getState() {
    return { ...this.state };
  }
}

module.exports = { LiveState };
