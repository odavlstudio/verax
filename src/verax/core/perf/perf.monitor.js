/**
 * PHASE 21.9 — Performance Monitor
 * 
 * Monitors runtime, memory, event loop delay, and execution counters.
 * Records timestamped samples and peak values.
 */

import { getTimeProvider } from '../../../cli/util/support/time-provider.js';

/**
 * Performance Monitor
 */
export class PerformanceMonitor {
  constructor() {
    this.timeProvider = getTimeProvider();
    this.startTime = this.timeProvider.now();
    this.startMemory = process.memoryUsage();
    this.samples = [];
    this.peakMemoryRSS = this.startMemory.rss;
    this.peakMemoryHeapUsed = this.startMemory.heapUsed;
    this.peakMemoryHeapTotal = this.startMemory.heapTotal;
    this.peakEventLoopDelay = 0;
    
    // Counters
    this.pagesVisited = 0;
    this.interactionsExecuted = 0;
    
    // Phase tracking
    this.phaseStartTimes = {};
    this.phaseDurations = {};
    
    // Event loop monitoring
    this.eventLoopMonitor = null;
    this.lastEventLoopCheck = this.timeProvider.now();
    this.eventLoopDelays = [];
    
    this.startEventLoopMonitoring();
  }
  
  /**
   * Start event loop delay monitoring
   */
  startEventLoopMonitoring() {
    const checkInterval = 100; // Check every 100ms
    
    this.eventLoopMonitor = setInterval(() => {
      const now = this.timeProvider.now();
      const delay = now - this.lastEventLoopCheck - checkInterval;
      
      if (delay > 0) {
        this.eventLoopDelays.push(delay);
        if (delay > this.peakEventLoopDelay) {
          this.peakEventLoopDelay = delay;
        }
      }
      
      this.lastEventLoopCheck = now;
    }, checkInterval);
  }
  
  /**
   * Record a sample
   */
  sample(phase = null) {
    const now = this.timeProvider.now();
    const memory = process.memoryUsage();
    
    // Update peaks
    if (memory.rss > this.peakMemoryRSS) {
      this.peakMemoryRSS = memory.rss;
    }
    if (memory.heapUsed > this.peakMemoryHeapUsed) {
      this.peakMemoryHeapUsed = memory.heapUsed;
    }
    if (memory.heapTotal > this.peakMemoryHeapTotal) {
      this.peakMemoryHeapTotal = memory.heapTotal;
    }
    
    // Calculate average event loop delay
    const avgEventLoopDelay = this.eventLoopDelays.length > 0
      ? this.eventLoopDelays.reduce((a, b) => a + b, 0) / this.eventLoopDelays.length
      : 0;
    
    this.samples.push({
      timestamp: now,
      elapsedMs: now - this.startTime,
      phase,
      memory: {
        rss: memory.rss,
        heapUsed: memory.heapUsed,
        heapTotal: memory.heapTotal,
        external: memory.external
      },
      eventLoopDelay: avgEventLoopDelay,
      pagesVisited: this.pagesVisited,
      interactionsExecuted: this.interactionsExecuted
    });
    
    // Keep only last 1000 samples to avoid memory bloat
    if (this.samples.length > 1000) {
      this.samples.shift();
    }
    
    // Reset event loop delays array periodically
    if (this.eventLoopDelays.length > 100) {
      this.eventLoopDelays = this.eventLoopDelays.slice(-50);
    }
  }
  
  /**
   * Start a phase
   */
  startPhase(phaseName) {
    this.phaseStartTimes[phaseName] = this.timeProvider.now();
  }
  
  /**
   * End a phase
   */
  endPhase(phaseName) {
    if (this.phaseStartTimes[phaseName]) {
      const duration = this.timeProvider.now() - this.phaseStartTimes[phaseName];
      this.phaseDurations[phaseName] = (this.phaseDurations[phaseName] || 0) + duration;
      delete this.phaseStartTimes[phaseName];
    }
  }
  
  /**
   * Increment pages visited
   */
  incrementPages() {
    this.pagesVisited++;
    this.sample('PAGE_VISIT');
  }
  
  /**
   * Increment interactions executed
   */
  incrementInteractions() {
    this.interactionsExecuted++;
    this.sample('INTERACTION');
  }
  
  /**
   * Get current metrics
   */
  getCurrentMetrics() {
    const now = this.timeProvider.now();
    const memory = process.memoryUsage();
    const avgEventLoopDelay = this.eventLoopDelays.length > 0
      ? this.eventLoopDelays.reduce((a, b) => a + b, 0) / this.eventLoopDelays.length
      : 0;
    
    return {
      runtimeMs: now - this.startTime,
      memoryRSS: memory.rss,
      memoryHeapUsed: memory.heapUsed,
      memoryHeapTotal: memory.heapTotal,
      peakMemoryRSS: this.peakMemoryRSS,
      peakMemoryHeapUsed: this.peakMemoryHeapUsed,
      peakEventLoopDelay: this.peakEventLoopDelay,
      avgEventLoopDelay: avgEventLoopDelay,
      pagesVisited: this.pagesVisited,
      interactionsExecuted: this.interactionsExecuted,
      phaseDurations: { ...this.phaseDurations }
    };
  }
  
  /**
   * Get final report
   */
  getFinalReport() {
    const metrics = this.getCurrentMetrics();
    
    // Find slow phases
    const slowPhases = Object.entries(this.phaseDurations)
      .filter(([_, duration]) => duration > 5000) // Phases > 5s
      .map(([phase, duration]) => ({
        phase,
        durationMs: duration,
        percentage: (duration / metrics.runtimeMs) * 100
      }))
      .sort((a, b) => b.durationMs - a.durationMs);
    
    return {
      ...metrics,
      slowPhases,
      sampleCount: this.samples.length,
      samples: this.samples.slice(-100) // Last 100 samples only
    };
  }
  
  /**
   * Stop monitoring
   */
  stop() {
    if (this.eventLoopMonitor) {
      clearInterval(this.eventLoopMonitor);
      this.eventLoopMonitor = null;
    }
  }
}

/**
 * Create a performance monitor instance
 */
export function createPerformanceMonitor() {
  return new PerformanceMonitor();
}




