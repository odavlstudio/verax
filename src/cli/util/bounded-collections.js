/**
 * Week 4 — Bounded Collection Management
 * 
 * Prevent unbounded memory growth:
 * - Explicit caps on arrays (traces, findings, logs)
 * - Streaming writes when possible (append-only)
 * - Cap violations recorded as evidence (not silent)
 */

import { getTimeProvider } from './support/time-provider.js';

/**
 * Bounded buffer with overflow tracking
 * Grows up to `capacity`, then records overflow events
 */
export class BoundedBuffer {
  constructor(name, capacity = 1000000) {
    this.name = name;
    this.capacity = capacity;
    this.items = [];
    this.overflowCount = 0;
    this.overflowFirstTime = null;
    this.totalItemsAttempted = 0;
  }

  /**
   * Add item to buffer
   * Returns true if added, false if capped
   */
  add(item) {
    this.totalItemsAttempted++;

    if (this.items.length >= this.capacity) {
      if (!this.overflowFirstTime) {
        this.overflowFirstTime = getTimeProvider().iso();
      }
      this.overflowCount++;
      return false; // Rejected
    }

    this.items.push(item);
    return true; // Accepted
  }

  /**
   * Get all items
   */
  getItems() {
    return this.items;
  }

  /**
   * Get buffer status
   */
  getStatus() {
    return {
      name: this.name,
      capacity: this.capacity,
      currentSize: this.items.length,
      overflowCount: this.overflowCount,
      overflowFirstTime: this.overflowFirstTime,
      totalAttempted: this.totalItemsAttempted,
      percentFull: ((this.items.length / this.capacity) * 100).toFixed(2)
    };
  }

  /**
   * Check if capacity exceeded
   */
  isCapped() {
    return this.overflowCount > 0;
  }

  /**
   * Clear buffer
   */
  clear() {
    this.items = [];
    this.overflowCount = 0;
    this.overflowFirstTime = null;
    this.totalItemsAttempted = 0;
  }
}

/**
 * Streaming writer for append-only data
 * Writes batches to disk, keeps in-memory buffer bounded
 */
export class StreamingWriter {
  constructor(filePath, batchSize = 100) {
    this.filePath = filePath;
    this.batchSize = batchSize;
    this.buffer = [];
    this.batchCount = 0;
    this.totalWritten = 0;
    this.isOpen = false;
  }

  /**
   * Queue item for writing
   */
  async append(item) {
    this.buffer.push(item);

    if (this.buffer.length >= this.batchSize) {
      await this.flush();
    }

    return true;
  }

  /**
   * Flush pending writes to disk
   */
  async flush() {
    if (this.buffer.length === 0) {
      return;
    }

    const { atomicWriteFileSync } = await import('./atomic-write.js');
    const itemsToWrite = this.buffer.splice(0, this.batchSize);

    for (const item of itemsToWrite) {
      const line = JSON.stringify(item) + '\n';
      // @ts-ignore - atomicWriteFileSync supports append option
      atomicWriteFileSync(this.filePath, line, { append: true });
      this.totalWritten++;
    }

    this.batchCount++;
  }

  /**
   * Get writer status
   */
  getStatus() {
    return {
      filePath: this.filePath,
      batchSize: this.batchSize,
      bufferSize: this.buffer.length,
      batchesWritten: this.batchCount,
      totalWritten: this.totalWritten
    };
  }

  /**
   * Finalize and close stream
   */
  async close() {
    await this.flush();
    this.isOpen = false;
  }
}

/**
 * Collection cap manager
 * Tracks and enforces limits across multiple collections
 */
export class CapManager {
  constructor() {
    this.caps = new Map(); // name → {limit, current, overflow}
    this.capsHit = [];
  }

  /**
   * Register a collection with capacity limit
   */
  registerCap(name, limit) {
    this.caps.set(name, {
      name,
      limit,
      current: 0,
      overflow: 0,
      overflowFirstTime: null
    });
  }

  /**
   * Check if collection is at capacity
   */
  checkAndIncrement(name) {
    const cap = this.caps.get(name);
    if (!cap) {
      throw new Error(`[CapManager] Collection not registered: ${name}`);
    }

    cap.current++;

    if (cap.current > cap.limit) {
      if (cap.overflow === 0) {
        cap.overflowFirstTime = getTimeProvider().iso();
        this.capsHit.push(name); // Record which caps were hit
      }
      cap.overflow++;
      return false; // At capacity
    }

    return true; // Not yet at capacity
  }

  /**
   * Get all cap statuses
   */
  getStatus() {
    const statuses = [];
    for (const [_name, cap] of this.caps) {
      statuses.push({
        name: cap.name,
        limit: cap.limit,
        current: cap.current,
        percentFull: ((cap.current / cap.limit) * 100).toFixed(2),
        overflow: cap.overflow,
        overflowFirstTime: cap.overflowFirstTime
      });
    }
    return {
      capsHit: this.capsHit,
      statuses
    };
  }

  /**
   * Generate evidence for caps hit
   */
  generateCapEvidence() {
    const evidence = {
      timestamp: getTimeProvider().iso(),
      capsHit: this.capsHit,
      details: this.getStatus()
    };
    return evidence;
  }

  /**
   * Reset manager
   */
  reset() {
    this.caps.clear();
    this.capsHit = [];
  }
}
