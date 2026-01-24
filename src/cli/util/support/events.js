import { getTimeProvider } from '../../../cli/util/support/time-provider.js';
/**
 * Event emitter for run progress
 */
export class RunEventEmitter {
  constructor() {
    this.events = [];
    this.listeners = [];
    this.heartbeatInterval = null;
    this.heartbeatStartTime = null;
    this.currentPhase = null;
    this.heartbeatIntervalMs = 2500; // 2.5 seconds
  }
  
  on(event, handler) {
    this.listeners.push({ event, handler });
  }
  
  emit(type, data = {}) {
    const event = {
      type,
      timestamp: getTimeProvider().iso(),
      ...data,
    };
    
    this.events.push(event);
    
    // Call registered listeners
    this.listeners.forEach(({ event: listenEvent, handler }) => {
      if (listenEvent === type || listenEvent === '*') {
        handler(event);
      }
    });
  }
  
  getEvents() {
    return this.events;
  }

  /**
   * Start heartbeat for a phase
   * @param {string} phase - Current phase name
   * @param {boolean} jsonMode - Whether in JSON output mode
   */
  startHeartbeat(phase, jsonMode = false) {
    this.currentPhase = phase;
    const provider = getTimeProvider();
    this.heartbeatStartTime = provider.now();
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      const elapsedMs = getTimeProvider().now() - this.heartbeatStartTime;
      const elapsedSeconds = Math.floor(elapsedMs / 1000);
      
      const heartbeatEvent = {
        type: 'heartbeat',
        phase: this.currentPhase,
        elapsedMs,
        elapsedSeconds,
        timestamp: getTimeProvider().iso(),
      };

      // Add to events array
      this.events.push(heartbeatEvent);

      // Emit to listeners
      this.listeners.forEach(({ event: listenEvent, handler }) => {
        if (listenEvent === 'heartbeat' || listenEvent === '*') {
          if (jsonMode) {
            // In JSON mode, emit as JSON line
            handler(heartbeatEvent);
          } else {
            // Human-readable format: single line, overwrite-friendly
            process.stdout.write(`\r…still working (phase=${this.currentPhase}, elapsed=${elapsedSeconds}s)`);
          }
        }
      });
    }, this.heartbeatIntervalMs);
    
    // CRITICAL: Unref the interval so it doesn't keep the process alive
    // This allows tests to exit cleanly even if stopHeartbeat() is not called
    if (this.heartbeatInterval && this.heartbeatInterval.unref) {
      this.heartbeatInterval.unref();
    }
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    // Clear the progress line in human mode
    process.stdout.write('\r' + ' '.repeat(60) + '\r');
    this.currentPhase = null;
    this.heartbeatStartTime = null;
  }

  /**
   * Update current phase for heartbeat
   * @param {string} phase - New phase name
   */
  updatePhase(phase) {
    this.currentPhase = phase;
    this.heartbeatStartTime = getTimeProvider().now();
  }
}



