/**
 * WEEK 4: Bounded memory strategies for collections
 *
 * This module enforces capacity limits on collections that grow unbounded:
 * - traces
 * - findings/silence entries
 * - coverage gaps
 * - logs
 *
 * Enforces VERAX law #5: No Hidden Behavior
 * Every cap enforcement is recorded as observable evidence.
 */

import { getTimeProvider } from '../cli/util/support/time-provider.js';

export class CapManager {
  constructor() {
    this.caps = new Map(); // collectionName -> { max, current, exceededAt }
    this.evidence = []; // Timeline of cap events
  }

  /**
   * Register a capacity limit for a collection
   */
  registerCap(collectionName, maxSize) {
    if (this.caps.has(collectionName)) {
      throw new Error(`[CAP-MANAGER] Duplicate cap registration: ${collectionName}`);
    }
    this.caps.set(collectionName, {
      max: maxSize,
      current: 0,
      exceededAt: null,
    });
    return { registered: true, collection: collectionName, max: maxSize };
  }

  /**
   * Record item addition to a collection (with enforcement)
   */
  recordAdd(collectionName, _item = null) {
    if (!this.caps.has(collectionName)) {
      throw new Error(`[CAP-MANAGER] Unknown collection: ${collectionName}`);
    }

    const cap = this.caps.get(collectionName);
    const willExceed = cap.current + 1 > cap.max;

    cap.current++;

    const evidence = {
      timestamp: getTimeProvider().now(),
      collection: collectionName,
      action: 'ADD',
      count: cap.current,
      maxAllowed: cap.max,
      exceeded: willExceed,
      message: willExceed 
        ? `CAPACITY REACHED: ${collectionName} exceeds limit of ${cap.max}`
        : undefined,
    };

    this.evidence.push(evidence);

    if (willExceed && !cap.exceededAt) {
      cap.exceededAt = getTimeProvider().now();
      return {
        added: true,
        capped: true,
        evidence,
      };
    }

    return {
      added: true,
      capped: false,
      evidence: willExceed ? evidence : undefined,
    };
  }

  /**
   * Record item removal from a collection
   */
  recordRemove(collectionName) {
    if (!this.caps.has(collectionName)) {
      throw new Error(`[CAP-MANAGER] Unknown collection: ${collectionName}`);
    }

    const cap = this.caps.get(collectionName);
    if (cap.current > 0) {
      cap.current--;
    }

    this.evidence.push({
      timestamp: getTimeProvider().now(),
      collection: collectionName,
      action: 'REMOVE',
      count: cap.current,
    });

    return { removed: true, count: cap.current };
  }

  /**
   * Check if collection is at capacity
   */
  isAtCapacity(collectionName) {
    if (!this.caps.has(collectionName)) {
      return false;
    }
    const cap = this.caps.get(collectionName);
    return cap.current >= cap.max;
  }

  /**
   * Get current state of all caps
   */
  getState() {
    const state = {};
    for (const [name, cap] of this.caps) {
      state[name] = {
        current: cap.current,
        max: cap.max,
        utilization: ((cap.current / cap.max) * 100).toFixed(2) + '%',
        exceededAt: cap.exceededAt,
      };
    }
    return state;
  }

  /**
   * Get evidence of capacity violations
   */
  getCapViolationEvidence() {
    return this.evidence.filter(e => e.exceeded);
  }

  /**
   * Get full timeline of cap events
   */
  getTimeline() {
    return this.evidence;
  }

  /**
   * Reset manager state (for testing)
   */
  reset() {
    this.caps.clear();
    this.evidence = [];
  }
}

/**
 * WEEK 4: Streaming writer for unbounded logs/traces
 * Instead of accumulating in memory, stream to disk with buffering
 */
export class StreamingCollector {
  constructor(filePath, bufferSize = 1000) {
    this.filePath = filePath;
    this.bufferSize = bufferSize;
    this.buffer = [];
    this.flushed = 0;
    this.totalWritten = 0;
  }

  /**
   * Add item to buffer, flush if full
   */
  async push(item) {
    this.buffer.push(item);
    if (this.buffer.length >= this.bufferSize) {
      return await this.flush();
    }
    return { buffered: true, bufferLength: this.buffer.length };
  }

  /**
   * Flush buffer to disk (async)
   */
  async flush() {
    if (this.buffer.length === 0) {
      return { flushed: false, reason: 'empty buffer' };
    }

    // In real implementation, write to file
    // For now, just track the count
    this.totalWritten += this.buffer.length;
    const written = this.buffer.length;
    this.buffer = [];

    return {
      flushed: true,
      itemsWritten: written,
      totalWritten: this.totalWritten,
    };
  }

  /**
   * Get collector stats
   */
  getStats() {
    return {
      filePath: this.filePath,
      bufferSize: this.bufferSize,
      currentBufferLength: this.buffer.length,
      totalWritten: this.totalWritten,
      bufferUtilization: ((this.buffer.length / this.bufferSize) * 100).toFixed(2) + '%',
    };
  }
}
